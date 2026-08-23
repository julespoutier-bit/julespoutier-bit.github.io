/* =========================================================
   Jules Poutier — Portfolio CGI
   Local admin tool: edits data/site.json and writes media files
   directly to disk via the File System Access API (Chrome/Edge only).
   ========================================================= */

const state = {
  rootHandle: null,
  data: null,
  dirty: false,
};

/* ---------- IndexedDB: remember the picked folder handle ---------- */
const IDB_NAME = 'admin-fs-handles';
const IDB_STORE = 'handles';

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ---------- Filesystem helpers ---------- */
async function writeFileAtPath(relPath, file) {
  const parts = relPath.split('/');
  const fileName = parts.pop();
  let dir = state.rootHandle;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
}

async function removeProjectFolder(slug) {
  try {
    const projectsDir = await state.rootHandle
      .getDirectoryHandle('assets', { create: true })
      .then((d) => d.getDirectoryHandle('projects', { create: true }));
    await projectsDir.removeEntry(slug, { recursive: true });
  } catch (err) {
    /* folder may not exist yet (e.g. an archive-only project with no uploads) */
  }
}

function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : 'mp4';
}

function slugify(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

function ensureUniqueSlug(base) {
  const existing = new Set(state.data.projects.map((p) => p.slug));
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

function escapeAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  const unsupportedWarn = document.getElementById('unsupportedWarn');
  const pickFolderBtn = document.getElementById('pickFolderBtn');
  const saveBtn = document.getElementById('saveBtn');
  const statusText = document.getElementById('statusText');
  const adminMain = document.getElementById('adminMain');

  const homepageHeroInput = document.getElementById('homepageHeroInput');
  const homepageHeroName = document.getElementById('homepageHeroName');

  const aboutBio = document.getElementById('aboutBio');
  const experienceRowsEl = document.getElementById('experienceRows');
  const addExperienceRowBtn = document.getElementById('addExperienceRow');

  const newProjectBtn = document.getElementById('newProjectBtn');
  const projectListEl = document.getElementById('projectList');

  const projectRowTemplate = document.getElementById('projectRowTemplate');
  const blockTemplate = document.getElementById('blockTemplate');
  const mediaSlotTemplate = document.getElementById('mediaSlotTemplate');

  const breakdownCategoriesEl = document.getElementById('breakdownCategories');
  const breakdownCategoryTemplate = document.getElementById('breakdownCategoryTemplate');
  const breakdownItemTemplate = document.getElementById('breakdownItemTemplate');

  function setStatus(text) {
    statusText.textContent = text;
  }

  function markDirty() {
    state.dirty = true;
    saveBtn.disabled = false;
    setStatus('Unsaved changes.');
  }

  if (!('showDirectoryPicker' in window)) {
    unsupportedWarn.hidden = false;
    pickFolderBtn.disabled = true;
  }

  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  /* ---------- Load / save ---------- */
  async function useHandle(handle) {
    state.rootHandle = handle;
    const ok = await loadData();
    if (ok) {
      adminMain.hidden = false;
      setStatus(`Folder: ${handle.name}`);
    }
  }

  async function loadData() {
    try {
      const dataDir = await state.rootHandle.getDirectoryHandle('data', { create: true });
      const fileHandle = await dataDir.getFileHandle('site.json');
      const file = await fileHandle.getFile();
      state.data = JSON.parse(await file.text());
      renderAll();
      return true;
    } catch (err) {
      setStatus('data/site.json not found — pick the site\'s root folder (the one containing "data/").');
      return false;
    }
  }

  async function pickFolder() {
    try {
      const handle = await window.showDirectoryPicker();
      idbSet('root', handle).catch(() => {}); // best-effort — folder access must not depend on this
      await useHandle(handle);
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('Could not open folder: ' + err.message);
    }
  }

  async function tryRestoreHandle() {
    const handle = await idbGet('root').catch(() => null);
    if (!handle) return;
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      await useHandle(handle);
    } else {
      setStatus('Previously used folder needs to be reconnected — click "Choose site folder".');
    }
  }

  async function saveAll() {
    try {
      const dataDir = await state.rootHandle.getDirectoryHandle('data', { create: true });
      const fileHandle = await dataDir.getFileHandle('site.json', { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(state.data, null, 2));
      await writable.close();
      state.dirty = false;
      saveBtn.disabled = true;
      setStatus('Saved.');
    } catch (err) {
      setStatus('Save failed: ' + err.message);
    }
  }

  function renderAll() {
    renderHomepage();
    renderBreakdowns();
    renderExperience();
    aboutBio.value = state.data.about.bio || '';
    renderProjects();
  }

  /* ---------- Breakdowns ---------- */
  function renderBreakdowns() {
    breakdownCategoriesEl.innerHTML = '';
    state.data.breakdowns.categories.forEach((category) => {
      breakdownCategoriesEl.appendChild(buildBreakdownCategory(category));
    });
  }

  function buildBreakdownCategory(category) {
    const frag = breakdownCategoryTemplate.content.cloneNode(true);
    const wrap = frag.querySelector('.breakdown-category');
    wrap.querySelector('.breakdown-category__label').textContent = category.label;

    const listEl = wrap.querySelector('.breakdown-item-list');
    category.items.forEach((item, i) => {
      listEl.appendChild(buildBreakdownItem(category, item, i));
    });

    wrap.querySelector('.add-breakdown-item').addEventListener('click', () => {
      category.items.push({ title: '', video: null });
      markDirty();
      renderBreakdowns();
    });

    return wrap;
  }

  function buildBreakdownItem(category, item, index) {
    const frag = breakdownItemTemplate.content.cloneNode(true);
    const row = frag.querySelector('.breakdown-item');

    const titleInput = row.querySelector('.bi-title');
    titleInput.value = item.title || '';
    titleInput.addEventListener('input', () => { item.title = titleInput.value; markDirty(); });

    const nameEl = row.querySelector('.bi-name');
    nameEl.textContent = item.video || '(none)';

    row.querySelector('.bi-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const relPath = `assets/breakdowns/${category.key}/clip-${index}.${extOf(file.name)}`;
      await writeFileAtPath(relPath, file);
      item.video = relPath;
      nameEl.textContent = relPath;
      markDirty();
    });

    row.querySelector('.bi-delete').addEventListener('click', () => {
      category.items.splice(category.items.indexOf(item), 1);
      markDirty();
      renderBreakdowns();
    });

    return row;
  }

  /* ---------- Homepage ---------- */
  function renderHomepage() {
    homepageHeroName.textContent = state.data.homepageHero || '(none)';
  }

  homepageHeroInput.addEventListener('change', async () => {
    const file = homepageHeroInput.files[0];
    if (!file) return;
    const relPath = `assets/hero.${extOf(file.name)}`;
    await writeFileAtPath(relPath, file);
    state.data.homepageHero = relPath;
    homepageHeroName.textContent = relPath;
    markDirty();
  });

  /* ---------- About ---------- */
  aboutBio.addEventListener('input', () => {
    state.data.about.bio = aboutBio.value;
    markDirty();
  });

  function renderExperience() {
    experienceRowsEl.innerHTML = '';
    state.data.about.experience.forEach((row, i) => {
      const div = document.createElement('div');
      div.className = 'experience-row';
      div.innerHTML = `
        <input type="text" class="e-year" value="${escapeAttr(row.year)}" placeholder="Year">
        <input type="text" class="e-role" value="${escapeAttr(row.role)}" placeholder="Role">
        <input type="text" class="e-details" value="${escapeAttr(row.details)}" placeholder="Details">
        <button class="admin-btn admin-btn--icon e-delete" type="button">✕</button>
      `;
      div.querySelector('.e-year').addEventListener('input', (e) => { row.year = e.target.value; markDirty(); });
      div.querySelector('.e-role').addEventListener('input', (e) => { row.role = e.target.value; markDirty(); });
      div.querySelector('.e-details').addEventListener('input', (e) => { row.details = e.target.value; markDirty(); });
      div.querySelector('.e-delete').addEventListener('click', () => {
        state.data.about.experience.splice(i, 1);
        markDirty();
        renderExperience();
      });
      experienceRowsEl.appendChild(div);
    });
  }

  addExperienceRowBtn.addEventListener('click', () => {
    state.data.about.experience.push({ year: '', role: '', details: '' });
    markDirty();
    renderExperience();
  });

  /* ---------- Projects ---------- */
  function renderProjects() {
    const openSlugs = new Set(
      [...projectListEl.querySelectorAll('.project-row')]
        .filter((r) => r.querySelector('details')?.open)
        .map((r) => r.dataset.slug)
    );
    projectListEl.innerHTML = '';
    state.data.projects.forEach((project) => {
      const row = buildProjectRow(project);
      row.dataset.slug = project.slug;
      if (openSlugs.has(project.slug)) row.querySelector('details').open = true;
      projectListEl.appendChild(row);
    });
    wireDragReorder();
  }

  function buildProjectRow(project) {
    const frag = projectRowTemplate.content.cloneNode(true);
    const row = frag.querySelector('.project-row');

    const titleInput = row.querySelector('.p-title');
    titleInput.value = project.title;
    titleInput.addEventListener('input', () => { project.title = titleInput.value; markDirty(); });

    const yearInput = row.querySelector('.p-year');
    yearInput.value = project.year || '';
    yearInput.addEventListener('input', () => { project.year = yearInput.value; markDirty(); });

    const pinSelected = row.querySelector('.p-pin-selected');
    pinSelected.checked = !!project.pinned.selectedProjects;
    pinSelected.addEventListener('change', () => { project.pinned.selectedProjects = pinSelected.checked; markDirty(); });

    const pinArchives = row.querySelector('.p-pin-archives');
    pinArchives.checked = !!project.pinned.archives;
    pinArchives.addEventListener('change', () => { project.pinned.archives = pinArchives.checked; markDirty(); });

    row.querySelector('.p-delete').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!confirm(`Delete "${project.title}"? This also deletes its assets folder from disk.`)) return;
      await removeProjectFolder(project.slug);
      state.data.projects.splice(state.data.projects.indexOf(project), 1);
      markDirty();
      renderProjects();
    });

    const heroInput = row.querySelector('.p-hero-input');
    const heroName = row.querySelector('.p-hero-name');
    heroName.textContent = project.hero || '(none)';
    heroInput.addEventListener('change', async () => {
      const file = heroInput.files[0];
      if (!file) return;
      const relPath = `assets/projects/${project.slug}/hero.${extOf(file.name)}`;
      await writeFileAtPath(relPath, file);
      project.hero = relPath;
      heroName.textContent = relPath;
      markDirty();
    });

    const blockList = row.querySelector('.block-list');
    project.blocks.forEach((block) => {
      blockList.appendChild(buildBlockEditor(project, block));
    });

    row.querySelector('.add-block').addEventListener('click', () => {
      project.blocks.push({ mediaCount: 1, textPosition: 'left', text: '', media: [null] });
      markDirty();
      renderProjects();
    });

    return row;
  }

  function buildBlockEditor(project, block) {
    const frag = blockTemplate.content.cloneNode(true);
    const wrap = frag.querySelector('.block-editor');

    const mediaCountSel = wrap.querySelector('.b-media-count');
    mediaCountSel.value = String(block.mediaCount || 0);

    const textPosSel = wrap.querySelector('.b-text-position');
    textPosSel.value = block.textPosition || 'left';
    textPosSel.disabled = !block.mediaCount;

    const textArea = wrap.querySelector('.b-text');
    textArea.value = block.text || '';
    textArea.addEventListener('input', () => { block.text = textArea.value; markDirty(); });

    const slotsEl = wrap.querySelector('.b-media-slots');
    renderMediaSlots(project, block, slotsEl);

    mediaCountSel.addEventListener('change', () => {
      const n = Number(mediaCountSel.value);
      block.mediaCount = n;
      textPosSel.disabled = !n;
      const media = block.media || [];
      block.media = Array.from({ length: n }, (_, i) => media[i] || null);
      markDirty();
      renderMediaSlots(project, block, slotsEl);
    });
    textPosSel.addEventListener('change', () => { block.textPosition = textPosSel.value; markDirty(); });

    wrap.querySelector('.b-up').addEventListener('click', () => {
      const i = project.blocks.indexOf(block);
      if (i <= 0) return;
      [project.blocks[i - 1], project.blocks[i]] = [project.blocks[i], project.blocks[i - 1]];
      markDirty();
      renderProjects();
    });
    wrap.querySelector('.b-down').addEventListener('click', () => {
      const i = project.blocks.indexOf(block);
      if (i === -1 || i === project.blocks.length - 1) return;
      [project.blocks[i + 1], project.blocks[i]] = [project.blocks[i], project.blocks[i + 1]];
      markDirty();
      renderProjects();
    });
    wrap.querySelector('.b-delete').addEventListener('click', () => {
      project.blocks.splice(project.blocks.indexOf(block), 1);
      markDirty();
      renderProjects();
    });

    return wrap;
  }

  function renderMediaSlots(project, block, container) {
    container.innerHTML = '';
    if (!block.mediaCount) return;
    block.media = block.media || [];
    for (let i = 0; i < block.mediaCount; i++) {
      const frag = mediaSlotTemplate.content.cloneNode(true);
      const slot = frag.querySelector('.media-slot');
      const nameEl = slot.querySelector('.m-name');
      const item = block.media[i];
      nameEl.textContent = item ? item.src : '(empty)';
      const fileInput = slot.querySelector('.m-file');
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        const blockIndex = project.blocks.indexOf(block);
        const relPath = `assets/projects/${project.slug}/block-${blockIndex}-${i}.${extOf(file.name)}`;
        await writeFileAtPath(relPath, file);
        const type = file.type.startsWith('video/') ? 'video' : 'image';
        block.media[i] = { type, src: relPath };
        nameEl.textContent = relPath;
        markDirty();
      });
      container.appendChild(slot);
    }
  }

  function wireDragReorder() {
    let srcSlug = null;
    projectListEl.querySelectorAll('.project-row').forEach((row) => {
      row.addEventListener('dragstart', () => {
        srcSlug = row.dataset.slug;
        row.classList.add('is-dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('is-dragging'));
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const destSlug = row.dataset.slug;
        if (!srcSlug || srcSlug === destSlug) return;
        const projects = state.data.projects;
        const srcIndex = projects.findIndex((p) => p.slug === srcSlug);
        const destIndex = projects.findIndex((p) => p.slug === destSlug);
        const [moved] = projects.splice(srcIndex, 1);
        projects.splice(destIndex, 0, moved);
        markDirty();
        renderProjects();
      });
    });
  }

  newProjectBtn.addEventListener('click', async () => {
    const title = prompt('Project title:');
    if (!title || !title.trim()) return;
    const slug = ensureUniqueSlug(slugify(title.trim()));
    state.data.projects.push({
      slug,
      title: title.trim(),
      year: '',
      hero: null,
      pinned: { selectedProjects: false, archives: false },
      blocks: [],
    });
    await state.rootHandle
      .getDirectoryHandle('assets', { create: true })
      .then((d) => d.getDirectoryHandle('projects', { create: true }))
      .then((d) => d.getDirectoryHandle(slug, { create: true }));
    markDirty();
    renderProjects();
  });

  /* ---------- Wire top bar ---------- */
  pickFolderBtn.addEventListener('click', pickFolder);
  saveBtn.addEventListener('click', saveAll);

  tryRestoreHandle();
});

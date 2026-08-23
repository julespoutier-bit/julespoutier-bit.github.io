/* =========================================================
   Jules Poutier — Portfolio CGI
   Renders pages marked with <body data-render="..."> from data/site.json,
   then hands off to window.initSite() (js/main.js) once the DOM is ready.
   ========================================================= */

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function posterCardHtml(project) {
  const media = project.hero
    ? `<video class="poster-card__video" muted loop playsinline preload="metadata"><source src="${escapeHtml(project.hero)}" type="video/mp4"></video>`
    : '';
  const caption = project.title ? `<p class="poster-card__caption">${escapeHtml(project.title)}</p>` : '';
  return `<a class="poster-card" href="project.html?slug=${encodeURIComponent(project.slug)}">
    <div class="poster-card__media">${media}</div>
    ${caption}
  </a>`;
}

function workCardHtml(project, { showDate = false } = {}) {
  const media = project.hero
    ? `<video class="work-card__video" muted loop playsinline preload="metadata"><source src="${escapeHtml(project.hero)}" type="video/mp4"></video>`
    : '';
  const dateSpan = showDate && project.year ? `<span class="work-card__date">${escapeHtml(project.year)}</span>` : '';
  return `<a class="work-card" href="project.html?slug=${encodeURIComponent(project.slug)}">
    <div class="work-card__media">${media}</div>
    <p class="work-card__caption">${escapeHtml(project.title)}${dateSpan}</p>
  </a>`;
}

function breakdownCardHtml(item) {
  const media = item.video
    ? `<video class="work-card__video" muted loop playsinline preload="metadata"><source src="${escapeHtml(item.video)}" type="video/mp4"></video>`
    : '';
  return `<a class="work-card" href="#" data-lightbox-video>
    <div class="work-card__media">${media}</div>
    <p class="work-card__caption">${escapeHtml(item.title)}</p>
  </a>`;
}

function breakdownCategoryHtml(category) {
  return `<section class="section--tight">
    <span class="grid-section-label">${escapeHtml(category.label)}</span>
    <div class="work-grid work-grid--4">${category.items.map(breakdownCardHtml).join('')}</div>
  </section>`;
}

function mediaItemHtml(item) {
  if (!item || !item.src) return '<div class="project-block__media-item"></div>';
  if (item.type === 'image') {
    return `<div class="project-block__media-item"><img src="${escapeHtml(item.src)}" alt=""></div>`;
  }
  return `<div class="project-block__media-item" data-lightbox-video><video muted loop playsinline preload="metadata"><source src="${escapeHtml(item.src)}" type="video/mp4"></video></div>`;
}

function blockHtml(block) {
  const mediaCount = block.mediaCount || 0;
  const textPosition = mediaCount > 0 ? (block.textPosition || 'left') : null;

  const textHtml = (mediaCount === 0 || textPosition !== 'none')
    ? `<div class="project-block__text"><p>${escapeHtml(block.text || '')}</p></div>`
    : '';

  let mediaHtml = '';
  if (mediaCount === 1) {
    mediaHtml = `<div class="project-block__media">${mediaItemHtml((block.media || [])[0])}</div>`;
  } else if (mediaCount > 1) {
    const items = block.media || [];
    const cells = Array.from({ length: mediaCount }, (_, i) => mediaItemHtml(items[i])).join('');
    mediaHtml = `<div class="project-block__media"><div class="project-block__media-grid" data-count="${mediaCount}">${cells}</div></div>`;
  }

  const inner = mediaCount === 0
    ? textHtml
    : textPosition === 'right' ? mediaHtml + textHtml
    : textPosition === 'none' ? mediaHtml
    : textHtml + mediaHtml;

  const dataText = mediaCount === 0 ? '' : ` data-text="${textPosition}"`;
  return `<div class="project-block reveal" data-media-count="${mediaCount}"${dataText}>${inner}</div>`;
}

function navCollectionFor(data, project) {
  if (project.pinned.selectedProjects) return data.projects.filter((p) => p.pinned.selectedProjects);
  if (project.pinned.archives) return data.projects.filter((p) => p.pinned.archives);
  return null;
}

const RENDERERS = {
  home(data) {
    const heroSource = document.querySelector('.hero-video source');
    if (heroSource && data.homepageHero) heroSource.src = data.homepageHero;
    const heroVideo = document.querySelector('.hero-video__el');
    if (heroVideo) heroVideo.load();

    const track = document.getElementById('selectedProjectsTrack');
    if (track) {
      track.innerHTML = data.projects
        .filter((p) => p.pinned.selectedProjects)
        .map(posterCardHtml)
        .join('');
    }
  },

  projects(data) {
    const grid = document.getElementById('selectedProjectsGrid');
    if (!grid) return;
    grid.innerHTML = data.projects
      .filter((p) => p.pinned.selectedProjects)
      .map((p) => workCardHtml(p))
      .join('');
  },

  breakdown(data) {
    const container = document.getElementById('breakdownCategories');
    if (!container) return;
    container.innerHTML = data.breakdowns.categories.map(breakdownCategoryHtml).join('');
  },

  archive(data) {
    const grid = document.getElementById('archiveGrid');
    if (!grid) return;
    grid.innerHTML = data.projects
      .filter((p) => p.pinned.archives)
      .map((p) => workCardHtml(p, { showDate: true }))
      .join('');
  },

  about(data) {
    const bio = document.querySelector('.about-bio');
    if (bio) bio.textContent = data.about.bio;

    const tbody = document.getElementById('aboutTableBody');
    if (tbody) {
      tbody.innerHTML = data.about.experience
        .map((row) => `<tr><td>${escapeHtml(row.year)}</td><td>${escapeHtml(row.role)}</td><td>${escapeHtml(row.details)}</td></tr>`)
        .join('');
    }
  },

  project(data) {
    const slug = new URLSearchParams(location.search).get('slug');
    const project = data.projects.find((p) => p.slug === slug);

    if (!project) {
      const main = document.querySelector('main');
      if (main) main.innerHTML = '<section class="section"><div class="container"><p class="lede">Project not found.</p></div></section>';
      return;
    }

    document.title = `${project.title} — Jules Poutier`;

    const heroSection = document.getElementById('projectHero');
    if (heroSection) {
      heroSection.innerHTML = project.hero
        ? `<video class="hero-video__el" autoplay muted loop playsinline><source src="${escapeHtml(project.hero)}" type="video/mp4"></video>`
        : '';
    }

    const navSlot = document.getElementById('projectNavSlot');
    if (navSlot) {
      const collection = navCollectionFor(data, project);
      if (collection && collection.length > 1) {
        const idx = collection.indexOf(project);
        const prev = collection[(idx - 1 + collection.length) % collection.length];
        const next = collection[(idx + 1) % collection.length];
        navSlot.innerHTML = `<nav class="project-nav">
          <a class="project-nav__prev" href="project.html?slug=${encodeURIComponent(prev.slug)}">&lt; ${escapeHtml(prev.title)}</a>
          <span class="project-nav__current">${escapeHtml(project.title)}</span>
          <a class="project-nav__next" href="project.html?slug=${encodeURIComponent(next.slug)}">${escapeHtml(next.title)} &gt;</a>
        </nav>`;
      } else {
        navSlot.innerHTML = '';
      }
    }

    const blocksSlot = document.getElementById('projectBlocks');
    if (blocksSlot) {
      blocksSlot.innerHTML = project.blocks.map(blockHtml).join('');
    }
  },
};

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.render;
  if (!page) return;

  fetch('data/site.json')
    .then((r) => r.json())
    .then((data) => {
      RENDERERS[page]?.(data);
    })
    .catch((err) => console.error('Failed to load data/site.json', err))
    .finally(() => window.initSite());
});

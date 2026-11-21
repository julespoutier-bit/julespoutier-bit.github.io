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

function rotateAttr(project) {
  return project.heroRotate ? ` data-rotate="${project.heroRotate}"` : '';
}

/* Shown as the video's own poster frame until it has one of its own — unlike
   a CSS background, this paints reliably on mobile browsers while the video
   is still loading. A small inline gradient, no extra request. */
const MEDIA_POSTER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0%25' stop-color='%23ececec'/%3E%3Cstop offset='45%25' stop-color='%23e2e2e2'/%3E%3Cstop offset='70%25' stop-color='%23e8e8e8'/%3E%3Cstop offset='100%25' stop-color='%23ececec'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='300' fill='url(%23g)'/%3E%3C/svg%3E";

function posterCardHtml(project) {
  const media = project.hero
    ? `<video class="poster-card__video" muted loop playsinline preload="metadata" poster="${escapeHtml(project.poster) || MEDIA_POSTER}"${rotateAttr(project)}><source src="${escapeHtml(project.hero)}" type="video/mp4"></video>`
    : '';
  const caption = project.title ? `<p class="poster-card__caption">${escapeHtml(project.title)}</p>` : '';
  return `<a class="poster-card" href="project.html?slug=${encodeURIComponent(project.slug)}">
    <div class="poster-card__media">${media}</div>
    ${caption}
  </a>`;
}

function workCardHtml(project, { showDate = false, hoverPlay = false } = {}) {
  const media = project.hero
    ? `<video class="work-card__video" muted loop playsinline preload="metadata" poster="${escapeHtml(project.poster) || MEDIA_POSTER}"${rotateAttr(project)}><source src="${escapeHtml(project.hero)}" type="video/mp4"></video>`
    : '';
  const dateSpan = showDate && project.year ? `<span class="work-card__date">${escapeHtml(project.year)}</span>` : '';
  const cls = hoverPlay ? 'work-card work-card--hover-play' : 'work-card';
  return `<a class="${cls}" href="project.html?slug=${encodeURIComponent(project.slug)}">
    <div class="work-card__media">${media}</div>
    <p class="work-card__caption">${escapeHtml(project.title)}${dateSpan}</p>
  </a>`;
}

function breakdownCardHtml(item) {
  const media = item.video
    ? `<video class="work-card__video" muted loop playsinline preload="metadata" poster="${escapeHtml(item.poster) || MEDIA_POSTER}"><source src="${escapeHtml(item.video)}" type="video/mp4"></video>`
    : '';
  return `<a class="work-card work-card--hover-play" href="#" data-lightbox-video>
    <div class="work-card__media">${media}</div>
    <p class="work-card__caption">${escapeHtml(item.title)}</p>
  </a>`;
}

function breakdownCategoryHtml(category) {
  return `<section class="section--tight">
    <span class="grid-section-label">${escapeHtml(category.label)}</span>
    <div class="work-grid">${category.items.map(breakdownCardHtml).join('')}</div>
  </section>`;
}

const RATIO_CSS = { '1:1': '1 / 1', '4:3': '4 / 3', '3:4': '3 / 4', '16:9': '16 / 9', '9:16': '9 / 16' };

function mediaItemHtml(item) {
  if (!item || !item.src) return '<div class="project-block__media-item"></div>';
  // A "big" item spans the grid instead of sizing to its own ratio — skip the inline ratio.
  const style = !item.big && RATIO_CSS[item.ratio] ? ` style="aspect-ratio:${RATIO_CSS[item.ratio]}"` : '';
  const bigAttr = item.big ? ' data-big="1"' : '';
  if (item.type === 'image') {
    return `<div class="project-block__media-item"${style}${bigAttr}><img src="${escapeHtml(item.src)}" alt=""></div>`;
  }
  return `<div class="project-block__media-item"${style}${bigAttr} data-lightbox-video><video muted loop playsinline preload="metadata" poster="${MEDIA_POSTER}"><source src="${escapeHtml(item.src)}" type="video/mp4"></video></div>`;
}

function mediaColHtml(count, items, columns) {
  items = items || [];
  if (count === 1) return `<div class="project-block__media">${mediaItemHtml(items[0])}</div>`;
  const hasBig = items.some((i) => i && i.big);
  const cells = Array.from({ length: count }, (_, i) => mediaItemHtml(items[i])).join('');
  const bigAttr = hasBig ? ' data-big-layout="1"' : '';
  const columnsAttr = columns ? ` data-columns="${columns}"` : '';
  return `<div class="project-block__media"><div class="project-block__media-grid" data-count="${count}"${bigAttr}${columnsAttr}>${cells}</div></div>`;
}

/* Blocks compose their text as "Title\n\nBody" (see combineText at build time);
   render the title as a heading and the rest as a normal paragraph. */
function textBodyHtml(text) {
  text = text || '';
  const sep = text.indexOf('\n\n');
  if (sep === -1) return `<p>${escapeHtml(text)}</p>`;
  const title = text.slice(0, sep);
  const body = text.slice(sep + 2);
  return `<p class="project-block__title">${escapeHtml(title)}</p>${body ? `<p>${escapeHtml(body)}</p>` : ''}`;
}

function blockHtml(block) {
  const mediaCount = block.mediaCount || 0;

  // Two independent media columns, side by side, no text.
  if (block.textPosition === 'split') {
    const inner = mediaColHtml(mediaCount, block.media) + mediaColHtml(block.mediaCount2 || 0, block.media2);
    return `<div class="project-block reveal" data-media-count="${mediaCount}" data-text="split">${inner}</div>`;
  }

  const textPosition = mediaCount > 0 ? (block.textPosition || 'left') : null;
  const textWidthAttr = block.textWidth === 'narrow' ? ' data-text-width="narrow"' : '';

  const textHtml = (mediaCount === 0 || textPosition !== 'none')
    ? `<div class="project-block__text"${textWidthAttr}>${textBodyHtml(block.text)}</div>`
    : '';

  const mediaHtml = mediaCount > 0 ? mediaColHtml(mediaCount, block.media, block.mediaColumns) : '';

  const inner = mediaCount === 0
    ? textHtml
    : textPosition === 'right' ? mediaHtml + textHtml
    : textPosition === 'none' ? mediaHtml
    : textHtml + mediaHtml;

  const dataText = mediaCount === 0 ? '' : ` data-text="${textPosition}"`;
  return `<div class="project-block reveal" data-media-count="${mediaCount}"${dataText}>${inner}</div>`;
}

/* A hero video filmed/rendered sideways: rotate it in place, measuring the
   hero box itself so the rotated video still covers it exactly (full-bleed
   or ratio-boxed alike), and keep it covered across resizes. */
function applyHeroRotation(section, video, deg) {
  if (!deg) {
    video.classList.remove('is-rotated');
    video.style.width = '';
    video.style.height = '';
    video.style.transform = '';
    return;
  }
  video.classList.add('is-rotated');
  const sync = () => {
    const r = section.getBoundingClientRect();
    video.style.width = `${r.height}px`;
    video.style.height = `${r.width}px`;
    video.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
  };
  sync();
  if (!section._heroRotationObserver) {
    section._heroRotationObserver = new ResizeObserver(sync);
    section._heroRotationObserver.observe(section);
  }
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
      .map((p) => workCardHtml(p, { showDate: true, hoverPlay: true }))
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
        ? `<video class="hero-video__el" autoplay muted loop playsinline poster="${escapeHtml(project.poster) || MEDIA_POSTER}"><source src="${escapeHtml(project.hero)}" type="video/mp4"></video>`
        : '';
      heroSection.toggleAttribute('data-lightbox-video', !!project.hero);
      if (project.heroRotate) heroSection.setAttribute('data-rotate', project.heroRotate);
      else heroSection.removeAttribute('data-rotate');
      heroSection.classList.toggle('has-ratio', !!RATIO_CSS[project.heroRatio]);
      heroSection.style.aspectRatio = RATIO_CSS[project.heroRatio] || '';
      const heroVideoEl = heroSection.querySelector('.hero-video__el');
      if (heroVideoEl) applyHeroRotation(heroSection, heroVideoEl, project.heroRotate);
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

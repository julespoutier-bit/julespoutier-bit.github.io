/* =========================================================
   Jules Poutier — Portfolio CGI
   Script principal (partagé par toutes les pages)
   ========================================================= */

/* Pages that render their content from data/site.json (data-render on <body>)
   call this themselves once the DOM is populated, instead of relying on
   DOMContentLoaded — every init below takes a static DOM snapshot with no
   delegation, so it must run AFTER dynamic content exists. */
window.initSite = function initSite() {
  setActiveNavLink();
  initHeaderContrast();
  initMobileNav();
  initCustomCursor();
  initScrollReveal();
  initScrollPosters();
  initCardRotations();
  initHoverVideos();
  initAutoplayVideos();
  initVideoLightbox();
  initFooterYear();
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.hasAttribute('data-render')) return;
  window.initSite();
});

/* ---------- Header contrast: white over the hero video, black once past it ---------- */
function initHeaderContrast() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const hero = document.querySelector('.hero-video');
  if (!hero) {
    header.classList.add('is-on-light');
    return;
  }

  function update() {
    const heroBottom = hero.getBoundingClientRect().bottom;
    header.classList.toggle('is-on-light', heroBottom <= header.offsetHeight);
  }

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* ---------- Custom cursor ---------- */
function initCustomCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const cursor = document.createElement('div');
  cursor.className = 'cursor-arrow is-hidden';
  cursor.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M16 9.16 L7 12 L16 15.73" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="butt" stroke-linejoin="miter"/></svg>';
  document.body.appendChild(cursor);

  window.addEventListener('mousemove', (e) => {
    cursor.style.left = `${e.clientX - 6}px`;
    cursor.style.top = `${e.clientY - 11}px`;
    cursor.classList.remove('is-hidden');
  });
  document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
}

/* ---------- Nav active state ---------- */
function setActiveNavLink() {
  const current = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = link.getAttribute('href');
    if (href === current) link.classList.add('is-active');
  });
}

/* ---------- Mobile nav toggle ---------- */
function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('is-open');
    toggle.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  links.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      links.classList.remove('is-open');
      toggle.classList.remove('is-open');
      document.body.style.overflow = '';
    });
  });
}

/* ---------- Scroll reveal ---------- */
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  items.forEach((el) => observer.observe(el));
}

/* ---------- Poster bands: horizontal scroll driven by vertical scroll, eased ---------- */
function initScrollPosters() {
  const sections = [...document.querySelectorAll('.poster-section')]
    .map((section) => ({
      section,
      sticky: section.querySelector('.poster-sticky'),
      track: section.querySelector('.poster-track'),
      scrollDistance: 0,
      current: 0,
      target: 0,
    }))
    .filter((s) => s.sticky && s.track);

  if (!sections.length) return;

  function layout() {
    sections.forEach((s) => {
      s.scrollDistance = Math.max(s.track.scrollWidth - s.sticky.clientWidth, 0);
      s.section.style.height = `${s.sticky.clientHeight + s.scrollDistance}px`;
    });
  }

  function computeTargets() {
    sections.forEach((s) => {
      if (!s.scrollDistance) {
        s.target = 0;
        return;
      }
      const rect = s.section.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / s.scrollDistance, 0), 1);
      s.target = progress * s.scrollDistance;
    });
  }

  function tick() {
    computeTargets();
    sections.forEach((s) => {
      s.current += (s.target - s.current) * 0.08;
      if (Math.abs(s.target - s.current) < 0.05) s.current = s.target;
      s.track.style.transform = `translateX(${-s.current}px)`;
    });
    requestAnimationFrame(tick);
  }

  layout();
  window.addEventListener('resize', layout);
  requestAnimationFrame(tick);
}

/* ---------- Card thumbnails: a hero filmed/rendered sideways, rotated in place ---------- */
function initCardRotations() {
  document.querySelectorAll('video[data-rotate]').forEach((video) => {
    const deg = Number(video.dataset.rotate);
    const container = video.closest('.poster-card__media, .work-card__media');
    if (!container || !deg) return;
    video.classList.add('is-rotated');
    const sync = () => {
      const r = container.getBoundingClientRect();
      // Applying this outside any transition — a card's hover-scale transition
      // on `transform` would otherwise animate the rotation itself into place.
      video.style.transition = 'none';
      video.style.width = `${r.height}px`;
      video.style.height = `${r.width}px`;
      video.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
      void video.offsetHeight;
      video.style.transition = '';
    };
    sync();
    new ResizeObserver(sync).observe(container);
  });
}

/* ---------- Homepage poster cards + Breakdowns cards: play video on hover ---------- */
function initHoverVideos() {
  document.querySelectorAll('.poster-card, .work-card--hover-play').forEach((card) => {
    const video = card.querySelector('video');
    if (!video) return;

    card.addEventListener('mouseenter', () => {
      video.currentTime = 0;
      video.play().catch(() => {});
    });
    card.addEventListener('mouseleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  });
}

/* ---------- Grid cards (Projects / Breakdowns / Archives): loop only while in view ---------- */
function initAutoplayVideos() {
  const videos = document.querySelectorAll('.work-card:not(.work-card--hover-play) .work-card__video, .project-block__media video');
  if (!videos.length) return;

  if (!('IntersectionObserver' in window)) {
    videos.forEach((v) => v.play().catch(() => {}));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { threshold: 0.25 }
  );

  videos.forEach((v) => observer.observe(v));
}

/* ---------- Fullscreen video lightbox with custom player (Breakdowns / Archives / Project BTS) ---------- */
function initVideoLightbox() {
  const lightbox = document.querySelector('.video-lightbox');
  if (!lightbox) return;

  const video = lightbox.querySelector('.video-player__el');
  const closeBtn = lightbox.querySelector('.video-lightbox__close');
  const playerEl = lightbox.querySelector('.video-player');
  const playBtn = lightbox.querySelector('.video-player__play');
  const iconPlay = playBtn.querySelector('.icon-play');
  const iconPause = playBtn.querySelector('.icon-pause');
  const progress = lightbox.querySelector('.video-player__progress');
  const progressFill = lightbox.querySelector('.video-player__progress-fill');
  const progressHandle = lightbox.querySelector('.video-player__progress-handle');
  const timeEl = lightbox.querySelector('.video-player__time');
  const muteBtn = lightbox.querySelector('.video-player__mute');
  const fullscreenBtn = lightbox.querySelector('.video-player__fullscreen');

  function formatTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  function updatePlayIcon() {
    iconPlay.hidden = !video.paused;
    iconPause.hidden = video.paused;
  }

  function updateProgress() {
    const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    progressFill.style.width = `${pct}%`;
    progressHandle.style.left = `${pct}%`;
    timeEl.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }

  function togglePlay() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  playBtn.addEventListener('click', togglePlay);
  video.addEventListener('click', togglePlay);
  video.addEventListener('play', updatePlayIcon);
  video.addEventListener('pause', updatePlayIcon);
  video.addEventListener('timeupdate', updateProgress);
  video.addEventListener('loadedmetadata', updateProgress);

  function seek(e) {
    const rect = progress.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    if (video.duration) video.currentTime = pct * video.duration;
  }
  let seeking = false;
  progress.addEventListener('mousedown', (e) => {
    seeking = true;
    seek(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (seeking) seek(e);
  });
  window.addEventListener('mouseup', () => {
    seeking = false;
  });

  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    muteBtn.classList.toggle('is-muted', video.muted);
  });

  fullscreenBtn.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerEl.requestFullscreen?.();
    }
  });

  document.querySelectorAll('[data-lightbox-video]').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const source = card.querySelector('video source, video');
      const src = source && (source.tagName === 'SOURCE' ? source.src : source.currentSrc || source.src);
      if (!src) return;
      video.src = src;
      video.muted = false;
      muteBtn.classList.remove('is-muted');
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      video.play().catch(() => {});
      showControls();
    });
  });

  function close() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    video.pause();
  }

  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  /* Controls bar only shows while the mouse is moving */
  let hideTimer;
  function showControls() {
    playerEl.classList.add('is-active');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => playerEl.classList.remove('is-active'), 1800);
  }
  playerEl.addEventListener('mousemove', showControls);
  playerEl.addEventListener('mouseleave', () => {
    clearTimeout(hideTimer);
    playerEl.classList.remove('is-active');
  });
}

/* ---------- Footer year ---------- */
function initFooterYear() {
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

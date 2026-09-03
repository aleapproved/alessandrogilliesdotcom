(function () {
  // Single source of truth for the favicon SVG. Used here for the initial
  // pre-paint set, and again from favicon.js on load and theme changes.
  window.__updateFavicon = function () {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const LETTER = { cv: 'c', malaphors: 'm', game: 'g', contact: '@' };
    const tag = (document.body && document.body.getAttribute('data-page') || '').toLowerCase();
    const seg = (location.pathname || '/').toLowerCase().split('/').filter(Boolean)[0] || '';
    const letter = LETTER[tag] || LETTER[seg] || 'a';
    const bg = isDark ? 'black' : 'white';
    const fg = isDark ? 'white' : 'black';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${bg}"/><text x="50" y="68" font-size="64" text-anchor="middle" fill="${fg}" font-family="sans-serif">${letter}</text></svg>`;
    const href = 'data:image/svg+xml,' + encodeURIComponent(svg);

    let link = document.getElementById('favicon');
    if (!link) {
      link = document.createElement('link');
      link.id = 'favicon';
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  };

  // Prevent any transitions during first paint.
  document.documentElement.classList.add('no-anim');

  // A blocked storage read must not stop OS-theme detection.
  let stored = null;
  try {
    stored = localStorage.getItem('theme');
  } catch {
    // Treat unavailable storage as no explicit preference.
  }

  let prefersDark = false;
  try {
    prefersDark = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    // Use light mode when media-query detection is unavailable.
  }

  const theme = stored === 'dark' || stored === 'light'
    ? stored
    : prefersDark ? 'dark' : 'light';
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // Set an initial favicon before paint to avoid grey globe.
  try {
    window.__updateFavicon();
  } catch {
    // Favicon setup must not prevent the page from becoming interactive.
  }

  // After the DOM is ready, allow transitions again.
  const enableTransitions = () => {
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-anim');
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const btn = document.getElementById('themeToggle');
      if (btn) {
        btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        btn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
        const icon = btn.querySelector('.theme-toggle__icon');
        if (icon) icon.textContent = isDark ? '🌕' : '☀️';
      }
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enableTransitions);
  } else {
    enableTransitions();
  }
})();

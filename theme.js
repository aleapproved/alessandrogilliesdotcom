// theme.js
(function () {
  const ROOT = document.documentElement;
  const EVT = 'themechange';

  function getTheme() {
    return ROOT.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function setTheme(next) {
    const value = next === 'dark' ? 'dark' : 'light';
    if (value === 'dark') {
      ROOT.setAttribute('data-theme', 'dark');
    } else {
      ROOT.removeAttribute('data-theme');
    }
    // Persist BOTH 'light' and 'dark' explicitly. Storing nothing means
    // "user has no preference, follow OS" — which would override an explicit
    // light choice on the next page if the OS prefers dark.
    try {
      localStorage.setItem('theme', value);
    } catch {
      // Theme changes still work when storage is blocked or unavailable.
    }

    // Reflect on the toggle if present
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.setAttribute('aria-pressed', value === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
      const icon = btn.querySelector('.theme-toggle__icon');
      if (icon) icon.textContent = value === 'dark' ? '🌕' : '☀️';
    }

    // Notify listeners
    window.dispatchEvent(new CustomEvent(EVT, { detail: { theme: value } }));
  }

  // Expose small API
  window.Theme = { getTheme, setTheme, EVT };

  // Wire up the toggle button if present
  function initToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
    });
    // Ensure correct aria-pressed, aria-label, and icon on load
    const theme = getTheme();
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    const icon = btn.querySelector('.theme-toggle__icon');
    if (icon) icon.textContent = theme === 'dark' ? '🌕' : '☀️';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle, { once: true });
  } else {
    initToggle();
  }
})();

// theme.js
(function () {
  const ROOT = document.documentElement;
  const EVT = 'themechange';
  const STORAGE_KEY = 'theme';

  let systemPreference = null;

  function isValidTheme(value) {
    return value === 'dark' || value === 'light';
  }

  function readStoredPreference() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return isValidTheme(value) ? value : null;
    } catch {
      return null;
    }
  }

  function getTheme() {
    return ROOT.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function reflectToggle(value) {
    const button = document.getElementById('themeToggle');
    if (!button) return;
    button.setAttribute('aria-pressed', value === 'dark' ? 'true' : 'false');
    button.setAttribute('aria-label', value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function applyTheme(next) {
    const value = next === 'dark' ? 'dark' : 'light';
    if (value === 'dark') ROOT.setAttribute('data-theme', 'dark');
    else ROOT.removeAttribute('data-theme');
    reflectToggle(value);
    window.dispatchEvent(new CustomEvent(EVT, { detail: { theme: value } }));
    return value;
  }

  function getSystemTheme() {
    return systemPreference && systemPreference.matches ? 'dark' : 'light';
  }

  function applySystemPreference() {
    return applyTheme(getSystemTheme());
  }

  function setTheme(next) {
    const value = applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // The toggle still works for this page when browser storage is unavailable.
    }
    return value;
  }

  function handleSystemChange() {
    if (!readStoredPreference()) applySystemPreference();
  }

  function initToggle() {
    const button = document.getElementById('themeToggle');
    if (!button) return;

    try {
      systemPreference = window.matchMedia('(prefers-color-scheme: dark)');
      if (typeof systemPreference.addEventListener === 'function') {
        systemPreference.addEventListener('change', handleSystemChange);
      } else if (typeof systemPreference.addListener === 'function') {
        systemPreference.addListener(handleSystemChange);
      }
    } catch {
      systemPreference = null;
    }

    button.addEventListener('click', () => {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
    reflectToggle(getTheme());
  }

  window.Theme = { getTheme, setTheme, applyTheme, applySystemPreference, EVT };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle, { once: true });
  } else {
    initToggle();
  }
})();

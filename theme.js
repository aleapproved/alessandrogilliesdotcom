// theme.js
(function () {
  const ROOT = document.documentElement;
  const EVT = 'themechange';
  const STORAGE_KEY = 'theme';
  const RESET_LABEL = 'Forget the saved theme and follow your device colour scheme';
  const SAVED_NOTICE = 'Theme saved in this browser. “Forget saved theme” removes the preference and follows your device setting.';
  const UNAVAILABLE_NOTICE = 'Theme changed for this page. Browser storage is unavailable.';
  const CLEARED_NOTICE = 'Theme preference cleared. Following your device setting.';
  const STATUS_DURATION_MS = 6000;

  let controls = null;
  let resetButton = null;
  let status = null;
  let statusTimer = null;
  let systemPreference = null;

  function isValidTheme(value) {
    return value === 'dark' || value === 'light';
  }

  function readStoredPreference() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return { available: true, value: isValidTheme(value) ? value : null };
    } catch {
      return { available: false, value: null };
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
    const icon = button.querySelector('.theme-toggle__icon');
    if (icon) icon.textContent = value === 'dark' ? '🌕' : '☀️';
  }

  function applyTheme(next) {
    const value = next === 'dark' ? 'dark' : 'light';
    if (value === 'dark') {
      ROOT.setAttribute('data-theme', 'dark');
    } else {
      ROOT.removeAttribute('data-theme');
    }
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

  function showStatus(message) {
    if (!status) return;
    clearTimeout(statusTimer);
    status.textContent = message;
    status.classList.add('is-visible');
    document.body.classList.add('theme-status-visible');
    statusTimer = setTimeout(() => {
      status.classList.remove('is-visible');
      document.body.classList.remove('theme-status-visible');
      status.textContent = '';
    }, STATUS_DURATION_MS);
  }

  function removeResetControl() {
    if (resetButton) resetButton.remove();
    resetButton = null;
    document.body.classList.remove('theme-preference-saved');
  }

  function createResetControl() {
    if (!controls || resetButton) return;
    resetButton = document.createElement('button');
    resetButton.className = 'theme-reset';
    resetButton.type = 'button';
    resetButton.textContent = 'forget saved theme';
    resetButton.setAttribute('aria-label', RESET_LABEL);
    resetButton.title = RESET_LABEL;
    resetButton.addEventListener('click', clearPreference);
    controls.insertBefore(resetButton, status);
    document.body.classList.add('theme-preference-saved');
  }

  function reflectControlState() {
    const stored = readStoredPreference();
    if (stored.available && stored.value) {
      createResetControl();
    } else {
      removeResetControl();
    }
  }

  function persistPreference(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
      reflectControlState();
      return true;
    } catch {
      removeResetControl();
      return false;
    }
  }

  function setTheme(next) {
    const value = applyTheme(next);
    if (persistPreference(value)) {
      showStatus(SAVED_NOTICE);
    } else {
      showStatus(UNAVAILABLE_NOTICE);
    }
    return value;
  }

  function clearPreference() {
    let cleared = false;
    try {
      localStorage.removeItem(STORAGE_KEY);
      cleared = true;
    } catch {
      // The current page can still follow the device setting.
    }

    applySystemPreference();
    if (cleared) {
      removeResetControl();
      showStatus(CLEARED_NOTICE);
    } else {
      reflectControlState();
      showStatus(UNAVAILABLE_NOTICE);
    }
    return cleared;
  }

  function hasStoredPreference() {
    return Boolean(readStoredPreference().value);
  }

  function buildControls() {
    const toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    controls = document.createElement('div');
    controls.className = 'theme-controls';
    toggle.parentNode.insertBefore(controls, toggle);
    controls.appendChild(toggle);

    status = document.createElement('div');
    status.className = 'theme-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    controls.appendChild(status);
  }

  function handleSystemChange() {
    if (!hasStoredPreference()) applySystemPreference();
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

    buildControls();
    button.addEventListener('click', () => {
      setTheme(getTheme() === 'dark' ? 'light' : 'dark');
    });
    reflectToggle(getTheme());
    reflectControlState();
  }

  window.Theme = {
    getTheme,
    setTheme,
    applyTheme,
    applySystemPreference,
    clearPreference,
    hasStoredPreference,
    EVT,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle, { once: true });
  } else {
    initToggle();
  }
})();

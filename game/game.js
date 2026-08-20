(function(){
  const $ = sel => document.querySelector(sel);
  const arena = $('#arena');

  // Stats containers (text + pct + bars)
  const textWood = $('#text-wood');
  const textMine = $('#text-mine');
  const textFish = $('#text-fish');
  const barWood  = $('#bar-wood');
  const barMine  = $('#bar-mine');
  const barFish  = $('#bar-fish');

  const toastEl  = $('#toast');

  // ---- persistence ----
  const STORAGE_KEY = 'mini-skill-state-v1';
  function load(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      ['wood','mine','fish'].forEach(k => {
        if (saved && saved[k]) {
          state[k].lvl  = Number.isFinite(saved[k].lvl) ? saved[k].lvl : state[k].lvl;
          state[k].xp   = Number.isFinite(saved[k].xp)  ? saved[k].xp  : state[k].xp;
          state[k].next = state[k].lvl >= 99 ? 0 : xpForLevel(state[k].lvl);
        }
      });
    } catch {
      // ignore corrupt or blocked storage
    }
  }
  function save(){
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* storage may be unavailable in some privacy modes */ }
  }

  // In-memory state (no persistence beyond localStorage)
  const state = {
    wood: { lvl: 1, xp: 0, next: xpForLevel(1) },
    mine: { lvl: 1, xp: 0, next: xpForLevel(1) },
    fish: { lvl: 1, xp: 0, next: xpForLevel(1) }
  };

  // Exponential XP curve, capped at level 99.
  // Starts at 10 XP for level 1→2 and grows ~15% per level.
  function xpForLevel(level){
    const base = 10;
    const growth = 1.15;
    return Math.max(10, Math.floor(base * Math.pow(growth, level - 1)));
  }

  // ASCII-safe strings
  const SEP = ' \u2013 '; // en dash
  const EMOJI = {
    wood: '\u{1F332}',                                      // tree
    mine: supportsRockEmoji() ? '\u{1FAA8}' : '\u26F0\uFE0F',// rock or mountain
    fish: '\u{1F41F}'                                       // fish
  };

  function supportsRockEmoji(){
    const test = document.createElement('span');
    test.style.position = 'absolute';
    test.style.visibility = 'hidden';
    test.style.fontFamily = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla", system-ui, sans-serif';
    test.textContent = '\u{1FAA8}';
    document.body.appendChild(test);
    const wRock = test.getBoundingClientRect().width;
    test.textContent = '\u25A1';
    const wTofu = test.getBoundingClientRect().width;
    document.body.removeChild(test);
    return Math.abs(wRock - wTofu) > 0.5;
  }

  // RNG helpers
  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function chance(p){ return Math.random() < p; }

  // Layout guard – compute positions from client size, not rect
  function randPos(width, height){
    const pad = 8;
    const W = Math.max(pad, arena.clientWidth);
    const H = Math.max(pad, arena.clientHeight);
    const maxX = Math.max(pad, W - width  - pad);
    const maxY = Math.max(pad, H - height - pad);
    const x = randInt(pad, maxX);
    const y = randInt(pad, maxY);
    return {x,y};
  }

  function makeNode(emoji, label, kind){
    const el = document.createElement('button');
    el.className = 'node';
    el.setAttribute('aria-label', label);
    el.dataset.baseLabel = label; // remember the clean, non-critical label
    el.innerHTML = `<span class="glyph">${emoji}</span>`;
    el.dataset.kind = kind;
    el.addEventListener('click', () => bump(kind));
    arena.appendChild(el);
    placeNode(kind, true);
    return el;
  }

  // Decide crit status and ensure aria-label is reset each spawn
  function rollCrit(el){
    if (!el) return false;
    // Reset to base state every spawn
    el.classList.remove('crit');
    el.removeAttribute('data-crit');
    const base = el.dataset.baseLabel || el.getAttribute('aria-label') || 'node';
    el.setAttribute('aria-label', base);

    // 5% chance: mark as critical and annotate label
    const isCrit = chance(0.05);
    if (isCrit) {
      el.classList.add('crit');       // visual: 2× scale + ✨ via CSS
      el.setAttribute('data-crit', '1');
      el.setAttribute('aria-label', `${base} (critical)`);
    }
    return isCrit;
  }

  // Place node based on its final size (including its current crit state).
  // Re-roll only when a node is created or clicked, not when its container
  // changes size.
  function placeNode(kind, rerollCrit = false){
    const el = arena.querySelector(`[data-kind="${kind}"]`);
    if (!el) return;

    if (rerollCrit) rollCrit(el);

    // Temporarily position at (0,0) to measure current rendered size
    el.style.left = '0px'; el.style.top = '0px';
    const rect = el.getBoundingClientRect();
    const w = rect.width  || 48;
    const h = rect.height || 48;

    const {x,y} = randPos(w, h);
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  }

  function vibrate(ms){
    try {
      if (navigator && navigator.vibrate) navigator.vibrate(ms);
    } catch { /* ignore */ }
  }

  function showToast(text){
    if (!toastEl) return;
    toastEl.textContent = text;
    toastEl.classList.add('show');
    // auto-hide
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  function popConfetti(x, y){
    // Respect reduced motion
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const colors = ['var(--accent)','var(--good)','var(--text)'];
    const n = 10;
    for (let i=0;i<n;i++){
      const bit = document.createElement('div');
      bit.className = 'confetti';
      bit.style.left = (x + randInt(-12, 12)) + 'px';
      bit.style.top  = (y + randInt(-6, 6)) + 'px';
      bit.style.background = colors[i % colors.length];
      arena.appendChild(bit);
      setTimeout(() => bit.remove(), 700);
    }
  }

  function updateStatsUI(){
    setStatUI(state.wood, textWood, barWood);
    setStatUI(state.mine, textMine, barMine);
    setStatUI(state.fish, textFish, barFish);
  }

  function setStatUI(s, textEl, barEl){
    const percent = s.lvl >= 99 ? 100 : Math.floor((s.xp / s.next) * 100);
    const lvlText = s.lvl >= 99 ? `lvl 99` : `lvl ${s.lvl}`;
    if (textEl) textEl.textContent = lvlText;
    if (barEl)  barEl.style.width  = `${Math.min(100, percent)}%`;
  }

  function bump(kind){
    const el = arena.querySelector(`[data-kind="${kind}"]`);
    const s = state[kind];
    if (!el || s.lvl >= 99) { placeNode(kind); return; }

    // Mobile haptics
    vibrate(8);

    // Determine XP gain: 1 or 5 if critical node
    const isCrit = el.hasAttribute('data-crit');
    const gain = isCrit ? 5 : 1;

    const preLvl = s.lvl;
    s.xp += gain;

    // Level loop
    while (s.xp >= s.next && s.lvl < 99){
      s.xp -= s.next;
      s.lvl += 1;
      s.next = s.lvl >= 99 ? 0 : xpForLevel(s.lvl);
    }

    updateStatsUI();

    // Level-up feedback (toast + subtle confetti from click location)
    if (s.lvl > preLvl) {
      showToast(`${kind} ${SEP} level ${s.lvl}!`);
      const r = el.getBoundingClientRect();
      const a = arena.getBoundingClientRect();
      const cx = r.left - a.left + r.width/2;
      const cy = r.top  - a.top  + r.height/2;
      popConfetti(cx, cy);
      vibrate(16);
    }

    // Reposition and re-roll crit
    placeNode(kind, true);
    save(); // persist after each interaction
  }

  function start(){
    arena.innerHTML = '';

    // load any saved progress before creating UI
    load();

    makeNode(EMOJI.wood, 'tree', 'wood');
    makeNode(EMOJI.mine, 'rock', 'mine');
    makeNode(EMOJI.fish, 'fish', 'fish');
    updateStatsUI();
  }

  // Fit arena to remaining viewport height (24px bottom gap)
  function fitArena() {
    if (!arena) return;
    arena.style.height = 'auto';
    const top = arena.getBoundingClientRect().top;
    const available = Math.max(140, Math.floor(window.innerHeight - 24 - top));
    arena.style.height = available + 'px';
  }

  // Refit the arena on viewport changes. The ResizeObserver below then
  // catches any *actual* arena size change (e.g. orientation flip) and
  // reposition emojis. This keeps emojis stable when the user resizes
  // the window in a way that doesn't change the arena.
  window.addEventListener('resize', fitArena);
  window.addEventListener('orientationchange', fitArena);
  window.addEventListener('load', fitArena);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitArena);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => ['wood','mine','fish'].forEach(placeNode));
    ro.observe(arena);
  }

  fitArena();
  start();
})();

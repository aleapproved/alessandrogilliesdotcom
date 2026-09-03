(function(){
  const $ = sel => document.querySelector(sel);
  const arena = $('#arena');
  const campScene = $('#campScene');
  const campTitle = $('#camp-title');
  const campDescription = $('#camp-description');
  const woodCount = $('#wood-count');
  const buildButton = $('#buildButton');
  const buildLabel = $('#build-label');
  const buildCost = $('#build-cost');
  const buildHint = $('#build-hint');

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
  const SKILLS = ['wood', 'mine', 'fish'];
  const MIN_LEVEL = 1;
  const MAX_LEVEL = 99;
  const CAMP_STAGES = [
    {
      name: 'the clearing',
      description: 'A quiet patch of ground with room to grow.',
      cost: 10,
      label: 'build a lean-to'
    },
    {
      name: 'the lean-to',
      description: 'A roof, a fire, and somewhere dry to sleep.',
      cost: 100,
      label: 'build a small hut'
    },
    {
      name: 'the small hut',
      description: 'A proper little home at the edge of the wilds.',
      cost: 1000,
      label: 'build a wooden cabin'
    },
    {
      name: 'the wooden cabin',
      description: 'A sturdy base camp. There is still plenty of world beyond it.',
      cost: null,
      label: 'camp complete for now'
    }
  ];

  function normaliseSkill(savedSkill, fallback) {
    const isRecord = savedSkill && typeof savedSkill === 'object' && !Array.isArray(savedSkill);
    const hasValidLevel = isRecord
      && Number.isInteger(savedSkill.lvl)
      && savedSkill.lvl >= MIN_LEVEL
      && savedSkill.lvl <= MAX_LEVEL;
    const lvl = hasValidLevel ? savedSkill.lvl : fallback.lvl;
    const next = lvl >= MAX_LEVEL ? 0 : xpForLevel(lvl);
    const storedXp = hasValidLevel ? savedSkill.xp : null;
    const xp = Number.isFinite(storedXp) && storedXp >= 0
      ? Math.min(Math.floor(storedXp), Math.max(0, next - 1))
      : 0;

    return { lvl, xp: lvl >= MAX_LEVEL ? 0 : xp, next };
  }

  function load(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      SKILLS.forEach(k => { state[k] = normaliseSkill(saved?.[k], state[k]); });
      if (saved && saved.resources && Number.isFinite(saved.resources.wood)) {
        state.resources.wood = Math.max(0, Math.floor(saved.resources.wood));
      }
      if (saved && saved.camp && Number.isFinite(saved.camp.woodStage)) {
        state.camp.woodStage = Math.min(CAMP_STAGES.length - 1, Math.max(0, Math.floor(saved.camp.woodStage)));
      }
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
    fish: { lvl: 1, xp: 0, next: xpForLevel(1) },
    resources: { wood: 0 },
    camp: { woodStage: 0 }
  };

  // Exponential XP curve, capped at level 99.
  // Starts at 10 XP for level 1→2 and grows ~15% per level.
  function xpForLevel(level){
    const base = 10;
    const growth = 1.15;
    return Math.max(10, Math.floor(base * Math.pow(growth, level - 1)));
  }

  // Inline flat-shaded resource icons keep the game self-contained and avoid
  // platform-dependent emoji rendering.
  const SEP = ' \u2013 '; // en dash
  const NODE_GRAPHICS = {
    wood: '<svg class="node-graphic node-graphic--wood" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect class="node-graphic__trunk" x="28" y="40" width="8" height="20"></rect><polygon class="node-graphic__leaf" points="32,3 8,34 20,34 11,48 53,48 44,34 56,34"></polygon><polygon class="node-graphic__leaf node-graphic__leaf--dark" points="32,3 32,48 53,48 44,34 56,34"></polygon><polygon class="node-graphic__leaf node-graphic__leaf--light" points="32,12 21,31 30,31"></polygon></svg>',
    mine: '<svg class="node-graphic node-graphic--mine" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><polygon class="node-graphic__rock" points="8,47 14,24 31,12 51,18 58,39 45,54 21,57"></polygon><polygon class="node-graphic__rock node-graphic__rock--light" points="31,12 51,18 41,34 24,29"></polygon><polygon class="node-graphic__rock node-graphic__rock--dark" points="8,47 24,29 41,34 45,54 21,57"></polygon><polygon class="node-graphic__rock node-graphic__rock--shine" points="19,25 29,17 25,29"></polygon></svg>',
    fish: '<svg class="node-graphic node-graphic--fish" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><polygon class="node-graphic__fish-tail" points="13,32 2,20 4,32 2,44"></polygon><polygon class="node-graphic__fish-body" points="10,32 19,20 37,17 51,26 54,38 40,47 22,44"></polygon><polygon class="node-graphic__fish-fin" points="27,21 32,10 38,20"></polygon><polygon class="node-graphic__fish-fin node-graphic__fish-fin--lower" points="29,44 34,54 39,44"></polygon><circle class="node-graphic__fish-eye" cx="42" cy="28" r="2.5"></circle><polygon class="node-graphic__fish-shine" points="19,28 31,22 27,29"></polygon></svg>'
  };

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

  function makeNode(label, kind){
    const el = document.createElement('button');
    el.className = 'node';
    el.setAttribute('aria-label', label);
    el.dataset.baseLabel = label; // remember the clean, non-critical label
    el.innerHTML = `<span class="glyph">${NODE_GRAPHICS[kind]}</span>`;
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

    const colors = ['var(--ar-gold-bright)', 'var(--ar-forest-leaf)', 'var(--ar-ink-strong)'];
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

  function updateCampUI(){
    const stageIndex = Math.min(CAMP_STAGES.length - 1, Math.max(0, state.camp.woodStage));
    const stage = CAMP_STAGES[stageIndex];
    const nextStage = CAMP_STAGES[stageIndex + 1];
    const wood = state.resources.wood;

    if (campScene) campScene.dataset.woodStage = String(stageIndex);
    if (campTitle) campTitle.textContent = stage.name;
    if (campDescription) campDescription.textContent = stage.description;
    if (woodCount) woodCount.textContent = String(wood);

    if (!buildButton || !buildLabel || !buildCost || !buildHint) return;

    if (!nextStage || stage.cost === null) {
      buildLabel.textContent = stage.label;
      buildCost.textContent = '';
      buildHint.textContent = 'more camp upgrades are waiting to be discovered';
      buildButton.disabled = true;
      return;
    }

    buildLabel.textContent = stage.label;
    buildCost.textContent = `${stage.cost} wood`;
    buildButton.disabled = wood < stage.cost;
    buildHint.textContent = wood >= stage.cost
      ? 'ready to build'
      : `chop ${stage.cost - wood} more wood to build`;
  }

  function buildCamp(){
    const stage = CAMP_STAGES[state.camp.woodStage];
    const nextStage = CAMP_STAGES[state.camp.woodStage + 1];
    if (!stage || !nextStage || stage.cost === null || state.resources.wood < stage.cost) {
      updateCampUI();
      return;
    }

    state.resources.wood -= stage.cost;
    state.camp.woodStage += 1;
    updateCampUI();
    showToast(`${nextStage.name} built!`);
    save();
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
    if (kind === 'wood') state.resources.wood += gain;

    // Level loop
    while (s.xp >= s.next && s.lvl < 99){
      s.xp -= s.next;
      s.lvl += 1;
      s.next = s.lvl >= 99 ? 0 : xpForLevel(s.lvl);
    }

    updateStatsUI();
    updateCampUI();

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
    arena.querySelectorAll('.node, .confetti').forEach(el => el.remove());

    // load any saved progress before creating UI
    load();

    makeNode('tree', 'wood');
    makeNode('rock', 'mine');
    makeNode('fish', 'fish');
    updateStatsUI();
    updateCampUI();
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
  // reposition resource nodes. This keeps nodes stable when the user resizes
  // the window in a way that doesn't change the arena.
  window.addEventListener('resize', fitArena);
  window.addEventListener('orientationchange', fitArena);
  window.addEventListener('load', fitArena);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitArena);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => ['wood','mine','fish'].forEach(placeNode));
    ro.observe(arena);
  }

  if (buildButton) buildButton.addEventListener('click', buildCamp);

  fitArena();
  start();
})();

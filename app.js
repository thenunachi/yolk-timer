// ── Audio engine ──────────────────────────────────────────────────────────────

let audioCtx = null;
let soundEnabled = true;
const activeSizzle = {};

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window['webkitAudioContext'])();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function buildNoiseNode(type) {
  const ctx = getAudioCtx();
  const rate = ctx.sampleRate;
  const buf  = ctx.createBuffer(1, rate * 3, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop   = true;

  const hi = ctx.createBiquadFilter();
  const lo = ctx.createBiquadFilter();
  if (type === 'boil') {
    hi.type = 'highpass'; hi.frequency.value = 350;
    lo.type = 'lowpass';  lo.frequency.value = 2800;
  } else {
    hi.type = 'highpass'; hi.frequency.value = 2200;
    lo.type = 'lowpass';  lo.frequency.value = 10000;
  }

  const gain = ctx.createGain();
  gain.gain.value = 0;

  src.connect(hi); hi.connect(lo); lo.connect(gain); gain.connect(ctx.destination);
  src.start();
  return { src, gain, targetVol: type === 'boil' ? 0.07 : 0.055 };
}

function startSizzle(id) {
  if (!soundEnabled) return;
  stopSizzle(id);
  const ctx  = getAudioCtx();
  const type = (id === 'egg' || id === 'poached') ? 'boil' : 'sizzle';
  const node = buildNoiseNode(type);
  node.gain.gain.linearRampToValueAtTime(node.targetVol, ctx.currentTime + 0.6);
  activeSizzle[id] = node;
}

function stopSizzle(id) {
  if (!activeSizzle[id]) return;
  const ctx = getAudioCtx();
  const { src, gain } = activeSizzle[id];
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
  setTimeout(() => { try { src.stop(); } catch (_) {} }, 500);
  activeSizzle[id] = null;
}

function stopAllSizzles() {
  Object.keys(activeSizzle).forEach(stopSizzle);
}

function playBell() {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  [0, 0.38, 0.76].forEach(delay => {
    const t = ctx.currentTime + delay;
    [[880, 1], [1760, 0.55], [2640, 0.28], [3520, 0.12]].forEach(([freq, amp]) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(amp * 0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.8);
    });
  });
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-toggle');
  btn.textContent = soundEnabled ? '🔊' : '🔇';
  btn.title = soundEnabled ? 'Mute sounds' : 'Unmute sounds';
  btn.classList.toggle('muted', !soundEnabled);
  if (!soundEnabled) stopAllSizzles();
}

// ── Timer constants ───────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 50; // r=50

const mk = (total) => ({ total, remaining: total, interval: null, running: false, paused: false });

const state = {
  egg:       mk(600),
  omelette:  mk(120),
  poached:   mk(180),
  scrambled: mk(90),
  sunny:     mk(120),
};

const doneMessages = {
  egg:       { title: 'Eggs Ready! 🥚',        msg: 'Your eggs are perfectly cooked. Enjoy!' },
  omelette:  { title: 'Omelette Done! 🍳',     msg: 'Slide it onto a plate and serve hot!' },
  poached:   { title: 'Perfectly Poached! 💧', msg: 'Lift gently with a slotted spoon.' },
  scrambled: { title: 'Scrambled Done! 🥄',    msg: 'Serve immediately while still fluffy!' },
  sunny:     { title: 'Sunny-side Up! ☀️',     msg: 'Slide onto plate — yolk still glossy!' },
};

const ICONS = { egg: '🥚', omelette: '🍳', poached: '💧', scrambled: '🥄', sunny: '☀️' };

// ── Preset selection ──────────────────────────────────────────────────────────

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const seconds = parseInt(btn.dataset.seconds, 10);

    if (state[target].running) return; // don't change mid-run

    // Update active button
    document.querySelectorAll(`.preset-btn[data-target="${target}"]`).forEach((b) =>
      b.classList.remove('active')
    );
    btn.classList.add('active');

    // Update state and UI
    state[target].total = seconds;
    state[target].remaining = seconds;
    updateDisplay(target);
    updateRing(target, 1);
    setStatus(target, '');
    if (target === 'egg')       { setEggScene('idle'); resetEggWaterColor(); }
    if (target === 'omelette')  setOmeletteScene('idle');
    if (target === 'poached')   setPoachedScene('idle');
    if (target === 'scrambled') setScrambledScene('idle');
    if (target === 'sunny')     setSunnyScene('idle');
  });
});

// ── Timer controls ────────────────────────────────────────────────────────────

function startTimer(id) {
  const s = state[id];
  if (s.running) return;

  s.running = true;
  s.paused = false;

  document.getElementById(`${id}-start`).disabled = true;
  document.getElementById(`${id}-pause`).disabled = false;
  setStatus(id, 'Running…', false);

  s.interval = setInterval(() => tick(id), 1000);
  const sceneActions = {
    egg:       () => { setEggScene('boiling');       document.getElementById('egg-scene').classList.remove('scene-paused'); },
    omelette:  () => { setOmeletteScene('cooking');  document.getElementById('omelette-scene').classList.remove('scene-paused'); },
    poached:   () => { setPoachedScene('cooking');   document.getElementById('poached-scene').classList.remove('scene-paused'); },
    scrambled: () => { setScrambledScene('cooking'); document.getElementById('scrambled-scene').classList.remove('scene-paused'); },
    sunny:     () => { setSunnyScene('cooking');     document.getElementById('sunny-scene').classList.remove('scene-paused'); },
  };
  sceneActions[id]?.();
  startSizzle(id);
  setChicken(id, 'running');
}

function pauseTimer(id) {
  const s = state[id];
  if (!s.running) return;

  if (!s.paused) {
    clearInterval(s.interval);
    s.paused = true;
    s.running = false;
    document.getElementById(`${id}-start`).disabled = false;
    document.getElementById(`${id}-pause`).disabled = true;
    setStatus(id, 'Paused', false);
    stopSizzle(id);
    setChicken(id, 'paused');
    ['egg','omelette','poached','scrambled','sunny'].forEach(t => {
      if (id === t) document.getElementById(`${t === 'egg' ? 'egg' : t}-scene`).classList.add('scene-paused');
    });
  }
}

function resetTimer(id) {
  const s = state[id];
  clearInterval(s.interval);
  s.running = false;
  s.paused = false;
  s.remaining = s.total;

  document.getElementById(`${id}-start`).disabled = false;
  document.getElementById(`${id}-pause`).disabled = true;

  updateDisplay(id);
  updateRing(id, 1);
  setStatus(id, '', false);

  const resetActions = {
    egg:       () => { setEggScene('idle'); resetEggWaterColor(); document.getElementById('egg-scene').classList.remove('scene-paused'); },
    omelette:  () => { clearStepHighlights(); setOmeletteScene('idle'); document.getElementById('omelette-scene').classList.remove('scene-paused'); },
    poached:   () => { setPoachedScene('idle');   document.getElementById('poached-scene').classList.remove('scene-paused'); },
    scrambled: () => { setScrambledScene('idle'); document.getElementById('scrambled-scene').classList.remove('scene-paused'); },
    sunny:     () => { setSunnyScene('idle');     document.getElementById('sunny-scene').classList.remove('scene-paused'); },
  };
  resetActions[id]?.();
  stopSizzle(id);
  setChicken(id, 'idle');
}

// ── Tick ─────────────────────────────────────────────────────────────────────

function tick(id) {
  const s = state[id];
  s.remaining--;

  updateDisplay(id);
  updateRing(id, s.remaining / s.total);

  if (id === 'omelette') highlightOmeletteStep(s.remaining, s.total);
  if (id === 'egg') updateEggWaterColor(s.remaining / s.total);

  if (s.remaining <= 0) {
    clearInterval(s.interval);
    s.running = false;
    document.getElementById(`${id}-start`).disabled = false;
    document.getElementById(`${id}-pause`).disabled = true;
    setStatus(id, '✓ Done', true);
    stopSizzle(id);
    playBell();
    showDone(id);
    const doneActions = { egg: () => setEggScene('done'), omelette: () => setOmeletteScene('done'), poached: () => setPoachedScene('done'), scrambled: () => setScrambledScene('done'), sunny: () => setSunnyScene('done') };
    doneActions[id]?.();
    setChicken(id, 'idle');
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────

function updateDisplay(id) {
  const { remaining } = state[id];
  const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
  const secs = (remaining % 60).toString().padStart(2, '0');
  document.getElementById(`${id}-display`).textContent = `${mins}:${secs}`;
}

const RING_R  = 67; // ring stroke centre radius in px (SVG r=50 scaled to 160px container)
const RING_CX = 80; // centre x of 160×160 ring container
const RING_CY = 80; // centre y
const CHICK_SIZE = 34;

function placeChicken(el, fraction) {
  const alpha = fraction * 2 * Math.PI;          // angle (counter-clockwise from top)
  const x = RING_CX + RING_R * Math.sin(alpha);  // screen x
  const y = RING_CY - RING_R * Math.cos(alpha);  // screen y
  el.style.left = (x - CHICK_SIZE / 2) + 'px';
  el.style.top  = (y - CHICK_SIZE / 2) + 'px';

  // Flip to face direction of travel
  const face = el.querySelector('.chicken-face');
  if (face) face.style.transform = Math.cos(alpha) > 0 ? 'scaleX(-1)' : 'scaleX(1)';
}

function updateRing(id, fraction) {
  const offset = CIRCUMFERENCE * (1 - fraction);
  document.getElementById(`${id}-ring`).style.strokeDashoffset = offset;
  const chicken = document.getElementById(`${id}-chicken`);
  if (chicken) placeChicken(chicken, fraction);
}

function setChicken(id, chickenState) {
  const el = document.getElementById(`${id}-chicken`);
  if (!el) return;
  if (chickenState === 'running') {
    el.style.opacity = '1';
    el.classList.remove('paused');
  } else if (chickenState === 'paused') {
    el.style.opacity = '0.6';
    el.classList.add('paused');
  } else {
    el.style.opacity = '0';
    el.classList.remove('paused');
    placeChicken(el, 1); // reset to top
  }
}

function setStatus(id, msg, isDone = false) {
  const el = document.getElementById(`${id}-status`);
  el.textContent = msg;
  el.classList.toggle('done', isDone);
}

// ── Omelette step guide ───────────────────────────────────────────────────────

function highlightOmeletteStep(remaining, total) {
  const progress = 1 - remaining / total;
  let stepIndex;

  if (progress < 0.25)      stepIndex = 1;
  else if (progress < 0.5)  stepIndex = 2;
  else if (progress < 0.75) stepIndex = 3;
  else                       stepIndex = 4;

  clearStepHighlights();
  const el = document.getElementById(`step-${stepIndex}`);
  if (el) el.classList.add('active-step');
}

function clearStepHighlights() {
  [1, 2, 3, 4].forEach((i) => {
    const el = document.getElementById(`step-${i}`);
    if (el) el.classList.remove('active-step');
  });
}

// ── Done overlay ──────────────────────────────────────────────────────────────

function showDone(id) {
  const { title, msg } = doneMessages[id];
  document.getElementById('done-title').textContent = title;
  document.getElementById('done-msg').textContent = msg;
  document.getElementById('done-icon').textContent = ICONS[id] ?? '✅';
  document.getElementById('done-overlay').classList.add('visible');

  // Browser notification if permitted
  if (Notification.permission === 'granted') {
    new Notification(title, { body: msg });
  }
}

function closeDoneOverlay() {
  document.getElementById('done-overlay').classList.remove('visible');
}

// ── Notification permission ───────────────────────────────────────────────────

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ── Egg scene animation ───────────────────────────────────────────────────────

function setEggScene(sceneState) {
  const scene = document.getElementById('egg-scene');
  const label = document.getElementById('egg-scene-label');
  const card  = document.getElementById('egg-card');
  scene.classList.remove('boiling', 'done');
  card.classList.remove('egg-boiling', 'egg-done');

  if (sceneState === 'boiling') {
    scene.classList.add('boiling');
    card.classList.add('egg-boiling');
    label.textContent = 'Cooking…';
    label.style.color = '#60aaff';
  } else if (sceneState === 'done') {
    scene.classList.add('done');
    card.classList.add('egg-done');
    label.textContent = '🎉 Ready to eat!';
    label.style.color = '#ffd700';
  } else {
    label.textContent = 'Choose a preset to start';
    label.style.color = '';
  }
}

function updateEggWaterColor(fraction) {
  const progress = 1 - fraction;
  // Deep blue → slightly lighter blue as water heats (keeps contrast with egg)
  const r = Math.round(26  + (60  - 26)  * progress);
  const g = Math.round(95  + (155 - 95)  * progress);
  const b = Math.round(184 + (230 - 184) * progress);
  document.getElementById('pot-water').setAttribute('fill', `rgb(${r},${g},${b})`);
}

function resetEggWaterColor() {
  document.getElementById('pot-water').setAttribute('fill', '#1a5fb8');
}

// ── Omelette scene animation ──────────────────────────────────────────────────

function setOmeletteScene(sceneState) {
  const scene = document.getElementById('omelette-scene');
  const label = document.getElementById('omelette-scene-label');
  const card  = document.getElementById('omelette-card');
  scene.classList.remove('cooking', 'done');
  card.classList.remove('omelette-cooking');

  if (sceneState === 'cooking') {
    scene.classList.add('cooking');
    card.classList.add('omelette-cooking');
    label.textContent = 'Cooking…';
    label.style.color = '#ff9060';
  } else if (sceneState === 'done') {
    scene.classList.add('done');
    label.textContent = '🎉 Omelette ready!';
    label.style.color = '#ffd700';
  } else {
    label.textContent = 'Choose a style to start';
    label.style.color = '';
  }
}

// ── New egg type scenes ───────────────────────────────────────────────────────

function makeScene(id, cookingColor, cookingText, doneText) {
  return function setScene(state) {
    const scene = document.getElementById(`${id}-scene`);
    const label = document.getElementById(`${id}-label`);
    scene.classList.remove('cooking', 'done');
    if (state === 'cooking') {
      scene.classList.add('cooking');
      label.textContent = cookingText;
      label.style.color = cookingColor;
    } else if (state === 'done') {
      scene.classList.add('done');
      label.textContent = doneText;
      label.style.color = '#ffd700';
    } else {
      label.textContent = 'Choose a style to start';
      label.style.color = '';
    }
  };
}

function setPoachedScene(sceneState) {
  const scene = document.getElementById('poached-scene');
  const label = document.getElementById('poached-label');
  const card  = document.getElementById('poached-card');
  scene.classList.remove('cooking', 'done');
  card.classList.remove('poached-cooking');

  if (sceneState === 'cooking') {
    scene.classList.add('cooking');
    card.classList.add('poached-cooking');
    label.textContent = 'Poaching…';
    label.style.color = '#38bdf8';
  } else if (sceneState === 'done') {
    scene.classList.add('done');
    label.textContent = '🎉 Perfectly poached!';
    label.style.color = '#ffd700';
  } else {
    label.textContent = 'Choose a style to start';
    label.style.color = '';
  }
}

function setSunnyScene(sceneState) {
  const scene = document.getElementById('sunny-scene');
  const label = document.getElementById('sunny-label');
  const card  = document.getElementById('sunny-card');
  scene.classList.remove('cooking', 'done');
  card.classList.remove('sunny-cooking', 'sunny-done');

  if (sceneState === 'cooking') {
    scene.classList.add('cooking');
    card.classList.add('sunny-cooking');
    label.textContent = 'Sizzling…';
    label.style.color = '#fb923c';
  } else if (sceneState === 'done') {
    scene.classList.add('done');
    card.classList.add('sunny-done');
    label.textContent = '🎉 Sunny and perfect!';
    label.style.color = '#ffd700';
  } else {
    label.textContent = 'Choose a style to start';
    label.style.color = '';
  }
}

function setScrambledScene(sceneState) {
  const scene = document.getElementById('scrambled-scene');
  const label = document.getElementById('scrambled-label');
  const card  = document.getElementById('scrambled-card');
  scene.classList.remove('cooking', 'done');
  card.classList.remove('scrambled-cooking');

  if (sceneState === 'cooking') {
    scene.classList.add('cooking');
    card.classList.add('scrambled-cooking');
    label.textContent = 'Scrambling…';
    label.style.color = '#facc15';
  } else if (sceneState === 'done') {
    scene.classList.add('done');
    label.textContent = '🎉 Creamy and fluffy!';
    label.style.color = '#ffd700';
  } else {
    label.textContent = 'Choose a style to start';
    label.style.color = '';
  }
}

// ── Fun Egg Facts ────────────────────────────────────────────────────────────

const EGG_FACTS = [
  "An eggshell has about 17,000 tiny pores — they let moisture and gases pass through as the chick develops.",
  "Fresh eggs sink in water. Stale eggs float. Try the float test before cracking!",
  "The colour of an eggshell depends entirely on the hen's breed — not its diet or nutrition.",
  "The average hen lays 250–270 eggs a year, about one every 26 hours.",
  "Brown and white eggs have identical nutritional value — the colour is purely cosmetic.",
  "Egg white is around 90% water and 10% protein, with virtually zero fat.",
  "Eggs are one of the very few foods that naturally contain Vitamin D.",
  "All the egg's fat and most of its vitamins (A, D, E, K) are packed into the yolk.",
  "A double-yolk egg occurs roughly once in every 1,000 eggs — caused by two yolks releasing at once.",
  "Eggs can be safely stored in the refrigerator for 4–5 weeks after purchase.",
  "The green ring around an overcooked yolk forms when iron and sulfur compounds react — harmless but avoidable.",
  "Egg yolks are one of the best dietary sources of choline — vital for brain health and memory.",
  "Poaching works best between 71–82°C (160–180°F) — well below boiling, so the white sets gently.",
  "In medieval Europe, eggs were sometimes used as currency to pay rent to landlords.",
  "The US alone produces around 100 billion eggs every year — roughly 300 per person.",
];

let factIndex = 0;
let factTimer = null;
const FACT_DURATION = 10000;
let factStart = Date.now();

function showFact(animate = true) {
  const textEl    = document.getElementById('fact-text');
  const counterEl = document.getElementById('fact-counter');
  const barEl     = document.getElementById('fact-bar');

  const render = () => {
    textEl.textContent    = EGG_FACTS[factIndex];
    counterEl.textContent = `${factIndex + 1} / ${EGG_FACTS.length}`;
    textEl.classList.remove('fading');
    factStart = Date.now();
    animateBar(barEl);
  };

  if (animate) {
    textEl.classList.add('fading');
    setTimeout(render, 210);
  } else {
    render();
  }
}

function animateBar(barEl) {
  const tick = () => {
    const elapsed = Date.now() - factStart;
    const pct = Math.min((elapsed / FACT_DURATION) * 100, 100);
    barEl.style.width = pct + '%';
    if (pct < 100) requestAnimationFrame(tick);
  };
  barEl.style.width = '0%';
  requestAnimationFrame(tick);
}

function nextFact() {
  factIndex = (factIndex + 1) % EGG_FACTS.length;
  showFact();
  resetFactTimer();
}

function prevFact() {
  factIndex = (factIndex - 1 + EGG_FACTS.length) % EGG_FACTS.length;
  showFact();
  resetFactTimer();
}

function resetFactTimer() {
  clearInterval(factTimer);
  factTimer = setInterval(nextFact, FACT_DURATION);
}

// ── Init ──────────────────────────────────────────────────────────────────────

const CHICKEN_URL = 'https://plus.unsplash.com/premium_vector-1728553012649-8102ab88cbc1?q=80&w=120&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

const FALLBACK_RING_IMG = 'https://plus.unsplash.com/premium_vector-1760727859820-f8e7c1fc7337?q=80&w=300&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D';

document.querySelectorAll('.ring-inner-img').forEach(img => {
  img.onerror = function () {
    if (this.src !== FALLBACK_RING_IMG) this.src = FALLBACK_RING_IMG;
  };
});

Object.keys(state).forEach(id => {
  updateDisplay(id);
  updateRing(id, 1);

  // Inject chicken orbit into every ring container
  const container = document.querySelector(`#${id}-card .progress-ring-container`);
  if (container) {
    const orbit = document.createElement('div');
    orbit.className = 'chicken-orbit';
    orbit.id = `${id}-chicken`;

    const face = document.createElement('div');
    face.className = 'chicken-face';

    const img = document.createElement('img');
    img.className = 'chicken-img';
    img.src = CHICKEN_URL;
    img.alt = '🐔';

    face.appendChild(img);
    orbit.appendChild(face);
    container.appendChild(orbit);
    placeChicken(orbit, 1); // start at top of ring
  }
});

factIndex = Math.floor(Math.random() * EGG_FACTS.length);
showFact(false);
resetFactTimer();

// ── Carousel ──────────────────────────────────────────────────────────────────

const carouselSections = Array.from(document.querySelectorAll('.timer-section'));
const carouselLabels   = ['Boiled Egg', 'Omelette', 'Poached Egg', 'Scrambled Eggs', 'Sunny-side Up'];
const carouselDots     = Array.from(document.querySelectorAll('#carousel-dots .dot'));
let carouselIndex      = 0;

function goToSlide(newIndex) {
  if (newIndex === carouselIndex) return;
  const direction = newIndex > carouselIndex ? 1 : -1;
  carouselSections[carouselIndex].classList.remove('active');
  carouselDots[carouselIndex].classList.remove('active');
  carouselIndex = newIndex;
  carouselSections[carouselIndex].classList.add('active', direction > 0 ? 'c-enter-right' : 'c-enter-left');
  carouselDots[carouselIndex].classList.add('active');
  document.getElementById('carousel-section-name').textContent = carouselLabels[carouselIndex];
  setTimeout(() => carouselSections[carouselIndex].classList.remove('c-enter-right', 'c-enter-left'), 400);
}

document.getElementById('carousel-prev').addEventListener('click', () => {
  goToSlide((carouselIndex - 1 + carouselSections.length) % carouselSections.length);
});

document.getElementById('carousel-next').addEventListener('click', () => {
  goToSlide((carouselIndex + 1) % carouselSections.length);
});

carouselDots.forEach((dot, i) => {
  dot.addEventListener('click', () => goToSlide(i));
});

// ── Audio ──────────────────────────────────────────────────────────────
const ctx = new (window.AudioContext || window.webkitAudioContext)();

function unlockAudio() {
  if (ctx.state === 'suspended') ctx.resume();
  // iOS WebKit requires an actual buffer playback within the user gesture to unlock audio
  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
}

function beep(freq = 880, duration = 0.12, vol = 0.4) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function beepWarning() {
  beep(660, 0.1);
}

function beepFinish() {
  beep(880, 0.12);
  setTimeout(() => beep(880, 0.12), 160);
  setTimeout(() => beep(1100, 0.2), 320);
}

// ── Interval list ──────────────────────────────────────────────────────
const intervalList = document.getElementById('interval-list');
let intervals = [];
let nextId = 1;

function addInterval(name = '', seconds = 30) {
  const id = nextId++;
  intervals.push({ id, name, seconds });
  renderIntervals();
}

function removeInterval(id) {
  intervals = intervals.filter(i => i.id !== id);
  renderIntervals();
}

function renderIntervals() {
  intervalList.innerHTML = '';
  intervals.forEach((iv, idx) => {
    const row = document.createElement('div');
    row.className = 'interval-row';
    row.innerHTML = `
      <div class="interval-label">
        <input type="text" placeholder="Interval ${idx + 1}" value="${iv.name}"
          data-id="${iv.id}" data-field="name">
        <input type="number" min="1" max="3600" value="${iv.seconds}"
          data-id="${iv.id}" data-field="seconds">
        <span class="unit">sec</span>
      </div>
      <button class="btn-remove" data-id="${iv.id}">×</button>
    `;
    intervalList.appendChild(row);
  });

  intervalList.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', e => {
      const { id, field } = e.target.dataset;
      const iv = intervals.find(i => i.id == id);
      if (!iv) return;
      if (field === 'name') iv.name = e.target.value;
      if (field === 'seconds') iv.seconds = Math.max(1, parseInt(e.target.value) || 1);
    });
  });

  intervalList.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', () => removeInterval(Number(btn.dataset.id)));
  });
}

document.getElementById('btn-add').addEventListener('click', () => addInterval());

// seed with two default intervals
addInterval('Work', 30);
addInterval('Rest', 15);

// ── Timer ──────────────────────────────────────────────────────────────
const circleProgress = document.getElementById('circle-progress');
const circleWrap = document.querySelector('.circle-wrap');
const timeDisplay = document.getElementById('time-display');
const nameDisplay = document.getElementById('interval-name-display');
const roundDisplay = document.getElementById('round-display');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnStop  = document.getElementById('btn-stop');

const CIRCUMFERENCE = 2 * Math.PI * 100; // ≈ 628.3
circleProgress.style.strokeDasharray = CIRCUMFERENCE;

let running = false;
let paused  = false;
let rafId   = null;
let currentIndex   = 0;
let round          = 1;
let startTime      = null;   // performance.now() anchor for current interval
let elapsedOnPause = 0;      // ms already elapsed when we paused
let intervalDuration = 0;
let lastBeepSecond = Infinity; // tracks which countdown second we last beeped

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setControls(state) {
  // state: 'idle' | 'running' | 'paused'
  btnStart.style.display = state === 'idle'    ? 'inline-block' : 'none';
  btnPause.style.display = state !== 'idle'    ? 'inline-block' : 'none';
  btnStop.style.display  = state !== 'idle'    ? 'inline-block' : 'none';
  btnPause.textContent   = state === 'paused'  ? 'Resume' : 'Pause';
  const lockInputs = state !== 'idle';
  document.getElementById('btn-add').disabled = lockInputs;
  intervalList.querySelectorAll('input, .btn-remove').forEach(el => el.disabled = lockInputs);
}

function startCurrentInterval() {
  const iv = intervals[currentIndex];
  intervalDuration = iv.seconds * 1000;
  startTime = performance.now();
  elapsedOnPause = 0;
  lastBeepSecond = Infinity;
  nameDisplay.textContent = iv.name || `Interval ${currentIndex + 1}`;
  roundDisplay.textContent = `Round ${round}`;
  circleProgress.style.stroke = '#f5c400';
  circleWrap.classList.remove('warning');
}

function tick(now) {
  if (!running || paused) return;
  const elapsed   = elapsedOnPause + (now - startTime);
  const remaining = Math.max(0, intervalDuration - elapsed);
  const remainingSec = Math.ceil(remaining / 1000);
  const progress  = elapsed / intervalDuration;

  timeDisplay.textContent = formatTime(remainingSec);
  circleProgress.style.strokeDashoffset = CIRCUMFERENCE * Math.min(progress, 1);

  // beep at 3, 2, 1 — once per second
  if (remainingSec <= 3 && remainingSec >= 1 && remainingSec < lastBeepSecond) {
    lastBeepSecond = remainingSec;
    circleWrap.classList.add('warning');
    beepWarning();
  }

  if (remaining <= 0) {
    beepFinish();
    currentIndex++;
    if (currentIndex >= intervals.length) {
      currentIndex = 0;
      round++;
    }
    startCurrentInterval();
  }

  rafId = requestAnimationFrame(tick);
}

function start() {
  unlockAudio();
  if (intervals.length === 0) { alert('Add at least one interval.'); return; }
  running = true;
  paused  = false;
  currentIndex = 0;
  round = 1;
  setControls('running');
  startCurrentInterval();
  rafId = requestAnimationFrame(tick);
}

function togglePause() {
  if (!running) return;
  if (!paused) {
    paused = true;
    elapsedOnPause += performance.now() - startTime;
    cancelAnimationFrame(rafId);
    setControls('paused');
  } else {
    paused = false;
    startTime = performance.now();
    setControls('running');
    rafId = requestAnimationFrame(tick);
  }
}

function stop() {
  running = false;
  paused  = false;
  cancelAnimationFrame(rafId);
  setControls('idle');
  circleProgress.style.strokeDashoffset = 0;
  circleWrap.classList.remove('warning');
  timeDisplay.textContent = '00:00';
  nameDisplay.textContent = 'ready';
  roundDisplay.textContent = '';
}

btnStart.addEventListener('click', start);
btnPause.addEventListener('click', togglePause);
btnStop.addEventListener('click', stop);

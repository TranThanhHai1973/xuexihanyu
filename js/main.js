import * as P from './player.js';
import * as Editor from './editor.js';
import * as Term from './terminal.js';
import * as Palette from './palette.js';
import * as Menu from './menu.js';
import { bus } from './bus.js';
import { store } from './store.js';
import { $, fmt } from './util.js';
import { COMMANDS, loopLabel } from './commands.js';

/* ---------- toasts (look like editor notifications) ---------- */
function toast({ msg, kind = 'err' }) {
  const el = document.createElement('div');
  el.className = `toast${kind === 'ok' ? ' ok' : ''}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
bus.on('toast', toast);
bus.on('error', (msg) => {
  bus.emit('print', [{ text: `[error] ${msg}`, kind: 'err' }]);
  toast({ msg: `Debug session failed: ${msg}`, kind: 'err' });
});

/* ---------- status bar + debug toolbar state ---------- */
let dur = 0;
function setPlayIcon(playing) {
  const href = playing ? '#i-pause' : '#i-run';
  $('#d-play use').setAttribute('href', href);
  $('#pb-play use').setAttribute('href', href);
}

bus.on('state', (s) => setPlayIcon(s === 1 || s === 3));
bus.on('tick', ({ t, d }) => {
  dur = d;
  const label = `${fmt(t)} / ${fmt(d)}`;
  $('#st-time').textContent = label;
  $('#pb-time').textContent = fmt(t);
  $('#pb-dur').textContent = fmt(d);
  if (d) $('#pb-seek').value = Math.round((t / d) * 1000);
});
bus.on('speed', (v) => {
  const s = `${v.toFixed(2)}x`;
  $('#st-speed').textContent = s;
  $('#pb-speed').textContent = s;
});
bus.on('loop', ({ a, b }) => {
  const text = a == null ? 'loop off' : b == null ? `loop A ${fmt(a)}` : `loop ${fmt(a)}-${fmt(b)}`;
  $('#st-loop').textContent = text;
});
bus.on('mode', (m) => {
  $('#st-mode').textContent = m[0].toUpperCase() + m.slice(1);
});
bus.on('cursor', ({ ln, col }) => {
  $('#st-pos').textContent = `Ln ${ln}, Col ${col}`;
});

/* ---------- wiring buttons ---------- */
const loopClick = () => toast({ msg: loopLabel(P.cycleLoop()), kind: 'ok' });
bus.on('toggle-loop', loopClick);
$('#d-play').onclick = () => P.toggle();
$('#d-back').onclick = () => P.seekBy(-5);
$('#d-fwd').onclick = () => P.seekBy(5);
$('#d-loop').onclick = loopClick;
$('#d-restart').onclick = () => P.seekTo(0);
$('#d-stop').onclick = () => P.stop();

$('#pb-play').onclick = () => P.toggle();
$('#pb-back').onclick = () => P.seekBy(-5);
$('#pb-fwd').onclick = () => P.seekBy(5);
$('#pb-loop').onclick = loopClick;
const cycleSpeed = () => {
  const s = P.getState().speed;
  P.setSpeed(s >= 2 ? 0.5 : s + 0.25);
};
$('#pb-speed').onclick = cycleSpeed;
$('#pb-exit').onclick = () => P.setMode('stealth');
$('#pb-seek').oninput = (e) => P.seekTo((Number(e.target.value) / 1000) * dur);
$('#pl-close').onclick = () => P.setMode('stealth');
$('#pl-catch').onclick = () => P.toggle();

$('#st-speed').onclick = cycleSpeed;
$('#st-loop').onclick = loopClick;
$('#st-mode').onclick = () => P.cycleMode();

/* ---------- keyboard ---------- */
let lastEsc = 0;
window.addEventListener(
  'keydown',
  (e) => {
    const typing = e.target.matches && e.target.matches('input, textarea');

    if (e.key === 'Escape') {
      if (Palette.isOpen()) return;
      const t = Date.now();
      if (t - lastEsc < 600) P.setMode('stealth');
      lastEsc = t;
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      Palette.open();
      return;
    }
    if (mod && e.key === '`') {
      e.preventDefault();
      bus.emit('focus-terminal');
      return;
    }
    if (e.key === 'F5') {
      e.preventDefault();
      P.toggle();
      return;
    }
    if (e.altKey && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      P.setMode(P.getState().mode === 'peek' ? 'stealth' : 'peek');
      return;
    }
    if (e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      P.setMode(P.getState().mode === 'full' ? 'stealth' : 'full');
      return;
    }

    if (typing || Palette.isOpen() || mod || e.altKey) return;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        P.seekBy(-5);
        break;
      case 'ArrowRight':
        e.preventDefault();
        P.seekBy(5);
        break;
      case 'ArrowUp':
        e.preventDefault();
        P.setVolume(10);
        break;
      case 'ArrowDown':
        e.preventDefault();
        P.setVolume(-10);
        break;
      case 'l':
      case 'L':
        loopClick();
        break;
      case '[':
        P.stepSpeed(-1);
        break;
      case ']':
        P.stepSpeed(1);
        break;
      case ' ':
        e.preventDefault();
        P.toggle();
        break;
      default:
    }
  },
  true,
);

/* ---------- boot ---------- */
Editor.init();
Term.init();
Palette.init();
Menu.init();
bus.emit('speed', P.getState().speed);

if (!store.get().last) {
  setTimeout(() => Palette.open(), 300);
} else {
  bus.emit('print', [{ text: 'Last session found. Run "play" to resume it.', kind: 'dim' }]);
}

window.__codecamo = { P, COMMANDS };

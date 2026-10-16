import * as P from './player.js';
import * as Palette from './palette.js';
import { bus } from './bus.js';
import { $, $$, esc } from './util.js';

const SEP = { sep: true };
const showPeek = { label: 'Show Video (Peek)', key: 'Alt+P', run: () => P.setMode('peek') };
const showFull = { label: 'Show Video Full Screen', key: 'Alt+F', run: () => P.setMode('full') };
const hideVideo = { label: 'Hide Video', key: 'Esc Esc', run: () => P.setMode('stealth') };

const MENUS = {
  File: [
    { label: 'Open Link...', key: 'Ctrl+P', run: () => Palette.open() },
    SEP,
    showPeek,
    showFull,
    hideVideo,
    SEP,
    { label: 'Open notes.md', run: () => bus.emit('open-file', 'notes.md') },
    { label: 'Open history.json', run: () => bus.emit('open-file', 'history.json') },
    SEP,
    { label: 'Reload Window', key: 'Ctrl+R', run: () => location.reload() },
  ],
  View: [
    { label: 'Command Palette...', key: 'Ctrl+P', run: () => Palette.open() },
    { label: 'Terminal', key: 'Ctrl+`', run: () => bus.emit('focus-terminal') },
    SEP,
    showPeek,
    showFull,
    hideVideo,
  ],
  Run: [
    { label: 'Continue / Pause', key: 'F5', run: () => P.toggle() },
    { label: 'Step Back 5s', key: 'Left', run: () => P.seekBy(-5) },
    { label: 'Step Over 5s', key: 'Right', run: () => P.seekBy(5) },
    { label: 'Toggle Loop A-B', key: 'L', run: () => bus.emit('toggle-loop') },
    SEP,
    { label: 'Restart', run: () => P.seekTo(0) },
    { label: 'Stop', run: () => P.stop() },
  ],
};

let current = null;

function close() {
  $('#menu-pop').hidden = true;
  $$('.tb-menu').forEach((m) => m.classList.remove('open'));
  current = null;
}

function openMenu(el) {
  const name = el.textContent.trim();
  const items = MENUS[name];
  if (!items) return close();
  const pop = $('#menu-pop');
  pop.innerHTML = items
    .map((it, i) =>
      it.sep
        ? '<div class="msep"></div>'
        : `<div class="mi" data-i="${i}"><span>${esc(it.label)}</span><span class="kb">${esc(it.key || '')}</span></div>`,
    )
    .join('');
  pop.hidden = false;
  const r = el.getBoundingClientRect();
  pop.style.left = `${r.left}px`;
  pop.style.top = `${r.bottom}px`;
  $$('.tb-menu').forEach((m) => m.classList.toggle('open', m === el));
  current = name;
}

export function init() {
  const pop = $('#menu-pop');
  $$('.tb-menu').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (current === el.textContent.trim()) close();
      else openMenu(el);
    });
    el.addEventListener('mouseenter', () => {
      if (current && MENUS[el.textContent.trim()]) openMenu(el);
    });
  });
  pop.addEventListener('click', (e) => {
    const row = e.target.closest('[data-i]');
    if (!row) return;
    const item = MENUS[current][Number(row.dataset.i)];
    close();
    item.run();
  });
  document.addEventListener('click', close);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) close();
  });
}

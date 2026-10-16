import { COMMANDS, openUrl } from './commands.js';
import { bus } from './bus.js';
import { $, esc, parseYouTube } from './util.js';

let items = [];
let sel = 0;

export const isOpen = () => !$('#palette').hidden;

function render() {
  $('#pal-list').innerHTML = items
    .map(
      (it, i) =>
        `<div class="pi${i === sel ? ' on' : ''}" data-i="${i}" role="option"><span>${esc(it.label)}</span>` +
        `<span class="kb">${esc(it.key || '')}</span></div>`,
    )
    .join('');
}

function build(q) {
  const query = q.trim().replace(/^>\s*/, '').toLowerCase();
  items = [];
  const yt = parseYouTube(q);
  if (yt) {
    items.push({
      label: `Debug: Start session ${yt.id}`,
      key: 'Enter',
      run: async () => {
        const res = await openUrl(q);
        bus.emit('print', res);
        if (res[0] && res[0].kind === 'err') bus.emit('toast', { msg: res[0].text.replace('[error] ', ''), kind: 'err' });
      },
    });
  }
  items.push(...COMMANDS.filter((c) => c.label.toLowerCase().includes(query)));
  sel = 0;
  render();
}

export function open() {
  const el = $('#palette');
  el.hidden = false;
  const input = $('#pal-in');
  input.value = '';
  build('');
  input.focus();
}

export function close() {
  $('#palette').hidden = true;
}

function choose(i) {
  const it = items[i];
  if (!it) return;
  close();
  it.run();
}

export function init() {
  const input = $('#pal-in');
  input.addEventListener('input', () => build(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      sel = Math.min(items.length - 1, sel + 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      sel = Math.max(0, sel - 1);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(sel);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  $('#pal-list').addEventListener('click', (e) => {
    const row = e.target.closest('[data-i]');
    if (row) choose(Number(row.dataset.i));
  });
  $('#palette').addEventListener('mousedown', (e) => {
    if (e.target.id === 'palette') close();
  });
}

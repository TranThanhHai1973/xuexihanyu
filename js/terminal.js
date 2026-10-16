import { bus } from './bus.js';
import { run } from './commands.js';
import { $, $$, esc } from './util.js';

const history = [];
let hIdx = 0;

function print(items) {
  const out = $('#term-out');
  for (const it of items) {
    const row = document.createElement('div');
    row.className = it.kind ? `k-${it.kind}` : '';
    row.innerHTML = esc(it.text);
    out.appendChild(row);
  }
  const body = $('#pn-terminal');
  body.scrollTop = body.scrollHeight;
}

function echo(line) {
  const out = $('#term-out');
  const row = document.createElement('div');
  row.innerHTML = `<span class="ps1">dev@hanzi:~/hanzi-trainer$</span> ${esc(line)}`;
  out.appendChild(row);
}

export function focus() {
  $('#term-in').focus();
}

export function init() {
  const input = $('#term-in');

  print([
    { text: 'Python 3.11.4 (main) [GCC 12.2.0] on linux', kind: 'dim' },
    { text: 'Loading dataset... done (12,480 samples)', kind: 'dim' },
    { text: 'Type "help" for commands.', kind: 'dim' },
  ]);

  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const line = input.value;
      input.value = '';
      echo(line);
      if (line.trim()) {
        history.push(line);
        hIdx = history.length;
      }
      print(await run(line));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (hIdx > 0) input.value = history[--hIdx];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      hIdx = Math.min(history.length, hIdx + 1);
      input.value = history[hIdx] || '';
    }
  });

  $('#pn-terminal').addEventListener('click', () => {
    if (!getSelection().toString()) focus();
  });

  $$('.pn-tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.pn-tab').forEach((t) => t.classList.toggle('on', t === tab));
      $$('.pn-body').forEach((b) => (b.hidden = b.id !== `pn-${tab.dataset.p}`));
      if (tab.dataset.p === 'terminal') focus();
    }),
  );

  bus.on('term-clear', () => ($('#term-out').innerHTML = ''));
  bus.on('focus-terminal', () => {
    $('.pn-tab[data-p="terminal"]').click();
    focus();
  });
  bus.on('print', print);
}

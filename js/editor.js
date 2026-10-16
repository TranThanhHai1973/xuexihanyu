import { bus } from './bus.js';
import { store } from './store.js';
import { $, esc, fmt } from './util.js';
import { MAIN_PY, UTILS_PY, README_MD, REQ_TXT, POOL } from './fakecode.js';

const MAX_ROWS = 400;
const PROJECT = 'hanzi-trainer';

const FILES = {
  'main.py': { lang: 'py', icon: 'fi-py', lines: [...MAIN_PY], type: true },
  'utils.py': { lang: 'py', icon: 'fi-py', lines: [...UTILS_PY], type: true },
  'translate.md': { lang: 'md', icon: 'fi-md', view: true },
  'notes.md': { lang: 'md', icon: 'fi-md', dynamic: notesLines },
  'history.json': { lang: 'json', icon: 'fi-json', dynamic: historyLines },
  'README.md': { lang: 'md', icon: 'fi-md', lines: README_MD },
  'requirements.txt': { lang: 'txt', icon: 'fi-txt', lines: REQ_TXT },
};
for (const f of Object.values(FILES)) f.startNum = 1;

const TREE = [
  { dir: 'src', files: ['main.py', 'utils.py'] },
  { dir: 'data', files: ['history.json'] },
  { file: 'translate.md' },
  { file: 'notes.md' },
  { file: 'README.md' },
  { file: 'requirements.txt' },
];

let open = ['main.py', 'utils.py', 'notes.md'];
let active = 'main.py';
let codeEl;
let pool = { queue: [], cur: null, pos: 0, wait: 0, idx: 0 };

function notesLines() {
  const { notes } = store.get();
  const out = ['# Notes', ''];
  if (!notes.length) out.push('<!-- nothing here yet: use `note <text>` in the terminal -->');
  for (const n of notes) out.push(`- [${fmt(n.at)}] ${n.text}`);
  return out;
}

function historyLines() {
  const { history } = store.get();
  return JSON.stringify(
    history.map((h) => ({ id: h.id, title: h.title || null, at: new Date(h.at).toISOString() })),
    null,
    2,
  ).split('\n');
}

const PY =
  /(#.*$)|("""[\s\S]*?"""|f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*')|\b(def|class|import|from|return|for|in|if|elif|else|while|with|as|try|except|raise|lambda|yield|pass|and|or|not|None|True|False|self)\b|\b(\d[\d_]*(?:\.\d+)?(?:e-?\d+)?)\b|(\b[A-Za-z_]\w*)(?=\()/g;

function hlPy(line) {
  let out = '';
  let i = 0;
  let m;
  PY.lastIndex = 0;
  while ((m = PY.exec(line))) {
    out += esc(line.slice(i, m.index));
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'k' : m[4] ? 'n' : 'f';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    i = PY.lastIndex;
  }
  return out + esc(line.slice(i));
}

function highlight(line, lang) {
  if (lang === 'py') return hlPy(line);
  if (lang === 'md') {
    if (/^#/.test(line)) return `<span class="k">${esc(line)}</span>`;
    if (/^<!--/.test(line)) return `<span class="c">${esc(line)}</span>`;
    return esc(line).replace(/`([^`]+)`/g, '<span class="s">`$1`</span>');
  }
  if (lang === 'json') {
    return esc(line).replace(/(&quot;|")([\w-]+)(&quot;|")(\s*:)/g, '<span class="p">"$2"</span>$4');
  }
  return esc(line);
}

function lines(f) {
  if (f.dynamic) f.lines = f.dynamic();
  return f.lines;
}

function rowHtml(num, text, lang, isLast) {
  return (
    `<div class="row${isLast ? ' act' : ''}"><span class="num">${num}</span>` +
    `<span class="txt">${highlight(text, lang)}${isLast ? '<span class="cur"></span>' : ''}</span></div>`
  );
}

function render() {
  const f = FILES[active];
  $('#tr').hidden = !f.view;
  codeEl.hidden = !!f.view;
  $('#minimap').hidden = !!f.view;
  if (f.view) {
    bus.emit('translate-focus');
  } else {
    const ls = lines(f);
    f.startNum = f.startNum || 1;
    codeEl.innerHTML = ls
      .map((t, i) => rowHtml(f.startNum + i, t, f.lang, f.type && i === ls.length - 1))
      .join('');
    codeEl.scrollTop = codeEl.scrollHeight;
    if (f.type) emitCursor(f);
  }
  renderTabs();
  renderTree();
  renderCrumbs();
  document.title = `${active} - ${PROJECT} - Visual Studio Code`;
  $('#tb-title').textContent = document.title;
}

function emitCursor(f) {
  const last = f.lines[f.lines.length - 1] || '';
  bus.emit('cursor', { ln: f.startNum + f.lines.length - 1, col: last.length + 1 });
}

function renderTabs() {
  const el = $('#tabs');
  el.innerHTML = open
    .map(
      (n) =>
        `<div class="tab${n === active ? ' on' : ''}" data-f="${n}" role="tab">` +
        `<span class="${FILES[n].icon}">${n}</span><svg class="ic" data-x="${n}"><use href="#i-x"/></svg></div>`,
    )
    .join('');
}

function renderTree() {
  const el = $('#tree');
  const item = (n, indent) =>
    `<div class="tr${n === active ? ' on' : ''}" data-f="${n}" style="padding-left:${indent}px">` +
    `<svg class="ic ${FILES[n].icon}"><use href="#i-files"/></svg>${n}</div>`;
  el.innerHTML = TREE.map((e) =>
    e.dir
      ? `<div class="tr" style="padding-left:12px"><svg class="ic fi-dir"><use href="#i-folder"/></svg>${e.dir}</div>` +
        e.files.map((n) => item(n, 30)).join('')
      : item(e.file, 12),
  ).join('');
}

function renderCrumbs() {
  const dir = ['main.py', 'utils.py'].includes(active) ? 'src > ' : '';
  $('#crumbs').textContent = `${PROJECT} > ${dir}${active}`;
}

export function openFile(name) {
  if (!FILES[name]) return;
  if (!open.includes(name)) open.push(name);
  active = name;
  render();
}

function closeFile(name) {
  if (open.length === 1) return;
  const i = open.indexOf(name);
  open = open.filter((n) => n !== name);
  if (active === name) active = open[Math.min(i, open.length - 1)];
  render();
}

/* ---- ambient "typing" so the editor always looks busy ---- */
function newRow(f, text) {
  f.lines.push(text);
  const prev = codeEl.lastElementChild;
  if (prev) {
    prev.classList.remove('act');
    const cur = prev.querySelector('.cur');
    if (cur) cur.remove();
  }
  codeEl.insertAdjacentHTML('beforeend', rowHtml(f.startNum + f.lines.length - 1, text, f.lang, true));
  while (f.lines.length > MAX_ROWS) {
    f.lines.shift();
    f.startNum++;
    codeEl.firstElementChild.remove();
  }
}

function typeTick(dt) {
  const f = FILES[active];
  if (!f.type || document.hidden) return;

  if (pool.cur == null) {
    pool.wait -= dt;
    if (pool.wait > 0) return;
    if (!pool.queue.length) {
      pool.queue = [...POOL[pool.idx++ % POOL.length]];
    }
    pool.cur = pool.queue.shift();
    pool.pos = (pool.cur.match(/^ */) || [''])[0].length;
    newRow(f, pool.cur.slice(0, pool.pos));
  }

  pool.pos = Math.min(pool.cur.length, pool.pos + 1 + Math.floor(Math.random() * 2));
  const text = pool.cur.slice(0, pool.pos);
  f.lines[f.lines.length - 1] = text;
  const last = codeEl.lastElementChild;
  last.querySelector('.txt').innerHTML = `${highlight(text, f.lang)}<span class="cur"></span>`;
  codeEl.scrollTop = codeEl.scrollHeight;
  emitCursor(f);

  if (pool.pos >= pool.cur.length) {
    pool.cur = null;
    if (pool.queue.length) {
      pool.wait = 150 + Math.random() * 350;
    } else {
      pool.wait = 2500 + Math.random() * 5000;
    }
  }
}

export function refreshDynamic() {
  if (FILES[active].dynamic) render();
}

export function init() {
  codeEl = $('#code');
  $('#tabs').addEventListener('click', (e) => {
    const x = e.target.closest('[data-x]');
    if (x) return closeFile(x.dataset.x);
    const t = e.target.closest('[data-f]');
    if (t) openFile(t.dataset.f);
  });
  $('#tree').addEventListener('click', (e) => {
    const t = e.target.closest('[data-f]');
    if (t) openFile(t.dataset.f);
  });
  bus.on('open-file', openFile);
  bus.on('boss', () => openFile('main.py'));
  bus.on('notes-changed', refreshDynamic);
  bus.on('meta', refreshDynamic);
  render();

  let last = performance.now();
  setInterval(() => {
    const t = performance.now();
    typeTick(t - last);
    last = t;
  }, 70);
}

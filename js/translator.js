import { bus } from './bus.js';
import { store } from './store.js';
import * as P from './player.js';
import { $, esc } from './util.js';

const PINYIN_URL = 'https://cdn.jsdelivr.net/npm/pinyin-pro@3.29.5/+esm';
const HAN = /[㐀-鿿]/;
const MAX_CHUNK = 400;

let lib = null;
let token = 0;
let timer = null;
let composing = false;
let current = { lines: [], py: null, vi: [] };
const cache = new Map();

function loadPinyin() {
  if (!lib) {
    lib = import(PINYIN_URL).catch((e) => {
      lib = null;
      throw e;
    });
  }
  return lib;
}

const decoder = document.createElement('textarea');
const decode = (s) => {
  decoder.innerHTML = s;
  return decoder.value;
};

function chunks(text) {
  if (text.length <= MAX_CHUNK) return [text];
  const parts = text.match(/[^。！？；.!?;]+[。！？；.!?;]*/g) || [text];
  const out = [];
  let buf = '';
  for (const p of parts) {
    if ((buf + p).length > MAX_CHUNK && buf) {
      out.push(buf);
      buf = '';
    }
    buf += p;
  }
  if (buf) out.push(buf);
  return out.flatMap((c) => (c.length > MAX_CHUNK ? c.match(new RegExp(`.{1,${MAX_CHUNK}}`, 'g')) : [c]));
}

async function translatePart(text) {
  if (cache.has(text)) return cache.get(text);
  const ctl = new AbortController();
  const timeout = setTimeout(() => ctl.abort(), 9000);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|vi`;
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const out = data && data.responseData && data.responseData.translatedText;
    if (Number(data.responseStatus) !== 200 || !out) {
      throw new Error(data.responseDetails || 'Không có kết quả');
    }
    const vi = decode(out);
    cache.set(text, vi);
    return vi;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateLine(line) {
  const parts = await Promise.all(chunks(line).map(translatePart));
  return parts.join(' ');
}

function rubyHtml(py, text) {
  if (!py) return esc(text);
  return py(text, { type: 'all', toneType: 'symbol' })
    .map((it) => (it.isZh ? `<ruby>${esc(it.origin)}<rt>${esc(it.pinyin)}</rt></ruby>` : esc(it.origin)))
    .join('');
}

function card(i, line, py) {
  return (
    `<div class="trc" data-i="${i}"><div class="zh">${rubyHtml(py, line)}</div>` +
    `<div class="vi" id="vi-${i}">${HAN.test(line) ? 'Đang dịch…' : '(không có chữ Hán)'}</div>` +
    `<button class="tr-note" data-i="${i}" title="Save to notes.md">+ note</button></div>`
  );
}

async function run() {
  const my = ++token;
  const input = $('#tr-in');
  const out = $('#tr-out');
  store.set({ draft: input.value });
  const lines = input.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!lines.length) {
    out.innerHTML = '<div class="tr-empty">Nhập tiếng Trung ở ô phía trên, bản dịch tiếng Việt kèm pinyin sẽ hiện ở đây.</div>';
    current = { lines: [], py: null, vi: [] };
    return;
  }

  let py = null;
  try {
    py = (await loadPinyin()).pinyin;
  } catch {
    /* pinyin is optional: still show the translation */
  }
  if (my !== token) return;

  current = { lines, py, vi: [] };
  out.innerHTML = lines.map((l, i) => card(i, l, py)).join('');

  lines.forEach(async (line, i) => {
    if (!HAN.test(line)) return;
    const el = $(`#vi-${i}`);
    try {
      const vi = await translateLine(line);
      if (my !== token) return;
      current.vi[i] = vi;
      el.textContent = vi;
    } catch (e) {
      if (my !== token) return;
      el.textContent = `Không dịch được (${e.message}). Thử lại sau vài giây.`;
      el.classList.add('err');
    }
  });
}

function schedule(delay = 800) {
  clearTimeout(timer);
  timer = setTimeout(run, delay);
}

function saveNote(i) {
  const line = current.lines[i];
  if (!line) return;
  const pinyin = current.py ? current.py(line, { toneType: 'symbol' }) : '';
  const vi = current.vi[i] || '';
  store.addNote([line, pinyin, vi].filter(Boolean).join(' | '), P.now());
  bus.emit('notes-changed');
  bus.emit('toast', { msg: 'Saved to notes.md', kind: 'ok' });
}

export function setText(text) {
  $('#tr-in').value = text;
  schedule(50);
}

export function focus() {
  $('#tr-in').focus();
}

export function init() {
  const input = $('#tr-in');
  input.value = store.get().draft || '';

  input.addEventListener('compositionstart', () => (composing = true));
  input.addEventListener('compositionend', () => {
    composing = false;
    schedule();
  });
  input.addEventListener('input', () => {
    if (!composing) schedule();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      schedule(0);
    }
  });
  $('#tr-clear').addEventListener('click', () => {
    input.value = '';
    run();
    input.focus();
  });
  $('#tr-out').addEventListener('click', (e) => {
    const b = e.target.closest('.tr-note');
    if (b) saveNote(Number(b.dataset.i));
  });

  bus.on('translate-set', setText);
  bus.on('translate-focus', focus);
  run();
}

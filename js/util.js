export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(x)}` : `${p(m)}:${p(x)}`;
}

/** "80", "1:20", "1:02:03" -> seconds, NaN when invalid. */
export function parseTime(str) {
  if (str == null) return NaN;
  const parts = String(str).trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function parseStart(v) {
  if (!v) return 0;
  if (/^\d+$/.test(v)) return Number(v);
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
}

const ID = /^[\w-]{11}$/;

/** Accepts watch / youtu.be / shorts / embed / live links or a bare 11-char id. */
export function parseYouTube(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (ID.test(text)) return { id: text, start: 0 };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  const start = parseStart(url.searchParams.get('t') || url.searchParams.get('start'));

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return ID.test(id) ? { id, start } : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && ID.test(v)) return { id: v, start };
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
    if (m) return { id: m[1], start };
  }
  return null;
}

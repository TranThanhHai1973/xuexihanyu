import { bus } from './bus.js';
import { store } from './store.js';

const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const ERRORS = {
  2: 'Invalid video id',
  5: 'Player error, try again',
  100: 'Video not found or private',
  101: 'Owner disabled embedding for this video',
  150: 'Owner disabled embedding for this video',
};

const state = { id: null, loopA: null, loopB: null, mode: 'stealth', speed: store.get().speed };

let yt = null;
let ready = false;
let pendingLoad = null;
let apiPromise = null;
let timer = null;

function loadApi() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('Cannot reach the YouTube player API (check your network)'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

function startTimer() {
  if (timer) return;
  timer = setInterval(tick, 200);
}

function tick() {
  if (!ready) return;
  const t = now();
  const d = yt.getDuration() || 0;
  if (state.loopA != null && state.loopB != null && t >= state.loopB) {
    yt.seekTo(state.loopA, true);
  }
  bus.emit('tick', { t, d });
}

function onStateChange(e) {
  bus.emit('state', e.data);
  const YTS = window.YT.PlayerState;
  if (e.data === YTS.PLAYING || e.data === YTS.CUED) {
    const title = yt.getVideoData && yt.getVideoData().title;
    if (title && state.id) {
      store.touchHistory(state.id, title);
      bus.emit('meta', { id: state.id, title });
    }
  }
}

function onError(e) {
  bus.emit('error', ERRORS[e.data] || `Player error (${e.data})`);
}

function applyRate() {
  if (ready) yt.setPlaybackRate(state.speed);
}

export async function load(id, start = 0) {
  await loadApi();
  state.id = id;
  clearLoop();
  store.set({ last: id, start });
  store.touchHistory(id);

  if (yt && ready) {
    yt.loadVideoById({ videoId: id, startSeconds: start });
    applyRate();
    return;
  }
  if (yt) {
    pendingLoad = { id, start };
    return;
  }
  yt = new window.YT.Player('yt-mount', {
    videoId: id,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      cc_load_policy: store.get().cc ? 1 : 0,
      hl: 'zh-CN',
      cc_lang_pref: 'zh',
      start,
    },
    events: {
      onReady: () => {
        ready = true;
        applyRate();
        if (pendingLoad) {
          yt.loadVideoById({ videoId: pendingLoad.id, startSeconds: pendingLoad.start });
          pendingLoad = null;
        }
        startTimer();
        bus.emit('ready');
      },
      onStateChange,
      onError,
    },
  });
}

export const hasVideo = () => state.id != null;
export const current = () => state.id;
export const getState = () => state;
export const isPlaying = () => ready && yt.getPlayerState() === 1;
export const now = () => (ready ? yt.getCurrentTime() || 0 : 0);

export function play() {
  if (ready) yt.playVideo();
}
export function pause() {
  if (ready) yt.pauseVideo();
}
export function toggle() {
  if (!ready) return;
  if (isPlaying()) pause();
  else play();
}
export function seekTo(sec) {
  if (ready) yt.seekTo(Math.max(0, sec), true);
}
export function seekBy(delta) {
  if (!ready) return;
  const d = yt.getDuration() || Infinity;
  seekTo(Math.min(d, now() + delta));
}
export function stop() {
  if (ready) yt.stopVideo();
  clearLoop();
  setMode('stealth');
}

export function setSpeed(v) {
  const rates = ready && yt.getAvailablePlaybackRates ? yt.getAvailablePlaybackRates() : RATES;
  const next = rates.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  state.speed = next;
  store.set({ speed: next });
  applyRate();
  bus.emit('speed', next);
  return next;
}
export function stepSpeed(dir) {
  const i = RATES.indexOf(state.speed);
  const base = i >= 0 ? i : RATES.indexOf(1);
  return setSpeed(RATES[Math.min(RATES.length - 1, Math.max(0, base + dir))]);
}

export function setVolume(delta) {
  if (!ready) return 0;
  const v = Math.min(100, Math.max(0, yt.getVolume() + delta));
  yt.setVolume(v);
  return v;
}

export function setCaptions(on) {
  store.set({ cc: on });
  if (!ready) return;
  try {
    if (on) yt.loadModule('captions');
    else yt.unloadModule('captions');
  } catch {
    /* captions module is optional */
  }
}

export function setLoop(a, b) {
  state.loopA = a;
  state.loopB = b;
  bus.emit('loop', { a, b });
}
export function clearLoop() {
  setLoop(null, null);
}
/** 1st call marks A, 2nd marks B and starts looping, 3rd clears. */
export function cycleLoop() {
  const t = now();
  if (state.loopA == null) {
    setLoop(t, null);
    return 'A';
  }
  if (state.loopB == null) {
    if (t - state.loopA < 1) return 'short';
    setLoop(state.loopA, t);
    seekTo(state.loopA);
    return 'on';
  }
  clearLoop();
  return 'off';
}

export function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode;
  bus.emit('mode', mode);
}
export function cycleMode() {
  const order = ['stealth', 'peek', 'full'];
  setMode(order[(order.indexOf(state.mode) + 1) % order.length]);
}

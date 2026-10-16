import * as P from './player.js';
import { bus } from './bus.js';
import { store } from './store.js';
import { fmt, parseTime, parseYouTube } from './util.js';

const ok = (text) => ({ text: `[ok] ${text}`, kind: 'ok' });
const err = (text) => ({ text: `[error] ${text}`, kind: 'err' });
const dim = (text) => ({ text, kind: 'dim' });
const plain = (text) => ({ text, kind: '' });

export async function openUrl(raw) {
  const r = parseYouTube(raw);
  if (!r) return [err('Not a valid YouTube link or video id')];
  try {
    await P.load(r.id, r.start);
  } catch (e) {
    return [err(e.message)];
  }
  return [ok(`session started: ${r.id}${r.start ? ` @${fmt(r.start)}` : ''}`)];
}

export function loopLabel(res) {
  if (res === 'A') return 'loop: point A set, run again to set B';
  if (res === 'on') return 'loop: on';
  if (res === 'short') return 'loop: move forward before setting B';
  return 'loop: off';
}

function loopCommand(args) {
  if (!P.hasVideo()) return [err('No active session')];
  const a = args[0];
  if (!a) return [ok(loopLabel(P.cycleLoop()))];
  if (a === 'off') {
    P.clearLoop();
    return [ok('loop: off')];
  }
  const m = a.match(/^([\d:]+)-([\d:]+)$/);
  const from = m ? parseTime(m[1]) : NaN;
  const to = m ? parseTime(m[2]) : NaN;
  if (!(from >= 0) || !(to > from)) return [err('Usage: loop 1:20-1:35 | loop off | loop')];
  P.setLoop(from, to);
  P.seekTo(from);
  return [ok(`loop: ${fmt(from)} - ${fmt(to)}`)];
}

function seekCommand(args) {
  if (!P.hasVideo()) return [err('No active session')];
  const a = args[0];
  if (!a) return [err('Usage: seek +5 | seek -5 | seek 1:20')];
  if (/^[+-]\d+(\.\d+)?$/.test(a)) {
    P.seekBy(Number(a));
    return [ok(`seek ${a}s`)];
  }
  const t = parseTime(a);
  if (Number.isNaN(t)) return [err('Usage: seek +5 | seek -5 | seek 1:20')];
  P.seekTo(t);
  return [ok(`seek ${fmt(t)}`)];
}

const HELP = [
  'play <url|id>      start a video (no argument: resume the last one)',
  'pause | resume     pause or continue',
  'seek +5|-5|1:20    jump relative or absolute',
  'speed 0.75         playback speed (0.25 - 2)',
  'loop 1:20-1:35     loop a range; "loop" marks A/B live; "loop off"',
  'cc on|off          captions',
  'mode stealth|peek|full',
  'note <text>        save a phrase with the current timestamp',
  'tr [text]          open the translator (Chinese to Vietnamese + pinyin)',
  'notes | history    open notes.md / history.json',
  'clear              clear terminal',
];

export async function run(line) {
  const [cmd = '', ...args] = line.trim().split(/\s+/);
  const rest = line.trim().slice(cmd.length).trim();

  switch (cmd.toLowerCase()) {
    case '':
      return [];
    case 'help':
      return HELP.map(plain);
    case 'play': {
      if (rest) return openUrl(rest);
      if (P.hasVideo()) {
        P.play();
        return [ok('resumed')];
      }
      const { last, start } = store.get();
      return last ? openUrl(`${last}${start ? `?t=${start}` : ''}`) : [err('Usage: play <youtube-url>')];
    }
    case 'pause':
      P.pause();
      return [ok('paused')];
    case 'resume':
    case 'continue':
      P.play();
      return [ok('resumed')];
    case 'stop':
      P.stop();
      return [ok('stopped')];
    case 'seek':
      return seekCommand(args);
    case 'speed': {
      const v = Number(args[0]);
      if (!(v >= 0.25 && v <= 2)) return [err('Usage: speed 0.25 - 2')];
      return [ok(`speed ${P.setSpeed(v).toFixed(2)}x`)];
    }
    case 'loop':
      return loopCommand(args);
    case 'cc': {
      const on = args[0] !== 'off';
      P.setCaptions(on);
      return [ok(`captions ${on ? 'on' : 'off'}`)];
    }
    case 'mode': {
      if (!['stealth', 'peek', 'full'].includes(args[0])) return [err('Usage: mode stealth|peek|full')];
      P.setMode(args[0]);
      return [ok(`mode ${args[0]}`)];
    }
    case 'note': {
      if (!rest) return [err('Usage: note <text>')];
      store.addNote(rest, P.now());
      bus.emit('notes-changed');
      return [ok(`saved at ${fmt(P.now())}`)];
    }
    case 'tr':
    case 'translate':
      bus.emit('open-file', 'translate.md');
      if (rest) bus.emit('translate-set', rest);
      return [ok('opened translate.md')];
    case 'notes':
      bus.emit('open-file', 'notes.md');
      return [ok('opened notes.md')];
    case 'history':
      bus.emit('open-file', 'history.json');
      return [ok('opened history.json')];
    case 'ls':
      return [plain('src/  data/  notes.md  README.md  requirements.txt')];
    case 'clear':
      bus.emit('term-clear');
      return [];
    default:
      return [err(`command not found: ${cmd} (try "help")`)];
  }
}

export const COMMANDS = [
  { label: 'Debug: Continue / Pause', key: 'F5', run: () => P.toggle() },
  { label: 'Debug: Step Back 5s', key: 'Left', run: () => P.seekBy(-5) },
  { label: 'Debug: Step Over 5s', key: 'Right', run: () => P.seekBy(5) },
  { label: 'Debug: Toggle Loop A-B', key: 'L', run: () => bus.emit('toast', { msg: loopLabel(P.cycleLoop()), kind: 'ok' }) },
  { label: 'Debug: Restart', run: () => P.seekTo(0) },
  { label: 'Debug: Stop', run: () => P.stop() },
  { label: 'Debug: Speed Down', key: '[', run: () => P.stepSpeed(-1) },
  { label: 'Debug: Speed Up', key: ']', run: () => P.stepSpeed(1) },
  { label: 'Debug: Captions On', run: () => P.setCaptions(true) },
  { label: 'Debug: Captions Off', run: () => P.setCaptions(false) },
  { label: 'View: Hide Preview (stealth)', key: 'Esc Esc', run: () => P.setMode('stealth') },
  { label: 'View: Show Preview Panel (peek)', key: 'Alt+P', run: () => P.setMode('peek') },
  { label: 'View: Toggle Full Screen Preview', key: 'Alt+F', run: () => P.setMode(P.getState().mode === 'full' ? 'stealth' : 'full') },
  { label: 'File: Open Translator (translate.md)', key: 'Alt+T', run: () => bus.emit('open-file', 'translate.md') },
  { label: 'File: Open notes.md', run: () => bus.emit('open-file', 'notes.md') },
  { label: 'File: Open history.json', run: () => bus.emit('open-file', 'history.json') },
  { label: 'Developer: Reload Window', key: 'Ctrl+R', run: () => location.reload() },
  { label: 'Terminal: Focus Terminal', key: 'Ctrl+`', run: () => bus.emit('focus-terminal') },
];

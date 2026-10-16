const KEY = 'codecamo:v1';
const defaults = { last: null, start: 0, speed: 1, cc: false, notes: [], history: [] };

let data = { ...defaults };
try {
  data = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {
  data = { ...defaults };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage may be blocked (private mode); the app still works */
  }
}

export const store = {
  get: () => data,
  set(patch) {
    Object.assign(data, patch);
    save();
  },
  addNote(text, at) {
    data.notes.push({ text, at, vid: data.last });
    save();
  },
  touchHistory(id, title) {
    const i = data.history.findIndex((h) => h.id === id);
    const entry = i >= 0 ? data.history.splice(i, 1)[0] : { id, title: '' };
    if (title) entry.title = title;
    entry.at = Date.now();
    data.history.unshift(entry);
    data.history.length = Math.min(data.history.length, 30);
    save();
  },
};

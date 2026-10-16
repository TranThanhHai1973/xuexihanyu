const map = new Map();

export const bus = {
  on(evt, fn) {
    if (!map.has(evt)) map.set(evt, new Set());
    map.get(evt).add(fn);
  },
  emit(evt, data) {
    const set = map.get(evt);
    if (set) set.forEach((fn) => fn(data));
  },
};

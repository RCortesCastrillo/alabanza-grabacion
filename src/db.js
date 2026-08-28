import { get, set, del, keys, createStore } from 'idb-keyval';

const store = createStore('alabanza', 'datos');

export const SECTIONS = [
  { id: 'entrada', label: 'Inicio', initial: 1 },
  { id: 'gozo', label: 'Alabanza', initial: 1, single: true, hint: 'Todos los cantos de alabanza seguidos, en una sola grabación, para que el ritmo no cambie entre uno y otro.' },
  { id: 'adoracion', label: 'Adoración', initial: 1 }
];
export const MAX_SONGS = 20;

export function nextSunday(from = new Date()) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + ((7 - day) % 7));
  return d.toISOString().slice(0, 10);
}

export function defaultSession() {
  return {
    counts: Object.fromEntries(SECTIONS.map(s => [s.id, s.initial])),
    name: '',
    date: nextSunday(),
    bitrate: 128
  };
}

export async function loadSession() {
  const s = await get('session', store);
  const session = { ...defaultSession(), ...(s || {}) };
  // Las secciones de una sola grabación siempre tienen 1.
  for (const sec of SECTIONS) if (sec.single) session.counts[sec.id] = 1;
  return session;
}
export function saveSession(session) {
  return set('session', session, store);
}

export const takeKey = (sectionId, n) => `take:${sectionId}:${n}`;

export function getTake(sectionId, n) {
  return get(takeKey(sectionId, n), store);
}
export function saveTake(sectionId, n, take) {
  return set(takeKey(sectionId, n), take, store);
}
export function deleteTake(sectionId, n) {
  return del(takeKey(sectionId, n), store);
}

export async function loadAllTakes() {
  const all = await keys(store);
  const out = {};
  for (const k of all) {
    if (typeof k === 'string' && k.startsWith('take:')) {
      const take = await get(k, store);
      if (take) out[k] = take;
    }
  }
  return out;
}

export async function clearAllTakes() {
  const all = await keys(store);
  for (const k of all) {
    if (typeof k === 'string' && k.startsWith('take:')) await del(k, store);
  }
}

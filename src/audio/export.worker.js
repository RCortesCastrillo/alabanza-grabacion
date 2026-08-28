// Worker de exportación, en modo "flujo": recibe una toma a la vez, la procesa
// (tono, recorte de aire, volumen, fundidos) y la codifica a MP3 de inmediato.
// Así nunca hay más de una toma descomprimida en memoria, aunque sean 30 minutos.
import { Mp3Encoder } from '@breezystack/lamejs';
import { applyTone } from './tone.js';

const SR = 44100;
const WIN_MS = 20;
const SILENCE_BELOW_PEAK_DB = 42; // "silencio" = 42 dB por debajo del pico de la toma (relativo, no fijo)
const SILENCE_FLOOR_DB = -60;      // y nunca más alto que esto en absoluto
const PAD_START_MS = 300;          // colchón antes del primer sonido
const PAD_END_MS = 800;            // colchón después del último (la guitarra sigue sonando)
const GAP_MS = 2000;               // pausa entre secciones, como en vivo
const FADE_OUT_MS = 500;
const FADE_IN_MS = 120;
const TARGET_RMS_DB = -14;
const PEAK_LIMIT = Math.pow(10, -1 / 20); // -1 dBFS

const post = (type, data) => self.postMessage({ type, ...data });

let enc = null, chunks = [], total = 0, done = 0, index = 0;
const BLOCK = 1152 * 20;
const int16 = new Int16Array(BLOCK);

self.onmessage = e => {
  const m = e.data;
  try {
    if (m.type === 'start') {
      enc = new Mp3Encoder(1, SR, m.bitrate || 128);
      chunks = []; total = m.count; done = 0; index = 0;
    } else if (m.type === 'take') {
      processTake(m.samples);
      done++;
      post('takeDone', { index: done });
    } else if (m.type === 'finish') {
      const tail = enc.flush();
      if (tail.length) chunks.push(new Uint8Array(tail));
      post('done', { blob: new Blob(chunks, { type: 'audio/mpeg' }) });
      chunks = []; enc = null;
    }
  } catch (err) {
    post('error', { message: err?.message || String(err) });
  }
};

function processTake(samples) {
  const base = done / total, span = 1 / total;
  const prog = (step, pct) => post('progress', { step, pct: base + span * pct });

  prog('trim', 0);
  applyTone(samples, SR);
  const s = trimEdges(samples); // vista sobre el mismo buffer, sin copiar
  prog('trim', 1);

  prog('level', 0);
  const r = rms(s);
  let gain = r > 0 ? Math.pow(10, TARGET_RMS_DB / 20) / r : 1;
  const pk = peak(s);
  if (pk * gain > PEAK_LIMIT) gain = PEAK_LIMIT / pk;
  if (Math.abs(gain - 1) > 1e-3) for (let k = 0; k < s.length; k++) s[k] *= gain;
  prog('level', 1);

  prog('join', 0);
  const n = s.length;
  const fIn = Math.min(Math.round(SR * FADE_IN_MS / 1000), n);
  const fOut = Math.min(Math.round(SR * FADE_OUT_MS / 1000), n);
  for (let k = 0; k < fIn; k++) s[k] *= k / fIn;
  for (let k = 0; k < fOut; k++) s[n - 1 - k] *= k / fOut;
  if (index > 0) encodeSilence(Math.round(SR * GAP_MS / 1000));
  index++;
  prog('join', 1);

  encode(s, pct => prog('encode', pct));
}

function rms(s) {
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s[i] * s[i];
  return Math.sqrt(sum / (s.length || 1));
}
function peak(s) {
  let p = 0;
  for (let i = 0; i < s.length; i++) { const a = Math.abs(s[i]); if (a > p) p = a; }
  return p;
}

function trimEdges(s) {
  const win = Math.round(SR * WIN_MS / 1000);
  const padStart = Math.round(SR * PAD_START_MS / 1000);
  const padEnd = Math.round(SR * PAD_END_MS / 1000);
  const pk = peak(s);
  if (pk <= 0) return s.subarray(0, Math.min(s.length, padStart));
  const thrDb = Math.min(20 * Math.log10(pk) - SILENCE_BELOW_PEAK_DB, SILENCE_FLOOR_DB);
  const thr = Math.pow(10, thrDb / 20);
  const nWin = Math.floor(s.length / win);
  let first = -1, last = -1;
  for (let w = 0; w < nWin; w++) {
    let sum = 0;
    const off = w * win;
    for (let i = 0; i < win; i++) sum += s[off + i] * s[off + i];
    if (Math.sqrt(sum / win) > thr) { if (first < 0) first = w; last = w; }
  }
  if (first < 0) return s.subarray(0, Math.min(s.length, padStart));
  const start = Math.max(0, first * win - padStart);
  const end = Math.min(s.length, (last + 1) * win + padEnd);
  return s.subarray(start, end);
}

function encodeSilence(count) {
  int16.fill(0);
  for (let i = 0; i < count; i += BLOCK) {
    const len = Math.min(BLOCK, count - i);
    const buf = enc.encodeBuffer(len === BLOCK ? int16 : int16.subarray(0, len));
    if (buf.length) chunks.push(new Uint8Array(buf));
  }
}

function encode(samples, onPct) {
  for (let i = 0; i < samples.length; i += BLOCK) {
    const len = Math.min(BLOCK, samples.length - i);
    for (let k = 0; k < len; k++) {
      const v = Math.max(-1, Math.min(1, samples[i + k]));
      int16[k] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = enc.encodeBuffer(len === BLOCK ? int16 : int16.subarray(0, len));
    if (buf.length) chunks.push(new Uint8Array(buf));
    if ((i / BLOCK) % 8 === 0) onPct(i / samples.length);
  }
  onPct(1);
}

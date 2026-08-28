// Worker de exportación: recorte de silencios, emparejar volumen, concatenar con fundidos, MP3.
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

self.onmessage = e => {
  const { takes, bitrate } = e.data;
  try {
    const mp3 = process(takes, bitrate || 128);
    post('done', { blob: mp3 });
  } catch (err) {
    post('error', { message: err?.message || String(err) });
  }
};

function process(takes, bitrate) {
  const n = takes.length;
  // 1. Recortar aire en las orillas.
  post('progress', { step: 'trim', pct: 0 });
  const trimmed = takes.map((t, i) => {
    const out = trimEdges(applyTone(t.samples, SR));
    post('progress', { step: 'trim', pct: (i + 1) / n });
    return out;
  });

  // 2. Emparejar volumen.
  post('progress', { step: 'level', pct: 0 });
  const targetRms = Math.pow(10, TARGET_RMS_DB / 20);
  trimmed.forEach((s, i) => {
    const r = rms(s);
    let gain = r > 0 ? targetRms / r : 1;
    const pk = peak(s);
    if (pk * gain > PEAK_LIMIT) gain = PEAK_LIMIT / pk;
    if (Math.abs(gain - 1) > 1e-3) for (let k = 0; k < s.length; k++) s[k] *= gain;
    post('progress', { step: 'level', pct: (i + 1) / n });
  });

  // 3. Concatenar con pausa y fundidos suaves.
  post('progress', { step: 'join', pct: 0 });
  const joined = concatWithGaps(trimmed);
  post('progress', { step: 'join', pct: 1 });

  // 4. MP3.
  post('progress', { step: 'encode', pct: 0 });
  return encodeMp3(joined, bitrate);
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
  if (pk <= 0) return s.slice(0, Math.min(s.length, padStart));
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
  if (first < 0) return s.slice(0, Math.min(s.length, padStart));
  const start = Math.max(0, first * win - padStart);
  const end = Math.min(s.length, (last + 1) * win + padEnd);
  return s.slice(start, end);
}

function concatWithGaps(parts) {
  const gap = Math.round(SR * GAP_MS / 1000);
  const fo = Math.round(SR * FADE_OUT_MS / 1000);
  const fi = Math.round(SR * FADE_IN_MS / 1000);
  let total = 0;
  parts.forEach((p, i) => { total += p.length + (i > 0 ? gap : 0); });
  const out = new Float32Array(total);
  let pos = 0;
  parts.forEach((p, i) => {
    if (i > 0) pos += gap; // silencio entre secciones
    const n = p.length;
    const fIn = Math.min(fi, n), fOut = Math.min(fo, n);
    for (let k = 0; k < fIn; k++) p[k] *= k / fIn;
    for (let k = 0; k < fOut; k++) p[n - 1 - k] *= k / fOut;
    out.set(p, pos);
    pos += n;
  });
  return out;
}

function encodeMp3(samples, kbps) {
  const enc = new Mp3Encoder(1, SR, kbps);
  const block = 1152 * 20;
  const chunks = [];
  const int16 = new Int16Array(block);
  for (let i = 0; i < samples.length; i += block) {
    const len = Math.min(block, samples.length - i);
    for (let k = 0; k < len; k++) {
      const v = Math.max(-1, Math.min(1, samples[i + k]));
      int16[k] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = enc.encodeBuffer(len === block ? int16 : int16.subarray(0, len));
    if (buf.length) chunks.push(new Uint8Array(buf));
    if ((i / block) % 8 === 0) post('progress', { step: 'encode', pct: i / samples.length });
  }
  const tail = enc.flush();
  if (tail.length) chunks.push(new Uint8Array(tail));
  post('progress', { step: 'encode', pct: 1 });
  return new Blob(chunks, { type: 'audio/mpeg' });
}

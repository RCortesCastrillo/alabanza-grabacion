// Worker de exportación: recorte de silencios, emparejar volumen, concatenar con fundidos, MP3.
import { Mp3Encoder } from '@breezystack/lamejs';
import { applyTone } from './tone.js';

const SR = 44100;
const WIN_MS = 20;
const SILENCE_DB = -45;
const PAD_MS = 80;
const XFADE_MS = 15;
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

  // 3. Concatenar con fundidos traslapados.
  post('progress', { step: 'join', pct: 0 });
  const joined = concatWithCrossfade(trimmed);
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
  const thr = Math.pow(10, SILENCE_DB / 20);
  const pad = Math.round(SR * PAD_MS / 1000);
  const nWin = Math.floor(s.length / win);
  let first = -1, last = -1;
  for (let w = 0; w < nWin; w++) {
    let sum = 0;
    const off = w * win;
    for (let i = 0; i < win; i++) sum += s[off + i] * s[off + i];
    if (Math.sqrt(sum / win) > thr) { if (first < 0) first = w; last = w; }
  }
  if (first < 0) return s.slice(0, Math.min(s.length, pad * 2)); // toma vacía: casi nada
  const start = Math.max(0, first * win - pad);
  const end = Math.min(s.length, (last + 1) * win + pad);
  return s.slice(start, end);
}

function concatWithCrossfade(parts) {
  const xf = Math.round(SR * XFADE_MS / 1000);
  let total = 0;
  parts.forEach((p, i) => { total += p.length - (i > 0 ? Math.min(xf, p.length) : 0); });
  const out = new Float32Array(Math.max(total, 0));
  let pos = 0;
  parts.forEach((p, i) => {
    if (i === 0) { out.set(p, 0); pos = p.length; return; }
    const f = Math.min(xf, p.length, pos);
    const start = pos - f;
    for (let k = 0; k < f; k++) {
      const t = k / f;
      out[start + k] = out[start + k] * (1 - t) + p[k] * t;
    }
    out.set(p.subarray(f), pos);
    pos += p.length - f;
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

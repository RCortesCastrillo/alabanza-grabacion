// Reproductor para las tomas crudas de MediaRecorder.
//
// Los blobs de MediaRecorder no traen duración en la cabecera: en iPhone el <audio>
// se queda mudo al primer "play" y no deja adelantar. Y reproducir con Web Audio
// se silencia con el interruptor lateral del iPhone. Solución: decodificar la toma,
// escribirla como WAV (cabecera completa) y dársela al <audio> del sistema.

import { applyTone } from './tone.js';

const fmt = s => {
  s = Math.max(0, Math.round(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

async function decode(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const c = new AC();
  try {
    const ab = await blob.arrayBuffer();
    return await new Promise((res, rej) => {
      const p = c.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  } finally {
    c.close().catch(() => {});
  }
}

function toWav(buffer) {
  const ch = buffer.numberOfChannels, n = buffer.length, sr = buffer.sampleRate;
  const mono = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / ch;
  }
  applyTone(mono, sr);
  // Normalizar para escuchar: pico a -1 dBFS. La grabación cruda queda igual.
  let pk = 0;
  for (let i = 0; i < n; i++) { const a = Math.abs(mono[i]); if (a > pk) pk = a; }
  const gain = pk > 0 ? Math.min(0.891 / pk, 40) : 1;
  if (gain !== 1) for (let i = 0; i < n; i++) mono[i] *= gain;
  const out = new ArrayBuffer(44 + n * 2);
  const v = new DataView(out);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, mono[i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([out], { type: 'audio/wav' });
}

// Caché: la misma toma no se decodifica dos veces.
const wavCache = new WeakMap();
async function wavUrlFor(blob) {
  if (wavCache.has(blob)) return wavCache.get(blob);
  const buffer = await decode(blob);
  const url = URL.createObjectURL(toWav(buffer));
  wavCache.set(blob, url);
  return url;
}

export function mountPlayer(container, blob, { autoplay = false } = {}) {
  container.innerHTML = `<div class="player-loading">Preparando el audio…</div>`;
  let audio = null, dead = false;

  (async () => {
    let url, note = '';
    try {
      url = await wavUrlFor(blob);
    } catch (err) {
      console.warn('[reproductor] no se pudo decodificar, se usa el archivo crudo', err);
      url = URL.createObjectURL(blob);
      note = '<p class="muted">Si no suena a la primera, pausa y vuelve a darle play.</p>';
    }
    if (dead) return;
    container.innerHTML = `<audio controls playsinline preload="auto" src="${url}" style="width:100%"></audio>${note}`;
    audio = container.querySelector('audio');
    if (autoplay) audio.play().catch(() => {});
  })();

  return {
    pause() { audio?.pause(); },
    destroy() { dead = true; audio?.pause(); audio = null; container.innerHTML = ''; }
  };
}

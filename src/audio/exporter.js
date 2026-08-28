// Decodifica las tomas en el hilo principal (decodeAudioData no existe en workers en Safari),
// las remuestrea a 44100 Hz y manda todo al worker para el resto.

const SR = 44100;

async function decodeToMono(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ sampleRate: SR });
  const ab = await blob.arrayBuffer();
  let buffer = await new Promise((res, rej) => {
    // Safari viejo solo acepta callbacks.
    const p = ctx.decodeAudioData(ab, res, rej);
    if (p && p.then) p.then(res, rej);
  });
  if (buffer.sampleRate !== SR) {
    const len = Math.ceil(buffer.duration * SR);
    const off = new OfflineAudioContext(1, len, SR);
    const src = off.createBufferSource();
    src.buffer = buffer;
    src.connect(off.destination);
    src.start();
    buffer = await off.startRendering();
  }
  const ch = buffer.numberOfChannels;
  const mono = new Float32Array(buffer.length);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) mono[i] += d[i] / ch;
  }
  await ctx.close().catch(() => {});
  return mono;
}

export async function exportMp3(takes, { bitrate = 128, onProgress = () => {} } = {}) {
  const samples = [];
  for (let i = 0; i < takes.length; i++) {
    onProgress({ step: 'decode', pct: i / takes.length });
    samples.push(await decodeToMono(takes[i].blob));
  }
  onProgress({ step: 'decode', pct: 1 });

  const worker = new Worker(new URL('./export.worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'progress') onProgress({ step: m.step, pct: m.pct });
      else if (m.type === 'done') { worker.terminate(); resolve(m.blob); }
      else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
    };
    worker.onerror = err => { worker.terminate(); reject(err.error || new Error(err.message)); };
    worker.postMessage({ takes: samples.map(s => ({ samples: s })), bitrate }, samples.map(s => s.buffer));
  });
}

// Decodifica las tomas en el hilo principal (decodeAudioData no existe en workers en Safari),
// las remuestrea a 44100 Hz y las manda al worker UNA POR UNA. El buffer se transfiere
// (no se copia), así que el hilo principal no retiene más de una toma a la vez.

const SR = 44100;

async function decodeToMono(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ sampleRate: SR });
  try {
    const ab = await blob.arrayBuffer();
    let buffer = await new Promise((res, rej) => {
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
    if (ch === 1) {
      buffer.copyFromChannel(mono, 0);
    } else {
      for (let c = 0; c < ch; c++) {
        const d = buffer.getChannelData(c);
        for (let i = 0; i < d.length; i++) mono[i] += d[i] / ch;
      }
    }
    return mono;
  } finally {
    ctx.close().catch(() => {});
  }
}

export async function exportMp3(takes, { bitrate = 128, onProgress = () => {} } = {}) {
  const worker = new Worker(new URL('./export.worker.js', import.meta.url), { type: 'module' });
  const n = takes.length;
  return new Promise(async (resolve, reject) => {
    let waitTake = null;
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === 'progress') onProgress({ step: m.step, pct: m.pct });
      else if (m.type === 'takeDone') waitTake?.();
      else if (m.type === 'done') { worker.terminate(); resolve(m.blob); }
      else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
    };
    worker.onerror = err => { worker.terminate(); reject(err.error || new Error(err.message)); };
    try {
      worker.postMessage({ type: 'start', bitrate, count: n });
      for (let i = 0; i < n; i++) {
        onProgress({ step: 'decode', pct: (i + 0.5) / n });
        const mono = await decodeToMono(takes[i].blob);
        const doneP = new Promise(r => { waitTake = r; });
        worker.postMessage({ type: 'take', samples: mono }, [mono.buffer]);
        await doneP; // esperar a que el worker termine esta toma antes de decodificar la siguiente
      }
      worker.postMessage({ type: 'finish' });
    } catch (err) {
      worker.terminate();
      reject(err);
    }
  });
}

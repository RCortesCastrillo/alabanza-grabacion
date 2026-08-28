// Captura de audio: micrófono sin procesamiento, MediaRecorder, medidor de nivel,
// Wake Lock y manejo de interrupciones.

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];

export function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIME_CANDIDATES.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

export function isSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined');
}

export class Recorder {
  constructor({ onLevel, onStop, onTick } = {}) {
    this.onLevel = onLevel || (() => {});
    this.onStop = onStop || (() => {});
    this.onTick = onTick || (() => {});
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.ctx = null;
    this.analyser = null;
    this.raf = 0;
    this.tick = 0;
    this.startedAt = 0;
    this.wakeLock = null;
    this.stopping = false;
    this.settingsReport = null;
    this._onVis = this._onVis.bind(this);
  }

  async start() {
    const constraints = {
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1
      }
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = this.stream.getAudioTracks()[0];

    // Verificar qué aplicó el navegador realmente.
    const s = track.getSettings ? track.getSettings() : {};
    this.settingsReport = {
      echoCancellation: s.echoCancellation,
      noiseSuppression: s.noiseSuppression,
      autoGainControl: s.autoGainControl,
      channelCount: s.channelCount,
      sampleRate: s.sampleRate,
      allOff: s.echoCancellation === false && s.noiseSuppression === false && s.autoGainControl === false
    };
    if (!this.settingsReport.allOff) {
      console.warn('[grabadora] el navegador no apagó todo el procesamiento:', this.settingsReport);
    }

    // Medidor de nivel.
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      src.connect(this.analyser);
      this._buf = new Float32Array(this.analyser.fftSize);
      this._meter();
    } catch (e) {
      console.warn('[grabadora] sin medidor de nivel', e);
    }

    const mime = pickMimeType();
    this.mime = mime;
    this.recorder = new MediaRecorder(this.stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.recorder.onerror = () => this.stop(true);

    // Interrupciones: llamada, pantalla bloqueada, otra app toma el micrófono.
    track.addEventListener('ended', () => this.stop(true));
    track.addEventListener('mute', () => this.stop(true));
    document.addEventListener('visibilitychange', this._onVis);

    await this._requestWakeLock();

    this.recorder.start(1000); // trozos cada segundo: si algo se cae, lo grabado ya está en chunks
    this.startedAt = performance.now();
    this.tick = setInterval(() => this.onTick(this.elapsed()), 250);
  }

  elapsed() {
    return this.startedAt ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  _onVis() {
    if (document.visibilityState === 'hidden') this.stop(true);
  }

  async _requestWakeLock() {
    try {
      if ('wakeLock' in navigator) this.wakeLock = await navigator.wakeLock.request('screen');
    } catch { /* no pasa nada */ }
  }

  _meter() {
    const loop = () => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(this._buf);
      let sum = 0, peak = 0;
      for (let i = 0; i < this._buf.length; i++) {
        const v = this._buf[i];
        sum += v * v;
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sum / this._buf.length);
      const db = 20 * Math.log10(rms || 1e-8);
      this.onLevel({ rms, peak, db });
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  // Devuelve una promesa con { blob, duration, interrupted, mime, settings }.
  stop(interrupted = false) {
    if (this.stopping) return this._stopPromise;
    this.stopping = true;
    const duration = this.elapsed();
    this._stopPromise = new Promise(resolve => {
      const finish = () => {
        const blob = new Blob(this.chunks, { type: this.recorder?.mimeType || this.mime || 'audio/webm' });
        this._cleanup();
        const result = { blob, duration, interrupted, mime: blob.type, settings: this.settingsReport };
        this.onStop(result);
        resolve(result);
      };
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.onstop = finish;
        try { this.recorder.stop(); } catch { finish(); }
      } else {
        finish();
      }
    });
    return this._stopPromise;
  }

  _cleanup() {
    clearInterval(this.tick);
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this._onVis);
    this.analyser = null;
    if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.wakeLock) { this.wakeLock.release().catch(() => {}); this.wakeLock = null; }
  }
}

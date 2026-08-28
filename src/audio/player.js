// Reproductor propio para las tomas crudas de MediaRecorder.
// Los blobs de MediaRecorder no traen duración en la cabecera y el <audio> nativo
// se queda mudo en el primer "play" en varios celulares. Aquí se decodifica la toma
// y se toca con Web Audio, que es fiable en iOS y Android.

let ctx = null;
let current = null; // reproductor activo, para que solo suene uno a la vez

function getCtx() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx || ctx.state === 'closed') ctx = new AC();
  return ctx;
}

async function decode(blob) {
  const c = getCtx();
  const ab = await blob.arrayBuffer();
  return new Promise((res, rej) => {
    const p = c.decodeAudioData(ab, res, rej);
    if (p && p.then) p.then(res, rej);
  });
}

const fmt = s => {
  s = Math.max(0, Math.round(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const ICON_PLAY = '<svg class="ic fill" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
const ICON_PAUSE = '<svg class="ic fill" viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>';

export function mountPlayer(container, blob, { autoplay = false } = {}) {
  container.innerHTML = `
    <div class="player">
      <button class="pbtn" aria-label="Escuchar">${ICON_PLAY}</button>
      <div class="ptrack" role="progressbar"><i></i></div>
      <div class="ptime">0:00 / --:--</div>
    </div>`;
  const btn = container.querySelector('.pbtn');
  const bar = container.querySelector('.ptrack > i');
  const track = container.querySelector('.ptrack');
  const time = container.querySelector('.ptime');

  let buffer = null, source = null, startAt = 0, offset = 0, playing = false, raf = 0, dead = false;

  const draw = () => {
    if (!buffer) return;
    const pos = playing ? Math.min(buffer.duration, offset + getCtx().currentTime - startAt) : offset;
    bar.style.width = `${(pos / buffer.duration) * 100}%`;
    time.textContent = `${fmt(pos)} / ${fmt(buffer.duration)}`;
    if (playing) raf = requestAnimationFrame(draw);
  };

  const stopSource = () => {
    if (source) { source.onended = null; try { source.stop(); } catch { /* ya parado */ } source = null; }
    cancelAnimationFrame(raf);
  };

  const pause = () => {
    if (!playing) return;
    offset = Math.min(buffer.duration, offset + getCtx().currentTime - startAt);
    stopSource();
    playing = false;
    btn.innerHTML = ICON_PLAY;
    draw();
  };

  const play = async () => {
    if (dead) return;
    const c = getCtx();
    if (c.state === 'suspended') await c.resume();
    if (!buffer) {
      btn.disabled = true; time.textContent = 'Cargando…';
      try { buffer = await decode(blob); }
      catch (err) {
        console.warn('[reproductor] decode falló, usando <audio>', err);
        btn.disabled = false;
        fallbackToNative();
        return;
      }
      finally { btn.disabled = false; }
      if (dead) return;
    }
    if (current && current !== api) current.pause();
    current = api;
    if (offset >= buffer.duration - 0.05) offset = 0;
    source = c.createBufferSource();
    source.buffer = buffer;
    source.connect(c.destination);
    source.onended = () => { if (playing) { playing = false; offset = buffer.duration; btn.innerHTML = ICON_PLAY; draw(); } };
    startAt = c.currentTime;
    source.start(0, offset);
    playing = true;
    btn.innerHTML = ICON_PAUSE;
    draw();
  };

  btn.onclick = () => (playing ? pause() : play());
  track.onclick = e => {
    if (!buffer) return;
    const r = track.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const was = playing;
    if (was) pause();
    offset = frac * buffer.duration;
    if (was) play(); else draw();
  };

  // Plan B: <audio> nativo con el truco para que calcule la duración de blobs sin cabecera.
  function fallbackToNative() {
    const url = URL.createObjectURL(blob);
    container.innerHTML = `<audio controls preload="auto" src="${url}" style="width:100%"></audio>`;
    const a = container.querySelector('audio');
    a.addEventListener('loadedmetadata', () => {
      if (a.duration === Infinity) {
        a.currentTime = 1e101;
        a.addEventListener('timeupdate', function once() { a.removeEventListener('timeupdate', once); a.currentTime = 0; });
      }
    });
    a.play().catch(() => {});
    api.pause = () => a.pause();
    api.destroy = () => { a.pause(); URL.revokeObjectURL(url); };
  }

  const api = {
    pause,
    destroy() { dead = true; pause(); buffer = null; if (current === api) current = null; }
  };
  if (autoplay) play();
  return api;
}

import './style.css';
import { registerSW } from 'virtual:pwa-register';
import {
  SECTIONS, MAX_SONGS, loadSession, saveSession, loadAllTakes,
  takeKey, saveTake, deleteTake, clearAllTakes, nextSunday
} from './db.js';
import { Recorder, isSupported } from './audio/recorder.js';
import { exportMp3 } from './audio/exporter.js';
import { mountPlayer } from './audio/player.js';

registerSW({ immediate: true });

// ---------- Estado ----------
const state = {
  session: null,
  takes: {},          // takeKey -> { blob, duration, mime, interrupted, createdAt }
  view: 'home',       // home | record | mictest | settings | export
  recordTarget: null, // { sectionId, n, label }
  exportResult: null  // { blob, url, name }
};

const app = document.getElementById('app');
const VERSION = '1.6';
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ---------- Utilidades ----------
const fmt = s => {
  s = Math.round(s || 0);
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fechaBonita = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
};
const songList = () => {
  const list = [];
  for (const sec of SECTIONS) {
    for (let n = 1; n <= state.session.counts[sec.id]; n++) {
      list.push({ sectionId: sec.id, n, label: sec.single ? sec.label : `${sec.label} ${n}`, take: state.takes[takeKey(sec.id, n)] || null });
    }
  }
  return list;
};
const fileName = () => {
  const who = (state.session.name || '').trim();
  return `Alabanza ${fechaBonita(state.session.date)}${who ? ' - ' + who : ''}.mp3`;
};

let toastTimer = 0;
function toast(msg, ms = 2600) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

function confirmModal({ title, text, okLabel, danger }) {
  return new Promise(resolve => {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
        <div class="row">
          <button class="btn" data-a="no">Cancelar</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${esc(okLabel)}</button>
        </div>
      </div>`;
    bg.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a && e.target !== bg) return;
      bg.remove(); resolve(a === 'ok');
    });
    document.body.appendChild(bg);
    bg.querySelector('[data-a="no"]').focus();
  });
}

// Íconos
const I = {
  mic: '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  play: '<svg class="ic fill" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
  redo: '<svg class="ic" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  gear: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  back: '<svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  stop: '<svg class="ic fill" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>'
};

// ---------- Render ----------
function render() {
  if (state.view === 'home') renderHome();
  else if (state.view === 'record') renderRecord();
  else if (state.view === 'mictest') renderMicTest();
  else if (state.view === 'settings') renderSettings();
  else if (state.view === 'export') renderExport();
  window.scrollTo(0, 0);
}

function renderHome() {
  const songs = songList();
  const done = songs.filter(s => s.take).length;
  const total = songs.reduce((a, s) => a + (s.take?.duration || 0), 0);
  const allDone = done === songs.length && songs.length > 0;
  const s = state.session;

  app.innerHTML = `
    <header class="top">
      <h1>Grabación</h1>
      <div class="sub">${esc(fechaBonita(s.date))}${s.name ? ' · ' + esc(s.name) : ''} <span class="ver">v${VERSION}</span></div>
      <button class="icon-btn" data-go="settings" aria-label="Ajustes">${I.gear}</button>
    </header>

    <div class="progress">
      <div><span class="n">${done}</span> de ${songs.length} grabados</div>
      <div class="total">${fmt(total)}</div>
    </div>
    <div class="bar"><i style="width:${songs.length ? (done / songs.length) * 100 : 0}%"></i></div>

    ${SECTIONS.map(sec => `
      <section class="section">
        <div class="section-head">
          <h2>${sec.label}${sec.single ? '' : `<span class="count">${s.counts[sec.id]} ${s.counts[sec.id] === 1 ? 'canto' : 'cantos'}</span>`}</h2>
          ${sec.single ? '' : `<div class="stepper">
            <button data-count="${sec.id}" data-d="-1" aria-label="Quitar un canto de ${sec.label}" ${s.counts[sec.id] <= 1 ? 'disabled' : ''}>−</button>
            <button data-count="${sec.id}" data-d="1" aria-label="Agregar un canto a ${sec.label}" ${s.counts[sec.id] >= MAX_SONGS ? 'disabled' : ''}>+</button>
          </div>`}
        </div>
        ${sec.hint ? `<p class="section-hint">${sec.hint}</p>` : ''}
        <div class="spine">
          ${songs.filter(x => x.sectionId === sec.id).map(song => cardHtml(song)).join('')}
        </div>
      </section>`).join('')}

    <div class="tools">
      <button class="btn" data-go="mictest">${I.mic} Probar micrófono</button>
    </div>

    <div class="foot">
      <button class="btn primary big block" data-go="export" ${allDone ? '' : 'disabled'}>Unir y exportar</button>
      <p class="hint">${allDone ? 'Todos los cantos están grabados.' : `Faltan ${songs.length - done} por grabar.`}</p>
    </div>`;
}

function cardHtml(song) {
  const t = song.take;
  const cls = t ? (t.interrupted ? 'card interrupted' : 'card done') : 'card';
  return `
    <div class="${cls}">
      <div class="label">${esc(song.label)}</div>
      <div class="meta">${t
        ? `<span class="dur">${fmt(t.duration)}</span>${t.interrupted ? ' · <span class="flag">Se cortó, revísalo</span>' : ''}`
        : 'Sin grabar'}</div>
      <div class="actions">
        ${t ? `
          <button class="btn sq" data-play="${song.sectionId}:${song.n}" aria-label="Escuchar ${song.label}">${I.play}</button>
          <button class="btn sq" data-rec="${song.sectionId}:${song.n}" aria-label="Regrabar ${song.label}">${I.redo}</button>`
        : `<button class="btn rec" data-rec="${song.sectionId}:${song.n}">${I.mic} Grabar</button>`}
      </div>
    </div>`;
}

// ---------- Grabación ----------
let rec = null;
let recResult = null;
let activePlayer = null;

function dialHtml(mainLabel, mainIcon, mainClass = '') {
  const r = 120, c = 2 * Math.PI * r;
  return `
    <div class="dial">
      <svg viewBox="0 0 260 260">
        <circle class="track" cx="130" cy="130" r="${r}" fill="none" stroke-width="12"/>
        <circle class="level" id="lvl" cx="130" cy="130" r="${r}" fill="none" stroke-width="12"
          stroke-dasharray="${c}" stroke-dashoffset="${c}" stroke-linecap="round"/>
      </svg>
      <button class="main ${mainClass}" id="mainBtn">${mainIcon}<span>${mainLabel}</span></button>
    </div>`;
}

function renderRecord() {
  const tgt = state.recordTarget;
  const existing = state.takes[takeKey(tgt.sectionId, tgt.n)];
  app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${I.back}</button>
        <h2>${existing ? 'Regrabar' : 'Grabar'}</h2>
      </div>
      <div class="rec-screen">
        <div class="what">${esc(tgt.label)}</div>
        <div class="time" id="time">0:00</div>
        ${dialHtml('Grabar', I.mic)}
        <div class="level-hint" id="lvlHint">${SECTIONS.find(x => x.id === tgt.sectionId)?.single ? 'Canta todos los cantos seguidos. Si te equivocas, detén y graba otra vez.' : 'Toca el botón y empieza a cantar.'}</div>
        ${existing ? '<p class="muted">La toma anterior se reemplaza solo si guardas la nueva.</p>' : ''}
        <div class="review" id="review"></div>
      </div>
    </div>`;
  bindDial({ onSaved: saveRecordedTake, label: tgt.label });
}

function renderMicTest() {
  app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${I.back}</button>
        <h2>Probar micrófono</h2>
      </div>
      <div class="notice tip">
        Pon el celular a un palmo de distancia, a la altura del pecho, apuntando al espacio entre tu boca y la boca de la guitarra, ligeramente de lado.
        Pegado a la boca, la guitarra queda lejísimos; sobre la guitarra, al revés.
      </div>
      <div class="rec-screen" style="min-height:auto">
        <p class="muted">Graba 15 segundos de prueba y escúchalos. No se guarda.</p>
        <div class="time" id="time">0:15</div>
        ${dialHtml('Probar', I.mic)}
        <div class="level-hint" id="lvlHint"></div>
        <div class="review" id="review"></div>
      </div>
    </div>`;
  bindDial({ test: true, maxSeconds: 15 });
}

function bindDial({ onSaved, test = false, maxSeconds = 0, label = '' }) {
  const btn = document.getElementById('mainBtn');
  const lvl = document.getElementById('lvl');
  const time = document.getElementById('time');
  const hint = document.getElementById('lvlHint');
  const review = document.getElementById('review');
  const C = 2 * Math.PI * 120;
  let quietSince = 0;
  let smooth = 0;
  recResult = null;

  const setLevel = ({ db, peak }) => {
    // -60 dB → 0, 0 dB → 1
    const x = Math.max(0, Math.min(1, (db + 60) / 60));
    smooth = x > smooth ? x : smooth * 0.9 + x * 0.1;
    lvl.setAttribute('stroke-dashoffset', C * (1 - smooth));
    lvl.classList.toggle('hot', peak > 0.7 && peak <= 0.98);
    lvl.classList.toggle('clip', peak > 0.98);
    const now = performance.now();
    if (db < -40) {
      if (!quietSince) quietSince = now;
      if (now - quietSince > 2500) { hint.textContent = 'Casi no se oye nada. ¿El micrófono está tapado?'; hint.classList.add('low'); }
    } else {
      quietSince = 0; hint.classList.remove('low');
      hint.textContent = peak > 0.98 ? 'Muy fuerte, se puede saturar. Aléjate un poco.' : 'Grabando…';
    }
  };

  const start = async () => {
    if (!isSupported()) { hint.textContent = 'Este navegador no puede grabar. Usa Chrome (Android) o Safari (iPhone).'; return; }
    btn.disabled = true;
    rec = new Recorder({
      onLevel: setLevel,
      onTick: s => {
        time.textContent = fmt(maxSeconds ? Math.max(0, maxSeconds - s) : s);
        if (maxSeconds && s >= maxSeconds) rec?.stop(false);
      },
      onStop: onStopped
    });
    try {
      await rec.start();
    } catch (err) {
      rec = null; btn.disabled = false;
      hint.classList.add('low');
      hint.textContent = err?.name === 'NotAllowedError'
        ? 'No hay permiso para el micrófono. Ve a los ajustes del navegador y dale "Permitir".'
        : 'No se pudo abrir el micrófono. Cierra otras apps que lo estén usando e intenta de nuevo.';
      return;
    }
    if (rec.settingsReport && !rec.settingsReport.allOff) console.info('[grabadora] ajustes reales:', rec.settingsReport);
    btn.disabled = false;
    btn.classList.add('stop');
    btn.innerHTML = `${I.stop}<span>Detener</span>`;
    time.classList.add('live');
    hint.textContent = 'Grabando…';
    btn.onclick = () => rec?.stop(false);
  };

  const onStopped = result => {
    rec = null;
    recResult = result;
    time.classList.remove('live');
    time.textContent = fmt(result.duration);
    lvl.style.transition = 'none';
    lvl.setAttribute('stroke-dashoffset', C);
    lvl.classList.remove('hot', 'clip');
    requestAnimationFrame(() => { lvl.style.transition = ''; });
    btn.classList.remove('stop');
    btn.innerHTML = `${I.redo}<span>Otra vez</span>`;
    btn.onclick = () => { if (activePlayer) { activePlayer.destroy(); activePlayer = null; } review.innerHTML = ''; hint.textContent = ''; start(); };
    hint.textContent = '';
    hint.classList.remove('low');

    const tooShort = result.duration < 1 || result.blob.size < 1000;

    review.innerHTML = `
      ${result.interrupted ? `<div class="notice warn">La grabación se interrumpió (llamada, pantalla bloqueada u otra app). Se guardó lo que alcanzó a grabarse: escúchalo y decide.</div>` : ''}
      ${tooShort ? `<div class="notice err">La toma quedó vacía. Vuelve a intentarlo.</div>` : ''}
      <div id="takePlayer"></div>
      ${test ? '' : `
        <div class="row">
          <button class="btn primary big" id="keep" ${tooShort ? 'disabled' : ''}>Se queda</button>
        </div>`}`;
    if (!tooShort) activePlayer = mountPlayer(document.getElementById('takePlayer'), result.blob);
    if (!test) {
      document.getElementById('keep').onclick = async () => {
        await onSaved(result);
      };
    }
    if (test && !tooShort) hint.textContent = 'Escúchalo. Si se oye bien, ya puedes empezar.';
  };

  btn.onclick = start;
}

async function saveRecordedTake(result) {
  const tgt = state.recordTarget;
  const take = {
    blob: result.blob,
    duration: result.duration,
    mime: result.mime,
    interrupted: result.interrupted,
    micSettings: result.settings,
    createdAt: Date.now()
  };
  await saveTake(tgt.sectionId, tgt.n, take);
  state.takes[takeKey(tgt.sectionId, tgt.n)] = take;
  state.exportResult = null;
  toast(`${tgt.label} guardado`);
  go('home');
}

// ---------- Escuchar una toma ----------
function playTake(sectionId, n) {
  const take = state.takes[takeKey(sectionId, n)];
  if (!take) return;
  const sec = SECTIONS.find(s => s.id === sectionId);
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal">
      <h3>${esc(sec.single ? sec.label : `${sec.label} ${n}`)}</h3>
      <div id="modalPlayer"></div>
      <div class="row">
        <button class="btn" data-a="close">Cerrar</button>
        <button class="btn" data-a="rerec">${I.redo} Regrabar</button>
      </div>
    </div>`;
  bg.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a && e.target !== bg) return;
    player.destroy();
    bg.remove();
    if (a === 'rerec') startRecord(sectionId, n);
  });
  document.body.appendChild(bg);
  const player = mountPlayer(bg.querySelector('#modalPlayer'), take.blob, { autoplay: true });
}

function startRecord(sectionId, n) {
  const sec = SECTIONS.find(s => s.id === sectionId);
  state.recordTarget = { sectionId, n, label: sec.single ? sec.label : `${sec.label} ${n}` };
  go('record');
}

// ---------- Ajustes ----------
function renderSettings() {
  const s = state.session;
  app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${I.back}</button>
        <h2>Ajustes</h2>
      </div>
      <div class="field">
        <label for="fName">Tu nombre</label>
        <input id="fName" type="text" value="${esc(s.name)}" placeholder="Por ejemplo: Juan" autocomplete="off" />
        <div class="help">Va en el nombre del archivo para que el pastor sepa de quién es.</div>
      </div>
      <div class="field">
        <label for="fDate">Domingo</label>
        <input id="fDate" type="date" value="${esc(s.date)}" />
      </div>
      <div class="field">
        <label>Calidad del audio</label>
        <div class="seg" id="segBr">
          <button data-br="128" class="${s.bitrate === 128 ? 'on' : ''}">Normal</button>
          <button data-br="96" class="${s.bitrate === 96 ? 'on' : ''}">Ligera</button>
        </div>
        <div class="help">Normal ≈ 1 MB por minuto. Ligera pesa un 25 % menos.</div>
      </div>
      <p class="muted">El archivo se llamará: <strong>${esc(fileName())}</strong></p>

      <p class="muted">Versión ${VERSION}</p>
      <div class="danger-zone">
        <button class="btn danger block" id="newSunday">Empezar domingo nuevo</button>
        <p class="muted">Borra todas las tomas grabadas. Tu nombre se conserva.</p>
      </div>
    </div>`;

  const save = async () => {
    s.name = document.getElementById('fName').value.trim();
    const d = document.getElementById('fDate').value;
    if (d) s.date = d;
    await saveSession(s);
    document.querySelector('.panel .muted strong').textContent = fileName();
  };
  document.getElementById('fName').addEventListener('input', save);
  document.getElementById('fDate').addEventListener('change', save);
  document.getElementById('segBr').addEventListener('click', async e => {
    const b = e.target.closest('[data-br]'); if (!b) return;
    s.bitrate = Number(b.dataset.br);
    await saveSession(s);
    document.querySelectorAll('#segBr button').forEach(x => x.classList.toggle('on', x === b));
  });
  document.getElementById('newSunday').onclick = async () => {
    const ok = await confirmModal({
      title: 'Empezar domingo nuevo',
      text: 'Se borrarán todas las tomas grabadas. Esto no se puede deshacer.',
      okLabel: 'Sí, borrar todo', danger: true
    });
    if (!ok) return;
    await clearAllTakes();
    state.takes = {};
    state.exportResult = null;
    s.date = nextSunday();
    s.counts = Object.fromEntries(SECTIONS.map(x => [x.id, x.initial]));
    await saveSession(s);
    toast('Listo. Domingo nuevo.');
    go('home');
  };
}

// ---------- Exportar ----------
const STEPS = [
  ['decode', 'Leyendo las tomas'],
  ['trim', 'Quitando el aire de las orillas'],
  ['level', 'Emparejando el volumen'],
  ['join', 'Uniendo los cantos'],
  ['encode', 'Creando el MP3']
];

function renderExport() {
  const songs = songList();
  app.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${I.back}</button>
        <h2>Unir y exportar</h2>
      </div>
      <p class="muted">${songs.length} cantos, ${fmt(songs.reduce((a, s) => a + s.take.duration, 0))} en total.</p>
      <div id="exportBody"></div>
    </div>`;
  if (state.exportResult) showExportResult();
  else runExport();
}

async function runExport() {
  const body = document.getElementById('exportBody');
  body.innerHTML = `
    <ul class="export-steps">${STEPS.map(([k, t]) => `<li data-step="${k}">${t}</li>`).join('')}</ul>
    <div class="bar"><i id="expBar" style="width:0%"></i></div>
    <p class="muted">Esto puede tardar un momento. No cierres la app.</p>`;
  const songs = songList();
  const items = body.querySelectorAll('[data-step]');
  const onProgress = ({ step, pct }) => {
    const idx = STEPS.findIndex(s => s[0] === step);
    items.forEach((li, i) => { li.classList.toggle('done', i < idx); li.classList.toggle('on', i === idx); });
    const overall = (idx + pct) / STEPS.length;
    const bar = document.getElementById('expBar');
    if (bar) bar.style.width = `${Math.round(overall * 100)}%`;
  };
  try {
    const blob = await exportMp3(songs.map(s => s.take), { bitrate: state.session.bitrate, onProgress });
    if (state.view !== 'export') return;
    if (state.exportResult?.url) URL.revokeObjectURL(state.exportResult.url);
    state.exportResult = { blob, url: URL.createObjectURL(blob), name: fileName() };
    showExportResult();
  } catch (err) {
    console.error(err);
    body.innerHTML = `
      <div class="notice err">No se pudo crear el audio. ${esc(err?.message || '')}</div>
      <button class="btn primary block" id="retry">Intentar de nuevo</button>`;
    document.getElementById('retry').onclick = runExport;
  }
}

function showExportResult() {
  const body = document.getElementById('exportBody');
  const r = state.exportResult;
  r.name = fileName();
  const file = new File([r.blob], r.name, { type: 'audio/mpeg' });
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share);
  const mb = (r.blob.size / 1048576).toFixed(1);
  body.innerHTML = `
    <div class="notice ok">Listo. <strong>${esc(r.name)}</strong> <span class="size">(${mb} MB)</span></div>
    <p>Escúchalo antes de mandarlo para revisar que las uniones quedaron limpias:</p>
    <audio controls src="${r.url}" preload="auto"></audio>
    <div style="margin-top:16px">
      ${canShare
        ? `<button class="btn primary big block" id="share">Mandar por WhatsApp</button>
           <p class="hint muted" style="text-align:center">Se abre el menú de compartir; ahí eliges WhatsApp y al pastor.</p>`
        : `<a class="btn primary big block" id="dl" href="${r.url}" download="${esc(r.name)}">Guardar el archivo</a>
           <div class="notice tip">Este navegador no puede mandar el archivo directo. Guárdalo, luego abre WhatsApp, entra al chat del pastor, toca el clip 📎 y elige el archivo <strong>${esc(r.name)}</strong> de tus descargas.</div>`}
      <button class="btn ghost block" id="dlAlt" style="margin-top:10px">${canShare ? 'O guardar el archivo en el celular' : 'Volver a crear el audio'}</button>
    </div>`;
  if (canShare) {
    document.getElementById('share').onclick = async () => {
      try {
        await navigator.share({ files: [file], title: r.name });
        toast('Enviado');
      } catch (err) {
        if (err?.name !== 'AbortError') {
          toast('No se pudo compartir. Prueba guardando el archivo.');
        }
      }
    };
    document.getElementById('dlAlt').onclick = () => {
      const a = document.createElement('a');
      a.href = r.url; a.download = r.name; document.body.appendChild(a); a.click(); a.remove();
      toast('Guardado en descargas');
    };
  } else {
    document.getElementById('dlAlt').onclick = () => { state.exportResult = null; runExport(); };
  }
}

// ---------- Navegación y eventos ----------
function go(view) {
  if (rec) rec.stop(false);
  if (activePlayer) { activePlayer.destroy(); activePlayer = null; }
  state.view = view;
  render();
}

app.addEventListener('click', async e => {
  const t = e.target.closest('[data-go],[data-rec],[data-play],[data-count]');
  if (!t) return;
  if (t.dataset.go) { go(t.dataset.go); return; }
  if (t.dataset.rec) { const [s, n] = t.dataset.rec.split(':'); startRecord(s, Number(n)); return; }
  if (t.dataset.play) { const [s, n] = t.dataset.play.split(':'); playTake(s, Number(n)); return; }
  if (t.dataset.count) {
    const id = t.dataset.count, d = Number(t.dataset.d);
    const cur = state.session.counts[id];
    const next = Math.max(1, Math.min(MAX_SONGS, cur + d));
    if (next === cur) return;
    if (d < 0 && state.takes[takeKey(id, cur)]) {
      const sec = SECTIONS.find(s => s.id === id);
      const ok = await confirmModal({
        title: `Quitar ${sec.label} ${cur}`,
        text: 'Ese canto ya está grabado. Si lo quitas, se borra la toma.',
        okLabel: 'Quitar', danger: true
      });
      if (!ok) return;
      await deleteTake(id, cur);
      delete state.takes[takeKey(id, cur)];
    }
    state.session.counts[id] = next;
    state.exportResult = null;
    await saveSession(state.session);
    render();
  }
});

// ---------- Arranque ----------
(async () => {
  state.session = await loadSession();
  state.takes = await loadAllTakes();
  render();
  if (!isSupported()) {
    toast('Este navegador no puede grabar. Usa Chrome en Android o Safari en iPhone.', 6000);
  }
})();

(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))o(n);new MutationObserver(n=>{for(const s of n)if(s.type==="childList")for(const i of s.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&o(i)}).observe(document,{childList:!0,subtree:!0});function a(n){const s={};return n.integrity&&(s.integrity=n.integrity),n.referrerPolicy&&(s.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?s.credentials="include":n.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function o(n){if(n.ep)return;n.ep=!0;const s=a(n);fetch(n.href,s)}})();const re="modulepreload",le=function(e,t){return new URL(e,t).href},O={},ce=function(t,a,o){let n=Promise.resolve();if(a&&a.length>0){const i=document.getElementsByTagName("link"),r=document.querySelector("meta[property=csp-nonce]"),l=(r==null?void 0:r.nonce)||(r==null?void 0:r.getAttribute("nonce"));n=Promise.allSettled(a.map(c=>{if(c=le(c,o),c in O)return;O[c]=!0;const h=c.endsWith(".css"),d=h?'[rel="stylesheet"]':"";if(!!o)for(let L=i.length-1;L>=0;L--){const p=i[L];if(p.href===c&&(!h||p.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${c}"]${d}`))return;const m=document.createElement("link");if(m.rel=h?"stylesheet":re,h||(m.as="script"),m.crossOrigin="",m.href=c,l&&m.setAttribute("nonce",l),document.head.appendChild(m),h)return new Promise((L,p)=>{m.addEventListener("load",L),m.addEventListener("error",()=>p(new Error(`Unable to preload CSS for ${c}`)))})}))}function s(i){const r=new Event("vite:preloadError",{cancelable:!0});if(r.payload=i,window.dispatchEvent(r),!r.defaultPrevented)throw i}return n.then(i=>{for(const r of i||[])r.status==="rejected"&&s(r.reason);return t().catch(s)})};function de(e={}){const{immediate:t=!1,onNeedRefresh:a,onOfflineReady:o,onRegistered:n,onRegisteredSW:s,onRegisterError:i}=e;let r,l;const c=async(d=!0)=>{await l};async function h(){if("serviceWorker"in navigator){if(r=await ce(async()=>{const{Workbox:d}=await import("./workbox-window.prod.es5-BqEJf4Xk.js");return{Workbox:d}},[],import.meta.url).then(({Workbox:d})=>new d("./sw.js",{scope:"./",type:"classic"})).catch(d=>{i==null||i(d)}),!r)return;r.addEventListener("activated",d=>{(d.isUpdate||d.isExternal)&&window.location.reload()}),r.addEventListener("installed",d=>{d.isUpdate||o==null||o()}),r.register({immediate:t}).then(d=>{s?s("./sw.js",d):n==null||n(d)}).catch(d=>{i==null||i(d)})}}return l=h(),c}function S(e){return new Promise((t,a)=>{e.oncomplete=e.onsuccess=()=>t(e.result),e.onabort=e.onerror=()=>a(e.error)})}function V(e,t){let a;const o=()=>{if(a)return a;const n=indexedDB.open(e);return n.onupgradeneeded=()=>n.result.createObjectStore(t),a=S(n),a.then(s=>{s.onclose=()=>a=void 0},()=>{a=void 0}),a};return(n,s)=>o().then(i=>s(i.transaction(t,n).objectStore(t)))}let q;function R(){return q||(q=V("keyval-store","keyval")),q}function G(e,t=R()){return t("readonly",a=>S(a.get(e)))}function F(e,t,a=R()){return a("readwrite",o=>(o.put(t,e),S(o.transaction)))}function W(e,t=R()){return t("readwrite",a=>(a.delete(e),S(a.transaction)))}function ue(e,t){return e.openCursor().onsuccess=function(){this.result&&(t(this.result),this.result.continue())},S(e.transaction)}function Q(e=R()){return e("readonly",t=>{if(t.getAllKeys)return S(t.getAllKeys());const a=[];return ue(t,o=>a.push(o.key)).then(()=>a)})}const k=V("alabanza","datos"),w=[{id:"entrada",label:"Inicio",initial:1},{id:"gozo",label:"Alabanza",initial:1,single:!0,hint:"Todos los cantos de alabanza seguidos, en una sola grabación, para que el ritmo no cambie entre uno y otro."},{id:"adoracion",label:"Adoración",initial:1}],K=20;function J(e=new Date){const t=new Date(e);t.setHours(12,0,0,0);const a=t.getDay();return t.setDate(t.getDate()+(7-a)%7),t.toISOString().slice(0,10)}function pe(){return{counts:Object.fromEntries(w.map(e=>[e.id,e.initial])),name:"",date:J(),bitrate:128}}async function me(){const e=await G("session",k),t={...pe(),...e||{}};for(const a of w)a.single&&(t.counts[a.id]=1);return t}function B(e){return F("session",e,k)}const $=(e,t)=>`take:${e}:${t}`;function he(e,t,a){return F($(e,t),a,k)}function fe(e,t){return W($(e,t),k)}async function be(){const e=await Q(k),t={};for(const a of e)if(typeof a=="string"&&a.startsWith("take:")){const o=await G(a,k);o&&(t[a]=o)}return t}async function ve(){const e=await Q(k);for(const t of e)typeof t=="string"&&t.startsWith("take:")&&await W(t,k)}const ge=["audio/webm;codecs=opus","audio/mp4","audio/webm","audio/ogg"];function ye(){return typeof MediaRecorder>"u"?null:ge.find(e=>MediaRecorder.isTypeSupported(e))||""}function X(){var e;return!!((e=navigator.mediaDevices)!=null&&e.getUserMedia&&typeof MediaRecorder<"u")}class we{constructor({onLevel:t,onStop:a,onTick:o}={}){this.onLevel=t||(()=>{}),this.onStop=a||(()=>{}),this.onTick=o||(()=>{}),this.stream=null,this.recorder=null,this.chunks=[],this.ctx=null,this.analyser=null,this.raf=0,this.tick=0,this.startedAt=0,this.wakeLock=null,this.stopping=!1,this.settingsReport=null,this._onVis=this._onVis.bind(this)}async start(){const t={audio:{echoCancellation:!1,noiseSuppression:!1,autoGainControl:!1,channelCount:1}};this.stream=await navigator.mediaDevices.getUserMedia(t);const a=this.stream.getAudioTracks()[0],o=a.getSettings?a.getSettings():{};this.settingsReport={echoCancellation:o.echoCancellation,noiseSuppression:o.noiseSuppression,autoGainControl:o.autoGainControl,channelCount:o.channelCount,sampleRate:o.sampleRate,allOff:o.echoCancellation===!1&&o.noiseSuppression===!1&&o.autoGainControl===!1},this.settingsReport.allOff||console.warn("[grabadora] el navegador no apagó todo el procesamiento:",this.settingsReport);try{const s=window.AudioContext||window.webkitAudioContext;this.ctx=new s,this.ctx.state==="suspended"&&await this.ctx.resume();const i=this.ctx.createMediaStreamSource(this.stream);this.analyser=this.ctx.createAnalyser(),this.analyser.fftSize=2048,i.connect(this.analyser),this._buf=new Float32Array(this.analyser.fftSize),this._meter()}catch(s){console.warn("[grabadora] sin medidor de nivel",s)}const n=ye();this.mime=n,this.recorder=new MediaRecorder(this.stream,n?{mimeType:n,audioBitsPerSecond:192e3}:void 0),this.chunks=[],this.recorder.ondataavailable=s=>{s.data&&s.data.size&&this.chunks.push(s.data)},this.recorder.onerror=()=>this.stop(!0),a.addEventListener("ended",()=>this.stop(!0)),a.addEventListener("mute",()=>this.stop(!0)),document.addEventListener("visibilitychange",this._onVis),await this._requestWakeLock(),this.recorder.start(1e3),this.startedAt=performance.now(),this.tick=setInterval(()=>this.onTick(this.elapsed()),250)}elapsed(){return this.startedAt?(performance.now()-this.startedAt)/1e3:0}_onVis(){document.visibilityState==="hidden"&&this.stop(!0)}async _requestWakeLock(){try{"wakeLock"in navigator&&(this.wakeLock=await navigator.wakeLock.request("screen"))}catch{}}_meter(){const t=()=>{if(!this.analyser)return;this.analyser.getFloatTimeDomainData(this._buf);let a=0,o=0;for(let i=0;i<this._buf.length;i++){const r=this._buf[i];a+=r*r;const l=Math.abs(r);l>o&&(o=l)}const n=Math.sqrt(a/this._buf.length),s=20*Math.log10(n||1e-8);this.onLevel({rms:n,peak:o,db:s}),this.raf=requestAnimationFrame(t)};this.raf=requestAnimationFrame(t)}stop(t=!1){if(this.stopping)return this._stopPromise;this.stopping=!0;const a=this.elapsed();return this._stopPromise=new Promise(o=>{const n=()=>{var r;const s=new Blob(this.chunks,{type:((r=this.recorder)==null?void 0:r.mimeType)||this.mime||"audio/webm"});this._cleanup();const i={blob:s,duration:a,interrupted:t,mime:s.type,settings:this.settingsReport};this.onStop(i),o(i)};if(this.recorder&&this.recorder.state!=="inactive"){this.recorder.onstop=n;try{this.recorder.stop()}catch{n()}}else n()}),this._stopPromise}_cleanup(){clearInterval(this.tick),cancelAnimationFrame(this.raf),document.removeEventListener("visibilitychange",this._onVis),this.analyser=null,this.ctx&&(this.ctx.close().catch(()=>{}),this.ctx=null),this.stream&&(this.stream.getTracks().forEach(t=>t.stop()),this.stream=null),this.wakeLock&&(this.wakeLock.release().catch(()=>{}),this.wakeLock=null)}}const C=44100;async function ke(e){const t=window.AudioContext||window.webkitAudioContext,a=new t({sampleRate:C});try{const o=await e.arrayBuffer();let n=await new Promise((r,l)=>{const c=a.decodeAudioData(o,r,l);c&&c.then&&c.then(r,l)});if(n.sampleRate!==C){const r=Math.ceil(n.duration*C),l=new OfflineAudioContext(1,r,C),c=l.createBufferSource();c.buffer=n,c.connect(l.destination),c.start(),n=await l.startRendering()}const s=n.numberOfChannels,i=new Float32Array(n.length);if(s===1)n.copyFromChannel(i,0);else for(let r=0;r<s;r++){const l=n.getChannelData(r);for(let c=0;c<l.length;c++)i[c]+=l[c]/s}return i}finally{a.close().catch(()=>{})}}async function $e(e,{bitrate:t=128,onProgress:a=()=>{}}={}){const o=new Worker(new URL(""+new URL("export.worker-BcEG4ubP.js",import.meta.url).href,import.meta.url),{type:"module"}),n=e.length;return new Promise(async(s,i)=>{let r=null;o.onmessage=l=>{const c=l.data;c.type==="progress"?a({step:c.step,pct:c.pct}):c.type==="takeDone"?r==null||r():c.type==="done"?(o.terminate(),s(c.blob)):c.type==="error"&&(o.terminate(),i(new Error(c.message)))},o.onerror=l=>{o.terminate(),i(l.error||new Error(l.message))};try{o.postMessage({type:"start",bitrate:t,count:n});for(let l=0;l<n;l++){a({step:"decode",pct:(l+.5)/n});const c=await ke(e[l].blob),h=new Promise(d=>{r=d});o.postMessage({type:"take",samples:c},[c.buffer]),await h}o.postMessage({type:"finish"})}catch(l){o.terminate(),i(l)}})}function Y(e,t,a,o,n,s){return{b0:e/o,b1:t/o,b2:a/o,a1:n/o,a2:s/o}}function Le(e,t,a=Math.SQRT1_2){const o=2*Math.PI*t/e,n=Math.cos(o),s=Math.sin(o)/(2*a);return Y((1+n)/2,-(1+n),(1+n)/2,1+s,-2*n,1-s)}function xe(e,t,a,o=.7){const n=Math.pow(10,a/40),s=2*Math.PI*t/e,i=Math.cos(s),l=Math.sin(s)/2*Math.sqrt((n+1/n)*(1/o-1)+2),c=2*Math.sqrt(n)*l;return Y(n*(n+1+(n-1)*i+c),-2*n*(n-1+(n+1)*i),n*(n+1+(n-1)*i-c),n+1-(n-1)*i+c,2*(n-1-(n+1)*i),n+1-(n-1)*i-c)}function z(e,t){let a=0,o=0,n=0,s=0;for(let i=0;i<e.length;i++){const r=e[i],l=t.b0*r+t.b1*a+t.b2*o-t.a1*n-t.a2*s;o=a,a=r,s=n,n=l,e[i]=l}}function Ee(e,t){return z(e,Le(t,70)),z(e,xe(t,5500,-4)),e}async function Se(e){const t=window.AudioContext||window.webkitAudioContext,a=new t;try{const o=await e.arrayBuffer();return await new Promise((n,s)=>{const i=a.decodeAudioData(o,n,s);i&&i.then&&i.then(n,s)})}finally{a.close().catch(()=>{})}}function Me(e){const t=e.numberOfChannels,a=e.length,o=e.sampleRate,n=new Float32Array(a);for(let d=0;d<t;d++){const v=e.getChannelData(d);for(let m=0;m<a;m++)n[m]+=v[m]/t}Ee(n,o);let s=0;for(let d=0;d<a;d++){const v=Math.abs(n[d]);v>s&&(s=v)}const i=s>0?Math.min(.891/s,40):1;if(i!==1)for(let d=0;d<a;d++)n[d]*=i;const r=new ArrayBuffer(44+a*2),l=new DataView(r),c=(d,v)=>{for(let m=0;m<v.length;m++)l.setUint8(d+m,v.charCodeAt(m))};c(0,"RIFF"),l.setUint32(4,36+a*2,!0),c(8,"WAVE"),c(12,"fmt "),l.setUint32(16,16,!0),l.setUint16(20,1,!0),l.setUint16(22,1,!0),l.setUint32(24,o,!0),l.setUint32(28,o*2,!0),l.setUint16(32,2,!0),l.setUint16(34,16,!0),c(36,"data"),l.setUint32(40,a*2,!0);let h=44;for(let d=0;d<a;d++,h+=2){const v=Math.max(-1,Math.min(1,n[d]));l.setInt16(h,v<0?v*32768:v*32767,!0)}return new Blob([r],{type:"audio/wav"})}const U=new WeakMap;async function Ae(e){if(U.has(e))return U.get(e);const t=await Se(e),a=URL.createObjectURL(Me(t));return U.set(e,a),a}function Z(e,t,{autoplay:a=!1}={}){e.innerHTML='<div class="player-loading">Preparando el audio…</div>';let o=null,n=!1;return(async()=>{let s,i="";try{s=await Ae(t)}catch(r){console.warn("[reproductor] no se pudo decodificar, se usa el archivo crudo",r),s=URL.createObjectURL(t),i='<p class="muted">Si no suena a la primera, pausa y vuelve a darle play.</p>'}n||(e.innerHTML=`<audio controls playsinline preload="auto" src="${s}" style="width:100%"></audio>${i}`,o=e.querySelector("audio"),a&&o.play().catch(()=>{}))})(),{pause(){o==null||o.pause()},destroy(){n=!0,o==null||o.pause(),o=null,e.innerHTML=""}}}de({immediate:!0});const u={session:null,takes:{},view:"home",recordTarget:null,exportResult:null},M=document.getElementById("app"),ee="1.9",Ce=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"],A=e=>{e=Math.round(e||0);const t=Math.floor(e/60),a=e%60;return`${t}:${String(a).padStart(2,"0")}`},b=e=>String(e).replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[t]),te=e=>{const[t,a,o]=e.split("-").map(Number);return`${o} ${Ce[a-1]}`},D=()=>{const e=[];for(const t of w)for(let a=1;a<=u.session.counts[t.id];a++)e.push({sectionId:t.id,n:a,label:t.single?t.label:`${t.label} ${a}`,take:u.takes[$(t.id,a)]||null});return e},T=()=>{const e=(u.session.name||"").trim();return`Alabanza ${te(u.session.date)}${e?" - "+e:""}.mp3`};let j=0;function E(e,t=2600){var o;(o=document.querySelector(".toast"))==null||o.remove();const a=document.createElement("div");a.className="toast",a.textContent=e,document.body.appendChild(a),clearTimeout(j),j=setTimeout(()=>a.remove(),t)}function ae({title:e,text:t,okLabel:a,danger:o}){return new Promise(n=>{const s=document.createElement("div");s.className="modal-bg",s.innerHTML=`
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${b(e)}</h3>
        <p>${b(t)}</p>
        <div class="row">
          <button class="btn" data-a="no">Cancelar</button>
          <button class="btn danger" data-a="ok">${b(a)}</button>
        </div>
      </div>`,s.addEventListener("click",i=>{var l;const r=(l=i.target.closest("[data-a]"))==null?void 0:l.dataset.a;!r&&i.target!==s||(s.remove(),n(r==="ok"))}),document.body.appendChild(s),s.querySelector('[data-a="no"]').focus()})}const g={mic:'<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',play:'<svg class="ic fill" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',redo:'<svg class="ic" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',gear:'<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',back:'<svg class="ic" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',stop:'<svg class="ic fill" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>'};function _(){u.view==="home"?Be():u.view==="record"?Re():u.view==="mictest"?Pe():u.view==="settings"?Ue():u.view==="export"&&_e(),window.scrollTo(0,0)}function Be(){const e=D(),t=e.filter(s=>s.take).length,a=e.reduce((s,i)=>{var r;return s+(((r=i.take)==null?void 0:r.duration)||0)},0),o=t===e.length&&e.length>0,n=u.session;M.innerHTML=`
    <header class="top">
      <h1>Grabación</h1>
      <div class="sub">${b(te(n.date))}${n.name?" · "+b(n.name):""} <span class="ver">v${ee}</span></div>
      <button class="icon-btn" data-go="settings" aria-label="Ajustes">${g.gear}</button>
    </header>

    <div class="progress">
      <div><span class="n">${t}</span> de ${e.length} grabados</div>
      <div class="total">${A(a)}</div>
    </div>
    <div class="bar"><i style="width:${e.length?t/e.length*100:0}%"></i></div>

    ${w.map(s=>`
      <section class="section">
        <div class="section-head">
          <h2>${s.label}${s.single?"":`<span class="count">${n.counts[s.id]} ${n.counts[s.id]===1?"canto":"cantos"}</span>`}</h2>
          ${s.single?"":`<div class="stepper">
            <button data-count="${s.id}" data-d="-1" aria-label="Quitar un canto de ${s.label}" ${n.counts[s.id]<=1?"disabled":""}>−</button>
            <button data-count="${s.id}" data-d="1" aria-label="Agregar un canto a ${s.label}" ${n.counts[s.id]>=K?"disabled":""}>+</button>
          </div>`}
        </div>
        ${s.hint?`<p class="section-hint">${s.hint}</p>`:""}
        <div class="spine">
          ${e.filter(i=>i.sectionId===s.id).map(i=>Te(i)).join("")}
        </div>
      </section>`).join("")}

    <div class="tools">
      <button class="btn" data-go="mictest">${g.mic} Probar micrófono</button>
    </div>

    <div class="foot">
      <button class="btn primary big block" data-go="export" ${o?"":"disabled"}>Unir y exportar</button>
      <p class="hint">${o?"Todos los cantos están grabados.":`Faltan ${e.length-t} por grabar.`}</p>
    </div>`}function Te(e){const t=e.take;return`
    <div class="${t?t.interrupted?"card interrupted":"card done":"card"}">
      <div class="label">${b(e.label)}</div>
      <div class="meta">${t?`<span class="dur">${A(t.duration)}</span>${t.interrupted?' · <span class="flag">Se cortó, revísalo</span>':""}`:"Sin grabar"}</div>
      <div class="actions">
        ${t?`
          <button class="btn sq" data-play="${e.sectionId}:${e.n}" aria-label="Escuchar ${e.label}">${g.play}</button>
          <button class="btn sq" data-rec="${e.sectionId}:${e.n}" aria-label="Regrabar ${e.label}">${g.redo}</button>`:`<button class="btn rec" data-rec="${e.sectionId}:${e.n}">${g.mic} Grabar</button>`}
      </div>
    </div>`}let f=null,x=null;function ne(e,t,a=""){const n=2*Math.PI*120;return`
    <div class="dial">
      <svg viewBox="0 0 260 260">
        <circle class="track" cx="130" cy="130" r="120" fill="none" stroke-width="12"/>
        <circle class="level" id="lvl" cx="130" cy="130" r="120" fill="none" stroke-width="12"
          stroke-dasharray="${n}" stroke-dashoffset="${n}" stroke-linecap="round"/>
      </svg>
      <button class="main ${a}" id="mainBtn">${t}<span>${e}</span></button>
    </div>`}function Re(){var a;const e=u.recordTarget,t=u.takes[$(e.sectionId,e.n)];M.innerHTML=`
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${g.back}</button>
        <h2>${t?"Regrabar":"Grabar"}</h2>
      </div>
      <div class="rec-screen">
        <div class="what">${b(e.label)}</div>
        <div class="time" id="time">0:00</div>
        ${ne("Grabar",g.mic)}
        <div class="level-hint" id="lvlHint">${(a=w.find(o=>o.id===e.sectionId))!=null&&a.single?"Canta todos los cantos seguidos. Si te equivocas, detén y graba otra vez.":"Toca el botón y empieza a cantar."}</div>
        ${t?'<p class="muted">La toma anterior se reemplaza solo si guardas la nueva.</p>':""}
        <div class="review" id="review"></div>
      </div>
    </div>`,se({onSaved:Ie,label:e.label})}function Pe(){M.innerHTML=`
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${g.back}</button>
        <h2>Probar micrófono</h2>
      </div>
      <div class="notice tip">
        Pon el celular a un palmo de distancia, a la altura del pecho, apuntando al espacio entre tu boca y la boca de la guitarra, ligeramente de lado.
        Pegado a la boca, la guitarra queda lejísimos; sobre la guitarra, al revés.
      </div>
      <div class="rec-screen" style="min-height:auto">
        <p class="muted">Graba 15 segundos de prueba y escúchalos. No se guarda.</p>
        <div class="time" id="time">0:15</div>
        ${ne("Probar",g.mic)}
        <div class="level-hint" id="lvlHint"></div>
        <div class="review" id="review"></div>
      </div>
    </div>`,se({test:!0,maxSeconds:15})}function se({onSaved:e,test:t=!1,maxSeconds:a=0,label:o=""}){const n=document.getElementById("mainBtn"),s=document.getElementById("lvl"),i=document.getElementById("time"),r=document.getElementById("lvlHint"),l=document.getElementById("review"),c=2*Math.PI*120;let h=0,d=0;const v=({db:p,peak:y})=>{const I=Math.max(0,Math.min(1,(p+60)/60));d=I>d?I:d*.9+I*.1,s.setAttribute("stroke-dashoffset",c*(1-d)),s.classList.toggle("hot",y>.7&&y<=.98),s.classList.toggle("clip",y>.98);const N=performance.now();p<-40?(h||(h=N),N-h>2500&&(r.textContent="Casi no se oye nada. ¿El micrófono está tapado?",r.classList.add("low"))):(h=0,r.classList.remove("low"),r.textContent=y>.98?"Muy fuerte, se puede saturar. Aléjate un poco.":"Grabando…")},m=async()=>{if(!X()){r.textContent="Este navegador no puede grabar. Usa Chrome (Android) o Safari (iPhone).";return}n.disabled=!0,f=new we({onLevel:v,onTick:p=>{i.textContent=A(a?Math.max(0,a-p):p),a&&p>=a&&(f==null||f.stop(!1))},onStop:L});try{await f.start()}catch(p){f=null,n.disabled=!1,r.classList.add("low"),r.textContent=(p==null?void 0:p.name)==="NotAllowedError"?'No hay permiso para el micrófono. Ve a los ajustes del navegador y dale "Permitir".':"No se pudo abrir el micrófono. Cierra otras apps que lo estén usando e intenta de nuevo.";return}f.settingsReport&&!f.settingsReport.allOff&&console.info("[grabadora] ajustes reales:",f.settingsReport),n.disabled=!1,n.classList.add("stop"),n.innerHTML=`${g.stop}<span>Detener</span>`,i.classList.add("live"),r.textContent="Grabando…",n.onclick=()=>f==null?void 0:f.stop(!1)},L=p=>{f=null,i.classList.remove("live"),i.textContent=A(p.duration),s.style.transition="none",s.setAttribute("stroke-dashoffset",c),s.classList.remove("hot","clip"),requestAnimationFrame(()=>{s.style.transition=""}),n.classList.remove("stop"),n.innerHTML=`${g.redo}<span>Otra vez</span>`,n.onclick=()=>{x&&(x.destroy(),x=null),l.innerHTML="",r.textContent="",m()},r.textContent="",r.classList.remove("low");const y=p.duration<1||p.blob.size<1e3;l.innerHTML=`
      ${p.interrupted?'<div class="notice warn">La grabación se interrumpió (llamada, pantalla bloqueada u otra app). Se guardó lo que alcanzó a grabarse: escúchalo y decide.</div>':""}
      ${y?'<div class="notice err">La toma quedó vacía. Vuelve a intentarlo.</div>':""}
      <div id="takePlayer"></div>
      ${t?"":`
        <div class="row">
          <button class="btn primary big" id="keep" ${y?"disabled":""}>Se queda</button>
        </div>`}`,y||(x=Z(document.getElementById("takePlayer"),p.blob)),t||(document.getElementById("keep").onclick=async()=>{await e(p)}),t&&!y&&(r.textContent="Escúchalo. Si se oye bien, ya puedes empezar.")};n.onclick=m}async function Ie(e){const t=u.recordTarget,a={blob:e.blob,duration:e.duration,mime:e.mime,interrupted:e.interrupted,micSettings:e.settings,createdAt:Date.now()};await he(t.sectionId,t.n,a),u.takes[$(t.sectionId,t.n)]=a,u.exportResult=null,E(`${t.label} guardado`),P("home")}function qe(e,t){const a=u.takes[$(e,t)];if(!a)return;const o=w.find(i=>i.id===e),n=document.createElement("div");n.className="modal-bg",n.innerHTML=`
    <div class="modal">
      <h3>${b(o.single?o.label:`${o.label} ${t}`)}</h3>
      <div id="modalPlayer"></div>
      <div class="row">
        <button class="btn" data-a="close">Cerrar</button>
        <button class="btn" data-a="rerec">${g.redo} Regrabar</button>
      </div>
    </div>`,n.addEventListener("click",i=>{var l;const r=(l=i.target.closest("[data-a]"))==null?void 0:l.dataset.a;!r&&i.target!==n||(s.destroy(),n.remove(),r==="rerec"&&oe(e,t))}),document.body.appendChild(n);const s=Z(n.querySelector("#modalPlayer"),a.blob,{autoplay:!0})}function oe(e,t){const a=w.find(o=>o.id===e);u.recordTarget={sectionId:e,n:t,label:a.single?a.label:`${a.label} ${t}`},P("record")}function Ue(){const e=u.session;M.innerHTML=`
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${g.back}</button>
        <h2>Ajustes</h2>
      </div>
      <div class="field">
        <label for="fName">Tu nombre</label>
        <input id="fName" type="text" value="${b(e.name)}" placeholder="Por ejemplo: Juan" autocomplete="off" />
        <div class="help">Va en el nombre del archivo para que se sepa de quién es.</div>
      </div>
      <div class="field">
        <label for="fDate">Domingo</label>
        <input id="fDate" type="date" value="${b(e.date)}" />
      </div>
      <div class="field">
        <label>Calidad del audio</label>
        <div class="seg" id="segBr">
          <button data-br="128" class="${e.bitrate===128?"on":""}">Normal</button>
          <button data-br="96" class="${e.bitrate===96?"on":""}">Ligera</button>
        </div>
        <div class="help">Normal ≈ 1 MB por minuto. Ligera pesa un 25 % menos.</div>
      </div>
      <p class="muted">El archivo se llamará: <strong>${b(T())}</strong></p>

      <p class="muted">Versión ${ee}</p>
      <div class="danger-zone">
        <button class="btn danger block" id="newSunday">Empezar domingo nuevo</button>
        <p class="muted">Borra todas las tomas grabadas. Tu nombre se conserva.</p>
      </div>
    </div>`;const t=async()=>{e.name=document.getElementById("fName").value.trim();const a=document.getElementById("fDate").value;a&&(e.date=a),await B(e),document.querySelector(".panel .muted strong").textContent=T()};document.getElementById("fName").addEventListener("input",t),document.getElementById("fDate").addEventListener("change",t),document.getElementById("segBr").addEventListener("click",async a=>{const o=a.target.closest("[data-br]");o&&(e.bitrate=Number(o.dataset.br),await B(e),document.querySelectorAll("#segBr button").forEach(n=>n.classList.toggle("on",n===o)))}),document.getElementById("newSunday").onclick=async()=>{await ae({title:"Empezar domingo nuevo",text:"Se borrarán todas las tomas grabadas. Esto no se puede deshacer.",okLabel:"Sí, borrar todo",danger:!0})&&(await ve(),u.takes={},u.exportResult=null,e.date=J(),e.counts=Object.fromEntries(w.map(o=>[o.id,o.initial])),await B(e),E("Listo. Domingo nuevo."),P("home"))}}const De=[["decode","Leyendo las tomas"],["trim","Quitando el aire de las orillas"],["level","Emparejando el volumen"],["join","Uniendo las partes con pausas suaves"],["encode","Creando el MP3"]];function _e(){const e=D();M.innerHTML=`
    <div class="panel">
      <div class="panel-head">
        <button class="icon-btn" data-go="home" aria-label="Volver">${g.back}</button>
        <h2>Unir y exportar</h2>
      </div>
      <p class="muted">${e.length} cantos, ${A(e.reduce((t,a)=>t+a.take.duration,0))} en total.</p>
      <div id="exportBody"></div>
    </div>`,u.exportResult?ie():H()}async function H(){var n;const e=document.getElementById("exportBody");e.innerHTML=`
    <ul class="export-steps">${De.map(([s,i])=>`<li data-step="${s}">${i}</li>`).join("")}</ul>
    <div class="bar"><i id="expBar" style="width:0%"></i></div>
    <p class="muted">Esto puede tardar un momento. No cierres la app.</p>`;const t=D(),a=e.querySelectorAll("[data-step]"),o=({step:s,pct:i})=>{a.forEach(l=>{l.classList.toggle("on",l.dataset.step===s),l.classList.remove("done")});const r=document.getElementById("expBar");r&&(r.style.width=`${Math.round(i*100)}%`)};try{const s=await $e(t.map(i=>i.take),{bitrate:u.session.bitrate,onProgress:o});if(u.view!=="export")return;(n=u.exportResult)!=null&&n.url&&URL.revokeObjectURL(u.exportResult.url),u.exportResult={blob:s,url:URL.createObjectURL(s),name:T()},ie()}catch(s){console.error(s),e.innerHTML=`
      <div class="notice err">No se pudo crear el audio. ${b((s==null?void 0:s.message)||"")}</div>
      <button class="btn primary block" id="retry">Intentar de nuevo</button>`,document.getElementById("retry").onclick=H}}function ie(){const e=document.getElementById("exportBody"),t=u.exportResult;t.name=T();const a=new File([t.blob],t.name,{type:"audio/mpeg"}),o=!!(navigator.canShare&&navigator.canShare({files:[a]})&&navigator.share),n=(t.blob.size/1048576).toFixed(1);e.innerHTML=`
    <div class="notice ok">Listo. <strong>${b(t.name)}</strong> <span class="size">(${n} MB)</span></div>
    <p>Escúchalo antes de mandarlo para revisar que las uniones quedaron limpias:</p>
    <audio controls src="${t.url}" preload="auto"></audio>
    <div style="margin-top:16px">
      ${o?`<button class="btn primary big block" id="share">Mandar por WhatsApp</button>
           <p class="hint muted" style="text-align:center">Se abre el menú de compartir; ahí eliges WhatsApp y a quién mandarlo.</p>`:`<a class="btn primary big block" id="dl" href="${t.url}" download="${b(t.name)}">Guardar el archivo</a>
           <div class="notice tip">Este navegador no puede mandar el archivo directo. Guárdalo, luego abre WhatsApp, entra al chat donde lo vas a mandar, toca el clip 📎 y elige el archivo <strong>${b(t.name)}</strong> de tus descargas.</div>`}
      <button class="btn ghost block" id="dlAlt" style="margin-top:10px">${o?"O guardar el archivo en el celular":"Volver a crear el audio"}</button>
    </div>`,o?(document.getElementById("share").onclick=async()=>{try{await navigator.share({files:[a],title:t.name}),E("Enviado")}catch(s){(s==null?void 0:s.name)!=="AbortError"&&E("No se pudo compartir. Prueba guardando el archivo.")}},document.getElementById("dlAlt").onclick=()=>{const s=document.createElement("a");s.href=t.url,s.download=t.name,document.body.appendChild(s),s.click(),s.remove(),E("Guardado en descargas")}):document.getElementById("dlAlt").onclick=()=>{u.exportResult=null,H()}}function P(e){f&&f.stop(!1),x&&(x.destroy(),x=null),u.view=e,_()}M.addEventListener("click",async e=>{const t=e.target.closest("[data-go],[data-rec],[data-play],[data-count]");if(t){if(t.dataset.go){P(t.dataset.go);return}if(t.dataset.rec){const[a,o]=t.dataset.rec.split(":");oe(a,Number(o));return}if(t.dataset.play){const[a,o]=t.dataset.play.split(":");qe(a,Number(o));return}if(t.dataset.count){const a=t.dataset.count,o=Number(t.dataset.d),n=u.session.counts[a],s=Math.max(1,Math.min(K,n+o));if(s===n)return;if(o<0&&u.takes[$(a,n)]){const i=w.find(l=>l.id===a);if(!await ae({title:`Quitar ${i.label} ${n}`,text:"Ese canto ya está grabado. Si lo quitas, se borra la toma.",okLabel:"Quitar",danger:!0}))return;await fe(a,n),delete u.takes[$(a,n)]}u.session.counts[a]=s,u.exportResult=null,await B(u.session),_()}}});(async()=>(u.session=await me(),u.takes=await be(),_(),X()||E("Este navegador no puede grabar. Usa Chrome en Android o Safari en iPhone.",6e3)))();

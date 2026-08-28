# App de grabación de alabanza — Especificación

Documento para construir la aplicación. Léelo completo antes de escribir código.

---

## 1. El problema

Tres hermanos del grupo de alabanza deben enviar cada viernes al pastor, por WhatsApp, una grabación de todos los cantos del domingo. Cada uno graba por su cuenta, cantando y tocando su propia guitarra.

Hoy lo hacen con la grabadora de voz del iPhone: graban todos los cantos en un solo archivo corrido, dejando silencios a propósito entre canto y canto para usarlos como marcas de corte. Si se equivocan en el canto 8, tienen que recortar desde el silencio anterior y volver a grabar desde ahí. Es frágil, lento, y los silencios quedan dentro del archivo final.

Además solo funciona en iPhone. Los otros hermanos tienen Android y no tienen equivalente.

## 2. La solución

Una app donde **cada canto es una grabación independiente**. Si el canto 8 salió mal, se regraba solo el 8 y los demás no se tocan. Al final la app pega todas las tomas en un solo audio continuo, sin silencios, listo para mandar por WhatsApp.

## 3. Requisitos duros

- **Debe funcionar en Android y en iPhone.** El grupo tiene ambos.
- **No pasa por Play Store ni App Store.** Se instala desde un link.
- **No requiere cuentas, contraseñas ni registro.** Ninguna.
- **No requiere internet después de la primera carga.**
- **No hay servidor ni backend.** Todo vive en el celular.
- Interfaz **en español**, sin vocabulario técnico.

## 4. Fuera de alcance — no construir

Estas cosas se discutieron y se descartaron. No las agregues:

- Lectura de PDF, letras o acordes. Ellos imprimen sus hojas y les funciona.
- Títulos o nombres de cantos. Los cantos se identifican por su posición.
- Cuentas de usuario, sincronización, nube, compartir entre dispositivos.
- Metrónomo, afinador, pistas de acompañamiento.
- Edición de audio dentro de cada toma (cortar por la mitad, etc.). Si una toma no sirve, se regraba completa.

## 5. Arquitectura

PWA (Progressive Web App) estática, instalable desde el navegador.

- **Stack:** Vite + JavaScript vanilla. No metas React ni ningún framework de UI — la app es una sola pantalla con estado simple y el peso extra no se justifica.
- **Dependencias:** `lamejs` (codificar MP3), `idb-keyval` (IndexedDB sin dolor). Nada más si se puede evitar.
- **Salida:** build estático desplegable en Netlify, Vercel o GitHub Pages.
- **HTTPS obligatorio.** Sin él el navegador no da acceso al micrófono. Cualquiera de los tres hostings lo da gratis.
- Service worker con estrategia cache-first sobre el app shell para que funcione sin internet.
- Manifest con íconos para "Agregar a pantalla de inicio", `display: standalone`, orientación vertical.

## 6. Estructura de los cantos

El domingo tiene tres secciones y **la cantidad de cantos cambia cada semana**:

| Sección | Cantidad típica |
|---|---|
| Entrada | 1, a veces 2 |
| Gozo | 5 o 6 |
| Adoración | 1 |

**No pongas un número fijo de cantos.** La app arranca con las tres secciones y un valor inicial razonable (1 / 5 / 1), y cada sección tiene botones para agregar y quitar. Debe aguantar desde 1 canto hasta 20 sin romperse.

Cada canto se identifica por sección y número: *Entrada 1, Gozo 3, Adoración 1*. El orden de grabación es el orden en que se canta el domingo, y ese es el orden del audio final.

## 7. Captura de audio

### 7.1 Restricciones del micrófono — crítico

El usuario canta **y toca guitarra al mismo tiempo**, con un solo micrófono. Los tres procesamientos automáticos del navegador arruinan eso y hay que apagarlos:

```js
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: false,   // mete artefactos con dos fuentes sonando a la vez
    noiseSuppression: false,   // se come el rasgueo de la guitarra
    autoGainControl: false,    // hace que el volumen "respire" solo
    channelCount: 1            // mono: es un celular con un micrófono
  }
});
```

Verifica con `getSettings()` que el navegador realmente los haya aplicado. Safari en iOS a veces ignora alguno. Si no se aplicaron, no falles: sigue adelante, pero déjalo anotado internamente.

### 7.2 Formato de grabación

Usa `MediaRecorder`. El formato soportado varía por plataforma — detéctalo, no lo asumas:

```js
const candidatos = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'];
const tipo = candidatos.find(t => MediaRecorder.isTypeSupported(t));
```

Android Chrome normalmente da `audio/webm;codecs=opus`. iOS Safari da `audio/mp4`. El formato de captura no importa mucho porque todo se decodifica y se re-codifica al exportar.

### 7.3 Pantalla e interrupciones

- Pide **Wake Lock** mientras se graba, para que la pantalla no se apague sola.
- Escucha `visibilitychange` y el evento `mute`/`ended` del track. Si la grabación se interrumpe (llamada entrante, el usuario bloquea la pantalla, otra app toma el micrófono): **detén limpiamente y guarda lo que alcanzó a grabarse**, marcando esa toma como interrumpida con un aviso claro. Jamás pierdas audio en silencio.
- Libera el `MediaStream` al terminar cada toma. No dejes el micrófono abierto — en algunos Android eso deja el indicador prendido y molesta.

### 7.4 Persistencia

Guarda cada toma como Blob en **IndexedDB**, no en memoria ni en localStorage. Si el hermano cierra la app o se le acaba la batería a medio proceso, al volver a abrir debe encontrar todas sus tomas donde las dejó.

Guarda también el estado de la sesión: cuántos cantos por sección, cuáles están grabados, la fecha y el nombre configurados.

## 8. Exportación — el corazón de la app

Al presionar "Unir y exportar", en este orden:

1. **Decodificar** cada toma con `decodeAudioData` a `AudioBuffer`.
2. **Remuestrear** todo a una frecuencia común (44100 Hz) con `OfflineAudioContext` si las tomas difieren. Puede pasar si se grabó en sesiones distintas.
3. **Recortar el aire de las orillas.** Detecta silencio por RMS en ventanas de ~20 ms, umbral alrededor de −45 dBFS. Recorta el silencio inicial y final, pero **deja unos 80 ms de colchón** en cada extremo — cortar exactamente en el primer sonido suena antinatural y se come el ataque de la primera nota. No toques los silencios internos de la toma: si el hermano hizo una pausa dentro del canto, es parte del canto.
4. **Emparejar volumen entre tomas.** Calcula el RMS de cada toma ya recortada y aplica ganancia para acercarlas a un nivel común. Verifica el pico resultante y limita la ganancia para no saturar — nunca dejes que el pico pase de −1 dBFS. Esto es lo que evita el brinco de volumen cuando una toma se grabó más cerca que otra.
5. **Concatenar** en un solo `AudioBuffer`, en orden: Entrada, Gozo, Adoración.
6. **Fundido en las uniones:** 15 ms de fade-out al final de cada toma y 15 ms de fade-in al inicio de la siguiente, traslapados. Sin esto, el salto de nivel de fondo entre dos tomas produce un "clic" audible.
7. **Codificar a MP3** con lamejs, mono, bitrate configurable (por defecto 128 kbps; ofrecer 96 kbps como opción ligera).

**Haz los pasos 3 a 7 en un Web Worker** con reporte de progreso. Media hora de audio congela la interfaz varios segundos si lo haces en el hilo principal, y en un celular modesto parece que la app se trabó.

### Referencia de tamaño

Mono a 128 kbps: aproximadamente 1 MB por minuto. Treinta minutos ≈ 29 MB. El usuario ya manda archivos de ese tamaño por WhatsApp sin problema, así que no hay riesgo. Debe salir **más chico** que su método actual, porque desaparecen los silencios que hoy quedan dentro del archivo.

## 9. Compartir a WhatsApp

```js
const archivo = new File([blob], nombre, { type: 'audio/mpeg' });
if (navigator.canShare?.({ files: [archivo] })) {
  await navigator.share({ files: [archivo] });
}
```

**Nombre del archivo:** `Alabanza 16 agosto - Juan.mp3` — fecha del domingo y nombre de quien grabó. Los tres hermanos mandan al mismo pastor; si los tres llegan como `grabacion.mp3` se le hace bolas. El nombre se configura una vez y se recuerda.

**Plan B obligatorio:** si `canShare` con archivos no está disponible (pasa en varios navegadores Android que no son Chrome), descarga el archivo con un enlace y dile al usuario, en texto claro, que lo adjunte desde WhatsApp a mano. Nunca lo dejes atorado con un audio que ya grabó y no puede mandar.

## 10. Pantallas y comportamiento

### Pantalla principal
Las tres secciones, una debajo de otra, con sus cantos como tarjetas. Cada tarjeta muestra:

- Su etiqueta (*Gozo 3*)
- Estado: vacío / grabado
- Duración, si ya está grabado
- Acciones: grabar, escuchar, regrabar

Arriba: contador de progreso (*6 de 8 grabados*) y duración total acumulada.
Abajo: botón de "Unir y exportar", deshabilitado mientras falte alguno.

### Grabación
Botón grande, imposible de fallar con el pulgar. Al grabar: tiempo transcurrido, medidor de nivel de entrada en vivo, y botón de detener. El medidor de nivel importa — es cómo el hermano se da cuenta de que el micrófono está tapado o el volumen está bajísimo antes de cantar cuatro minutos en balde.

Al detener, ofrece de inmediato escuchar la toma y decidir: se queda o se regraba.

### Prueba de micrófono
Accesible desde el inicio. Graba 15 segundos, los reproduce, no se guarda en la sesión. Sirve para hallar la posición del celular antes de empezar en serio.

Junto a ella, este consejo en texto plano: poner el celular a un palmo de distancia, a la altura del pecho, apuntando al espacio entre la boca y la boca de la guitarra, ligeramente de lado. Pegado a la boca la guitarra queda lejísimos; sobre la guitarra, al revés.

### Escuchar el resultado
Antes de exportar, permitir reproducir el audio ya unido para revisar que las uniones quedaron limpias.

### Ajustes
Nombre del hermano, fecha del domingo (por defecto el próximo domingo), calidad del MP3. Y un "Empezar domingo nuevo" que borra todas las tomas — **con confirmación**, porque es destructivo y detrás hay horas de trabajo.

## 11. Diseño

Antes de maquetar, lee `/mnt/skills/public/frontend-design/SKILL.md` y sigue su proceso: define tokens de color, tipografía y layout, critícalos contra este brief, y solo entonces escribe CSS.

Contexto de uso que debe guiar las decisiones: alguien de pie o sentado, con una guitarra en las manos, en la sala de su casa, mirando el celular de reojo entre canto y canto. Eso pide objetivos de toque grandes, contraste alto, texto legible sin acercar la cara, y cero elementos decorativos que compitan con el botón de grabar. Sin tema oscuro obligatorio, pero que no deslumbre.

El copy en español natural y directo, en voz activa. "Grabar", "Escuchar", "Regrabar", "Unir y exportar". Nada de "Procesar sesión" ni "Exportar buffer".

## 12. Lista de verificación antes de entregar

- [ ] Instalable desde el link en Android Chrome y en iOS Safari
- [ ] Funciona con el celular en modo avión después de la primera carga
- [ ] Los tres procesamientos de micrófono confirmados apagados (`getSettings()`)
- [ ] La guitarra se oye completa en las partes suaves
- [ ] Cerrar la app a media sesión y reabrir: todas las tomas siguen ahí
- [ ] Regrabar el canto 3 no altera ningún otro
- [ ] Bloquear la pantalla a media grabación no borra lo ya grabado
- [ ] El audio exportado no tiene silencios entre cantos ni clics en las uniones
- [ ] Una toma grabada lejos y otra cerca salen a volumen parejo
- [ ] Nada satura al exportar
- [ ] El compartir a WhatsApp llega como audio, no como documento
- [ ] Existe y funciona la ruta alterna de descarga manual
- [ ] Probado con 8 cantos y con 20

## 13. Despliegue

Build de producción y subida a Netlify, Vercel o GitHub Pages. Entrega el link final para compartir por WhatsApp junto con estas instrucciones de instalación, escritas para alguien que nunca ha instalado una PWA:

- **Android:** abrir el link en Chrome → menú de tres puntos → "Agregar a pantalla de inicio".
- **iPhone:** abrir el link en Safari (no en Chrome, ahí no aparece la opción) → botón de compartir → "Agregar a pantalla de inicio".

Y la advertencia de que la primera vez el celular pedirá permiso para el micrófono, y hay que darle "Permitir".

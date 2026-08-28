# Grabación de alabanza

PWA para grabar cada canto del domingo por separado y unirlos en un solo MP3 listo para mandar por WhatsApp. Sin cuentas, sin servidor, funciona sin internet después de la primera carga.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run preview    # sirve dist/ en http://localhost:4173
```

## Estructura

- `src/main.js` — pantallas, estado y navegación.
- `src/db.js` — sesión y tomas en IndexedDB (`idb-keyval`).
- `src/audio/recorder.js` — micrófono sin procesamiento, `MediaRecorder`, medidor de nivel, Wake Lock, interrupciones.
- `src/audio/exporter.js` — decodifica y remuestrea a 44.1 kHz en el hilo principal.
- `src/audio/export.worker.js` — recorte de aire, emparejar volumen, unión con fundidos y MP3 (`@breezystack/lamejs`, un fork de `lamejs` que arregla su empaquetado ESM).

## Despliegue

Cualquiera de estas opciones da HTTPS gratis (obligatorio para el micrófono):

**Netlify Drop (lo más simple):** `npm run build`, entra a <https://app.netlify.com/drop> y arrastra la carpeta `dist`. Netlify da un link tipo `https://algo.netlify.app`.

**Vercel:** `npx vercel --prod` en esta carpeta (framework Vite, salida `dist`).

**GitHub Pages:** sube el repo, en Settings → Pages elige "GitHub Actions" con el workflow de sitio estático apuntando a `dist`. El build usa `base: './'`, así que funciona en subcarpetas.

Después de desplegar, abre el link en el celular y verifica que el ícono de "instalar" aparezca.

## Instrucciones de instalación para compartir por WhatsApp

> Abre este link en tu celular: **[PEGAR LINK AQUÍ]**
>
> **Android:** ábrelo en Chrome → menú de tres puntos (arriba a la derecha) → "Agregar a pantalla de inicio" → "Instalar".
>
> **iPhone:** ábrelo en Safari (no en Chrome, ahí no sale la opción) → botón de compartir (el cuadrito con la flecha hacia arriba) → "Agregar a pantalla de inicio".
>
> La primera vez que grabes, el celular pedirá permiso para usar el micrófono. Dale **"Permitir"**.
>
> Ya instalada, la app funciona sin internet.

## Lista de verificación en celulares reales

Lo que sí se probó en esta Mac (Chromium con micrófono simulado): grabar, guardar, reabrir y recuperar tomas, agregar/quitar cantos, unir y exportar (recorte de silencios, volumen parejo, sin clics ni silencios entre cantos, pico bajo −1 dBFS), pantalla de compartir y ruta alterna de descarga.

Lo que hay que confirmar en los teléfonos del grupo:

- [ ] Instalable desde el link en Android Chrome y en iOS Safari
- [ ] Funciona en modo avión después de la primera carga
- [ ] `getSettings()` confirma los tres procesamientos apagados (se imprime en la consola si alguno no se apagó)
- [ ] La guitarra se oye completa en las partes suaves
- [ ] Bloquear la pantalla a media grabación guarda lo grabado y marca la toma como interrumpida
- [ ] El compartir a WhatsApp llega como audio, no como documento
- [ ] Probado con 8 cantos y con 20

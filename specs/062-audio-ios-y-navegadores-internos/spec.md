# Spec 062 · Que suene con el modo silencio de iOS y avisar en los navegadores internos (corta)

## Por qué
En el navegador interno de Instagram (iPhone) la app no suena. Hay dos causas probables: el modo silencio de iOS calla el audio de la web («ambiente») y los navegadores internos limitan el audio. Ion lo pidió (2026-11-25) y lo probará en un iPhone (Safari e Instagram, con y sin modo silencio).

## Qué cambia
- **Primer toque** (`app/plugins/audioUnlock.client.ts`, `useAudioUnlock.ts`): si existe `navigator.audioSession`, `type = 'playback'`; si no, en iOS se reproduce en bucle un `<audio>` mudo (un WAV de 0,5 s en una dirección `data:`). Una vez; si el navegador no deja, sigue como estaba y se reintenta en el siguiente toque. El `AudioContext` del motor se crea o se reanuda en su propio toque (`start`), sin cambios.
- **Aviso** (`InAppNotice.vue`, en `app.vue`): en Instagram, Facebook o TikTok (por el user agent, `app/lib/inApp.ts`), una tarjeta pequeña arriba que no bloquea: «Para oírla, ábrela en tu navegador» y «⋯ arriba a la derecha → Abrir en navegador externo». Se cierra con una X (hasta cerrar la pestaña). ES, EN y EU.

## Principios
1 ✔ un aviso de dos líneas · 2 ✔ · 3 ✔ · 4 ✔ · 5 ✔ · 6 ✔ · 7 ⚠ precedente: el truco del `<audio>` mudo es el habitual para el modo silencio de iOS; sin probar · 8 ✔ nada más se añade.

## Decisiones a revisar
- El audio mudo en bucle puede hacer que iOS muestre los controles de reproducción en el bloqueo de pantalla.
- Solo se avisa por user agent: un navegador interno que no se identifique no recibe el aviso.

## No comprobado
Solo el código y sus tests con navegadores simulados. **No probado en un iPhone**, ni con el modo silencio, ni dentro de Instagram.

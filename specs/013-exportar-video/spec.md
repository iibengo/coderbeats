# 013 · Exportar vídeo

> Estado: **borrador para revisar** (2026-11-15). No se programa nada hasta que se apruebe.
> Parte de: 003 (el aro y el agua), 005 (células y colonia), 009 (piloto / previsualización), 011 (modos), 010 (cadena maestra de audio).

## 1. Idea

Un botón **«🎬 Exportar vídeo»** que graba **la visualización** (la gota, el agua, las células) **sin botones**, con **el audio de la app**, **en tiempo real**, y entrega **un archivo** para guardar o compartir. Pensado para reels y vídeos de reacción, y para que **el piloto / la previsualización** (009) se pueda grabar sin la grabación de pantalla del sistema.

## 2. Qué se puede grabar

| Origen | Qué pasa |
|---|---|
| **Célula actual** | Suena en bucle `N` vueltas (elegible: 1, 2, 4) y se corta limpio al final de una vuelta. |
| **Canción completa** | Desde la primera célula hasta el final (`songBars`); si hay bucles o grupos en paralelo, lo que suene tal cual. |
| **Previsualización** | Arranca el piloto (009) y graba mientras se construye la canción, hasta que termina o se pulsa parar. |

**Formatos:** vertical **9:16** (1080×1920 o 720×1280), **cuadrado 1:1** (1080×1080 o 720×720). La app **no deforma** la vista: se **recompone** la escena en un lienzo del formato elegido (el aro centrado y a tamaño, las células alrededor).
**Marca discreta (opcional, apagada por defecto):** «coderbeats» pequeño abajo, semitransparente, dentro del lienzo.
**Cuenta atrás** de 3 s apagable antes de empezar (para soltar el botón).

## 3. Cómo (propuesta)

1. **Un lienzo de salida** (`OffscreenCanvas` o `<canvas>` oculto) del tamaño del formato. Cada frame se **dibuja ahí** la escena: se reutiliza `AroCanvas` (el aro, ya es 2D) y el tema del agua (WebGL2) **copiados** al lienzo con `drawImage` desde su canvas, más las células y la tira. Sin ningún elemento de interfaz (botones, ⋯, estilos, guía, avisos).
2. **Audio:** la cadena maestra ya termina en un `GainNode` (`ceiling` → `destination`). Se añade **una derivación** a un `MediaStreamAudioDestinationNode` (sin cambiar lo que se oye). **El micro no entra** (nunca se conecta a esa derivación).
3. **Grabar:** `canvas.captureStream(30 | 60)` + la pista del destino de audio → un solo `MediaStream` → **`MediaRecorder`**.
4. **Salida:** al parar, un `Blob` → **hoja de compartir** (`navigator.share({ files })`) y, si no existe, descarga. Nombre: `coderbeats-<estilo>-<fecha>.mp4|webm`.
5. **Reloj:** se graba **en tiempo real** (lo que ves y oyes). El inicio y el final se alinean a la **línea de compás** del motor (como todo lo demás), no a un temporizador.

## 4. Formatos y Safari del iPhone (el punto crítico)

- **Safari ≥ 14.1** tiene `MediaRecorder`, pero **solo `video/mp4` (H.264 + AAC)**; **Chrome/Android: `video/webm` (VP8/VP9 + Opus)**, y Chrome moderno también admite `mp4`. Se elige **con `MediaRecorder.isTypeSupported`**, por orden: `mp4;codecs=avc1,mp4a` → `mp4` → `webm;codecs=vp9,opus` → `webm`.
- **`canvas.captureStream()` en iOS** tiene errores históricos (fotogramas que se paran si el canvas no cambia; no funciona con algunos `WebGLRenderingContext` sin `preserveDrawingBuffer`). Mitigación: **un canvas 2D intermedio** que se redibuja siempre cada frame (también si la escena está quieta), y `requestFrame()` manual si hace falta.
- **Audio en iOS:** `MediaStreamAudioDestinationNode` funciona, pero el `AudioContext` debe estar **activo** (se arranca con el gesto del botón). Los **auriculares Bluetooth** cambian la frecuencia del contexto: se graba a la del contexto.
- **Compartir archivos:** `navigator.share({ files })` existe en iOS 15+ para `mp4`; **`webm` no se puede guardar en Fotos**. Por eso en iOS solo se ofrece **mp4**; si el dispositivo no lo soporta, se dice claro («este navegador no puede grabar vídeo con sonido») y no se ofrece el botón.
- **Fallback (mismo resultado, más lento)**: grabar **sin** `MediaRecorder` — fotogramas con `WebCodecs` (`VideoEncoder`/`AudioEncoder`) y empaquetado mp4 (muxer en JS) — solo si `MediaRecorder` falla en un iPhone real. Queda para una fase posterior.
- **La app, en segundo plano**, se queda sin audio ni frames: al **perder el foco** (cambio de pestaña, bloqueo de pantalla) se **para** y se guarda lo grabado hasta ahí, con aviso.

## 5. Rendimiento mientras graba

- Dibujar a un segundo lienzo y **codificar H.264 a tiempo real** compite con el audio y el aro. El audio **manda** (el `AudioContext` va en su hilo; un frame perdido es feo, un clic de audio es peor).
- Medidas: **30 fps** por defecto (60 opcional en dispositivos potentes), resolución 720 por defecto en móvil, **vigilante de frames** (003 E1.7, 012 `frameGovernor`) activo pero **sin subir el detalle** durante la grabación para no dar saltos de calidad dentro del vídeo; si se baja, se **fija** hasta el final.
- Se **desactiva** lo que no se ve en el vídeo (guía, avisos, ondas de interfaz).
- Se mide en un iPhone real antes de ofrecer 60 fps.

## 6. Tamaño del archivo

- Referencia: 720×1280, 30 fps, **~4 Mbit/s** vídeo + 128 kbit/s audio ≈ **0,5 MB/s ≈ 30 MB por minuto**; 1080×1920 a 8 Mbit/s ≈ 60 MB/min.
- Se fija `videoBitsPerSecond` (y `audioBitsPerSecond`) y se **avisa del tamaño estimado** antes de empezar y de un **tope** (por defecto 3 min / ~100 MB). Al llegar al tope, se para y se guarda.
- Memoria: los trozos (`ondataavailable` cada 1 s) se acumulan en memoria; en un iPhone antiguo, 100 MB es el límite razonable. Opción futura: escribir a OPFS.

## 7. Qué NO entra en el vídeo

- **El micro**, la voz del usuario ni ninguna fuga (la derivación sale de la **salida de la app**, no de la entrada).
- Botones, menús, guía, avisos y la barra del piloto (la **etiqueta «piloto automático · demo»** de 009 **sí** se deja si graba la previsualización: es lo honesto con el espectador).
- Con **«Previsualizar»**: el micro queda bloqueado mientras graba.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Safari/iOS solo mp4 y `captureStream` con fallos | Selección por `isTypeSupported`, canvas 2D intermedio siempre redibujado, probar en iPhone real antes de nada (fase 0) |
| Se pierden frames o el audio chasquea | Audio con prioridad, 30 fps, resolución moderada, congelar la calidad |
| Archivos enormes | Tasa fija, aviso de tamaño, tope de duración |
| `navigator.share` no disponible o rechaza el archivo | Descarga normal como alternativa; en iOS mp4 |
| El vídeo captura derechos de terceros (remixes de obras) | Es el usuario quien exporta; la marca opcional y la etiqueta del piloto; nada que subir automáticamente |
| La recomposición 9:16 rompe el aspecto del aro | Escena propia para el lienzo de salida (el aro a tamaño fijo y centrado), no un recorte de la pantalla |
| App en segundo plano / pantalla bloqueada | Se para y se guarda lo grabado, con aviso |
| Privacidad | Todo local; ningún envío; el micro nunca entra en la derivación |

## 9. Fases

0. **Laboratorio** (`/lab/video`, solo desarrollo): en un iPhone real y en Chrome, `canvas.captureStream` + audio de la cadena maestra → `MediaRecorder`; qué `mimeType` salen, si el archivo se abre y comparte, frames perdidos, tamaño. **Decide si hay fallback WebCodecs.** Hito: te enseño los archivos.
1. **Grabar la célula actual** en vertical 9:16 con audio y compartir (mp4 en iOS, webm/mp4 en el resto), sin marca.
2. **Formatos** (cuadrado, 720/1080), cuenta atrás, marca opcional, aviso de tamaño y tope.
3. **Canción completa** (alineada a líneas de compás, parada al final).
4. **Previsualización** (009): arranca el piloto, bloquea el micro y graba; la etiqueta del piloto queda dentro.
5. **Botón en Jugar y en Mis canciones**, y el **estado de grabando** (punto rosa y tiempo).
6. **Más adelante: «mi cámara deformada por el agua al ritmo»**: la cámara frontal como textura del agua (`getUserMedia` de vídeo, permiso aparte), desplazada por el campo de ondas del tema (WebGL2) al ritmo de los golpes. Riesgos propios: permiso de cámara, privacidad (no sale del dispositivo), coste de GPU en el móvil, y que **no** se mezcle con el micro. Spec aparte cuando llegue.

## 10. Criterios de aceptación (fases 1–3)

1. En Chrome y en un **iPhone con Safari**, «🎬 Exportar vídeo» produce un archivo que **se reproduce con imagen y sonido** y **se puede guardar o compartir**.
2. El vídeo **no contiene botones ni el micro**; el audio es el de la app (sin clics ni cortes).
3. El inicio y el final **caen en línea de compás**; la duración es la pedida (±1 frame de audio).
4. **No baja el audio ni la fluidez** de forma audible mientras graba (se comprueba de oído).
5. Un aviso claro cuando el dispositivo no puede grabar, o cuando la app pasa a segundo plano.

## 11. Preguntas abiertas

1. ¿30 o 60 fps por defecto? (propuesta: 30).
2. ¿Resolución por defecto: 720 (ligero) o 1080? (propuesta: 720 en móvil, 1080 en escritorio).
3. ¿Tope de duración: 3 min? ¿Se quiere poder grabar más escribiendo a OPFS?
4. ¿La marca «coderbeats», encendida o apagada por defecto? (propuesta: apagada).
5. ¿Se ofrece también **solo audio** (wav/m4a) con el mismo botón?

## 12. Implementado (2026-11-15): fases 1–3 en Chrome de escritorio; **sin probar en iOS**

`lib/videoExport.ts` (puro, con tests: formatos, elección del tipo, encuadre «cubrir», tamaño estimado, tope, nombre), `composables/useVideoExport.ts` y `components/VideoSheet.vue` (⋯ → «🎬 Exportar vídeo»). Un lienzo de salida 2D se redibuja en **cada frame** (gancho al final del frame de `VisualStage`, justo tras pintar el agua WebGL y el aro) copiando los dos lienzos de la escena **sin botones**; el audio sale de una derivación del final de la cadena maestra (`engine.videoAudio()`; el micro no entra). `captureStream(30)` + `MediaRecorder` (tipo por `isTypeSupported`: mp4 H.264/AAC → mp4 → webm vp9/vp8), 4 Mbit/s a 720 y 8 a 1080 + 128 kbit/s de audio, trozos de 1 s. Empieza en la siguiente línea de compás y dura los compases elegidos (célula: 2/4/8) o la canción entera (arranca desde el principio; tope de 3 min). Formatos vertical 9:16 y cuadrado 1:1; marca «coderbeats» opcional (apagada). Al perder el foco se para y se guarda lo grabado. Al acabar: vista previa, «Guardar» (descarga) y «Compartir» (`navigator.share({ files })` si se puede).
**Comprobado en Chrome (`tests/browser/video.mjs`):** célula de 2 compases en vertical 720 → `video/mp4`, 720×1280, 3,74 s (2 compases a 128 bpm: 3,75 s), 360 KB, con imagen (no en blanco) y con sonido (RMS 0,24).
**Pendiente / decisiones a revisar:**
- **iOS/Safari sin probar** (`captureStream`, mp4, compartir archivos, el audio con Bluetooth): hace falta la fase 0 en un iPhone real. Si falla, el fallback WebCodecs (§4) no está hecho.
- **Previsualización (fase 4)** y el botón en Mis canciones: sin hacer. «Cámara deformada por el agua»: sin hacer.
- No se ha medido el rendimiento mientras graba (30 fps fijos; el vigilante de frames sigue activo y podría bajar el detalle dentro del vídeo, §5: no se congela).
- El encuadre es «cubrir» centrado de la ventana (no una escena recompuesta): en cuadrado se recorta arriba y abajo; el aro queda en el centro.
- La canción completa no se probó en Chrome (solo la célula); con grupos en paralelo graba lo que suene.
- El tipo `mp4` que da este Chrome 135 no es el que dará Chrome antiguo (webm) ni Safari (solo mp4): la elección es por soporte.

## 13. Fase 4 (2026-11-16): exportar la previsualización

En «🎬 Exportar vídeo» hay un tercer origen, **«La previsualización (se construye sola)»**: arranca el piloto (009 §13: micro bloqueado, ayudas tenues, etiqueta «piloto automático · demo» dentro del vídeo) y graba hasta que termina (o hasta el tope de 3 min, o parar). Al acabar, todo vuelve como estaba (lo hace el piloto). Comprobado en Chrome (`tests/browser/video-previsualizacion.mjs`): demo de dembow, cuadrado 720 → 49 s, 720×720, 5,9 MB, y la canción del usuario igual que antes. Decisiones a revisar: empieza **ya** (no espera la línea de compás: el piloto arranca la música); el aviso de tamaño usa 90 s estimados; **el botón en Mis canciones sigue sin hacer** (se previsualiza la canción abierta, no una guardada sin abrir); iOS sin probar.

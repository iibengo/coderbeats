# Spec 054 · Guardar el audio del remix en MP3 (corta)

## Por qué
Ion quiere sacar **el remix original** (el de «escuchar el remix original») a un archivo de audio para analizar su calidad y, más adelante, valorar si alcanza para publicarlo (2026-11-20). Ya había una idea aparcada en `PENDIENTES.md` y un guion de pruebas que grababa en tiempo real a `.webm`; esto lo convierte en un botón.

## Qué es
- **Botón «🎧 Guardar audio (MP3)»** en el menú «⋯» del remix, en «Escuchar y compartir», debajo de «escuchar el remix original». Toca el remix **entero, desde el principio, con Auto** (`songFromTake(remix, remixTake(remix))`, igual que «escuchar el remix original»).
- **En tiempo real, como el vídeo** (dura lo que el remix), con «Grabando el audio 40/116 s ■ parar», luego «Preparando el MP3… 60 %» y, al acabar, **Compartir MP3 / Guardar MP3** (hoja del sistema en el móvil, descarga en el ordenador). El estado se ve con el menú cerrado.
- **Captura sin comprimir** de la salida maestra (después del limitador de −1 dBFS; sin el micro): `public/worklets/pcm-capture.js` + `engine.pcmCapture()`. Es estéreo y a la frecuencia del navegador (48 kHz aquí). **No pasa por Opus**: el MP3 sale de audio sin pérdida previa.
- **Recorte exacto** (`app/lib/audioExport.ts`, puro): se quita el silencio de antes de que suene el primer golpe y se corta a **la duración exacta** del remix (compases × 4 × 60 / bpm), con un fundido de salida de 0,3 s para que no haya chasquido (la cola de reverb del final se pierde).
- **MP3 de 320 kbps** con `@breezystack/lamejs` (**LGPL-3.0**, compatible con nuestra AGPL-3.0; acreditado en «Acerca de» y comprobado en `about.test.ts`). Se carga solo al exportar (`import()` dinámico) y cede el hilo para que la pantalla no se congele.
- **Sin normalizar el volumen** (decidido lo más simple): sale como suena la app (≈ −16 LUFS, pico −2,7 dBFS). Si luego se publica, se añade una normalización a ≈ −14 LUFS.
- Nombre: «título-coderbeats-AAAAMMDD-HHMM.mp3».
- Cancelar (■ parar) **no guarda nada**; si la app pasa a segundo plano, se cancela (Safari suspende el audio).

## Principios
1 ✔ un botón más dentro del «⋯» (la pantalla principal no cambia) · 2 ✔ no toca el sonido · 3 ✔ no cambia la respuesta de los toques · 4 ✔ es una acción de la persona · 5 ✔ una cosa a la vez (se desactiva mientras graba) · 6 ✔ compartir: un archivo más · 7 ✔ el precedente es «descargar» de cualquier reproductor, y el vídeo ya hace lo mismo · 8 ✔ **no se añade pantalla**; sustituye el guion manual de `exportar-audio.mjs`.

## Datos y seguridad
Todo en el navegador: el audio nunca se sube (regla del proyecto). El archivo es un `Blob` local. Sin cambios en lo guardado.

## Comprobado
- **Tests** (`tests/unit/audioExport.test.ts`): bloques, primer sonido, recorte y fundido, paso a 16 bits, nombre y un MP3 real (estéreo, 320 kbps, tamaño y sincronía de cabecera).
- **Navegador sin pantalla** (`tests/browser/lab-exportar-mp3.mjs`, Korobeiniki): el flujo entero (botón, progreso, «preparando», Guardar) sin errores; el MP3 dura **116,40 s** (el remix: 64 compases a 132 bpm = 116,36 s), **48 kHz estéreo, 320 kbps**, `−16,3 LUFS` y pico `−2,7 dBFS` (la grabación anterior en tiempo real daba −16,6 y −2,7: coincide).

## Sin comprobar / decisiones a revisar
- **iPhone/Safari:** el worklet, `navigator.share` con archivos y la suspensión en segundo plano. **Sin probar.**
- **No se ha oído** el archivo (solo medido).
- Si el fundido de 0,3 s al final corta algo que importe (la cola del último acorde): otra opción es añadir una cola de 2 s si el motor deja de sonar solo.
- Va **en tiempo real**: un render offline (`renderPatternAudio`) sería más rápido pero sin el limitador ni la cadena del motor (ver `PENDIENTES.md`).
- Solo el remix original. «Mi versión» y los remixes de Mis canciones usan el mismo botón pero `remixTake` solo da la versión original; exportar la mía queda para después.

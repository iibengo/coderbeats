# Spec 042 · Compresor «techno» de la salida (interruptor, apagado por defecto)

## Qué cambia
- **Ya había un compresor de pegamento en la salida** (spec 010 §7, `public/worklets/master-glue.js`, siempre encendido: umbral −16 dB, ratio 1,8, rodilla 12, ataque 30 ms, suelta 120 ms, +1 dB; sin latencia). La cadena es: `masterIn → saturador → pegamento → limitador (−6 dB, ratio 20) → techo −1 dB → salida`. (En la spec 041 dije que solo había limitador: me faltó el pegamento.)
- **Esta spec añade un segundo juego de ajustes para ese mismo compresor**, «techno» (`GLUE_TECHNO`), **fuerte**: umbral **−20 dB**, **ratio 4**, rodilla 8, el mismo ataque lento (30 ms: el golpe del bombo pasa) y la misma suelta corta (120 ms: no «respira» con el bombo, eso es el sidechain, spec 041) y **+8 dB de makeup**. (La primera versión, ratio 3 con el umbral de siempre, era demasiado suave: ~0,3 dB de diferencia; se endureció tras medir varias combinaciones.)
- **Interruptor en Ajustes → Avanzado → «Compresor techno»**, apagado por defecto; se guarda en `coderbeats:studio:v2` (`glue`, opcional; lo guardado sigue valiendo). Cambia los ajustes en marcha por un mensaje al worklet (`GlueCompressor.set`), sin cortes.
- **No se usa un `DynamicsCompressorNode` nuevo** (como se pedía) **a propósito:** el de Web Audio tiene unos 6 ms de *lookahead* (latencia fija) y la calibración del micro y la prueba de eco miden la cadena entera; meter un nodo, o quitarlo al apagar, movería la latencia. El worklet ya existe, no tiene latencia y se reajusta sin tocar el cableado. Y como el interruptor solo cambia los ajustes, **apagado es exactamente lo de siempre** (`glueOptions(false)` es el mismo objeto `GLUE_WARM`; test).
## Qué no cambia
- **El código generado** (no es código Strudel: es la cadena de salida del motor; el código mostrado y strudel.cc no lo llevan).
- Con el interruptor apagado, **nada de lo que suena** (Mis canciones, remixes de serie, Laboratorio): mismos ajustes del mismo worklet.
- Encendido, **toca todo lo que suena** (el motor entero, también el Laboratorio).
## Lo que he medido (Chrome sin pantalla, no es oído)
Con un techno de prueba (bombo, palmada, charle, bajo y melodía), ventanas de 4 compases y alternando encendido y apagado: **encendido frente a apagado, RMS +2,3 dB, factor de cresta −1,85 dB, pico +0,4 dB** (de −3,4 a −3,0 dB: el limitador de después lo sigue conteniendo). Es decir: la mezcla suena ~2 dB más fuerte y más «pareja», con menos distancia entre el pico y el nivel medio. Se probaron otras combinaciones (umbral −24/−28 con ratio 3–6): las de menos makeup bajaban el volumen sin tocar la cresta (el compresor es lento a propósito), así que el efecto de «pegar» sale de comprimir **y subir el makeup**. Con unos ajustes extremos de prueba (umbral −40, ratio 20) el nivel baja 26 dB: el mensaje llega al worklet. **No sé cómo suena:** si pisa el bombo o aprieta demasiado, `GLUE_TECHNO` en `app/lib/masterChain.ts` es el sitio (bajar el makeup a +6 o el ratio a 3).
**Ojo:** encendido sube el volumen medio ~2 dB (es lo que hace un compresor de bus con makeup); por eso está apagado por defecto.
## Cómo probarlo tú
1. Ajustes → «Controles avanzados» → «Compresor techno» → apagado. Pon una canción de techno (Hobbit, un remix techno) y escúchala 20 s.
2. Enciéndelo con la música sonando (no debe haber cortes ni cambio de volumen brusco) y escucha otros 20 s: ¿suena más «junto», sin perder el golpe del bombo? ¿el volumen sube (debería ~2 dB) y se pasa?
3. Apágalo: debe volver exactamente a como sonaba. Prueba también con una canción tuya sin techno: si no te gusta cómo cambia, déjalo apagado.
## Principios
2 ✔ (apagado por defecto: lo de siempre) · 5 ✔ · 7 ⚠ (precedente: el bus compressor de cualquier mezcla de techno; sin probar con gente) · 8 ✔. **Sin comprobar:** todo lo que es oído (si se nota, si pisa el bombo, el nivel) y el iPhone (el worklet ya se usa, pero el mensaje en marcha no se ha probado en Safari).

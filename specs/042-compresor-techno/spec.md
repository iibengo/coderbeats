# Spec 042 · Compresor «techno» de la salida (interruptor, apagado por defecto)

## Qué cambia
- **Ya había un compresor de pegamento en la salida** (spec 010 §7, `public/worklets/master-glue.js`, siempre encendido: umbral −16 dB, ratio 1,8, rodilla 12, ataque 30 ms, suelta 120 ms, +1 dB; sin latencia). La cadena es: `masterIn → saturador → pegamento → limitador (−6 dB, ratio 20) → techo −1 dB → salida`. (En la spec 041 dije que solo había limitador: me faltó el pegamento.)
- **Esta spec añade un segundo juego de ajustes para ese mismo compresor**, «techno» (`GLUE_TECHNO`): **ratio 3**, mismo umbral (−16 dB: por encima comprime más, por debajo igual), mismo ataque lento (el bombo pasa) y la misma suelta corta (no «respira» con el bombo: eso es el sidechain, spec 041), **+2 dB de makeup** (+1 más que el de siempre, para que el volumen no baje).
- **Interruptor en Ajustes → Avanzado → «Compresor techno»**, apagado por defecto; se guarda en `coderbeats:studio:v2` (`glue`, opcional; lo guardado sigue valiendo). Cambia los ajustes en marcha por un mensaje al worklet (`GlueCompressor.set`), sin cortes.
- **No se usa un `DynamicsCompressorNode` nuevo** (como se pedía) **a propósito:** el de Web Audio tiene unos 6 ms de *lookahead* (latencia fija) y la calibración del micro y la prueba de eco miden la cadena entera; meter un nodo, o quitarlo al apagar, movería la latencia. El worklet ya existe, no tiene latencia y se reajusta sin tocar el cableado. Y como el interruptor solo cambia los ajustes, **apagado es exactamente lo de siempre** (`glueOptions(false)` es el mismo objeto `GLUE_WARM`; test).
## Qué no cambia
- **El código generado** (no es código Strudel: es la cadena de salida del motor; el código mostrado y strudel.cc no lo llevan).
- Con el interruptor apagado, **nada de lo que suena** (Mis canciones, remixes de serie, Laboratorio): mismos ajustes del mismo worklet.
- Encendido, **toca todo lo que suena** (el motor entero, también el Laboratorio).
## Lo que he medido (Chrome sin pantalla, no es oído)
Con un techno de prueba (bombo, palmada, charle, bajo y melodía) y ventanas de 4 compases: encendido frente a apagado, RMS **+0,3 dB**, pico **±0,1 dB**, factor de cresta **−0,2 a −0,5 dB**: diferencia pequeña, dentro del ruido de la medida. Motivo probable: con una mezcla tan fuerte, el limitador (−6 dB, ratio 20) ya hace casi todo el trabajo. Con unos ajustes extremos de prueba (umbral −40, ratio 20) el nivel baja 26 dB: el mensaje llega al worklet y el ajuste funciona. **No sé si se oye;** si queda corto, el sitio para afinar es `GLUE_TECHNO` (`app/lib/masterChain.ts`: bajar el umbral a −20 dB, subir el ratio a 4).
## Cómo probarlo tú
1. Ajustes → «Controles avanzados» → «Compresor techno» → apagado. Pon una canción de techno (Hobbit, un remix techno) y escúchala 20 s.
2. Enciéndelo con la música sonando (no debe haber cortes ni cambio de volumen brusco) y escucha otros 20 s: ¿suena más «junto», sin perder el golpe del bombo? ¿el volumen es parecido?
3. Apágalo: debe volver exactamente a como sonaba. Prueba también con una canción tuya sin techno: si no te gusta cómo cambia, déjalo apagado.
## Principios
2 ✔ (no puede sonar mal: suave y apagado) · 5 ✔ · 7 ⚠ (precedente: el bus compressor de cualquier mezcla de techno; sin probar con gente) · 8 ✔. **Sin comprobar:** todo lo que es oído (si se nota, si pisa el bombo, el nivel) y el iPhone (el worklet ya se usa, pero el mensaje en marcha no se ha probado en Safari).

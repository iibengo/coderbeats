# Spec 045 · Percusión del minimal (rim, click, cowbell, tom, shaker)

## Qué
Cinco golpes del **uzu-drumkit (Unlicense)**, en `public/samples/techno/` (con el kit Techno; **~44 KB** más en total): aro (`rim`), clic (`click`), cowbell/clave (`cowbell`), tom (`tom`) y shaker (`shaker`). Origen, SHA y recorte en `public/samples/CREDITS.md`.
- **Sin cambiar el modelo de datos:** son **sintes de melodía de muestra** (como `guitarSample`): un loop `mel` con `synth: 'rim' | 'click' | 'cowbell' | 'tom' | 'shaker'`, cuya nota fija es C2 (la muestra a su altura original). **Su patrón es propio**: los golpes caen en el paso que sea, también **fuera de tiempo** (medios pasos y tercios, que la rejilla de melodía ya soportaba) y en compases de un loop de 1 a 16.
- **Nombres de strudel** (`rim`, `misc` con `.n(1)`, `cb`, `mt`, `sh`): el motor los registra con nuestros archivos, así que **el código mostrado suena igual pegado en strudel.cc**, sin `samples()` ni avisos.
- **No son melodía:** el Órgano no los edita, no cuentan como «melodías apiladas» ni para el tope de «Cantar esta parte», y en el Laboratorio van con la capa de ritmo (no con el tema). Cuentan en el reparto del volumen como capas permanentes (no son adornos).
- **Conversor:** `percu:` + `rim 4.5 11 14`… (LEEME y `minimal-ejemplo.txt`). Sin `percu:`, los 25+ archivos de antes dan el mismo `.json` (`probar-conversor.mjs`).
- **No cambia lo que ya suena:** nadie usa esos sintes hasta que un archivo los lleve; los otros kits y sintes no cambian.
## Principios
2 ✔ · 5 ⚠ cinco loops más por parte (el tope de 8 loops de siempre manda) · 7 ⚠ sin probar con gente · 8 ⚠ se añaden sonidos; no se quita nada. **Sin comprobar:** de oído, el volumen de cada golpe (ajustado por pico, no de oído: el shaker a −8 dB, lo demás −2 a −4), que «misc 11» sea de verdad un clic limpio y que fuera de tiempo suene a minimal (los medios pasos usan el mismo reloj, sin humanizar).

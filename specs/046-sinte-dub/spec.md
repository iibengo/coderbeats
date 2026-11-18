# Spec 046 · Sinte `dub` (stab de dub techno con eco)

## Qué
Sinte de melodía opcional `dub`, como `guitar` o `acid` (nada más cambia; tests): recibe **acordes** (varias notas a la vez) y suena a stab filtrado.
- **Sonido** (`SYNTH_SOUND.dub`): `supersaw` con `unison(2)` y `detune(0.3)` (dos sierras desafinadas), `lpf(800)` con `lpq(3)` (resonancia ligera), envolvente de filtro rápida (`lpenv(3)`, `lpd(0.18)`), `decay(0.3).sustain(0)`, `shape(0.25)` (saturación), **reverb larga** (`room(0.9).roomsize(8)`). Registro C2–G5.
- **El eco** (`SYNTH_ECHO.dub`, al final de la línea): **corchea con puntillo (3/16 de ciclo)** con **tres repeticiones**, cada una **más oscura y más baja**: `.off(3/16, x => x.lpf(650).postgain(0.6).off(3/16, y => y.lpf(480).postgain(0.6).off(3/16, z => z.lpf(340).postgain(0.6))))`.
## ¿Se puede el delay con feedback en Strudel?
- **Sí, pero sin filtro dentro del bucle.** superdough tiene `delay` (cantidad), `delaytime` (segundos) o `delaysync` (fracción de ciclo; **por defecto 3/16**, justo la corchea con puntillo) y `delayfeedback` (máx. 0,98). El nodo `FeedbackDelay` conecta la salida del retardo a su propia entrada **sin ningún filtro**: no existe el filtro en el bucle de feedback.
- **Cómo se consigue «cada repetición más oscura»:** escribiendo las repeticiones con `.off(3/16, …)` anidado, cada una con su `lpf` y su `postgain`. Son **tres** repeticiones y se acaban (no hay cola infinita como con feedback); la reverb larga hace de cola.
- **Por qué el eco va al final de la línea y no en `SYNTH_SOUND`:** la línea de un loop lleva después un `.gain("…")` por nota con silencios (`~@12`) que **recorta** cualquier repetición que caiga fuera de la nota (probado: solo sobrevivía la primera). Por eso `song.ts` añade `SYNTH_ECHO[synth]` justo tras el gain (una línea; es el generador de código, no el motor de audio).
- No se usó `.delay()` + `.delayfeedback()` real porque es **por orbit** (lo comparten todos los sintes de melodía) y no tiene filtro.
## Qué no se puede (y por qué)
- **En el motor, `room` y `shape` de la línea los pisan los controles de Espacio y Calidez** (se aplican al final del bloque, como pasa con todos los sintes): la reverb larga del dub solo se oye con el Espacio alto; en el código mostrado (strudel.cc) sí va tal cual. El **eco y el filtro de las repeticiones no dependen de eso** (usan `lpf`, `postgain` y `.off`).
- Si la parte lleva `filtro:` (lpf por vuelta), ese filtro **manda** sobre el del stab y el de sus ecos.
- La reverb (`room`) es por orbit y el dub comparte el de la melodía (orbit 5) con los demás sintes de la canción: lo normal es que el dub sea el único sinte de melodía.
## Conversor
`sinte: dub` (toda la canción o una parte) + acordes con corchetes; `dub-ejemplo.txt` y LEEME. Los 25+ archivos de antes dan el mismo `.json` (`probar-conversor.mjs`).
## Principios
2 ✔ · 5 ⚠ cuatro voces por repetición (CPU: 5 notas × 4 = 20 voces por stab; el vigilante de frames lo regula) · 7 ⚠ sin probar con gente · 8 ⚠ se añade un sinte. **Sin comprobar:** de oído, todo (si suena a dub o a «piano filtrado», el nivel del eco y la reverb, que 20 voces por stab no ahoguen un iPhone; la reverb en el motor depende del Espacio).

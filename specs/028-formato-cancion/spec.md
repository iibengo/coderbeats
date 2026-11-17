# Spec 028 · Mejoras del formato de canción (corta)

Valen para los remixes de dominio público y para Mis canciones. **Todo compatible con lo guardado** (campos nuevos opcionales; sin ellos, todo suena y se ve igual; test de que una canción vieja genera **el mismo código Strudel**). Leído antes: `PRINCIPIOS.md`, `DISENO.md`, `docs/investigacion-instrumentos.md`.

## 1. Fallo de tempo (investigado)
- **Estudio:** una canción de dembow a 108 bpm importada de archivo **sí** suena a 108 (medido en Chrome: 2,22 s por compás; el motor emite `setcpm(108/4)`); no he podido reproducir los ~4 s por compás.
- **Laboratorio (sí es un fallo):** al elegir una canción en Remixes, el motor **cambia al estilo y toma el tempo del estilo (120)**, y el tempo de la canción (108) se pierde; además «Mi versión», «escuchar el remix», «Abrir en el Estudio» y el vídeo se construyen con `bpm: null`, así que un remix guardado con tempo propio **suena al del estilo**. Se arregla: el tempo de la canción manda en todo el Laboratorio (elegir, actuar, grabar, escuchar, vídeo, duraciones y plan de la toma). Test: `songFromTake` conserva el tempo y la duración se calcula con él.
- Si los ~4 s siguen en tu móvil tras esto, dime con qué archivo y en qué pantalla (Estudio, Laboratorio, vídeo) lo mides.

## 2. Loops de 8 y 16 compases; notas que cruzan la línea de compás
- `LoopLength` pasa de `1 | 2 | 4` a `1 | 2 | 4 | 8 | 16` (la validación de lo guardado acepta los nuevos; los viejos no cambian). Un editor de partes de 16 compases solo en **«Avanzado»**.
- **Ligaduras:** hoy una nota no pasa de su compás («lo que sobra se recorta»). Una nota podrá durar más que lo que queda de compás: se emite con su duración entera (`.clip`) y el Órgano la dibuja continua. Sin ligaduras, el código es el de siempre.
- Riesgo: toca la generación de código de melodía y la rejilla del editor.

## 3. Tresillos
- La rejilla fina de hoy es de ¼ de paso (`res = 4`). Si hay posiciones o duraciones con tercios de paso (p. ej. 5,333) se usa **`res = 12`** (múltiplo de 3 y de 4); si no, **se emite exactamente lo de antes**. Las canciones guardadas no cambian.
- En el Órgano: un interruptor «Tresillos» (casillas de 3 por tiempo) en **«Avanzado»**.

## 4. Varias notas a la vez
- Dos o más notas en el mismo paso de un loop de melodía suenan juntas (`[c3,e3,g3]` en la mini-notación); la misma duración o cada una la suya. Lo guardado (monofónico) no cambia. El Órgano las dibuja apiladas; editar acordes en el Órgano, en «Avanzado» (el editor sigue siendo monofónico por defecto: principio «no puede sonar mal»).

## 5. Bajo y acordes propios de la canción
- Hoy el bajo y los acordes son el **fondo del estilo** (global del motor); una canción con otra armonía no encaja. Propuesta: **capas propias** = loops de melodía con un `role` opcional (`'bass'` | `'chords'`), con sus sinte (`bass`: sierra grave; `keys`/`pad`: acordes), que suenan como cualquier loop y se muestran en el Laboratorio como las capas «bajo» y «acordes» (ya reconocidas por `partsFromSong`). El fondo del estilo de esa parte se apaga. No se toca el cambio de fondo del motor (es lo arriesgado).

## 6. Conversor `notas-a-json`
- Una **sección larga = una parte** (hasta 16 compases, con el punto 2), no una parte cada 4. Marcadores `parte: Estrofa` en el texto; con bajo y acordes propios (`bajo:`, `acordes:`, punto 5). Vive fuera del repo.

## 7. Cumple PRINCIPIOS.md
1. Una pantalla, una cosa ✔ (formato, no pantallas). 2. No puede sonar mal: los tresillos y los acordes se escriben a mano pero siguen en la escala si «Ajustar a la escala» está activo ✔. 3. Inmediata ✔. 4. Tuyo: más control sobre tu canción ✔. 5. Pocas cosas: ⚠ más opciones → todas en «Avanzado». 6. Compartir: el formato sigue siendo un enlace/archivo de datos ✔. 7. Precedente: pianoroll de cualquier DAW (ligaduras, tresillos, acordes) ✔. 8. Quitar antes de añadir ⚠: se añade; compensa que una parte larga sustituye a «cuatro partes de 4 compases».

## 8. Orden y riesgo
1. Tempo (hecho en esta tanda) · 2. Tresillos y varias notas a la vez (solo generación de código y datos; bajo riesgo) · 3. Loops de 8/16 y ligaduras (toca rejilla y `LoopLength`) · 4. Bajo y acordes propios · 5. Conversor. Lo que toque el reloj del motor o no se pueda comprobar sin oír **se salta y se apunta**.

## 9. Hecho (2026-11-17) y decisiones a revisar
| Punto | Estado | Commit |
|---|---|---|
| 1 Tempo | **Arreglado** en el Laboratorio (el tempo de la canción manda al elegir, actuar, grabar, escuchar, vídeo y en duraciones). En el Estudio ya iba bien (108 bpm = 2,22 s/compás medido). **Los ~4 s/compás no los reproduje**: si siguen, dime archivo y pantalla. | `249802f` |
| 3 Tresillos | Hecho en el código que suena (rejilla de doceavos cuando hay tercios; si no, lo de siempre). **Falta el interruptor «Tresillos» del Órgano** (el editor sigue a pasos/cuartos). | `37d8411` |
| 4 Varias notas a la vez | Hecho en el código que suena (`[c4,e4,g4]`). **Falta editarlas en el Órgano** (sigue monofónico). | `37d8411` |
| 2 Loops de 8/16 y ligaduras | Hecho (se leen, suenan, comprobado en Strudel; en el Órgano 8 y 16 solo en «Avanzado»; las ligaduras llevan un `.clip` alineado). **Falta dibujar/editar ligaduras en el Órgano** (al editar siguen recortándose al compás). | `c2cef87`, `1e2e563` |
| 5 Bajo y acordes propios | Hecho como **sintes `bass` y `keys`** (loops normales; el Laboratorio los muestra como capas «bajo» y «acordes»); no se toca el fondo del estilo. **Sin probar de oído** el sonido. Sin editor propio de bajo/acordes en el Estudio todavía. | `f8ae184`, `eb11690` |
| 6 Conversor | **Hecho** (fuera del repo, `~/Descargas/coderbeats-herramientas/notas-a-json.mjs`): `parte:` = una sección (1–16 compases en un solo loop), `bajo:`, `acordes:` (`[G3,Bb3,D4]:16`), tresillos (`4/3`), notas que cruzan compás. | — |
- **Compatibilidad:** lo guardado no cambia (tests: mismo código Strudel para lo de 1/2/4 compases, para melodías con enteros y cuartos de paso, y sin ligaduras ni acordes).
- **Decisión mía:** «bajo y acordes propios» como sintes en vez de un `role` nuevo en el loop (menos cambios en datos y validación).

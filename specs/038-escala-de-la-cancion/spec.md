# Spec 038 · Escala de la canción (opcional)

## Qué
Un campo **opcional** `scale` en la canción (`Song.scale?: { tonic: 0–11, mode: 'major' | 'minor' }`, menor natural). Va en el archivo/enlace dentro de `g` (`g.scale`). **Sin él, todo funciona exactamente como antes** (`'scale' in song` es falso; tests).
- **Validación estricta** (`isSongScale`): forma exacta, sin campos de más; una escala mal formada hace que la canción no se abra (no se borra). Tests de inyección y de ida y vuelta por enlace.
- **En la app:** solo la guarda y la usa «Cantar esta parte» (spec 039). `engine.setSongScale()`. No toca el sonido ni lo guardado.
- **Conversor `notas-a-json.mjs`** (fuera del repo): `escala: sol menor` (también `Gm`, `La mayor`, `F#m`, `si bemol mayor`…); si falta, la **deduce de los acordes** (si no hay, del bajo; si no, de la melodía) y **la imprime** («Escala: sol menor (deducida de los acordes)»); el chequeo avisa de las **notas de la melodía y del bajo que se salen** (los acordes pueden salirse). Una escala que no entiende, la rechaza (no adivina).
- Lógica pura en `app/lib/songScale.ts` (`parseScale`, `inferScale`, `inScale`, `scaleLabel`…).
## Principios
2 ✔ (la escala sirve para que no suene mal) · 6 ✔ (viaja con el enlace/archivo) · 7 ⚠ precedente: el «scale lock» de los instrumentos de la investigación; sin probar con gente · 8 ✔ (nada se quita).
## Sin hacer
Modos distintos de mayor y menor natural (dórico, menor armónica); mostrar la escala en «Mis canciones». La deducción puede equivocarse con acordes prestados: el texto manda.

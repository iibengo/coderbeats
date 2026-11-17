# Spec 035 · Guitarra (sinte opcional, sin samples)

## Por qué
Con `lead` (onda cuadrada con eco) las melodías de rock suenan a pitido. Se añade un sinte que suena menos a pitido sin samples ni estilos nuevos.

## Qué es
Dos sintes de melodía, **opcionales** (los elige la canción; sin elegir suena el `lead` de siempre, con test):
| | `lead` (hoy) | `guitar` (limpia, arpegios) | `guitarDirty` (estribillo) |
|---|---|---|---|
| onda | square | sawtooth | sawtooth |
| filtro | `lpf(1800)` fijo | `lpf(1100)` + `lpenv(3)`, `lpd(0.2)`, `lps(0.1)`: brillo en el pulso y se cierra | `lpf(1800)` + `lpenv(2)`, `lpd(0.25)`, `lps(0.25)`: más abierto y con cuerpo |
| saturación | ninguna | `distort(0.5)` | `distort(3)` |
| decay / sustain | 0.2 / 0.5 | 0.35 / 0.25 (pulso corto) | 0.5 / 0.45 |
| eco | `delay(0.25)` | no | no |
Se usa `distort` y **no** `shape`: la «calidez» global añade `.shape()` al final del código y pisaría el del sinte. (Lo mismo les pasa hoy a `impacto`; no se toca.)
Nombre: ids `guitar` y `guitarDirty` en la app y los archivos; en el conversor, `guitarra` y `guitarra-sucia` (también valen los ids).

## Principios
2 (no puede sonar mal: mismas notas y escala, solo cambia el timbre) ✔ · 5 ✔ (no añade capas) · 7 ⚠ sin precedente probado con gente; es opcional · 8 ⚠ se añade un sinte; no se quita nada.

## Hecho y sin hacer
Hecho: sintes, registro (C3–C6), vista previa del Órgano, conversor (`sinte:`) con ejemplo, tests. **Sin oír.** Sin hacer: elegir el sinte desde la app (hoy solo viene en los archivos); suena a rock sintético, no a guitarra real.

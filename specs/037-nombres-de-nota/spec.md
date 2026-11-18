# Spec 037 · Nombres de nota en el Órgano (corta)

## Qué
En el Órgano, cajón ⋯, **solo con «Controles avanzados»**: interruptor «nombres de nota». Encendido: (1) los rótulos de las filas siguen el idioma de la app (do re mi… en español y euskera, C D E… en inglés) y (2) al tocar una nota sale su nombre con la octava (`sol4`, `G4`) en un aviso flotante ~1 s. Para poder decir «esa nota está mal».
- **Apagado (o sin «avanzado») el Órgano es el de siempre**: las filas siguen con `C4`, `F♯4`; no hay aviso. Test: `rowLabel(…, false)` es idéntico al rótulo anterior en todo el rango y en cualquier idioma. No cambian el dibujo, las notas ni el sonido.
- **Se guarda** en `coderbeats:studio:v2` (la misma clave de «avanzado», que se leía ya sin tocar `coderbeats:ui:v1`; en `ui:v1` no encajaba: su forma es estricta y una versión anterior lo reescribiría sin el campo). Compatible con lo guardado: `{advanced}` sigue valiendo; `noteNames` es opcional.
## Principios
1 ✔ (un interruptor escondido) · 2 ✔ (solo etiquetas) · 3 ✔ (el aviso sale en el mismo toque) · 5 ✔ · 7 ⚠ sin probar con gente · 8 ✔ (nada se quita; nada nuevo en la vista normal).
## Hecho / sin hacer
Hecho: `lib/noteNames.ts` con tests, interruptor, aviso, preferencia, i18n (es/en/eu), `tests/browser/organo-nombres.mjs`. Sin ver en un iPhone. Decisión: solfeo con `♯` (do♯).

# Spec 041 · Sidechain de la canción (el «bombeo» del techno)

## Qué
Campo opcional `Song.sidechain?: 'si' | 'no'` (validado estrictamente; sin él, **el código generado es exactamente el de siempre**: test con las líneas literales).
- **`si`:** el bombo lleva `.duckorbit("2:3:6").duckdepth(0.6).duckattack(0.15)`: empuja el **bajo** (orbit 2) y los **acordes** (3) del fondo y el **bajo y los acordes propios de la canción** (sintes `bass` y `keys`, que pasan al orbit 6, nuevo). **La melodía (orbit 5) y los adornos no se tocan.** Vale en el motor y en el **código mostrado** (para strudel.cc), con el fondo encendido o no.
- **`no`:** sin sidechain, ni siquiera con el fondo encendido.
- Conversor (fuera del repo): `sidechain: si | no | auto`; `auto` (por defecto) = `si` en techno y house, nada en el resto; imprime lo que ha hecho.
## Qué mejora (y qué no) respecto a lo que hay
- Hoy, con el fondo encendido (los remixes de serie y las canciones del conversor, que van con fondo `manual`), el bombo ya empuja los orbits 2, 3 **y 5 (toda la melodía incluida)**, y **solo en el motor**: el código que se pega en strudel.cc no lleva sidechain.
- Con `si`: (1) el código mostrado también bombea; (2) la melodía deja de agacharse con cada bombo (solo bajo y acordes); (3) funciona sin fondo. **Lo que no cambia:** profundidad y ataque (0,6 y 0,15, los de siempre).
- Cambia lo que suena solo en las canciones que lleven `sidechain: 'si'` (las que convierta el conversor en techno/house a partir de ahora). Los remixes de serie y lo guardado no lo llevan: suenan igual.
## Principios
2 ✔ · 5 ✔ · 7 ⚠ (precedente: el techno y el house reales; sin probar con gente) · 8 ✔. **Sin comprobar:** cómo suena el bombeo (profundidad 0,6 con el ataque de 0,15 s a 132 bpm; si se oye demasiado o muy poco) y que el orbit 6 no suene distinto al 5 (mismo efecto por línea).

## Compresión y pegada: no se hace (decisión a revisar)
- **`.shape()` ya existe:** la «calidez» (por defecto 0,5 → `.shape(0.25)`) se añade a todos los loops de cada bloque en el motor y en el código mostrado. Otro `.shape()` encima no «pega»: satura más y sube el volumen.
- **`.compressor()` de Strudel/superdough es por evento** (cada golpe lleva su propio compresor, de un pozo de nodos): no comprime el conjunto de la batería, así que no la «junta»; solo recortaría el pico de cada golpe suelto.
- Pegar de verdad pide un **compresor de bus** en la cadena de salida del motor (hoy: limitador a −6 dB, ratio 20, y techo −1 dB). Eso toca el audio de todo lo que suena (incluidos Mis canciones y los remixes de serie) y **no se puede afinar sin oír**: se deja apuntado, no se programa.

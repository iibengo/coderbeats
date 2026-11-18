# Spec 039 · Cantar una parte

## Qué
En el Estudio, **Editar parte** → bloque «🎤 Cantar esta parte»: elige 2 o 4 compases, pulsa, y (cuenta de un compás) canta sobre la parte que suena. Al acabar:
1. se detectan las notas con el detector de siempre (`trackPitch` + `segmentNotes`), sin red ni IA;
2. se **ajustan a la escala de la canción** (`Song.scale`, spec 038) y se **cuantizan a la rejilla** de semicorcheas (`assistMelody` con una escala propia, parámetro nuevo y opcional: sin él, la ayuda es la de siempre);
3. nace **un loop de melodía nuevo** en esa parte (**no sustituye nada**); como es el más reciente, **es el que edita el Órgano** («Ver en el Órgano»); las anteriores quedan como melodías apiladas.
- **Si la canción no tiene escala, pregunta** (selector de 24 escalas) y la guarda en la canción; no la adivina.
- **Repetir:** «Borrar toma» quita el loop cantado y se vuelve a cantar. **Tope: 3 melodías por parte** (sin contar efectos ni el bajo y los acordes propios) y los 8 loops de siempre.
- Con una canción de varias partes, la parte se queda en bucle mientras se canta (la misma 🔒 del Órgano) y el loop cae alineado con lo cantado (`phaseBar` respecto al inicio de la parte, como las frases del micro).
- **Cascos:** como «Grabar voz», si el fondo se oye por el micro, no se canta (avisa).
- No toca el reloj del motor: usa la misma captura y las mismas líneas de compás que la voz grabada; mientras se canta, el detector de batería ignora la voz (ya lo hacía con la voz grabada).
## Principios
1 ✔ (un botón, un resultado) · 2 ✔ (escala y rejilla) · 3 ⚠ el resultado llega al acabar la toma (no es instantáneo) · 4 ✔ (es tu voz) · 5 ✔ (tope de 3) · 6 ✔ · 7 ⚠ precedente: el «humming» de apps de composición; sin probar con gente · 8 ✔.
## Sin comprobar
**De oído:** que el ajuste a la escala conserve la intención de tu voz y que la cuantización no desmonte el ritmo; el desfase por la latencia del micro (se usa la calibrada); cantar con cascos en un iPhone. Probado con una voz sintética y micro falso en Chrome (notas en la escala, en la rejilla, loop nuevo, «borrar toma», parte única y de varias partes).

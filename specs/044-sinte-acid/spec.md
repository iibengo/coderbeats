# Spec 044 · Sinte `acid` (el 303)

Sinte de melodía **opcional**, como `guitar`: no cambia nada más (lead, guitar, guitarDirty, guitarSample, lo guardado y los estilos siguen igual; tests).
- **Código:** `.s("sawtooth").lpf(700).lpq(13).lpenv(4).lpa(0.002).lpd(0.14).lps(0.05).distort(0.8).decay(0.18).sustain(0.2).release(0.05).gain(0.4)`: sierra con un filtro muy resonante (`lpq` 13) cuya envolvente (abre 4 octavas y cierra en 0,14 s) da el «tiu-tiu-tiu», y una distorsión moderada (`distort` 0,8; la guitarra sucia lleva 3). Registro E1–E4 (`[28, 64]`). Sin samples. Usa `distort` y no `shape` (la «calidez» global pone su `.shape` al final y lo pisaría).
- **Conversor:** `sinte: acid` (toda la canción o una parte), con la lista de sintes y el LEEME al día.
- No tiene selector en la app: viene en los archivos, como la guitarra.
- Principios: 2 ✔ (mismas notas y escala, solo timbre) · 5 ✔ · 7 ⚠ sin probar con gente · 8 ⚠ se añade un sinte. **Sin oír:** si el `lpq` 13 con el `gain` 0,4 chilla o queda flojo (la resonancia sube el volumen en la frecuencia de corte), y el volumen frente a los demás sintes.

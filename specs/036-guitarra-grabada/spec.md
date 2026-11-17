# Spec 036 · Guitarra grabada (`guitarSample`)

Sinte opcional con 7 notas sueltas de una **Hofner Club** (Black And Green Guitars, Karoryfer Samples, **CC0**; LICENSE comprobado a mano: idéntico al texto oficial). Nombre de muestra `hofner`; notas e3 a3 d4 g4 c5 f5 a5 (saltos de 5 semitonos, el último de 4), WAV mono 16 bits de 0,5 s, **309 246 B** en total (SHA en `public/samples/CREDITS.md`). El motor sube o baja la nota más cercana.
- `guitar`, `guitarDirty` y `lead` no cambian. Elegible desde archivos (`sinte: guitarra-grabada` en el conversor); no desde la app.
- **Carga perezosa:** Strudel solo descarga una muestra al sonar por primera vez; **verificado en Chrome** (0 descargas antes de tocar; después, solo las notas usadas). No verificado en Safari/iPhone.
- Código mostrado: añade `samples('github:iibengo/coderbeats-kits/v2')` solo si hay guitarra (etiqueta `v2` por publicar por Ion).
- Principios: 2 ✔ (mismas notas, solo timbre) · 5 ✔ · 7 ⚠ sin probar con gente · 8 ⚠ se añade un sinte, no se quita nada. **Sin oír**: afinación del pitch-shift, volumen (gain bajado a 0,5 porque iba al doble que la batería) y cortes de la nota de 0,5 s.

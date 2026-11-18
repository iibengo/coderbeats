# Spec 043 · Kit «Techno» (muestras del uzu-drumkit)

Kit nuevo `techno` («Techno») en la lista de kits, **sin tocar** Batería, 808, Electrónico ni Vinilo ni lo guardado (el id es nuevo).
- **Muestras** (Unlicense, dominio público; autoría de Switch Angel y Mot4i, como el kit Electrónico): `bd` = bombo gordo con cola (`bd/17_bd_switchangel`), `sd` = **la palmada** (`cp/10_cp_switchangel`), `hh` = el charle cerrado de Electrónico (`hh/13_hh_switchangel`, idéntico). Mono, 16 bits, recortadas (0,5 y 0,4 s). **87 386 B en total.** Origen y SHA en `public/samples/CREDITS.md`.
- **Modelo sin cambios:** un instrumento, una muestra (`sampleIndex` a 0). **Para después:** el bombo corto (`bd/11_bd_mot4i`), el charle abierto (`oh/11`) y el ride (`rd/10`) necesitan un campo por paso o por loop.
- **Código mostrado:** solo suena en la app (`appOnly`): sin `.bank()` ni `samples()`, con el comentario «el kit de techno solo suena en la app» y los sonidos de strudel; «Acerca de» lo explica. En la app: `.bank("Techno")`.
- **No cambia lo que ya suena:** ninguna canción ni remix lo usa (los remixes de serie llevan su kit). Hay que elegirlo en Ajustes.
## Principios
2 ✔ · 5 ✔ · 7 ⚠ sin probar con gente · 8 ⚠ se añade un kit; no se quita ninguno. **Sin comprobar:** cómo suena (cuerpo del bombo con la cola cortada a 0,5 s, que la palmada funcione de caja, el volumen frente a los otros kits: todo ajustado por pico a −1,5 dB, no de oído).

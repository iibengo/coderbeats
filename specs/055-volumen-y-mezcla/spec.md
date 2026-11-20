# Spec 055 · Volumen y mezcla del MP3, tanda A (corta)

## Por qué
Ion pasó el MP3 de Korobeiniki y una referencia de techno (−6,2 LUFS) a una IA que oye y al análisis de esta sesión (2026-11-20). Las medidas de la referencia y de nuestro remix dieron: el grave está casi igual de equilibrado (la «falta de graves» era **10 LU de volumen**), pero el nuestro es **mono**, tiene ~3–4 dB menos de 2–6 kHz, el drop no pega más que la subida y el final corta seco. Esta tanda hace lo que se puede **medir sin oír**.

## Hecho (tanda A)
- **Volumen a −14 LUFS** al guardar el MP3 (`app/lib/loudness.ts`, pura): sonoridad integrada BS.1770-4 (filtro K, bloques de 400 ms, puertas de −70 LUFS y −10 LU), **limitador de pico offline** (mira hacia delante, nunca pasa del techo) y normalización iterativa. **Techo −2,3 dBFS** porque la codificación a MP3 suma ≈ 0,8 dB (medido) y así el pico real queda bajo −1 dBTP. Comprobada con la calibración de la norma (seno de 1 kHz a −23 dBFS = −23 LUFS), con los coeficientes publicados a 48 kHz y **contra `ffmpeg -af ebur128`** sobre el MP3 real: −14,0 LUFS exactos.
- **Fundido final de 2,5 s** (antes 0,3 s). Medido: la última parte baja de −24 a −44 dB sin chasquido.
- Tests (`tests/unit/loudness.test.ts`, 6) y guion `lab-exportar-mp3.mjs` al día.

## Medido (Korobeiniki, MP3 de la app, 116,4 s, 48 kHz estéreo, 320 kbps)
| | antes | después |
|---|---|---|
| LUFS integrado | −16,3 | **−14,0** |
| Pico (ebur128, MP3 decodificado) | −2,7 dBFS | **−1,5 dBFS** (< −1) |
| LRA | 6,4 LU | 6,3 LU |
Por partes (LUFS): Intro −18,5 · Estrofa −17,3 · Subida −11,4 · Drop −13,2 · Break −14,4 · Puente −15,4 · Drop 2 −13,5 · Final −18,4.

## Probado y **no** resuelto
- **La subida suena más fuerte que el drop** (+1,8 LU). Se probó quitar el pad del riser y poner el riser a fuerza 0,4, y quitar el bajo de la subida: **no cambió nada medible**, así que se deshizo. Lo que la sube está en el redoble de caja (`T.roll`, hasta el 100 %) o en el reparto de volumen del motor al haber menos loops (en la spec 048 ya se vio que al entrar bombo y caja el motor baja los demás). Falta aislar capa por capa.
- **Un fallo sin explicar:** en una de las cuatro grabaciones del navegador sin pantalla, el audio **se quedó casi mudo (≈ −36 dB, constante) desde ~93 s** hasta el final, aunque el motor seguía «sonando». No se repitió en las otras tres (con el mismo código de sonido). Puede ser del navegador sin pantalla; **no se ha descartado un fallo del motor**. Si te pasa en un móvil, dímelo.

## Sin hacer (siguiente)
- **Anchura estéreo** (hoy el drop es mono exacto: lado − medio −62 dB; la referencia, −11 dB) y **más 2–6 kHz** (−16,1 frente a −12,6): tocan los sintes compartidos (`SYNTH_SOUND`, `hat`, `keys`), que usan los demás remixes y las canciones guardadas. Hace falta decidir cómo: **sintes nuevos** (ids nuevos, el resto idéntico) o un campo por capa.
- **Tanda B (percusión, groove, transiciones):** se programa con capas dentro del tope de 4 capas por parte; hay que oírlo.

## Principios
1 ✔ nada cambia en pantalla · 2 ✔ no toca el sonido en directo (solo el archivo exportado) · 3 ✔ · 4 ✔ · 5 ✔ · 6 ✔ el MP3 sale al volumen de streaming · 7 ✔ la norma BS.1770 y la práctica de Spotify · 8 ✔ nada nuevo en pantalla.

## Decisiones a revisar
- Si −14 LUFS es el objetivo que quieres (Spotify ≈ −14; otros servicios usan −16 o −9).
- Si el fundido de 2,5 s corta algo que te importe.
- **Sin oír:** el archivo se ha medido, no escuchado.

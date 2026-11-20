# Spec 056 · Korobeiniki en techno: el sonido, tras el análisis (corta)

## Por qué
Ion pasó el MP3 y una referencia de techno a una IA que oye (2026-11-20). Con las medidas de esta sesión (spec 055) el diagnóstico quedó así: el reparto de graves ya es parecido al de la referencia (la «falta de graves» era 10 LU de volumen), pero el remix era **mono** en el drop, tenía **menos 2–12 kHz**, una **percusión escasa** y el drop **no pegaba más que la subida**. La spec 055 arregló el archivo; esta cambia **el sonido** (y se oye también en la app).

## Qué cambia (solo el remix `korobeiniki-techno`)
- **Dos sintes nuevos, sin tocar los de siempre** (lo guardado suena igual; hay test): `stabW` (stabs con el filtro a 4800 Hz, cortos y que **rebotan entre los dos lados**: `pan(sine.range(0.12,0.88).fast(2))`, reverb pequeña) y `leadW` (el `lead` con el filtro a 3200 Hz en vez de 1800, reverb pequeña y un vaivén lento). Registrados en `melody.ts` y `stageFx.ts`, y `stabW` cuenta como «acordes» en `remixParts.ts`.
- **Percusión con groove** (`app/lib/korobeiniki.ts`): el charles `hat` en vez del dibujo fijo del kit, con **golpes fantasma** (fuerza 0,3–0,5) entre el «tss» a contratiempo, un **redoble creciente** al final del 4.º compás de cada vuelta, el **charles abierto** que sustituye al cerrado en el paso 14 (nunca los dos a la vez) y un **redoble de caja** corto al final de cada vuelta. Cabe en los 8 loops de una parte (test).
- Los remixes de los demás estilos y los sintes de siempre no se tocan.

## Medido (MP3 de la app, tras la spec 055; antes → ahora)
| | antes | ahora |
|---|---|---|
| Anchura del drop (lado − medio) | **−62 dB** (mono) | **−21 dB** |
| 2–6 kHz (dB respecto al total, drop) | −16,1 | **−15,1** |
| 6–12 kHz | −16,7 | **−15,2** |
| Estrofa → Drop (LUFS) | −19,7 → −15,3 (4,4 LU) | **−19,0 → −13,0 (6 LU)** |
| Subida − Drop | +1,1 LU | **+0,8 LU** |
| Total / pico / LRA | −14,0 / −1,5 / 6,3 | **−14,1 / −1,5 / 7,7** |
Referencia de techno: lado − medio −11 dB; 2–6 kHz −12,6; 6–12 kHz −14,6. **Acerca, pero no llega** (más ancho y con 2–6 kHz 2,5 dB por debajo).

## No resuelto
- **La subida sigue unos 0,8 LU por encima del drop** (probado ya sin efecto en la spec 055: quitar pad y bajo, bajar el riser). Falta aislar capa por capa.
- Más anchura (el objetivo era ≈ −12 dB) y más 2–6 kHz: **sube o baja a oído**; no se ha tocado la mezcla para forzar la cifra.
- **Transiciones** (silencios cortos, entradas y salidas de capas, barridos): sin hacer.
- **Sin oír.** Nada de esto lo he escuchado; solo medido.

## Principios
1 ✔ nada cambia en pantalla · 2 ✔ misma tonalidad y escala; el charles y el pan no pueden desafinar · 3 ✔ · 4 ✔ se actúa igual · 5 ✔ **como mucho 8 loops y 4 capas por parte** (test) · 6 ✔ · 7 ✔ el techno de club (referencia aportada por Ion) · 8 ✔ se quita el dibujo fijo de charles del kit.

## Decisiones a revisar
- Si los dos sintes nuevos deben aparecer en el Estudio como opciones (hoy solo los usa este remix).
- El vaivén del `pan` es de un seno rápido: puede sonar a «ping-pong» si te molesta.
- Si el charles con fantasmas queda recargado o poco groove (a oído).

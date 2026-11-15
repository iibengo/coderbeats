# Estado (2026-11-15) — lo hecho mientras no estabas

Todo en `main`, **sin push**. Un commit por parte, con tests (926), `nuxt typecheck` y `nuxt build` en verde antes de cada uno.
Además de los tests, esta vez **sí he probado la interfaz con Chrome sin pantalla** (micro de mentira; guion en `tests/browser/`): arranca, carga demo, Escenario, grabar canción, convertir y deshacer, copiar con variación, el piloto y la voz funcionan. **Nada se ha oído** (no hay altavoces) ni se ha visto en un móvil.

## Qué se ha hecho (por commits)

| Cola | Commit | Qué |
|---|---|---|
| 1 | `dc21d47` | **Componer en directo** (011 §14.1): «● Grabar canción» en Jugar apunta las capas por compás y las convierte en células con nombre (`lib/liveCompose.ts`). |
| 2 | `fd28695`, `475050b` | **Escenario** (011 §13.1): «⚡ Escenario» (con la música sonando) a pantalla completa: 4 zonas (bombo, boom, crash, barrido), onda de color de la paleta, tope 6/s, zona muerta, EchoGate, «Grabar efectos» como capas de melodía; sintes `boom` e `impacto`. En Componer, «⚡ Efectos» (la misma pantalla). |
| 3 | `94aeeba` | **Piloto automático F1** (009): dedo fantasma con gestos reales sobre la pantalla, humanización pura con semilla, guion de la demo de dembow que construye la célula Principal (comprobado en Chrome: mismos golpes), bocadillo, ⏸ ⏭ ✕, un toque real lo detiene. Botón «▶ Ver cómo se construye» en ⋯ (solo en dembow). |
| 4 | `b01cbd7` | **Pista de voz** (007), primera rebanada: loop `'voz'` validado, toma de 2 compases alineada a la línea con la latencia corregida, guardada en IndexedDB, reproducida por Strudel; botón «🎤 Voz» (con cascos). Sin autotune. |
| 5 | `f486f3b`, `0b82c3d` | **Calidad:** tests de `usePrefs`, `useLibrary`, `useCalibration` (cobertura de composables 26 % → incluye los tres al 94–95 %); el vigilante de frames **vuelve a subir** el detalle si va sobrado (`lib/frameGovernor.ts`, con histéresis). |
| 6 | `0b82c3d` | Solo un paso: el Escenario sale de `VisualStage.vue` a `StageOverlay.vue`. |

## No hecho / saltado (y por qué)

- **Partir `useAudioEngine.ts` (2,6 mil líneas) y `AroCanvas.ts`:** no lo he tocado; sin poder oír ni ver en un móvil, un corte grande de un motor de audio sin tests de integración es lo más arriesgado de la cola. Mejor con tu supervisión.
- **Rendimiento por frame (cachear):** sin perfilar en un móvil real no hay qué optimizar con criterio; solo el vigilante.
- **Voz:** sin franja visual (F2), capas (F3), «audio no disponible» en la bola, aviso de Bluetooth, recolección de audios (a propósito: borrar por un recuento incompleto podría perder tomas), autotune.
- **Piloto:** solo dembow; falta colonia, melodía, órgano, remixes y grabar sesiones.
- **Escenario:** falta el disco en perspectiva tipo LED, la estela y el encendido en el drop.
- **Publicar `kits/coderbeats-kits`** como `iibengo/coderbeats-kits` tag `v1` (lo tienes que hacer tú; el código de Vinilo en strudel.cc no suena hasta entonces).

## Decisiones a revisar (cada una está en su spec)

- 011 §14.1 y §13.1 (final de cada sección): solo una célula, apuntar al llegar el compás, unir tramos cortos, barrido fijo de 2 s, «⚡ Efectos» en Componer bloquea mover células.
- 009 §12: sin `PilotWorker`, guion en orden con esperas, pausa sin parar la música, ⏭ carga la demo del estilo, la guía se calla durante el piloto.
- 007 §16: toma fija de 2 compases sin detector de voz, reproducción por Strudel (`loopAt`) sin medir deriva ni costura, carril exclusivo, solo una célula.
- Detalle visual: la barra de la tira de células de la canción pasa por debajo del selector Jugar | Componer (se ve en la captura tras grabar canción).
- El gancho `window.__engine` es solo de desarrollo; el motor usa `window.__cb` (no tocarlo).

## Qué probar en el móvil, en este orden

1. **Escenario:** con una demo sonando, «⚡ Escenario»: toca abajo/centro/arriba/lados. ¿Suenan **al instante** y a la nota del estilo? ¿Bombean tres bombos seguidos? ¿Las ondas se ven bien y no molestan? «● Grabar efectos» → ¿nacen las capas y suenan como lo tocado?
2. **Piloto:** en dembow, ⋯ → «▶ Ver cómo se construye». ¿Se ve el dedo natural? ¿Caen los golpes en el compás? ¿⏸, ⏭ y tocar la pantalla lo detienen bien?
3. **Grabar canción:** con 3 capas sonando, «● Grabar canción», apaga y enciende bolas al ritmo, «■». ¿Salen las partes que esperabas? ¿Cae el cambio en el compás justo?
4. **Voz (con cascos de cable):** «🎤 Voz», canta 2 compases desde el siguiente. ¿Cae **en el compás**? ¿El bucle no tiene clic ni se desfasa tras un minuto? ¿Suena a buen nivel? Cierra y abre la app: ¿sigue sonando la voz?
5. **Lo de ayer (012):** la fuga del bajo en techno (beatbox sin melodía fantasma), la melodía sugerida (aceptar, ↻, ✕, cantar), copiar con variación en Componer y «✦ Convertir en canción» + «↶ Deshacer».
6. Rendimiento: ¿baja el detalle si va lento y vuelve a subir al rato?

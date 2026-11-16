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

---

# Segunda tanda (2026-11-15, noche) — cola 3 → 9

Todo en `main`, **sin push**; un commit por parte con tests (996), `nuxt typecheck` y `nuxt build` en verde. Además, **cada parte se comprobó en Chrome** con los guiones de `tests/browser/` (micro de mentira; nada se oyó ni se vio en un móvil).

| # | Commit | Qué |
|---|---|---|
| — | `aa612e5`, `5f5affb` | Piloto **estricto** (micro real ignorado, no se aceptan sugerencias/variaciones, comprobación y corrección final, ajustes restaurados) y ayudas **tenues e intocables** mientras corre; etiqueta «micro bloqueado». |
| 3 | `d979965`, `68e33e9` | **«👁 Previsualizar»** (Jugar, ⋯ y Mis canciones): guion generado de los datos de cualquier canción; **construye la canción completa** (primera célula con el dedo; cada siguiente se crea y engancha **desde los datos**, plan B) y la toca entera; al acabar o parar con un toque, **todo vuelve** como estaba. Probado con la Sinfonía 40 (12 células). |
| 4 | `3deac7b` | **Tutorial jugando** (001 §14.1): «arrastra un golpe» → «llévalo al centro», mano fantasma del piloto, y las pistas del carril y de alejar (una vez). |
| 5 | `ce58ac1` | La tira de células baja bajo el selector Jugar \| Componer. |
| 6 | `2153013` | **Voz:** onda en círculo alrededor del aro y aviso de Bluetooth (ida y vuelta > 120 ms). |
| 7 | `9f3bbe1` | **Fundir células** (005 §21): `mergeCells` puro, deshacer, gesto de arrastrar y mantener 0,8 s. |
| 8 | `892b30a` | **Biblioteca:** buscador y grupos por estilo; **compartir por enlace** (solo datos, validado como lo guardado, topes, tests de inyección). |
| 9 | `03ac74a` | **Exportar vídeo** (013, fases 1–3): agua y aro sin botones + audio de la app; vertical/cuadrado; célula o canción; guardar/compartir. Comprobado: mp4 720×1280, duración exacta, con imagen y sonido. |

## ⚠ Pendiente: bloqueo al cambiar de canción mientras suena
Reproducido en **Chrome de escritorio** (con el servidor de desarrollo): con una demo sonando, abrir un remix desde «Remixes» deja la página sin responder (el depurador no llega a pausarla; con la CPU ralentizada 4× el objetivo llega a cerrarse). **También ocurre en la versión de antes de toda la cola (`90d42e6`)**, así que no lo causó lo de hoy. Desde parado, los tres remixes abren bien (3 s). Sospechas sin confirmar: la cadena `replaceSong` (parar → `setSong` → `play`) con los observadores (`useSuggestions`, `usePrefs`) al cambiar de estilo/kit con música; carga de muestras del kit nuevo. Se probó que **no es** `ensureVoices` ni el vigilante de frames. Para seguir: `PORT=3999 node tests/browser/repro-bloqueo-cambio.mjs` (y `repro-bloqueo-pila.mjs`), y bisecar dentro de `replaceSong`/`play`. Puede ser lo que ves en el móvil («se queda bloqueado y no inicia el play»): **solución provisional: parar antes de abrir otra canción**.
Nota: la «pantalla en blanco» de una sesión antigua fue, casi seguro, la caché del service worker (la prueba de recargar con datos guardados no se rompe).

## No hecho / saltado
- Previsualizar: sin gestos de colonia con el dedo (copiar/enganchar con el asa funciona a mano pero no encadenado en el guion; `colonyPoints()` queda expuesto) ni grupos en paralelo con gestos.
- Voz: tomas fijas de 2 compases, sin detector de voz, sin capas, sin recolección de audios (a propósito), sin autotune; las voces **no viajan** en el enlace compartido.
- Fundir: sin animación ni anillo azul; si sonaba, la canción arranca de nuevo.
- Vídeo: **sin probar en iOS**; sin previsualización (fase 4) ni cámara deformada; sin fallback WebCodecs; rendimiento al grabar sin medir.
- Tutorial: el arrastre real con el dedo no se pudo comprobar con el micro de mentira (llena el carril de bombo): se comprobó por el motor.
- Partir `useAudioEngine.ts` / `AroCanvas.ts` y perfilar el rendimiento por frame: siguen sin tocar.

## Decisiones a revisar (cada una, en su spec)
009 §12–§13 (previsualizar), 001 «Tutorial jugando: implementado», 007 §17, 005 §21.12, 006 «Implementado: buscador…», 013 §12.

## Qué probar en el móvil, en este orden
1. **El bloqueo:** abre una demo, dale a Play y abre un remix. ¿Se cuelga? ¿Y si paras antes?
2. **Previsualizar:** con el remix de Mozart, ⋯ → «👁 Previsualizar». ¿Se ve construir célula a célula y suena entera? Páralo con un toque: tu canción debe quedar como estaba.
3. **Exportar vídeo:** ⋯ → «🎬 Exportar vídeo», célula de 4 compases en vertical. ¿Se graba, se reproduce y se puede guardar/compartir en Safari del iPhone?
4. **Compartir por enlace:** 🔗 en una canción guardada → ábrela en otra pestaña/dispositivo; confirma y mira que sea idéntica.
5. **Fundir:** en Componer, arrastra una célula sobre otra, mantén ~1 s y suelta; «↶ deshacer».
6. **Tutorial:** borra los datos del sitio (o «Repetir la guía y el tutorial»), haz un bum, arrastra un golpe, llévalo al centro.
7. **Voz con cascos:** la onda alrededor del aro y el aviso con Bluetooth.


---

## Actualización (2026-11-16): el «bloqueo» al cambiar de canción
**Resuelto como falso positivo de la prueba, y arreglado un riesgo real.** El «bloqueo» reproducido en Chrome de escritorio era el **cuadro nativo `confirm()`** («Tu canción de ahora no está guardada») que Chrome sin pantalla no cierra: la página parecía colgada (y por eso también ocurría en la versión vieja). Desde parado no salía el cuadro y abría bien. **No era un fallo del motor.**
Aun así, es posible que sea lo que viste en el móvil: los cuadros nativos pueden **bloquearse o suprimirse** («evitar más cuadros de esta página») y entonces abrir un remix o una canción **no hacía nada sin avisar**. Se sustituyeron los 8 `confirm()` de la app por un **cuadro propio** (`useConfirm` + `ConfirmDialog`). Comprobado en Chrome (`tests/browser/cambio-cancion.mjs`): con una demo sonando, abrir un remix pide confirmación, al cancelar no cambia nada y al aceptar abre las 12 células y sigue sonando, sin cuadros nativos. Si en el móvil sigue sin iniciar el play tras cambiar de canción, sería otra causa (p. ej. carga de muestras del kit nuevo): pásame el error de la consola.

---

## Tercera tanda (2026-11-16) — plan autónomo, cola 1–4

| Commit | Qué |
|---|---|
| `68f2fea` | Cuadro de confirmación propio en vez de `window.confirm` (el «bloqueo» de las pruebas era el cuadro nativo sin cerrar; en el móvil los nativos pueden suprimirse). |
| `d17ed9b` | Remix nuevo **«Wow (60 s)»**: techno original de 32 compases (intro, entra, subida con riser, drop con gancho, crash e impacto, final). |
| `2f7b35d` | **Spec 014 fase 1:** «Producción» en ⋯ (swing y matices de volumen, apagado por defecto). |
| `85d68b7` | **Spec 015 fases 0–1:** «🎹 Agua» (teclado de agua fuera del aro, escala del estilo, acorde en los tiempos fuertes) + «● Grabar» como loop de melodía. |
| `fb85450` | **Vídeo fase 4:** exportar la previsualización. |
| `8a08c96`, `2b290d4`, `f711b99` | Specs 015 y 014 y el plan autónomo (`specs/PLAN-AUTONOMO.md`, `PLAN-AUTONOMO-2.md`). |

**Sin oír ni ver en un móvil** (como siempre): lo comprobado en Chrome está en `tests/browser/` (`cambio-cancion`, `agua`, `video-previsualizacion`…). **Pendiente** de la cola: 014 fases 1b–3 (variación en plantillas, automatización, transiciones), la zona muerta del teclado de agua, fluido, célula de melodía y las mejoras pequeñas: ver `specs/PLAN-AUTONOMO-2.md`.

### Qué probar en el móvil (esta tanda)
1. **Abrir un remix con una canción sonando** (ya con el cuadro propio): ¿pide confirmación, abre y suena?
2. **Remix «Wow (60 s)»** en Remixes: ¿se oye como una canción? ¿Qué falla («el drop no pega», «el bajo tapa el bombo»)?
3. **«Producción»** en ⋯ con una canción sonando: ¿se nota el swing y los matices? ¿Mejor o peor?
4. **«🎹 Agua»** (Jugar, sonando): toca el fondo fuera del aro; ¿suena al instante, a notas que encajan? «● Grabar» y comprueba la melodía.
5. **«🎬 Exportar vídeo» → «La previsualización»** en el iPhone.

---

# Tercera tanda (2026-11-16) — Agua legible + plan autónomo 2

Todo en `main`, **sin push**; un commit por parte con tests (1023), `nuxt typecheck` y `nuxt build` en verde. Lo de Agua, **comprobado en Chrome** (`tests/browser/agua.mjs` y `agua-visual.mjs`); nada oído ni visto en un móvil real.

| Commit | Qué |
|---|---|
| `600f3fd` | **«🎹 Agua» se entiende** (lo que viste negro): franjas suaves por nota (graves **abajo**, rosa/lila/azul por altura) solo con el modo encendido; al tocar, **onda de color** en el punto exacto (más grande cuanto más grave) y la franja se ilumina; rótulo «🎹 Agua · toca el fondo» y al grabar «● Grabando · compás n/4 · N notas»; lo grabado **se ve ya en la franja de melodía del aro**. Movimiento reducido: solo un cambio de brillo. |
| `e49e97f` | **Zona muerta** de 14 px alrededor de cualquier botón: ahí no se toca el agua. |
| `4d24ec5` | **Producción en «Convertir en canción»** (spec 014 §8): con el interruptor «Producción» (⋯) encendido, fill de caja en Entra y Drop y, en la Subida, barrido de ruido (`riser`) + impacto al final. Apagado = igual que antes. |
| `7ea6634` | **Voz sin audio:** la bola sale apagada y discontinua, «audio no disponible». |
| `f46460d` | Tests de `useTutorial` y `useSuggestions`. |

**Decisión que cambia cómo se toca:** para que lo que se ve coincida con lo que suena, ahora **la altura del dedo es la nota** (arriba agudas, abajo graves) y la posición horizontal es el brillo (izquierda cálido, derecha brillante). Antes era al revés.

## Saltado (y por qué)
- **Estela larga del dedo y «venas» por los hilos** (015 fase 2): sin poder medir rendimiento en móvil.
- **014:** hat abierto, cambio de nota del bajo, automatización por compás, downlifter, silencio antes de caer e impacto solo en el drop (un loop se repite cada vuelta), reglas en los remixes (datos fijos). Detalle en la spec 014 §8.
- **Fundir sin reiniciar la música** y su animación/anillo azul: tocan el reloj del motor (`replaceSong`), arriesgado sin oído. **👁 de Mis canciones grabable en vídeo:** sin tocar.
- **015 fase 3** (célula de melodía, Lissajous, adjuntar por fundir) y **partir `useAudioEngine.ts`:** no sin tu supervisión. **Tests de `useVideoExport`:** casi todo es navegador (MediaRecorder).
- El **estado de «Agua» no se guarda** a propósito.

## Qué probar en el móvil, en orden
1. **Agua:** música sonando → «🎹 Agua». ¿Se ven las franjas y el rótulo? Toca arriba/abajo del fondo: ¿onda de color donde tocas, franja iluminada, graves abajo/agudas arriba? Arrastra izquierda↔derecha: ¿el brillo cambia?
2. «● Grabar», toca unas notas durante 4 compases: ¿el rótulo cuenta el compás y se ven las notas en la franja de melodía del aro? «■» → ¿suena como lo tocado? ¿Los botones no disparan notas al pulsarlos?
3. **Producción:** ⋯ → «Producción» encendido, con un loop de ritmo sin melodía «✦ Convertir en canción» → ¿la Subida sube con ruido y cae bien el impacto (¿llega un paso pronto?), el fill de caja cada 4 compases? ↶ deshacer.
4. Con una canción guardada con voz en otro dispositivo (o borrando datos del sitio): la bola de voz sale discontinua.
5. Lo pendiente de antes (bloqueo al cambiar de canción sonando, previsualizar, vídeo, compartir, fundir).

---

# Cuarta tanda (2026-11-16) — fluido del agua y primer minuto

Todo en `main`, **sin push**; tests (1032), `nuxt typecheck` y `nuxt build` en verde en cada commit. Comprobado en Chrome (guiones `tests/browser/flujo.mjs` y capturas); **nada medido ni visto en un móvil real**.

| Commit | Qué |
|---|---|
| `feat(agua): estela del dedo y venas…` | **Estela del dedo** (Jugar) y **venas** por los hilos (Componer). El vigilante de frames tiene un escalón nuevo, `flow`: **lo primero que se apaga y lo último que vuelve**; con movimiento reducido no se dibuja. Interruptor **«Agua viva»** en ⋯ → ajustes (encendido por defecto, se guarda). Canvas propio, topes duros (28 puntos de estela, 48 de venas). |
| `feat(primer minuto)…` | Primera vez: Play late y «Dale a ▶». Durante la guía **no hay botones avanzados** (tapaban la frase). Textos más cortos en inicio, latencia y sonidos. **Latencia saltable** (solo se pide a quien no tiene sonidos). Spec 011, «Pulido del primer minuto». |

## Decisiones a revisar
- «Agua viva» **encendida por defecto**: si en tu móvil se nota lento, apágala y dime (el vigilante debería apagarla solo en ~2 s).
- Saltar la latencia deja la latencia en 0 hasta que se mida en ajustes (afecta a cuánto se adelantan los golpes del micro).
- El paso 2 (grabar tus 3 sonidos) **sigue siendo obligatorio**: es lo más largo del primer minuto real; quitarlo sería una función nueva (sonidos por defecto o tocar con el dedo sin micro).

## Qué probar en el móvil, en orden
1. **Primer minuto con alguien que no conozca la app** (o borrando los datos del sitio): ¿entiende que hay que dar a ▶? ¿Cuánto tarda en tener un ritmo que le guste? Mira dónde duda: ¿en la latencia? ¿en grabar los sonidos? ¿en la frase de la guía?
2. Tras la guía, ¿vuelven los botones y la melodía sugerida se entiende?
3. **Agua viva:** arrastra el dedo en Jugar: ¿estela lila que se desvanece? En Componer con un remix (Beethoven), ¿puntitos rosa corriendo por los hilos? ¿Va igual de fluido con el interruptor apagado/encendido? Si va lento, ¿se apaga sola?
4. Lo anterior (Agua legible, Producción en «Convertir en canción»…) sigue sin probar: ver la tanda 3.

---

# Quinta tanda (2026-11-16) — sin calibración obligatoria

Escrito primero en **spec 001 §17** (flujo, modelo, cómo medirlo con tus tomas, propuesta de calibrar, latencia) y luego implementado. Tests (1043), typecheck y build en verde; comprobado en Chrome (`tests/browser/sin-calibrar.mjs`). **No probado con voces reales ni en el móvil.**

- **`Empezar` → Estudio directo.** Latencia y sonidos ya no son obligatorios (se quitaron «Paso 1 de 2 / 2 de 2»); siguen en ⋯ («Medir latencia», «Calibrar mis sonidos») con «Ahora no» para volver. Quien ya tenía calibración la conserva y manda.
- **Modelo por defecto** (`lib/defaultModel.ts`): 15 muestras sintéticas (5 por clase) en centroide + bandas + cruces por cero; los MFCC no pesan. Prototipos sacados de cómo se agrupan los golpes de tu toma «Beatbox solo».
- **Medida con tus tomas** (`tests/unit/defaultModel.test.ts`, por subsecuencia común contra «bum pff ts» en bucle): en `t8` **29 golpes, precisión 76 %, cobertura 73 %** (los fallos son sobre todo colas del bum contadas como golpe aparte). Se salta si no están las tomas; `--silent=false` imprime la secuencia.
- **«¿Te afino a tu voz?»** (`lib/modelFit.ts`): mediana de lo lejos que caen los últimos 12 golpes de su clase; > 0,45 → sale una vez (Sí → «Tus sonidos», «Ahora no» se recuerda). Beatbox: ~0,1; voz cantada: ~1,1.
- **Latencia sin medir:** 50 ms; 180 ms si la salida parece Bluetooth (nombre de salida o latencia informada > 120 ms). iOS no da nombres de salida.

## Decisiones a revisar
- El **0,45** y los prototipos son una primera propuesta con **una sola voz** (la tuya, una toma): con otras voces o micros puede acertar menos; por eso la propuesta y ⋯.
- Sin calibración **no hay filtro de golpes flojos** (no hay volumen de referencia): el ruido de fondo podría colar golpes; si pasa, dímelo y pongo un volumen de referencia por defecto.
- 180 ms de Bluetooth es una estimación; «Medir latencia» en ⋯ lo ajusta.

## Qué probar en el móvil, en orden
1. **Borra los datos del sitio** y abre la app: `Empezar` → ¿llegas directo al Estudio, sin pasos? Dale a ▶ y haz «bum · pff · ts»: ¿se reconocen bombo, caja y platillo con tu voz **sin calibrar**? ¿Y con otra persona?
2. Canta «na» o di algo que no sea beatbox varias veces: ¿sale «¿Te afino a tu voz?»? ¿«Sí» abre «Tus sonidos» y al guardar mejora? ¿«Ahora no» no vuelve a salir?
3. Con cascos Bluetooth: ¿la imagen va por delante del sonido? ⋯ → «Medir latencia» ¿lo arregla? ¿Cuánto da frente a 180 ms?
4. ⋯: la línea «Sonidos: modelo por defecto / calibrados» cambia al calibrar.

---

# Sexta tanda (2026-11-16) — el modelo por defecto se adapta al micro

**Qué pasó en tu iPhone** (tu registro): bombo bien; los «ts» salían como caja y los «pff» como bombo. Todo un escalón más grave que en tu toma del laboratorio. Tu registro **no traía cifras del espectro**, así que no se puede saber exactamente qué cambió en el micro; sí se ve que el orden bum < pff < ts se mantiene.

**Qué hice** (spec 001 §17.8, `lib/adaptiveModel.ts`): sin calibración propia, el modelo **compara los golpes entre sí** en vez de fiarse del espectro absoluto: cuando entre los últimos golpes aparecen tres grupos de claridad bien separados, aprende que el más grave es bombo, el medio caja y el agudo platillo, y los guarda para la próxima sesión (por dispositivo). Con calibración propia no interviene.

**Medida antes → después** (tus tomas `t8`, «bum pff ts» en bucle, precisión/cobertura por secuencia; micros **simulados** que apagan los agudos):

| micro | antes (fijo) | después (adaptativo) |
|---|---|---|
| tal cual | 76 % / 73 % | 76 % / 73 % |
| medio escalón más grave | 55 % / 53 % | **72 % / 70 %** |
| 0,7 de escalón más grave | 59 % / 57 % | **72 % / 70 %** |

**Límites honestos:** es una **simulación**, no tu iPhone (no hay cifras de su espectro). **La primera vez que suene cada clase nueva puede equivocarse** (hasta tener las tres clases oídas, usa los prototipos fijos): en tu prueba, con el orden bombo → ts → pff, es probable que el primer «ts» y el primer «pff» fallen y luego acierte. Con solo dos clases, sigue fijo.

**Para el próximo registro:** cada golpe del diagnóstico trae ahora `c` (centroide), `z` (cruces por cero) y `graves`, y sale una línea cuando aprende tu micro («claridad bum … · pff … · ts …»). Con esas cifras de tu iPhone puedo ajustar los prototipos de verdad.

## Qué probar en el móvil
1. Borra «auto-centers» no hace falta: abre la app (con los datos del sitio borrados), toca ▶ y haz **bum ×4, pff ×4, ts ×4, y repite el ciclo**: ¿acierta en la segunda vuelta? ¿Sale la línea «el modelo por defecto aprendió tu micro» en el diagnóstico?
2. **Cierra y abre la app** y haz solo «ts» primero: ¿ya sale platillo (usa los centros guardados)?
3. Pásame el registro con las nuevas cifras (`c`, `z`, `graves`) de 6 «bum», 6 «pff» y 6 «ts».
4. Si sigue sin acertar bien: ⋯ → «Calibrar mis sonidos».

---

# Séptima tanda (2026-11-16) — el registro real del iPhone (spec 001 §17.9)

Con las cifras de tu registro: el iPhone suena muy distinto al laboratorio (centroide 0,05–0,14 frente a 0,3–0,5; cruces por cero 0,02–0,10 frente a 0,15–0,5). La versión anterior **no aprendió nunca** (pedía separaciones absolutas pensadas para el laboratorio) y dos golpes con pocos graves salían bombo.
**Cambio:** el bombo se decide por sus **graves** (≥ 0,42 de energía < 800 Hz; en el iPhone, 0,47–1,0; en caja/platillo ≤ 0,25), que no depende del micro; caja y platillo, por **orden** con separación relativa. Medido: la regla separa **exactamente** los 8 bombos de tu registro de los otros 17 golpes; `t8` del laboratorio sigue en 76 %/73 %.
**Lo que sigue sin saberse:** en ese registro no se distingue cuáles eran «ts» y cuáles «pff» (sus cifras son casi iguales y los primeros parecen menos claros que los últimos). Sin eso, **no puedo prometer que el platillo salga**.

## Qué probar y qué mandarme
1. Abre la app de nuevo (recarga completa) y haz **8 «ts», pausa larga, 8 «pff», pausa larga, 8 «bum»**, mirando el reloj para anotar los segundos de cada grupo. Pégame el diagnóstico con esos tiempos. Ahora cada golpe trae `c`, `z`, `graves`, `medios` y `agudos`.
2. Si «bum» ya va bien y los otros dos se mezclan, el siguiente paso es ⋯ → «Calibrar mis sonidos» (es lo que de verdad resuelve un micro distinto); con tu registro etiquetado ajusto el modelo genérico.

---

# Octava tanda (2026-11-16) — sintetizador de dedo, producción, publicar

Todo en `main`, **sin push**; tests (1064), `nuxt typecheck` y `nuxt build` en verde. Comprobado en Chrome sin pantalla (guiones `tests/browser/`: `sin-micro`, `sintetizador`, `sin-conexion`, `audio-parado`); **nada oído ni probado en un iPhone**. Lista completa de lo pendiente: [`PENDIENTES.md`](PENDIENTES.md). Preparación para publicar: [`PUBLICAR.md`](PUBLICAR.md).

| Qué | Detalle |
|---|---|
| **Célula de melodía + sintetizador de dedo** (spec 015 §12, escrita antes) | «+ melodía» (⋯) crea una célula libre de tipo `melodia` (campo opcional: lo guardado no cambia) y abre un sintetizador a pantalla completa: **mantener y deslizar suena continuo** (un oscilador propio que se desliza entre notas de la escala; arriba/abajo = nota, lados = filtro), **curva de luz** que deja el dedo, notas de la escala marcadas suaves, «Desliza el dedo». «● Grabar» pasa lo tocado a la melodía (cuantizada, en la franja del aro). En el mapa, su silueta lleva la **curva de Lissajous** de su melodía. «🎹 Agua» queda como estaba. Bug cazado en Chrome: el padre capturaba el puntero y el deslizamiento no llegaba (arreglado). |
| **Producción** (014 §9) | Con el interruptor: Intro y «Entra» abren el filtro vuelta a vuelta, el Final lleva un **downlifter** (sinte nuevo). Apagado = idéntico (test). Saltado y por qué: hat abierto, bajo cada 8, silencio antes de caer (piden formato nuevo o el motor; **no se ha tocado el reloj**). |
| **«¿Te afino a tu voz?»** (001 §17.10) | También cuando de los últimos 10 golpes que no son bombo **ninguno es platillo**. **Calibrar a manos libres**: «Empezar» una vez y va pidiendo «bum» ×5, «pff» ×5, «ts» ×5 (~20 s). |
| **Primer minuto** | Mientras el tutorial enseña algo, los botones avanzados se esconden (la frase tapaba una fila). |
| **Sin micro** | Si se deniega o falta el micro: «Entrar sin micro» abre una demo para tocar con el dedo (micro mudo, sin guía de beatbox). |
| **Acerca de** | ⋯ → «acerca de» y en la pantalla de inicio: AGPL, código fuente (AGPL §13) y créditos; datos comprobados por test contra `package.json`, `LICENSE` y `CREDITS.md`. |
| **Publicar** | `PUBLICAR.md`: README público; **hallazgos graves en la historia** (tu correo en 228 commits, capturas con tu barra de marcadores, una grabación de pantalla, samples 909/acoustic sin licencia) y un **script que hace una copia limpia** (probado; no toca este repositorio). Las capturas y la grabación las moví a `../coderbeats-material-privado/`. |
| **PWA** | Antes el service worker guardaba 3 archivos (no abría sin conexión) y no había iconos. Ahora **iconos** (192, 512, maskable, apple-touch) y **67 archivos en caché**; comprobado abriendo sin conexión en Chrome. |
| **Audio parado** | ▶ y volver a la app despiertan el audio si iOS lo paró (llamada, bloqueo); antes quedaba mudo. |

## Decisiones a revisar
- **El sintetizador usa un oscilador propio** (no el sinte de Strudel): suena distinto a lo grabado/reproducido. Si no te gusta, se graba y suena con `lead`/`piano` de Strudel y el oscilador queda para tocar.
- La URL del código fuente en «Acerca de» es `github.com/iibengo/coderbeats` (`app/lib/about.ts`): cámbiala si el repositorio se llama distinto.
- El icono es un dibujo propio (aros y puntos, la paleta de la app); cámbialo si quieres otro.
- Entrar en una célula de melodía abre el sintetizador **siempre**; «✕» lo cierra hasta cambiar de célula, y «🎛 Tocar» lo reabre.

## Qué escuchar y probar en el móvil, en orden
1. **Sintetizador:** ⋯ → «+ melodía». ¿Se entiende sin leer («Desliza el dedo»)? Mantén y desliza: ¿suena continuo, se desliza entre notas, y a los lados cambia el brillo? ¿La curva de luz sigue al dedo? Con la música sonando: «● Grabar», toca 4 compases, «■»: ¿la melodía grabada se parece a lo que tocaste? En Componer, ¿la célula se distingue por su curva?
2. **Comparar** con «🎹 Agua» y decidir cuál se queda.
3. **Calibrar a manos libres:** ⋯ → «Calibrar mis sonidos» → «Empezar»: ¿el ritmo de «Di “bum” 1/5…» te sigue bien? ¿Se confunde con la respiración?
4. **Producción** encendida + «✦ Convertir en canción» de un loop sin melodía: ¿la Intro «se abre»? ¿suena el downlifter al empezar el Final, o raro?
5. **iPhone:** bloquea la pantalla con música, vuelve y dale a ▶: ¿suena? «Añadir a pantalla de inicio»: ¿icono bonito y abre sin conexión (modo avión)?
6. **Sin micro:** niega el permiso del micro: ¿«Entrar sin micro» y la demo se tocan bien con el dedo?
7. **Tu registro etiquetado** (8 «ts», 8 «pff», 8 «bum», con segundos) para cerrar el reconocimiento en el iPhone.
8. Lo de las tandas anteriores (ver cada una).

---

# Novena tanda (2026-11-16) — el sintetizador vivo y guiado (spec 015 §13)

Tests (1074), typecheck y build en verde; comprobado en Chrome (`tests/browser/sintetizador.mjs`: el guiado de principio a fin, 15 aciertos con el dedo táctil → la melodía queda guardada en la célula). **Nada oído ni probado en un móvil.**

- **Curva viva:** ocupa casi toda la pantalla, lila vivo en reposo y **rosa con brillo** al sonar; respira, gira despacio, se deforma con la nota, se estira hacia el dedo y cada nota lanza una onda de color que corre por la curva. Respeta el vigilante de frames (`drawLevel`: 0 todo, 1 sin brillos/deformación/ondas, 2 además sin respiración ni tirón) y el movimiento reducido. Arreglado: con a = b el Lissajous era una elipse sosa.
- **Corregido tras tu prueba:** el punto saltaba y costaba seguirlo; ahora la curva no gira en el guiado, el punto se desliza, elige el sitio más cercano al anterior y se ve tenue la siguiente nota (spec 015 §13.3).
- **Modo guiado (por defecto):** 6 temas de dominio público adaptados al estilo (Himno de la alegría, Sinfonía n.º 40, Fray Santiago, Estrellita, Para Elisa, Dies irae). La siguiente nota es **un punto de luz sobre la curva**; llevas el dedo y suena esa nota; la nota espera, y lo grabado son las posiciones del tema (encajado en ritmo y escala). Al acabar, queda como la melodía de la célula. «↻ Otra», «✋ Libre» (el de antes, con «● Grabar») y «🎯 Guiado».

## Decisiones a revisar
- La **respiración no va colgada del reloj del motor** (periodo de dos tiempos del bpm, libre): «al ritmo» aproximado, a propósito (no se toca el reloj).
- Zona de acierto de **46 px** y giro de **una vuelta cada 30 s** (la nota fantasma se mueve despacio con el giro): propuestas a afinar con el dedo.
- Las melodías **adaptadas a la escala menor** de cada estilo pueden perder carácter (Himno, Elisa); si alguna suena mal, se quita o se le da otra tonalidad.

## Qué probar en el móvil, en orden
1. ⋯ → «+ melodía». ¿Se ve la curva (contraste, rosa al sonar)? ¿Respira y gira sin marear? ¿Se estira hacia el dedo, y cada nota lanza una onda de color?
2. **Guiado:** ¿se entiende «Lleva el dedo al punto de luz»? ¿Cuesta llegar (radio, giro)? ¿Suena bien la nota al llegar? Completa un tema: ¿queda sonando con la canción y cuadra con el ritmo? «↻ Otra» con los 6 temas: ¿cuáles suenan bien en tu estilo?
3. «✋ Libre» y «● Grabar»: igual que antes.
4. **Rendimiento:** ¿va fluido en tu móvil? Si no, ¿se simplifica sola?

## Novena tanda, segunda parte: modo espiral (spec 015 §14)
Pedido tras probar el guiado: **el instrumento al revés**. Ahora el modo por defecto es la **🌀 Espiral**: pones el dedo y lo mueves **sin levantar, como quieras**; las notas del tema vienen a él por una espiral (puntos de color que se enroscan hacia el dedo, con cola) y **suenan solas al llegar**; el dedo deja un rastro de luz y da el brillo (izquierda–derecha). Al llegar a la última nota queda grabada en la célula y el tema sigue en bucle. «🌀 → 🎯 → ✋» cambia de modo (🎯 es el de llevar el dedo al punto; ✋ el libre). Comprobado en Chrome (dedo táctil moviéndose al azar: suenan las notas del tema y queda guardada); **sin probar de oído**.
- Decisión a revisar: el ritmo es el del bpm pero **no va sincronizado con el compás de la canción** (no se toca el reloj del motor): puede notarse desfasado respecto a la batería.
- Probar: ⋯ → «+ melodía», pon el dedo y muévelo sin levantar. ¿Se entiende que las notas vienen a ti? ¿Suena la melodía reconocible? ¿Va a tempo con la batería o desfasada? ¿Se ve bien el rastro y las ondas? ¿Va fluido?

---

# Décima tanda (2026-11-16) — la portada simple (spec 016)

Todo en `main`, **sin push**; tests (1107), `nuxt typecheck` y `nuxt build` en verde. Comprobado en Chrome sin pantalla (`tests/browser/portada*.mjs`); **nada oído ni probado en un móvil**. Decisiones y diseño: [`016-portada-simple/spec.md`](016-portada-simple/spec.md).

## Qué hay (un commit por parte)
| Parte | Qué |
|---|---|
| Fase 1 | **La nueva portada** (`Portada.vue`): al abrir, «Elige cómo suena» (5 tarjetas) y empieza la base (bajo y acordes). Todo lo demás es el **Estudio** (el de siempre); **«⋯ → Estudio»** y, en el Estudio, **«⋯ → Modo simple»**; lo que eliges se **recuerda** (`coderbeats:ui:v1`, su propia clave: no toca canciones ni ajustes). Misma canción en los dos. |
| Fase 2 | **Espiral en la portada**: el dedo da el brillo (izq–der) y la **octava** (arriba más aguda, abajo más grave); se graba lo que sonó. |
| Sincronía | **«Melodía en el compás»** (opción, encendida): la espiral lee el reloj del motor (sin tocarlo), empieza en una línea de compás y programa cada nota en su paso (**0,00 ms de desvío** medido en Chrome); lo grabado lleva la fase del compás. |
| Fases 3 y 4 | **Ritmo**: la voz (siempre escuchando) o **tres pastillas** (bum, pff, ts) que suenan al instante y entran en el loop; ↶ ↷; **guardado automático** como «Mi canción»; **🎬 Mi reel**. |
| Ajuste | **La voz va primero** (guía: estilo → «Haz bum · pff · ts» → dedo → guardar; la espiral aparece cuando hay ritmo). **Mi reel**: vídeo vertical con el círculo, golpes, aguja y **estilo y BPM arriba**. |
| Idea del reel «Anatomía» | **La forma de tu ritmo** (líneas finas unen los golpes de cada instrumento: portada, Previsualizar y vídeo) y **rótulos de capa** numerados en Previsualizar («1 · Bombo: el pulso»), con frases de los 5 estilos y generadas de los datos (patrón y ghost notes), también en el vídeo. |

## ⚠ Decisiones a revisar
- **«Melodía en el compás» está encendida por defecto.** Si algo suena mal, apágala en «⋯» (portada) o en ajustes del Estudio.
- **Mientras tocas en vivo y ya hay una melodía grabada, suenan las dos** (la grabada es tu vuelta anterior): se superponen. Si molesta, se silencia la grabada mientras tocas.
- **La portada pide menos de 2 acciones sueltas**, pero hoy se ven: estilos, ⋯, 3 pastillas, ↶, ↻ Otra, ▶/■ y 🎬 Mi reel. Se puede quitar alguna.
- El círculo sale algo **pequeño** en el vídeo vertical (encuadre más cerrado: pendiente). **Previsualizar no está en la portada** (el piloto toca las bolas y las tiras que la portada esconde): hoy está en el Estudio.
- `tests/browser/grabar-cancion.mjs` ya fallaba antes de esta tanda (el tutorial del primer minuto esconde el botón «grabar canción»); no es de la portada.

## 🎧 Prueba de oído de la sincronía (la importante)
1. Abre la app (⋯ → «Melodía en el compás» **encendida**), elige **Hip hop** o **Techno** y espera a que suene la base.
2. «Haz bum · pff · ts» (voz o pastillas) hasta que haya un ritmo.
3. **Pon el dedo en el agua y muévelo.** Cuando empiece el tema (hasta unos 2 s después, siempre **en un tiempo 1 del compás**), escucha: **¿las notas caen justo en el pulso de la batería, o van un poquito antes o después?** Hazlo con 3 estilos (dnb es el más exigente).
4. Deja el dedo hasta la 2.ª vuelta y **levanta**: la melodía grabada sigue sonando. **¿Cae en el mismo sitio que cuando la tocabas?** (la fase del compás).
5. **Apaga «Melodía en el compás»** y repite el 3: ¿se nota la diferencia? Si el encendido va **desfasado** (aunque sea poco), dime por cuánto aproximadamente y de qué lado (adelantada o atrasada): se corrige con la latencia de salida.

## Qué probar en el móvil, en orden
1. **Primer minuto** (borra los datos del sitio): `Empezar` → tarjetas → ¿suena la base al instante? ¿«Haz bum · pff · ts» se entiende? ¿Tus golpes aparecen **al instante** en el círculo, con **las figuras** unidas por líneas finas?
2. **Pastillas** sin micro (y con micro): ¿suenan al instante, entran en el compás?
3. **Espiral** (la sincronía de arriba) y la **octava** (arriba/abajo del dedo).
4. **↶ ↷:** ¿deshacen una frase entera de voz o una melodía? Cierra y abre: «Mi canción» está en «Mis canciones».
5. **🎬 Mi reel:** ¿sale como un reel (círculo, figuras, estilo y BPM arriba)? ¿Se comparte bien en el iPhone? Y en el Estudio, «👁 Previsualizar» → grabar vídeo «La previsualización»: ¿aparecen los rótulos de capa («1 · Bombo: …»)?
6. **Estudio ↔ portada:** ¿vuelves sin perder nada? Elige el Estudio, cierra y abre: ¿entra directo?
7. Lo de las tandas anteriores (ver cada una).

---

# Undécima tanda (2026-11-16) — la portada, corregida tras tu vídeo del iPhone (spec 016 §16)

Tests (1111), typecheck y build en verde; comprobado en Chrome (`tests/browser/portada-melodia.mjs`, `portada-guia.mjs`, `portada.mjs`). **Nada oído en un móvil.**

| Lo que viste | Qué hice |
|---|---|
| La espiral no se entendía y el contador no avanzaba | **Fuera de la portada** (queda en el Estudio). Ahora la melodía es **«Magic Piano»**: **cada toque en el círculo toca la siguiente nota** y tú marcas el ritmo; el contador («Sinfonía n.º 40 · 8/20») **avanza con cada toque**. Cuantizado suave al compás; tras 1,2 s sin tocar, pasa al loop. |
| Mozart no pega en hip hop | **Cada estilo con sus melodías**: hip hop → Himno, Fray Santiago, Estrellita, Para Elisa; techno → Sinfonía n.º 40 y Dies irae; dnb → Dies irae; dembow y house → las suaves. Si un estilo no tuviera ninguna, no se ofrece. «↻» cambia entre las de ese estilo. |
| El ■ no paraba todo | **■ = parar todo al instante** (reloj, ritmo, melodía y colas) y **▶** lo vuelve a abrir. |
| Falta un «borrar» | **«Borrar»** (con confirmación, recuperable con ↶): empieza de cero; el estilo se queda. |
| Demasiadas cosas | La portada enseña **el círculo, tus golpes y la aguja**: sin franjas ni anillos, sin bolas, sin guías; **figuras suaves** (curvas) en vez de polígonos. Abajo: ↶, Borrar, ■, 🎬 Mi reel. |

## Decisiones a revisar
- El sonido de los toques es el sinte del estilo (onda `triangle`/`square`/`sawtooth`/`sine`), **no** el de Strudel; si no te gusta, se cambia por el mismo de la melodía.
- La melodía por toques **tarda 1,2 s en pasar al loop** (para no reescribirlo a cada toque); mientras, solo suena lo que tocas.
- «Mi reel» graba el aro mínimo: **sale muy limpio**; si quieres más cosas en el vídeo (bolas, ondas), se puede.

## Qué probar en el iPhone, en orden
1. Elige estilo → ritmo con la voz/pastillas → ¿se ve **solo el círculo, tus golpes y las figuras** (sin anillos)?
2. **Toca el círculo**: ¿cada toque es una nota, y el contador avanza? ¿Marcas tú el ritmo? ¿Cae bien en el compás (cuantizado suave)? ¿Se oye tu melodía repetirse al dejar de tocar?
3. «↻»: ¿las melodías del estilo pegan? Prueba los 5 estilos.
4. **■** con todo sonando: ¿para **todo** de golpe, sin colas raras? **▶**: ¿vuelve bien?
5. **Borrar** (y ↶ para recuperar).
6. **🎬 Mi reel**: ¿limpio, con las figuras, estilo y BPM?

## Undécima tanda, parte 2: 🎤 Voz (spec 016 §17)
La portada **no escucha hasta que pulsas «🎤 Voz»**, aunque ya tenga el permiso: con la voz apagada el micro sigue abierto pero la app lo ignora (no detecta golpes, no graba ni guarda nada). Así **no vuelve a pedir permiso** al encender/apagar. Tras 2,5 min apagada, o al pasar la web a segundo plano, el micro se **cierra de verdad** (al encender de nuevo se reabre). En el Estudio sigue escuchando siempre. Comprobado en Chrome (`tests/browser/portada-voz.mjs`): apagada no entra nada, encendida sí, cerrar y reabrir funciona; **no probado en iPhone**.
- **Probar en el iPhone:** 1) abre y elige estilo: ¿el botón sale apagado y los golpes del ruido no entran? 2) Enciéndela y haz bum · pff · ts. 3) Apágala y enciéndela varias veces: **¿pregunta el permiso otra vez?** (no debería). 4) Apágala, bloquea la pantalla y vuelve: ¿se cierra el micro y al encender **pregunta de nuevo**? (puede). 5) Con la voz apagada, ¿el volumen es el mismo que con ella encendida? (iOS lo baja mientras el micro está abierto).


---

# Duodécima tanda (2026-11-16) — el Laboratorio como entrada (spec 017)

Cambio de rumbo: la app creció demasiado. **La portada (spec 016) queda pausada** y el **Laboratorio** es lo primero que se abre. Tests (1121), typecheck y build en verde; cada pantalla comprobada en Chrome con guion (`tests/browser/lab-*.mjs`, `redireccion.mjs`). **Nada oído ni probado en iPhone.**

## Cómo se entra
| Qué | Dónde |
|---|---|
| **Laboratorio** (la entrada) | `/` → te lleva a `/lab` |
| Capas · Piano mágico · Coro · Círculo de ritmo | menú de `/lab` (un toque abre la pantalla) |
| **Estudio** (la app de antes, congelada) | botón discreto «Estudio» al pie del menú de `/lab`, o `/estudio`. Un enlace compartido (`/#…`) abre el Estudio solo |
| Portada (pausada, solo para pruebas) | `/estudio?portada` |
| Estado anterior | etiqueta de git `estudio-v1` |

Lo guardado no se toca: la preferencia `coderbeats:ui:v1` se lee tal cual y **no se reescribe**; el arranque ya no depende de ella. En el Estudio «Modo simple» (ajustes) ahora te lleva al Laboratorio.

## Las pantallas (todas: fondo negro, aguja con estela, una onda en cada toque, estilo arriba, ▶/■ que para todo y una frase)
1. **Capas**: seis círculos en hexágono; empieza con bombo, caja y platillo; el primer toque pone la base. **Panel DJ** debajo: mantener y mover = filtro (izq-der) y eco (arriba); soltar con el filtro cerrado = drop; botones platillo y subida.
2. **Piano mágico**: cada toque = la siguiente nota de una melodía que encaja con el estilo (la biblioteca de siempre); «otra melodía ↻».
3. **Coro**: arrastras una voz y suenan otras dos a dos y cuatro grados por encima, siempre en la escala del estilo; el lado = brillo.
4. **Círculo de ritmo**: tocar un anillo pone/quita golpes (dentro bombo, medio caja, fuera platillo); cada uno forma su figura. **Ruedas** (botón): arrastrar alrededor de un anillo cambia cuántos golpes; «exacto» = reparto a partes iguales (3 contra 4).
5. **Mando** (opcional): Capas = A B X Y, LB, RB; Piano = cualquier botón; Círculo = cruceta + A.

Se quitaron Theremín y DJ **como pantallas** (ahora el DJ está en Capas y el sintetizador de dedo es el Coro).

6. **Remixes** (spec 019; etiqueta `lab-v1` justo antes): eliges canción (Himno, Dies Irae, Wow, Sinfonía 40) y actúas sus 4 partes (Intro, Subida, Drop, Final) como botones grandes: entra en el siguiente compás y no avanza solo; dentro, ≤ 4 capas y el DJ. «● Grabar mi versión» (hasta 2 min; el final entra solo ≈ 8 s antes y acaba en el compás justo; «■ Terminar» antes), «▶ Mi versión», «🎬 Mi vídeo» (dura lo mismo), «escuchar el remix original» (la versión de ≈ 1 min del Laboratorio). **Mozart: notas «de oído», sin contrastar con la partitura** (spec 019 §6).
7. **Mis capas** (spec 018, parte 1–2): lo dibujado en el Círculo es «mi ritmo»; lo tocado en Piano/Coro, «mi melodía» (últimos 4 compases); aparecen en Capas como dos círculos más. **Pendiente de la 018:** «● Grabar», «✦ Hazme una canción», escuchar y vídeo en Capas (se pausó al llegar lo de Remixes).

8. **Estudio · Órgano de la melodía mejorado** (spec 020, fases 2–4; el editor aparte ♪ de los commits `821a52d`–`b928e61` se **retiró**: el editor es el Órgano de siempre, `MelodyOrgan.vue`, que se abre al tocar la franja de la melodía). Ahora: **casillas de corchea** (40 px; «fino» las vuelve semicorcheas), **● grabar** (la base sigue a su tempo y la frase se toca al doble de lento; 1 compás de cuenta; se cuadra a la casilla; acaba sola; lo de antes queda en ↶ deshacer) y **↻ responder** (la frase de 2 compases se copia a los 2 siguientes con una variación fija y cierra en la tónica; la lógica pura está en `lib/melodyGrid.ts`). **Faltan** de la 020: 1 (Abrir en el Estudio), 3b (batería de cada parte), 5 (una melodía por parte), 6 (esconder lo avanzado), 7 (duración a la vista).

9. **Remixes con N partes** (spec 019 §1b): las partes salen de **la canción** (`partsFromSong`): células parecidas seguidas se juntan, nombres claros, grupos en paralelo dentro de su parte, ≤ 4 capas, **máx. 8 partes**, botones en cuadrícula de 2 columnas. Los remixes principales tienen 7 partes (≈ 1 min 10 s). Ajuste de la 020: un remix, dos caras; el editor de melodía debe ser el **Órgano** (ver spec 020: el ♪ actual es provisional y se retirará).

## Motor y interfaz
`app/engine/index.ts` es la frontera (audio, estilos, kits, melodías, guardado/compartir, vídeo); `tests/unit/engineBoundary.test.ts` impide que el Laboratorio importe componentes del Estudio. **No moví archivos** (riesgo alto para poco beneficio): es una frontera por contrato.

## Principios (`specs/PRINCIPIOS.md`)
Escritos. En la spec 017 va cada uno. **Aviso de lo que no se cumple:** el principio 6 (compartir/guardar a mano) **no está en el Laboratorio todavía**; propongo enlace con el estado de la pantalla y vídeo por la frontera del motor como siguiente paso.

## Qué probar (en el móvil, en orden)
1. Abre coderbeats: ¿te lleva al Laboratorio y no suena nada? Entra en **Capas**: ¿el primer toque arranca el ritmo? ¿Las capas (bajo, acordes, melodía) encajan con cada uno de los 5 estilos?
2. **DJ**: mantén y mueve; suelta con el filtro cerrado (¿cae el drop en el compás siguiente?). «platillo» y «subida»: **no sé cómo suenan** (ruido sintético, sin probar).
3. **Piano mágico** en los 5 estilos: ¿las melodías pegan? ¿El toque cae en el compás (cuantizado suave)? Sin que se guarde nada.
4. **Coro**: ¿las tres voces suenan bien juntas en cada estilo? ¿El deslizar se oye bien (la nota cambia suave)?
5. **Círculo**: pon golpes; **ruedas** y «exacto»: ¿el 3 contra 4 se nota como polirritmo? (los golpes decimales se tocan con un pequeño desplazamiento).
6. ■ en cada pantalla: ¿para **todo** (incluida la voz del coro)?
7. «Estudio» (abajo del menú): ¿todo sigue igual? ¿«Mis canciones» conserva lo tuyo? Abre un enlace compartido antiguo: ¿va al Estudio?
8. Con un mando conectado (pulsa un botón para que el navegador lo vea): Capas, Piano y Círculo.

## Decisiones a revisar
- Los sonidos del Coro y del Piano son osciladores del motor (como el sinte de dedo), **no** Strudel/kits; si no gustan, se cambia por los sonidos de Strudel del estilo.
- El Laboratorio no guarda ni comparte aún (ver principio 6).
- Piano y Círculo usan el bajo del estilo como fondo; Coro solo el bombo y el bajo (pocas cosas a la vez).

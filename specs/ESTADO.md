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

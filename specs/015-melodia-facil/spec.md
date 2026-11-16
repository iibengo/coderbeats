# 015 · Melodía fácil: tocar el agua y la célula de melodía

> Estado: **idea apuntada para más adelante** (2026-11-15). No se programa nada hasta que se apruebe.
> Parte de: 002 (melodía y el órgano), 003 (el aro y el agua), 005 (células, grupos en paralelo y fundir §21), 011 (modos, Escenario), 012 (sugerencias), 013 (exportar vídeo).

## 1. El problema

Hoy **crear una melodía es difícil**: el órgano (piano) pide poner nota a nota, y la voz exige cantar afinado. Se quiere una forma **fácil, original y vistosa** de jugar con el tono, sin poner las notas a mano, que sirva para **cambiar la melodía y jugar** mientras las células suenan, y que dé un efecto «wow» (también en vídeo, spec 013).

## 2. La idea en dos tiempos

1. **Teclado de agua:** tocar el fondo (el agua) hace sonar notas, sin pantalla encima, integrado con las células como un fluido que las toca a todas.
2. **Célula de melodía:** un tipo de célula **distinto**, un generador donde se juega con una **figura viva** (una forma 3D que se mueve con el dedo y cambia) y de ella sale una melodía. Esa melodía **se adjunta a una célula reproductora**.

## 3. Teclado de agua (fase 1)

### 3.1 Cómo se toca
- **Horizontal = nota**, de la **escala del estilo y, mejor, del acorde del compás** (nunca suena una nota mala, aunque se toque al azar); la nota fuerte, siempre del acorde.
- **Vertical = carácter** (filtro u octava): arriba más brillante o agudo, abajo más grave y cálido.
- **Tiempo pegado a la rejilla** (como «cuantizar»): lo tocado cae en el ritmo. Sonar al instante al tocar; cuantizar al grabar.
- **Se graba en capas:** se toca 2 o 4 compases y pasa a ser un **loop de melodía normal** (loop `'mel'`, ya existe); tocar otra vez suma o sustituye. Reutiliza lo hecho para grabar efectos del Escenario (`fxToLoops`) y la escala (`suggestMelody`, `STYLE_MUSIC.scale/chordTones`).
- Apagable y con «↶ deshacer».

### 3.2 Por qué no el Escenario
El Escenario (011 §13.1) **pone una pantalla encima** y corta el flujo. Aquí se quiere **integrado con las células**, alrededor, como un fluido (la imagen: la sangre) que toca todas.

### 3.3 Dónde se toca: el problema del espacio
En **Jugar** la gota ocupa casi todo el ancho en vertical; el agua libre es poca (los lados) y por debajo van las bolas, las acciones y Play, por arriba los selectores. Además, fuera de la gota hoy los gestos son: filtro y espacio (ratón) y el pellizco con dos dedos. **Hay que medir** cuántos píxeles libres quedan en vertical, horizontal y en el móvil más pequeño **antes de decidir**. Opciones, de menos a más cambio:
1. **Una franja dedicada** (p. ej. el tercio de abajo en vertical) que se ve algo distinta. Lo más seguro y medible; cuesta espacio vertical.
2. **Todo el fondo, con prioridad:** manda el aro, luego los botones (con **zona muerta** como en el Escenario, 14 px), y lo demás es teclado; **un solo dedo**, para no chocar con el pellizco ni el filtro. Aprovecha todo, más riesgo de toques sin querer.
3. **Un gesto que abre el espacio:** al empezar a arrastrar fuera del aro la gota **se encoge y se aparta** suavemente, y vuelve al soltar. El más vistoso.
- **Propuesta inicial:** la opción 2; si en el móvil se queda corta, la 3.
- **En Componer** tocar el agua **crea una célula**: choca. O un modo corto («mantener ~1 s y arrastrar» toca en vez de crear), o solo en Jugar al principio.

### 3.4 El fluido
- **Venas, no ondas redondas:** cada nota lanza una corriente de partículas que viaja por los **hilos que unen las células, en orden, iluminando cada una al pasar**: se ve que la melodía conecta toda la canción.
- El dedo deja una **estela que deforma la superficie**; las ondas rebotan en las células.
- **El color sale de la nota** (la paleta única: rosa, lila, azul). Con la melodía grabada, el flujo **se repite solo** por las mismas venas.
- Variante por estilo: agua (dembow), **humo** (techno: la estela se estira y se disipa).
- **Coste:** partículas y deformación gastan GPU; el vigilante de frames (`frameGovernor`) baja el detalle, pero **hay que medir en el móvil**. Con movimiento reducido, solo un cambio suave de brillo.

## 4. Célula de melodía (fase 2)

### 4.1 Dos tipos de célula
- **Célula reproductora** (las de hoy): ritmo, bajo, acordes, capas. **Ejecuta** la canción (aunque también se puede crear en ella).
- **Célula de melodía** (nueva): un **generador**. Se entra en ella y **toda la gota es el instrumento** (se resuelve el espacio de §3.3). Aspecto propio: blanca (el color de la melodía) y borde ondulante.
- **Sin modelo nuevo al principio:** una célula que solo lleva melodía y suena en paralelo **ya existe** (las células libres de los grupos en paralelo, 005 §16; así está hecho el tema del remix de Mozart). Es otra forma de **crearla y entrar en ella**; el tipo propio puede ser solo un aspecto y un atajo («+ melodía» crea la célula y entra a tocar).
- Una melodía por célula (la monofonía de la 002 se mantiene).
- El **piano (órgano) se queda** para quien quiera precisión; esto es la vía fácil.

### 4.2 La figura que genera la melodía (lo original)
Una **forma viva** que se mueve con el dedo y de la que sale la melodía. Dos caminos:
1. **Curva de Lissajous en 3D** (propuesta inicial): una curva cerrada que gira; un punto la recorre (el cabezal) y **su altura es la nota**, pegada a la escala. Cambiar las proporciones (frecuencias) **cambia la figura y, con ella, la melodía**. Mover un punto de control cambia el contorno; la velocidad del giro, el ritmo; el volumen del giro, la densidad de notas. Al soltar, **se congela** y queda como loop de 2 o 4 compases, con notas del acorde en los tiempos fuertes. Matemática pura, vistosa, predecible.
2. **Gota o esfera deformable:** cada parte de la superficie es una nota y al girarla suena un recorrido. Más táctil, menos controlable.
- **Efectos visuales bonitos** (brillos, estela, color por nota) y que la figura **cambie** mientras se genera.
- **Coste:** 3D en el móvil gasta GPU. Empezar en **2D con profundidad simulada** (sombreado y perspectiva) y pasar a 3D real si va bien.
- A decidir: gestos (arrastrar, girar con dos dedos, mantener para congelar).

### 4.3 Adjuntar la melodía a una reproductora
- **Fundir (ya existe, 005 §21):** arrastrar la célula de melodía sobre la reproductora y mantener → su melodía pasa a ser el loop de melodía de esa célula (regla de la monofonía: gana la que ya estaba, se avisa de lo perdido).
- **Enlace vivo (más adelante):** la melodía queda como **satélite unido por un hilo**; si cambia la figura, cambia la melodía de la otra célula **en directo**. Más bonito, más coste.

## 5. Fases

0. **Medir el espacio libre** en Jugar (vertical, horizontal, móvil pequeño) y decidir §3.3.
1. **Teclado de agua** dentro de una célula normal (escala y acorde, cuantizado al grabar, loop `'mel'`, deshacer), con ondas de color simples.
2. **El fluido:** venas por los hilos, estela y rebotes; humo por estilo; vigilante de frames.
3. **Célula de melodía** con la **curva de Lissajous** (2D con profundidad), congelar a loop.
4. **Adjuntar por fundir** (reutiliza `mergeCells`).
5. Más adelante: gota deformable, 3D real, **enlace vivo**, y grabarlo en **vídeo** (013).

## 6. Riesgos

| Riesgo | Mitigación |
|---|---|
| **Falta de espacio** en Jugar | Fase 0 (medir); opciones 1–3 de §3.3; célula de melodía con la gota entera |
| **Choque de gestos** (pellizco, filtro/espacio, crear célula en Componer) | Un dedo, zona muerta, modo corto en Componer |
| **Latencia al tocar** | Sonar al instante (como el Escenario) y cuantizar solo al grabar |
| **GPU en el móvil** (fluido, figura 3D) | `frameGovernor`, 2D primero, movimiento reducido, medir |
| **Que no suene bien** | Escala + acorde, nota fuerte del acorde en los tiempos fuertes; se afina de oído |
| **Fuga al micro** | Registrar los golpes en el `EchoGate` (`output`), como el Escenario |
| **Datos guardados** | Sin modelo nuevo al principio: es un loop `'mel'` en una célula libre |

## 7. Cómo se probaría
Funciones puras con tests: `waterToNote(x, y, escala, acorde)`, cuantizado y conversión de lo tocado a loop `'mel'`, y la curva de Lissajous → notas (determinista, con semilla); código Strudel evaluado en Node; en navegador, el guion de `tests/browser/`; y **de dedo y de oído en el móvil**.

## 8. Preguntas abiertas
1. ¿Zona libre (opción 2) o gesto que abre el espacio (opción 3) en Jugar? (medir antes).
2. ¿En Componer, modo corto o solo en Jugar al principio?
3. ¿La célula de melodía es un **tipo con aspecto propio** o solo un atajo sobre las células libres?
4. ¿Curva de Lissajous o gota deformable para empezar? (propuesta: la curva).
5. ¿Adjuntar solo por fundir al principio, y el enlace vivo después?

## 9. Implementado (2026-11-16): fases 0 y 1 mínimas

`lib/waterKeys.ts` (puro, con tests: `scaleNotes`, `noteAtX`, `nearestChordTone`, `brightnessAtY`, `keysToHits`, `freeWater`) y el botón **«🎹 Agua»** en las acciones de Jugar (con la música sonando) + **«● Grabar»** (`engine.keysPlay`, `toggleKeysRec`). Con «Agua» encendido, **un dedo fuera del aro** toca notas de la **escala del estilo** (horizontal = nota de izquierda a derecha, en los tiempos fuertes pegada al acorde del compás; vertical = brillo del filtro, 700–9000 Hz); suena **al instante** por `superdough` (sinte según el estilo), se registra como salida para el micro (`EchoGate`) y, arrastrando, solo suena al cambiar de nota (≤ ~8/s). «Grabar» apunta lo tocado y al terminar lo pasa a **un loop de melodía de 4 compases** cuantizado a la semicorchea (monofónico; **sustituye al loop de melodía que hubiera**, dejando la versión previa hasta la siguiente línea de compás). Comprobado en Chrome (`tests/browser/agua.mjs`: 6 toques → 6 notas, escala correcta).
**Decisiones a revisar:** (a) **fase 0 solo en función pura** (`freeWater`, con casos de móvil vertical, pequeño y horizontal): no se midió en pantallas reales; en un móvil pequeño casi no queda agua libre fuera del aro (ahí habría que pasar a la opción 3 o a la célula de melodía); (b) se eligió la **opción 2** (todo el fondo fuera del aro, un dedo) **sin zona muerta alrededor de los botones** todavía (los botones paran los toques por sí mismos); (c) solo en **Jugar** (en Componer sigue creando células); (d) el estado «Agua» no se guarda; (e) sin ondas de color ni fluido (fase 2), sin célula de melodía ni figura (fase 3); (f) sin oír (afinar timbre, volumen y duración de la nota de vista previa).

## 10. Implementado (2026-11-16): «Agua» legible (fase 2, parte 1)
Probado en el móvil: «Agua» sonaba pero no se entendía (todo negro). Ahora, con el modo encendido (`WaterKeysOverlay.vue`, sin recoger toques): **franjas suaves por nota** (una por nota de la escala, graves **abajo**, color rosa/lila/azul por altura); **al tocar**, una **onda de color en el punto exacto** (mayor cuanto más grave la nota) y la franja se ilumina; **rótulo** «🎹 Agua · toca el fondo» y, al grabar, «● Grabando · compás n/4 · N notas»; y **lo grabado aparece ya en la franja de melodía del aro** (loop provisional con id −2, que no se puede coger). Movimiento reducido: solo un cambio de brillo.
**Decisión:** para que lo que se ve coincida con lo que suena, **la altura del dedo es ahora la nota** (abajo graves, arriba agudas) y la posición horizontal el brillo del filtro (izquierda cálido, derecha brillante); antes era al revés (`noteAtY`, `brightnessAtX`, `bandAtY`, `pitchColor`, con tests). Comprobado en Chrome (`tests/browser/agua-visual.mjs`); sin ver en móvil real.
**Zona muerta (hecho):** con «Agua» encendido, los toques a menos de 14 px de un botón (`inDeadZone`, de `stageFx.ts`) no tocan el agua. El estado «Agua» **no se guarda** a propósito (depende de que suene la música). Fase 2 pendiente: estela larga del dedo y «venas» por los hilos (sin poder medir rendimiento en móvil).

## 11. Implementado (2026-11-16): fase 2, el fluido (estela y venas)
`lib/flow.ts` (puro, con tests) y `FlowLayer.vue` (canvas propio, sin recoger toques, solo dibuja si hay algo): **estela del dedo** en Jugar (lila, ≤28 puntos, 0,55 s, un dedo quieto no la llena) y **venas** en Componer (≤48 puntitos rosa que corren por los hilos entre células, 3 por hilo). **Rendimiento:** el vigilante de frames (`frameGovernor`) tiene un escalón nuevo, `flow`, que es **lo primero que se apaga y lo último que vuelve**; con movimiento reducido no se dibuja; y hay un interruptor **«Agua viva»** en ⋯ → ajustes (encendido por defecto, se guarda) para comparar en el móvil. Comprobado en Chrome (`tests/browser/flujo.mjs`: estela con el dedo y nada al soltar; venas en el remix de Beethoven; nada con el interruptor apagado). **Sin medir en móvil real**; coste a vigilar: un canvas extra a pantalla completa (a 1,5× de resolución como mucho).

## 12. Célula de melodía: el sintetizador de dedo (2026-11-16, escrito antes de programar)

**Por qué:** «🎹 Agua» es un teclado escondido en el fondo y no se sabe qué pulsar. La idea buena es otra: **una célula de melodía propia**, y al entrar en ella la pantalla entera es **un instrumento**. «🎹 Agua» se queda tal cual para comparar.

### 12.1 Qué es
- **Célula de melodía** (`Cell.kind = 'melodia'`, campo opcional: lo guardado de antes no cambia y se lee igual). Es una **célula libre** (grupo en paralelo, 005 §16) que solo lleva un loop de melodía; **«+ melodía»** (⋯) la crea y **entra** en ella.
- **Se distingue** de las de batería: en el mapa, su silueta lleva dentro una **curva de Lissajous** blanca (el color de la melodía) en vez de franjas y golpes; la curva sale de **la propia melodía** (§12.4), así que cambia al grabar.
- Entrar en ella (tocarla en el mapa, o crearla) abre el **sintetizador**; «✕» lo cierra y deja ver la célula (para reabrirlo: botón «🎛» en las acciones mientras se mira una célula de melodía).

### 12.2 El sintetizador (como un theremín)
- **Mantener y deslizar suena continuo**: un oscilador propio (no un golpe por nota) que **se desliza** entre notas. **Arriba/abajo = nota**, siempre **dentro de la escala del estilo** (la misma `scaleNotes` de §3; abajo grave, arriba agudo; cada nota ocupa una franja del mismo alto, con una **histéresis** del 20 % para que no tiemble en el borde). **A los lados = filtro** (el «wowo»: izquierda cálido, derecha brillante, `brightnessAtX`).
- Al soltar, la nota se apaga con una cola corta. **No toca el reloj del motor** (un oscilador por Web Audio, sin pasar por Strudel): suena al instante aunque la música no suene.
- Las salidas se registran para el micro (EchoGate) como en el agua.

### 12.3 La curva de luz y la guía
- **El dedo deja una curva de luz** (estela larga, ~1,4 s, 64 puntos máx., color por altura de la nota: rosa/lila/azul) que dibuja lo tocado; con movimiento reducido, solo el punto.
- **Las notas de la escala, marcadas muy suaves**: una línea fina por nota con su nombre al borde; la nota que suena se enciende.
- **Guía mínima**: «Desliza el dedo» hasta el primer toque (una vez por sesión). Nada más.

### 12.4 Grabar
- **«● Grabar»** apunta las notas (cada cambio de nota es un evento) y, al **«■»**, pasa a la célula como el loop de melodía (4 compases, **cuantizado** a semicorcheas por `keysToHits`, monofónico; sustituye al anterior con «deshacer»). Se ve en la **franja de melodía** del aro y en la curva de Lissajous del mapa.
- Mientras graba, el rótulo cuenta el compás (n/4) y las notas, como en el agua.
- **La curva** (`lissajousOf(hits)`): `x = sin(a·t + φ)`, `y = sin(b·t)`; `a` = notas distintas (1–5), `b` = 2 + (notas mod 4), `φ` según la primera nota. Determinista; sin melodía, una curva por defecto (3:2).

### 12.5 Qué no hace (todavía)
- Sin 3D ni giro con dos dedos; sin enlace vivo con la reproductora; **adjuntar a otra célula = fundir** (005 §21), ya existente. El glide y el sonido **no se han oído** (sin probar de oído).
- El oscilador usa la onda del sinte del estilo (`lead`→cuadrada, `piano`→triangular, `pad`→sierra, `drone`→seno) con un filtro paso bajo; no es el sinte de Strudel, así que **al grabar y reproducir suena distinto** que mientras tocas (anotado para decidirlo de oído).

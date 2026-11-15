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

# 008 · Remixes

> Estado: **en marcha** (2026-11-14). Dos remixes: "Himno de la alegría" en dembow y "Dies Irae" en techno (con el wowo).
> Parte de: spec 005 (células y su demo del dembow, §20), 002 (melodía como loop) y 006 (Mis canciones).

## 1. Idea

Una categoría nueva, **Remixes**, junto a los estilos y a Mis canciones: **canciones de demo que mezclan un estilo con una melodía conocida**. Se abren como cualquier canción (varias células, con su código Strudel y editables) y sirven para oír lo que da de sí un estilo y para empezar a jugar desde algo que ya suena.

## 2. Regla: solo dominio público

- Solo melodías **de dominio público** (obras cuyo autor murió hace más de 70 años y de las que no se reproduce ninguna grabación ni edición protegida). **Aquí no hay ningún audio de terceros**: la melodía se escribe como notas y la tocan los sintes de la app; el **arreglo** (ritmo, bajo, acordes, estructura) es original de coderbeats.
- Cada remix lleva su **atribución** (compositor y años) a la vista en la lista.
- Antes de añadir uno, se comprueba que la obra y su melodía son de dominio público (compositor, fecha de muerte). Lista de candidatos posibles más adelante (no están hechos): la *Oda a la alegría* de Beethoven (1770–1827), el *Canon en re* de Pachelbel (1653–1706), *Für Elise* de Beethoven, *Greensleeves* (tradicional) o *La cucaracha*.

## 3. Cómo se ve y cómo se abre

- Un **botón "Remixes"** en la pantalla principal, junto al de Mis canciones (debajo, a la izquierda; en horizontal, a su lado), que abre una hoja como la de Mis canciones.
- La hoja lista los remixes con: título, **compositor y años**, estilo y tonalidad, cuántas células dura (en compases) y una línea por célula con lo que añade.
- **Abrir un remix** reemplaza la canción de ahora (como abrir una guardada, spec 006 §4.3): avisa si lo de ahora no está guardado, elige el **estilo** y el **kit** del remix y deja la primera célula a la vista. Si sonaba, arranca de nuevo desde ahí. **No** se marca como "viene de una guardada": al guardar es una canción nueva.
- Lo que se abre es una canción normal: se puede editar, copiar, fundir (005 §21) y guardar en Mis canciones.

## 4. Primer remix: "Himno de la alegría" en dembow

**La melodía.** El tema principal de la *Oda a la alegría* (final de la Novena sinfonía, Ludwig van Beethoven, 1824), en **re mayor** (F♯ y C♯): 16 compases en cuatro frases, de las que se usan dos de cuatro compases (cada frase cabe en un loop de melodía de 4 compases, spec 002):

- **Frase A (abierta):** `F♯ F♯ G A | A G F♯ E | D D E F♯ | F♯. E E` (en negras; la última es una negra con puntillo, una corchea y una blanca).
- **Frase A′ (cerrada):** las mismas tres primeras compases y `E. D D` al final.

**La tonalidad.** **Re mayor** tiene las mismas notas que **si menor** (la escala del dembow, spec 005 §20): el estilo no cambia (120 bpm, kit 808, acordes Bm–G y bajo b1/g1) y la ayuda de la melodía sigue yendo a la misma escala.

**La estructura (revisada, 2026-11-14).** La melodía no cabe en un loop (4 compases) y, repetida dentro de la célula, siempre suena el mismo trozo. Por eso el **Himno va en un grupo en paralelo de 5 células de 4 compases** (spec 005 §22: 20 compases = Dembow 8 + Subida 4 + Subidón 8), que **se enciende solo con la célula "Dembow" y se apaga con "Final"** mientras la batería cambia de célula:

| Célula del grupo | Suena en | Frase |
|---|---|---|
| Himno A | Dembow (12–15) | A, clara (lead) |
| Himno A′ | Dembow (16–19) | A′ |
| Puente B | Subida (20–23) | B, con el filtro que se abre (600 → 6 000 Hz) |
| Himno A↑ | Subidón (24–27) | A, una octava más aguda |
| Himno A′↑ | Subidón (28–31) | A′, una octava más aguda |

Las células 2 y 3 (Despierta, Entra el ritmo) conservan su **loop suave** de A (pad). **Frase B (el puente):** `E E F♯ D | E F♯G F♯ D | E F♯G F♯ E | D E A(grave)`.

**Las siete células de la canción** (la melodía de Dembow, Subida y Subidón viene del grupo):

| # | Célula | Vueltas | Qué suena |
|---|---|---|---|
| 1 | **Intro** | 4 | Solo los **acordes**, suaves (el filtro apenas se abre: 800 → 1 200 Hz) |
| 2 | **Despierta** | 4 | + **platillo** (en corcheas) + la **melodía** (frase A) **suave y lejana** (sinte pad, con su reverb) |
| 3 | **Entra el ritmo** | 4 | + **bombo** (0 4 8 12) |
| 4 | **Dembow** | 8 | + **caja dembow** (3 6 11 14), platillo en semicorcheas; **enciende el grupo del Himno** (A, A′) |
| 5 | **Subida** | 4 | **Sin bombo**; la **caja se acelera** (negras, corcheas y semicorcheas a lo largo de los 4 compases); el **filtro se abre** (600 → 6 000 Hz); suena el **puente (B)** |
| 6 | **Subidón** | 8 | **Todo**: acordes, **bajo**, bombo, caja dembow y platillo; el Himno **una octava más aguda** (A↑, A′↑) |
| 7 | **Final** | 2 | Solo los **acordes**, que **se apagan** (el filtro se cierra: 1 500 → 350 Hz); **apaga el grupo** |

Total: **34 compases** (unos 68 s a 120 bpm); en la colonia, 12 células (7 de la canción y 5 del grupo).

### 4.1 Qué se aproxima

1. **"Suave y lejana"** (células 1 y 2) se aproxima con **filtro y sinte**: los acordes con el filtro cerrado y la melodía con el sinte *pad* (ataque lento, reverb grande). La app no tiene volumen ni reverb **por loop**: la mezcla es automática (spec 005 §20.4).
2. **Cada frase de 4 compases es un loop de melodía** (el máximo del modelo) y las frases van **en células de un grupo en paralelo** que avanza solo (spec 005 §22): así el tema suena en orden y no se repite el mismo trozo. Loops de 8 compases: más adelante.
3. **El filtro que se abre y se apaga** es un **filtro paso bajo por vuelta** (`Cell.lpf`, §5): sube o baja a saltos, **una vez por compás**, no de forma continua.
4. **La caja que se acelera** es un loop de **4 compases** con más golpes en cada uno (no un redoble continuo): compás 1 a negras (0 4 8 12), compás 2 a corcheas, compases 3 y 4 a semicorcheas.
5. **La melodía una octava más aguda** va escrita 12 semitonos arriba (re mayor se queda en el registro del lead, hasta la A5).
6. **Se conservan** el sidechain del bombo, las ganancias y el resto de lo que se dice en la spec 005 §20.4.

## 5. Cambio de modelo: el filtro por vuelta (`Cell.lpf`)

Nada de lo que ya existe permite que **el filtro se abra durante una célula** (el filtro de la pantalla es uno solo para toda la canción, y el barrido de 005 §4.3 es de unos tiempos al final de cada célula). Se añade a la célula un campo opcional:

```ts
interface Cell {
  // … como hoy
  /** filtro paso bajo (Hz) de cada vuelta de la célula; si hay menos valores que vueltas, vale el último */
  lpf?: number[]
}
```

- **En el código:** `.lpf("<v1 v2 v3 …>")` después del `stack` de la célula, con un valor por vuelta. Es Strudel normal: **vale en strudel.cc**. En el código mostrado (`arrange`) cada sección empieza en su ciclo 0, así que va tal cual; en el **motor**, que trabaja con compases globales, el patrón va **rotado** al compás en el que empieza la célula para que la vuelta 1 de la célula use el primer valor (spec 005, §4.2).
- Es un filtro de la célula, **independiente** del filtro de la pantalla (DJ, `djf`): los dos suenan a la vez. Sustituye al `lpf` propio de los acordes mientras dura. **El bajo va por fuera** (enmienda 2026-11-14, §10): el filtro de la célula no lo toca.
- **Validación estricta** (`isCell`): una lista de 1 a 32 números finitos entre 60 y 20 000. Se escribe en el código con redondeo a entero; nada leído se escribe tal cual.
- Copiar y fundir células lo conservan en la copia (la fusión, el de la célula destino).
- No hay interfaz para editarlo todavía.

## 6. Datos y código

- `lib/remixes.ts`: la lista de remixes (`REMIXES`) y, de cada uno, su estilo, su kit, su compositor, sus células y una función que construye la `Song`. Las melodías están como notas (`[paso, duración, MIDI]`) con sus frases reutilizables.
- Los remixes **no se guardan** en el almacenamiento: son código; lo que se guarda es lo que el usuario guarda desde ellos.
- Los loops llevan `synth` propio (pad para la melodía lejana, lead para la clara), como el `drone` del dembow (005 §20).

## 7. Cómo se comprueba

- **Tests de datos** (`tests/unit/remixes.test.ts`): la lista y su atribución; las siete células con sus vueltas, loops y partes; las notas de cada frase (secuencia, duraciones que suman 4 compases, todas en la escala de si menor / re mayor, y la octava más aguda a +12); `isSong` y la ida y vuelta por JSON.
- **El código que sale se evalúa en Strudel** (el mismo intérprete de Node de la demo del dembow, 005 §20.3): 34 ciclos; en cada sección, qué suena y qué no (la Intro y el Final solo con acordes; la caja acelerada de la Subida con 4, 8, 16 y 16 golpes por compás y **sin bombo**; el bajo solo en el Subidón; la melodía clara frente a la octava más aguda) y el `lpf` de cada vuelta.
- **Filtro por vuelta:** validación (rechaza valores raros), rotación del patrón en el motor y que el código mostrado sigue siendo Strudel válido.
- **El wowo** (`tests/unit/wowo.test.ts`): el preludio (`wowPlan`) no engancha nada sin el motor y le pasa los compases en los que cambia el filtro de cada célula cuando se lo pide; el código del motor del remix, con el preludio delante, evalúa sin error. El remix entero (`tests/unit/techno.test.ts`): 10 células y 54 compases, qué entra en cada una, el filtro subiendo en los builds, la melodía (notas y escala) y el código mostrado evaluado en Strudel (filtro por vuelta y resonancia de cada golpe, sin wowo en el drop).
- **Sin cambios de comportamiento:** el resto de la app tiene el código que tenía: sin wowo (`lpq`/`lpenv`) y sin compuertas; el remix del Himno, igual.
- **Interfaz:** la hoja lista el remix; abrirlo deja 7 células y cambia estilo y kit. **Probado en Chrome** sobre `dev/lab-estudio` (la pantalla principal sin el paso del micro): el botón, la hoja con la atribución, y abrir deja dembow, kit 808, 120 bpm, las 7 células y el código con el `lpf` de cada vuelta. El sonido real y la sensación en el móvil quedan por probar.

## 8. Decisiones a revisar

1. **Qué frase va dónde:** A suave en Despierta y Entra el ritmo; en el grupo, A y A′ (Dembow), B (Subida), A↑ y A′↑ (Subidón); las células se llaman «Himno A», «Himno A2», «Puente B», «Himno A agudo» y «Himno A2 agudo» (los nombres solo llevan letras y números), por pedido del autor.
2. **La melodía continúa en la célula 3** (Entra el ritmo, solo "+ bombo"): se interpretó como que lo anterior sigue.
3. **El platillo** va en corcheas en las células 2 y 3 y en semicorcheas desde la 4 (el patrón del dembow).
4. **El bajo solo en el Subidón**, como pedía la descripción.
5. **Dónde está el botón** (debajo del de Mis canciones) y su icono: a revisar al verlo en el móvil.
6. **Atribución visible** (compositor y años): en la hoja de la lista; no hay pantalla de créditos.
7. **El wowo, segundo remix (2026-11-14):** el estilo `techno` es nuevo (no reutiliza house cambiando bpm: su bajo y sus
   acordes son otros); el bajo y el wowo van en células distintas (las de `lpf` no llevan bajo, §5) y el drop es el
   contraste limpio; el wowo va en el motor por el bus de la célula, no en los haps; el laboratorio de oído
   (`/lab/wowo`) es solo de desarrollo. El sonido en la app entera (móvil y cromo) queda por probar en persona.

## 9. Segundo remix: "Dies Irae" en techno, y el wowo (`Cell.wow`)

**La idea.** Un techno que **entra poco a poco** y estalla en el drop, con el **"wowo"**: el filtro de una célula con
resonancia que **se abre en cada golpe** y vuelve al valor de la vuelta. Prueba de oído antes de nada: el código mostrado
pegado en strudel.cc suena con el wowo (aprobado por el autor, 2026-11-14).

**El estilo `techno`** (`styles.ts`, `constants.ts`, `demos.ts`): 128 bpm, do menor, kit 909. Bombo 4×4, palmada en 2 y
4, open hat a contratiempo; el **bajo a corcheas** (el pulso que no para, `c2` en todas); acordes `Cm–A♭–B♭–Gm` con
supersaw; escala de do menor (`C D E♭ F G A♭ B♭`), la misma para la ayuda de la melodía. Tiene su demo grabable (el
dibujo del techno) y su etiqueta en la barra de estilos.

**La melodía.** El **Dies Irae**, la secuencia gregoriana anónima del siglo XIII que se canta en la misa de difuntos
(dominio público; el arreglo es de coderbeats). Cuatro frases de 2 compases, con la **nota pedal repetida en negras**
(lo que le da el aire de martillo): `F F F F | D F F F` ×2, `A♭ G F E♭` (la figura que baja), y `B♭ D B♭ E♭`. En do
menor (las notas repetidas están a negras, así que la célula puede tener la misma nota de descanso).

**Las diez células** (desde §10 el bajo va por fuera del filtro; el Riser, de §11, va entre el Build y el drop):

| # | Célula | Vueltas | Qué suena |
|---|---|---|---|
| 1 | **Pulso** | 4 | Bombo 4×4 y el bajo a corcheas. Nada más. |
| 2 | **Hats** | 4 | + palmada y open hat a contratiempo |
| 3 | **Entra el tema** | 8 | Tema completo (A), **wowo acid** (`lpq 8`, `lpenv 3`) con el filtro 500 → 3 600 Hz, **con bajo** (fuera del filtro, §10) |
| 4 | **Build** | 8 | **Sin bombo**: la caja en roll, el platillo en semicorcheas, el **puente** (B) y el **wowo house** abriendo 1 400 → 8 000 Hz; el bajo sigue |
| 5 | **Riser** | 4 | El build de verdad (§11): ruido, pad y caja que se abren; el último compás, en silencio |
| 6 | **DROP** | 8 | **Todo**: bajo y acordes, bombo, palmada y platillo; el tema limpio (A), sin wowo |
| 7 | **Groove** | 4 | El groove en paralelo al tema (B), wowo house, con bajo (§10) |
| 8 | **Build 2** | 4 | El segundo build, más corto, con wowo acid y bajo |
| 9 | **DROP 2** | 8 | El drop final: todo, el tema (B) limpio |
| 10 | **Salida** | 2 | Solo los acordes, que se apagan (1 800 → 600 Hz) |

Total: **54 compases** (~1 min 41 s a 128 bpm).

**El wowo (`Cell.wow`, opcional)** — el único campo nuevo:

```ts
interface Cell {
  // … como hoy
  /** resonancia y envolvente sobre el filtro por vuelta: el filtro se abre en cada golpe */
  wow?: { depth: number; q: number; attack: number; decay: number }
}
```

- **Valores** (`lib/wow.ts`): `depth` 0,5–5 (`lpenv`), `q` 0–20 (`lpq`), `attack` 0,001–0,5 s (`lpa`), `decay` 0,01–2 s
  (`lpd`). Presets de oído copiados de las variantes de sonido ya afinadas (002 §17): `acid` (8 / 3 / 0,005 / 0,15), el
  del lead "c"), `breathe` (1,5 / 4 / 0,3 / 0,8), el del pad) y `house` (2,5 / 6 / 0,005 / 0,18), el del lead "b").
- **Validación:** los cuatro números, en rango (`isWow`). Al normalizar, un wowo inválido **se descarta** (el filtro se
  queda como estaba) en vez de tirar la canción: puede venir de una versión futura.
- **En el código mostrado:** va detrás del filtro de la célula, es Strudel puro y **vale en strudel.cc**:
  `).lpf("<500 700 …>").lpq(8).lpenv(3).lpa(0.005).lpd(0.15)],`. Sin `lpf` propio, se pone delante `.lpf(20000)` (el
  filtro abierto) para tener algo que abrir.
- **En el motor:** no puede ir en los haps de la célula (con `filterHaps` el hap nace sin color; y el `lpenv` en los
  haps probaría la envolvente en cada golpe, no en cada vuelta). Va **por compás**: los haps de una célula con wowo
  llevan `color("w<id>")` (`cellTail`) y el código del motor deja su plan (`wowPlan`, en un comentario: el motor no deja
  llamar a funciones que no son de Strudel) y, delante, el **preludio** `lib/wowPrelude.ts`:
  - el motor deja en `__cbWowo` su función de enganche al evaluar; `wowPlan` calcula los compases en los que cambia el
    filtro de cada célula (la primera vuelta y cada cambio del `lpf` entre vueltas) y se la pasa; **sin wowo, nada se
    engancha** (el código de siempre es igual);
  - la compuerta (`mountWowo`, `useAudioEngine`) va **en serie en el bus de la célula** (`getBus(id)`, por donde sale
    todo lo de esa célula, con el `lpf` de la vuelta ya aplicado): un `BiquadFilterNode` que en cada compás con cambio
    programa el `lpf` de la vuelta y la envolvente del wowo delante, y sigue hasta el siguiente cambio. El barrido en el
    tiempo va **en el audio** (el nodo), no en los haps. Se desmonta al parar y se vuelve a montar al evaluar.
  - **Límite:** como mucho 4 células con wowo (el color las elige por su orden en la lista de células).
  - **Copia en strudel.cc:** copiar el código mostrado lleva el wowo (es Strudel puro); el código del motor no se copia.

## 10. Enmienda (2026-11-14): el bajo fuera del filtro y el bombo afinado

**A. El filtro y el wowo solo afectan a la melodía.** Antes, en el código mostrado, el bajo, el bombo y la batería iban
dentro del `stack` que lleva el `lpf` de la célula y su wowo (y por eso las células con wowo no llevaban bajo). Ahora, en
una célula con **wowo**, el filtro por vuelta y el wowo envuelven **solo la melodía** (y los acordes de la célula): el
**bajo, el bombo, la caja y los platillos van por fuera, limpios**. Con `lpf` pero sin wowo, el filtro sigue como en §5
sobre todos los loops de la célula, pero **el bajo siempre va por fuera**.

- **Código mostrado** (`cellBody`, `song.ts`): `[8, stack( bajo, bombo, caja, hat, stack( melodía ).lpf("<…>").lpq(8)… )]`.
  Es Strudel puro y vale en strudel.cc.
- **Motor:** el bajo ya era el fondo (orbit 2), fuera del filtro; ahora el color `w<id>` y el filtro de la célula con wowo
  solo van en el `stack` interior de la melodía, así que el bus del wowo (spec 009) solo lleva melodía. El sidechain
  del bombo sigue empujando a la melodía (orbit 5).
- **Techno:** «Entra el tema» y «Groove» pasan a llevar bajo (`parts.bass`), y el bajo del Build 2 deja de pasar por el
  wowo. Salida (solo acordes con filtro) no cambia: los acordes siguen dentro del filtro.

**B. El bombo afinado por compás** (`StyleMusic.kickTune`, `styles.ts`): el estilo puede dar un patrón de notas, una por acorde
del fondo, que se pone al bombo con `.note(...)`. En superdough, `.note()` sobre un sample lo repite a esa altura (`c3`,
midi 36, es sin cambio), así que el bombo sube y baja como mucho 5 semitonos. Techno: `<c3 ab2 bb2 g2>`, las raíces de
`Cm–A♭–B♭–Gm`, un acorde por compás (el mismo ciclo que los acordes), para que el drop «caiga» sobre la armonía. Los
demás estilos no lo llevan: suenan igual que antes.

**C.** Hecha: ver §11.

**Se comprueba** en `tests/unit/techno.test.ts`: el bajo mantiene su `lpf(450)` en «Entra el tema» y el build; el bombo, la
caja y el platillo no tienen `cutoff` ni resonancia; el filtro y el color del wowo solo en el `stack` de la melodía (código
mostrado y del motor); el bombo con `.note` por compás (`c3 ab2 bb2 g2 c3…`). **Pendiente:** escucharlo en la app.

## 11. El Riser: un build de verdad antes del drop (2026-11-14)

Entre el Build (8 vueltas, con el wowo) y el DROP entra una célula nueva, **«Riser»** (4 vueltas = 4 compases), pensada
para crear tensión y dejar **el aire antes de que el drop caiga**:

- **Ruido que se abre.** Nuevo sinte `riser` (`melody.ts`): ruido rosa (`.s("pink")`), una nota por negra en los compases 1–3
  (la altura no cuenta; solo marca cuándo suena). El **filtro de la célula** (`Cell.lpf`, §5) lo abre compás a compás:
  `600 → 1 500 → 4 000 → 12 000 Hz`. Es un sinte más del modelo (`MELODY_SYNTHS`, ruta de validación y de
  vista previa), no un efecto aparte.
- **Otro color de pad.** Un loop de melodía con el sinte `pad` (supersaw) que sube `A♭3 → B♭3 → D4` (los compases 1–3,
  una nota por compás): la dominante que pide el Do menor, un color que no había en el resto de la canción.
- **La caja en roll** que se aprieta: corcheas, semicorcheas, semicorcheas… (compases 1–3).
- **El último compás, en silencio total** (el cuarto: sin ruido, pad, caja, bajo ni acordes). La célula no lleva bajo ni acordes
  (`parts` apagados) para que en ese compás no suene nada.
- **Sin wowo**: el motor admite 4 células con wowo (009 §4) y ya están todas en las demás células. El filtro del
  Riser sube a saltos por compás, y la caja pasa también por él (sin wowo, el filtro de la célula afecta a todo, §10).

La canción pasa a **10 células y 54 compases**. Los ids de las células a partir del drop se desplazan en uno (los que
entran en el `wowPlan` siguen siendo la 3 y la 4).

**Se comprueba** (`tests/unit/techno.test.ts`): la célula (vueltas, sin wowo, el filtro que sube, los dos sintes), que va
justo antes del drop, y el código evaluado en Strudel: ruido y pad con su filtro en los compases 24–26, la caja
8/16/16/0 golpes, **ningún evento** en el compás 27 y el bombo en el 28. **Pendiente:** escucharlo en la app.

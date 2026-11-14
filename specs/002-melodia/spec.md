# 002 · Melodía con la voz

> Estado: **aprobada con la revisión del 2026-11-14; fase 0 (laboratorio) en marcha**. Se programa por fases (§12).
> Parte de: spec 001 (coderbeats MVP, con sus enmiendas hasta §16.20). Hoja de ruta §14, punto 4 ("tararear el bajo, con ajuste a escala").
> Revisada el 2026-11-13 con la spec 003 (el aro, enmienda 1): **la melodía es un instrumento más**, sin botón ni modo aparte, y sus notas se ven en su franja del aro.
> **Revisada el 2026-11-14 contra el código** (specs 003 hasta E6, 005 con grupos en paralelo y 006, la biblioteca): ver la revisión al final (§15) con lo que cambió y por qué. Donde el texto de arriba y §15 choquen, **manda §15**.

## 1. Idea

Cantas o tarareas una melodía corta y se convierte en un **loop de sintetizador que parte de tu melodía pero suena bien**: afinado a la escala del estilo, cuantizado a la rejilla y limpio. **Se canta como se hace el beatbox**: con el loop sonando, sin botón ni modo aparte. Si eliges "Voz como: bajo" en ⋯, suena como bajo y sustituye al bajo del fondo.

## 2. Alcance

**Dentro**
- **La melodía como instrumento más**: el detector separa el canto ("na", "da", "mmm") del beatbox ("bum", "pff", "ts") y la melodía entra por las mismas frases que la batería.
- Una **calibración del "na" jugando** (el reto de §14: 5 notas, de grave a aguda) junto a las de bombo, caja y platillo. Hasta la fase 3 la melodía se decide solo con la puerta de tono (§4.3).
- Detección de **notas** (altura, inicio y duración) de una voz monofónica.
- **Ayuda** (activada por defecto): afinación a la escala del estilo, cuantización del ritmo y limpieza (notas muy cortas, errores de octava, deslizamientos). Sin ayuda, se respetan tus notas y tu ritmo.
- **Sonido**: un sinte por estilo que encaja con su fondo (lead, piano o pad), cambiable en ⋯.
- **Bajo con la voz**: solo si lo eliges en ⋯ ("Voz como: melodía · bajo"). Sustituye al bajo del fondo mientras suena.
- **Integración**: una bola blanca, su franja en el aro (spec 003) y su línea `note("…")` en el código Strudel.
- Herramientas para probar con tu voz: un **laboratorio de afinación** (`/lab/voz`, solo en desarrollo, con una ruta de desarrollo que guarda las tomas) y tomas de prueba locales.

**Fuera (siguientes pasos)**
- Bajo automático por registro (con "dum" grave se confundiría con "bum").
- Polifonía, armonización automática o segundas voces.
- Cambiar la progresión de acordes según lo que cantas.
- Letra o sílabas como sonido (vocoder).

## 3. Flujo de usuario

1. Con el loop sonando, **cantas o tarareas** igual que haces beatbox: sílabas ("na", "da") o "mmm". No hay botón ni modo.
   - El detector clasifica cada sonido: con tono sostenido es **melodía**; si no, bombo, caja o platillo como hasta ahora (§4.3).
   - Puedes mezclar en la misma frase: "bum na ts na" da un loop de bombo, uno de platillo y uno de melodía.
   - Mientras cantas, la franja de melodía del aro muestra **tu altura en vivo**: un punto que sube y baja.
2. **La frase se cierra como la de la batería** (§16.15: por defecto, un compás; o por silencio, según ⋯ → Frase).
   - Las notas aparecen en la franja de melodía.
3. **El loop nace en la siguiente línea de compás**, con todos los de esa frase (análisis + 0,3 s de margen, como en §16.12). Cae al agua como los demás.
4. Si ya existe tu melodía (o tu bajo), se aplica **sustituye o completa**, como en la batería (§16.19). Hay como mucho una bola de melodía y una de bajo.
5. La bola de melodía se silencia, se borra y se resalta igual que las demás, y sus notas se editan en el aro (spec 003, E1.4).

**Por qué sin botón:** la melodía tiene que sentirse como un instrumento más, no como un modo aparte. El precio es que "bum", "dum" o "na" tienen tono y se pueden confundir. Se resuelve con la calibración del "na" y con una puerta de tono sostenido (§4.3), y se mide en el laboratorio.

## 4. Detección de notas

### 4.1 Algoritmo de altura: **YIN con probabilidad de voz primero; pYIN solo si hace falta** (propio, en el worker)

| Opción | Pros | Contras |
|---|---|---|
| **YIN** (de Cheveigné y Kawahara, 2002) | Simple, rápido, bien estudiado; vale para voz. Con la aperiodicidad (1 − d′ mínimo) da una **probabilidad de voz** por frame, una mediana corta y un arreglo de saltos de octava | Una estimación por frame: errores de octava y voz/no voz frágiles con voz suave (se mitigan con lo anterior) |
| **pYIN** (Mauch y Dixon, 2014) | Varios umbrales y Viterbi: muchos menos errores de octava | Más código y más CPU en el worker |
| MPM / McLeod (Pitchy) | Muy bueno en tiempo real para instrumentos | Mismos problemas con canto suave |
| CREPE (red neuronal) | El más preciso | Modelo de MB, TF.js, mucho cálculo en móvil: excesivo |
| essentia.js | pYIN ya hecho, en WASM | ~2–3 MB de WASM; el iPhone cargaría lento |

**Decisión (2026-11-14): empezar con YIN propio** en `lib/pitch.ts`: puro, testeable, sin dependencias, menos CPU.
- Cálculo: función diferencia con FFT (autocorrelación), ventana de 2048 muestras con salto de 256 (unos 5 ms a 48 kHz), integración sobre la mitad de la ventana (suelo ≈ 47 Hz a 48 kHz) y rango de 65–1000 Hz (C2–B5). Mínimo con umbral absoluto 0,15 e interpolación parabólica.
- Por frame: altura (MIDI decimal), probabilidad de voz y volumen (RMS). Después, una mediana de 5 frames y el arreglo de saltos de octava.
- **pYIN (Viterbi) solo si el laboratorio muestra errores de octava** que lo justifiquen (fase 0). La decisión sale de tus tomas, no de la teoría.
- essentia.js no entra: no hace falta compararlo si YIN llega a los objetivos.

**Cuándo se analiza:** en el worker, con un **buffer circular** del audio reciente (4 compases a 90 bpm son unos 2 MB). Mientras cantas, el mismo YIN en streaming alimenta el punto de altura en vivo y la puerta de tono (§4.3); al cerrarse la frase, las notas ya están listas (0,3 s antes de la línea de compás, §16.12 de la 001). Solo corre con Play, la melodía activada y el carril encendido.

### 4.2 Segmentación en notas (`lib/notes.ts`)

Sobre la trayectoria de YIN (MIDI decimal por frame, probabilidad de voz y volumen). Valores por defecto fijados con tus tomas del 2026-11-14 (§15.14):
1. **Tramos con voz**: probabilidad de voz ≥ 0,6 y volumen ≥ 0,001 (la cola de un "na" decae hasta ~0,002 con el tono todavía limpio; con 0,004 se perdía). Los huecos de hasta 30 ms (consonantes) no parten el tramo.
2. **Cortes dentro de un tramo**:
   - Por **onset de energía**: se reutiliza el detector de la spec 001, así que las consonantes ("na-na", "da-da") separan notas repetidas.
   - Por **cambio de altura sostenido**: más de 0,7 semitonos respecto a la mediana del tramo durante ≥ 60 ms. Así el vibrato no corta.
   - Los frames de **transición rápida** (más de 30 semitonos por segundo: un glissando) no son nota: cortan.
3. **Fragmentos de entrada y de salida** (tus tomas 1 y 2): la voz entra por debajo o cae al final y deja trozos cortos pegados a la nota. En el **borde** de un tramo (la cadena de fragmentos empieza o acaba el tramo) se absorben en la nota larga de al lado (≥ 0,4 s y ≥ 1,5 veces la cadena) si su altura está cerca según su duración: ≤ 0,1 s hasta 4 semitonos, ≤ 0,2 s hasta 2, ≤ 0,35 s hasta 1,2; una cola de ≤ 0,2 s **una octava más abajo** (la voz que se quiebra al final, error de octava de YIN) también. Los fragmentos pueden estar separados de la nota hasta 0,12 s. No se absorben si la nota larga tiene su propio ataque de energía (son dos notas), ni si están **entre** dos notas (una nota corta de verdad en medio de una melodía).
4. **Altura de cada nota**: la **mediana** de los frames centrales (se descartan el primer y el último 20 %). Así no cuentan los deslizamientos de entrada y salida ni la oscilación del vibrato. Duración mínima de una nota: **0,1 s**. Además, una nota tiene que llegar a un **pico de volumen de 0,004** en algún frame (la cola puede ser más suave): sin eso, un zumbido de fondo con tono (en tus tomas, unos 69 Hz) cuela notas fantasma al bajar el volumen mínimo.
5. **Inicio** = el onset de energía que lo precede (hasta 80 ms antes), si lo hay; si no, el inicio del tramo; corregido de latencia, como la batería. **Duración** = longitud del tramo.

### 4.3 Melodía o beatbox (`lib/notes.ts`, `lib/classifier.ts` y el worker)

**Decisión con datos (2026-11-14): notas primero.** Un sonido es melodía si su onset cae **dentro de una nota sostenida** (§4.2, ≥ 0,1 s de altura estable con voz), con un margen de 0,2 s para el ataque (`melodicOnsets`; en la toma 1 el onset llega ~0,15 s antes de la nota). Las tomas 7 y 8 mostraron que la **puerta por onset** de la primera versión (≥ 80 ms de altura estable desde el onset) separa mal: con el volumen mínimo bajado a 0,001 (necesario para no perder las colas de los "na"), deja pasar 3 de 29 sonidos de beatbox (10 %), y con 0,004 solo reconoce 1 "na" de unos 9. Con "notas primero": **0 de 29** sonidos de beatbox confundidos con melodía y 8 notas de los unos 9 "na" de la toma 7 (el reconocimiento de la melodía lo dan las **notas**, no los onsets: con "na" suave el detector de energía no ve todos los ataques).

- **Hasta la fase 3** no hay clase "na": la melodía se decide solo así, y un sonido que cae dentro de una nota **no se graba además como batería**. Una calibración antigua (sin "na") sigue valiendo.
- **Un sonido dentro de una nota es melodía, no batería**, y el carril "na" es un interruptor (§8.6), no un voto del clasificador.
- **Fase 3:** con la clase "na" del clasificador (vecinos más cercanos, 4.ª clase, calibrada con el reto del §14), si el sonido cae dentro de una nota *y* el clasificador dice "na", es melodía.
- **Latencia de la decisión:** hace falta ver 0,1 s de altura estable tras el onset, algo más que el análisis de la batería (unos 64 ms); entra en el margen de 0,3 s antes de la línea de compás (§16.12 de la 001) y se mide en la fase 1.
- **La puerta por onset** (`toneGate`) se conserva en `lib/notes.ts` por si hace falta como segunda opinión en el worker.
- Con fuga del fondo por el micro, la melodía se desactiva (§10).

## 5. Ayuda (activada por defecto)

Pasos en orden (`lib/melodyAssist.ts`, puro y testeado):

1. **Errores de octava**: una nota a ±12 semitonos (±0,5) de sus dos vecinas, que quedaría a ≤ 7 semitonos de ambas si se desplaza una octava, se desplaza.
2. **Notas sueltas muy cortas**: menos de media celda de la rejilla (o de 60 ms). Se funden con la vecina más parecida en altura o se eliminan si están aisladas.
3. **Escala del estilo**:

   | Estilo | Escala | Notas |
   |---|---|---|
   | hip hop 90 | la menor | A B C D E F G |
   | house | fa menor | F G A♭ B♭ C D♭ E♭ |
   | drum and bass | re menor | D E F G A B♭ C |

   Cada nota va al grado más cercano. En un empate (a ½ semitono de dos grados) gana la nota del acorde del fondo que suena en ese compás (por ejemplo Am o Dm) y, si no, la más cercana a la nota anterior.
4. **Ritmo**:
   - El inicio se cuantiza a **semicorcheas siempre** (también en drum and bass: una melodía en corcheas queda demasiado basta; la rejilla del estilo es de la batería, §8.6).
   - La duración, a celdas (mínimo 1).
   - Si entre dos notas queda un hueco de menos de una celda, la primera se alarga (legato).
5. **Registro**: se transpone por octavas para que la mediana caiga en el rango del sinte: lead C4–C6, piano C3–C5, pad C3–C5, bajo E1–E3.

**Sin ayuda** (respetar tus notas y tu ritmo):
- Sin escala ni cuantización a la rejilla; solo el registro.
- Altura redondeada al **semitono** más cercano (decidido; los microtonos de `note(60.27)` suenan desafinados, que es justo lo que "sin ayuda" quiere evitar). Es una constante por si se cambia.
- **Inicio**: `.nudge()` **no vale para sintes** (en superdough 1.3 solo lo aplica el sampler, y la 002 lo suponía; ver §15.1). El inicio se redondea a una **rejilla fina** (un cuarto de semicorchea, unos 30 ms a 124 bpm) escrita en la mini-notación, sin `.nudge()`. **Medido en el laboratorio (2026-11-14, Chrome):** `.nudge(0.25)` sobre un sinte no cambia nada (las dos capas suenan a la vez) y `.late(0.125)` sí desplaza el patrón 0,25 s. Como `.late()` mueve capas enteras y no notas sueltas, se mantiene la rejilla fina; `.late()` queda como opción si hiciera falta mover una capa entera. Duración redondeada a esa rejilla.

**Completar** (sustituye o completa, §3.4): la melodía es **monofónica**. Con "completa", una nota nueva solo entra en huecos libres: si empieza dentro de una existente se descarta; si empieza en un hueco, se recorta contra la siguiente. Con "sustituye", la frase nueva reemplaza al loop entero.

**Notas y líneas de compás:** una nota **no cruza la línea de compás**: se recorta en ella (como el bajo, 003 E1.3). Así la contracción de compases repetidos de §8.5 sigue valiendo. Partirla repitiendo el ataque queda para más adelante.

## 6. Sonido

Sintes de superdough (los de serie: no hay que cargar soundfonts). **Por defecto** encajan con el fondo del estilo y se pueden cambiar en ⋯ → "Melodía: lead · piano · pad".

| Sinte | Línea Strudel (intención; se afina de oído) | Por defecto en |
|---|---|---|
| **piano** (eléctrico, FM) | `.s("triangle").fm(1.5).fmh(2).decay(0.6).sustain(0.2).room(0.4)` | hip hop 90 |
| **lead** | `.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)` | house |
| **pad** | `.s("supersaw").attack(0.08).release(0.6).lpf(1200).room(0.8)` | drum and bass |
| **drone** (solo en demos; p. ej. el dembow, spec 005 §20) | `.s("sine").room(0.9)`: un sine con reverb para fondos. Un loop de melodía puede llevar su propio sinte (`synth`); no es de los que se eligen para cantar | — |
| **bajo** (con la voz) | el mismo timbre que el bajo del fondo del estilo (en dnb, el de tu reel: `.s("sawtooth").lpf(400).distort(0.3)`) | — |

- Bus propio: **orbit 5** (melodía) y **orbit 6** (bajo con la voz). El sidechain del bombo también los empuja, **solo si hay loop de melodía (o de bajo) en ese bloque**: `DUCK` pasa de `.duckorbit("2:3")` a `"2:3:5"` / `"2:3:5:6"` según lo que haya, así el código de siempre no cambia y sus tests tampoco (`DUCK` es compartido por el código mostrado y el motor).
- En el arranque de la implementación se comprobarán (como en `/spike`) `fm`/`fmh` y `attack`/`release` en superdough 1.3.

## 7. Bajo con la voz (fase 4)

- **Solo explícito**: ⋯ → "Voz como: melodía · bajo" (por defecto, melodía). Sin botón, un "dum" grave se confundiría con "bum", así que no hay detección por registro.
- **Sustituye al bajo del fondo** mientras tu bajo suena (no silenciado):
  - el bajo del fondo se retira con su rampa (§16.13);
  - la bola "bajo" lo indica;
  - si silencias o borras tu bajo, el del fondo vuelve si estaba elegido.
- **Coordinación con el fondo (005):** `cell.parts.bass` es por célula, y el bajo del fondo es un nodo nativo en el orbit 2 con rampas (§16.13 de la 001; `targetParts` cuenta los loops activos). "Retirar" el bajo del fondo es una rampa de ese nodo cuando hay un loop `'bass'` sonando en la célula que suena, y volver a subir al silenciarlo o borrarlo. El código mostrado de esa célula no lleva la línea del bajo del fondo. Por eso va en una fase propia.
- El loop `'bass'` **no se edita en el aro** en la primera versión (como el bajo del fondo, 003 E1.4).
- El bajo con la voz tiene su propia bola y ocupa **la franja del bajo** del aro (spec 003), con el color del bajo.

## 8. Integración

### 8.1 Modelo de datos

La melodía es un loop más (`FreeLoop`), no un tipo aparte: reutiliza frases, sustituye o completa, silenciar, borrar, persistencia y la edición del aro.

```ts
export type LoopInstrument = Instrument | 'mel' | 'bass'
export type MelodySynth = 'lead' | 'piano' | 'pad'

export interface LoopHit {
  /** semicorcheas desde el inicio del loop (entero con ayuda; decimal, en la rejilla fina, sin ella) */
  pos: number
  strength: number
  /** solo melodía y bajo: altura MIDI, entera */
  midi?: number
  /** solo melodía y bajo: duración en semicorcheas (con ayuda ≥ 1; sin ella, en la rejilla fina) */
  dur?: number
}

export interface FreeLoop {
  // … como hoy, con instrument: LoopInstrument
}
```

- Como mucho **un loop `'mel'` y uno `'bass'` por célula** (005), como la batería (§16.19). `MAX_LOOPS` (8) sigue valiendo: tres de batería, melodía y bajo caben.
- `Instrument` (bombo, caja, platillo) no cambia: es lo que se calibra y se clasifica como batería. `INSTRUMENTS`, los kits (`sampleIndex`), las demos y la mezcla siguen siendo de batería; `LoopInstrument` es el tipo del loop.
- **El sinte (`MelodySynth`) es un ajuste de canción, como `kit`**, no un campo del loop: va en `SongSnapshot` y se guarda en Mis canciones (opcional, por defecto el del estilo, §6). Así cambiarlo en ⋯ suena en la siguiente nota sin tocar ningún loop.
- **Persistencia:** `coderbeats:song:v1` y la biblioteca `coderbeats:library:v1` (spec 006); la 002 original hablaba de `coderbeats:loops:v1`, que ya es solo de migración. Sin migración: lo guardado hasta hoy es de batería y sigue valiendo.
- **Validación (seguridad, obligatoria):** `isFreeLoop` y `isSong` (`lib/cells.ts`) comprueban la forma exacta de lo que se lee del almacenamiento porque esos campos acaban en el código Strudel que se evalúa. Con la melodía: `instrument` ∈ batería + `'mel'` + `'bass'`; en los golpes de melodía y bajo, `midi` entero en rango (C1–C7) y `dur` finito y > 0; en los de batería, sin `midi` ni `dur`. **El nombre de nota se saca de una tabla a partir del entero; nunca se interpola un valor leído.** `song.ts` mantiene sus defensas (`safeNum`) y lleva sus tests de inyección (nombres, ids, `midi` y `dur` raros).
- **Ajustes** (`lib/prefsGuard.ts`): melodía activada, "voz como" y sinte son opcionales con valor por defecto; unos ajustes antiguos siguen valiendo.
- **Calibración:** `isCalibration` acepta hoy `bd|sd|hh`. La clase "na" (fase 3) es opcional: una calibración sin ella sigue valiendo y la melodía usa solo la puerta de tono.

### 8.2 Color

**Blanco**, como en el aro (spec 003, E1.2): la bola, la franja y las notas. El bajo con la voz usa el color del bajo (`#BE5A82`).

### 8.3 Aro

Con la franja de la spec 003 (de dentro a fuera: bombo, bajo, caja, **melodía**, platillo):
- Cada nota es un **punto** cuya distancia al centro dentro de la franja es la altura (más fuera = más aguda). Una línea muy tenue los une y dibuja la melodía.
- Con la fase 5 de la spec 003, las notas pasan a **arcos** con su duración.
- Al pasar la aguja, la nota se enciende y suelta su onda y su arco en la franja (spec 003, §4).
- Mientras cantas: un **punto de altura en vivo** en la franja.
- La franja aparece (con transición) cuando hay melodía; el bajo con la voz va en la franja del bajo.

### 8.4 Agua

La onda de la melodía en el agua (desde su bola) usa el **canal A**, el del pulso, que ya es blanco. No hace falta tinte ni una textura más.

### 8.5 Código Strudel

Una línea por loop de voz, en mini-notación con duraciones (`@n` en semicorcheas) y silencios:

```js
  note("<[a3@2 ~ c4 e4@3 ~@2 d4@2 c4@6] [g3@4 a3@12]>").s("triangle").fm(1.5).fmh(2).decay(0.6).sustain(0.2).room(0.4).orbit(5).duckorbit("2:3:5")…
```

- Las notas se escriben con su nombre (`a3`, `bb3`…).
- La rotación de fase y la contracción de compases repetidos son las mismas que en la batería (§16.6).
- Sin ayuda, el inicio va en la rejilla fina (§5), dentro de la misma mini-notación: sin `.nudge()`, que los sintes no aplican.
- Silenciado = línea comentada. Con bajo por voz, la línea del bajo del fondo desaparece del código mostrado.
- Lo que se edita en el aro (spec 003) cambia esta línea igual que la de la batería.

### 8.6 Encaje con células, grupos, carriles, ayuda y retraso de imagen (revisión 2026-11-14)

- **Células y grupos (005):**
  - El límite de un `'mel'` y un `'bass'` es **por célula**.
  - `groupLines` y `loopsLines` reutilizan el mismo generador por loop: la línea `note()` sale del mismo sitio, con su `.color("l<id>")` y su `filterHaps` de ventana y de nacimiento.
  - Con varias células, en estado canción no se graba; en bucle sí (005 §4.4), también la melodía.
  - El fondo progresivo cuenta la melodía como loop activo (`targetParts`).
- **Carriles que graban (003 E4):**
  - La melodía es un carril más ("na"), **un interruptor** (encendido por defecto cuando la melodía está activada). Se mantiene pulsado un hueco de su franja, como los otros.
  - `Lanes` pasa de `Set<Instrument>` a incluir `'mel'`; el mensaje `lanes` del worker lleva también ese carril.
  - `decideLane` sigue siendo solo de batería: la melodía no vota en el kNN hasta la fase 3.
  - La franja se ve tenue desde el principio cuando la melodía está activada, para que exista el hueco donde mantener pulsado (corrige E1.3, "no aparece hasta que exista una melodía").
- **Ayuda por carril (003 E5):** la melodía siempre usa semicorcheas (§5), no la rejilla del estilo. Un `'mel'` con notas fuera de ella se edita en semicorcheas.
- **Retraso de imagen (003 E6):**
  - El inicio de cada nota usa el **onset de energía** del detector de la 001, no el inicio del tramo con voz (YIN llega unos 20–40 ms tarde), y se corrige con la latencia de entrada (`latencySec`) como la batería.
  - Las notas se encienden en el aro con el mismo retraso de imagen que lo demás.
  - **El punto de altura en vivo no se retrasa**: es tu voz y la oyes directamente, sin pasar por los cascos.
- **Tempo (005 §6):** las notas están en semicorcheas y los segundos salen del `bpm` de la canción (`stepSeconds`), como la batería.

## 9. Cómo probarlo con tu voz

1. **Laboratorio `/lab/voz`** (solo con `nuxt dev`, como `/spike`: vive en `dev/` y no entra en el build):
   - grabas una toma (cuenta atrás de un compás y clic a 90 bpm, con cascos) y ves la **curva de altura** (MIDI, con la probabilidad de voz), los **onsets**, las **notas detectadas** y qué sonidos **pasan la puerta de tono**;
   - **escucha y repite** (tomas 1–6): la app toca cada nota esperada con un tono corto y tú la repites; muestra en grande qué nota toca ahora. Las notas esperadas se escriben para una voz media y un desplazamiento de octava (▼ 8ª / ▲ 8ª, que se recuerda) las coloca en tu registro;
   - ajustas en vivo los umbrales (voz, duración mínima, puerta) y se reanaliza al momento;
   - escuchas tu toma y las notas detectadas;
   - escribes las notas que querías (`A3 C4 E4 D4`) y ves el **% de notas con la clase de altura correcta** y el inicio a ≤ 1 semicorchea;
   - una prueba de **`.nudge()` frente a `.late()` en sintes** de Strudel;
   - **"Guardar toma"** la escribe en `tests/fixtures/voice/` (en `.gitignore`) como WAV + JSON + las notas esperadas, mediante una **ruta de desarrollo** (`/_lab/take`, solo con `nuxt dev`; el navegador no puede escribir ahí por sí solo). También lista y carga las ya guardadas para reanalizarlas con otros umbrales.
2. **Protocolo de 9 tomas** (con cascos, y repetir las 1, 2, 7 y 8 con el iPhone):
   1. escala lenta de la menor con "na";
   2. melodía de 4–6 notas con "da";
   3. tarareo legato "mmm" con deslizamientos;
   4. una nota larga con vibrato;
   5. una frase muy suave (casi susurrada);
   6. una línea de bajo grave con "dum";
   7. beatbox y "na" mezclados en la misma frase ("bum na ts na");
   8. beatbox solo ("bum pff ts"), para medir falsas melodías;
   9. **"na" con el fondo sonando por los altavoces (sin cascos)**, para medir la fuga (criterio 9): 5 s sin cantar (solo el fondo) y luego "na" en la do mi. Todo lo que se detecte en los 5 primeros segundos es fuga.
   Solo las tomas 1, 2, 7 y 8 deciden la fase 1; el resto afina.
3. **Test de tus tomas** (`tests/unit/voice-fixtures.test.ts`): si existen las tomas locales, mide el % de notas con la **clase de altura correcta** y el **inicio a ≤ 1 celda**. Si no existen, se salta. **Objetivo**: ≥ 90 % con ayuda y ≥ 80 % sin ayuda. Además mide la **confusión melodía ↔ batería** en las tomas 7 y 8. En la fase 0 solo informa; los umbrales de fallo se ponen con tus datos en la fase 1.
4. **Tests sintéticos** (siempre):
   - voz sintética con pulsos glotales y 3 formantes;
   - **vibrato** de ±40 cents a 5,5 Hz;
   - **glissando** de 120 ms entre notas;
   - **saltos de octava** inyectados en 3 frames;
   - voz **suave** a −35 dBFS con ruido;
   - y la ayuda paso a paso: escala por estilo, desempates, octava, notas cortas, cuantización, registro y la línea de código.

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Vibrato** parte notas o desafina | La mediana de los frames centrales da la altura. Solo se corta si el cambio pasa de 0,7 st durante ≥ 60 ms (el vibrato típico es de ±0,3–0,5 st) |
| **Deslizamientos** (portamento, "scoops") | Se descarta el 20 % inicial y final de cada nota para la altura. Si un tramo es todo deslizamiento (pendiente sostenida), se corta en el punto de máxima pendiente |
| **Voz suave** | Umbral de voz relativo al ruido de fondo; la frase se normaliza a −3 dBFS antes de YIN; la probabilidad de voz filtra el ruido. Test a −35 dBFS |
| **Errores de octava** | Mediana y arreglo de saltos en `lib/pitch.ts`, y la ayuda corrige los que queden. Si el laboratorio sigue mostrándolos, pasa a pYIN con Viterbi (§4.1) |
| **El fondo entra por el micro** (altavoces): el bajo y los acordes tienen tono y crearían **melodías falsas** | Con cascos no pasa. Si la prueba de eco detecta fuga, **la melodía se desactiva** y aparece un icono de cascos pequeño; la batería sigue funcionando. **Medido en la toma 9 (§15.15):** lo que se cuela del fondo es poco y flojo, y una nota tiene que superar 2 veces el piso de volumen y tener probabilidad de voz media ≥ 0,7 (§4.2). Con un fondo muy fuerte (piso > 0,006) esa regla no basta y manda la desactivación por fuga |
| **"Bum" o "dum" confundidos con melodía**, o "na" con bombo | Puerta de tono sostenido (≥ 80 ms) y 4.ª clase calibrada (§4.3). Umbrales fijados con tus tomas; se mide la confusión (§9) |
| Respiraciones y consonantes | Son frames sin voz y se ignoran. Las consonantes sirven para separar notas repetidas |
| Cálculo en el móvil (YIN en streaming cada ~5 ms y segmentación al cerrar la frase) | Se hace en el worker y se mide en la implementación (objetivo < 300 ms en un iPhone de gama media). Si no da tiempo, el salto sube a 512 muestras; si aún no, el loop nace un compás más tarde, pero nunca se corta el audio |

## 11. Criterios de aceptación

1. Cantar "na" con el loop sonando crea **un loop de melodía** en la siguiente línea de compás posible, sin botón. Un beatbox sin canto no crea melodía. En las tomas 7 y 8 de §9, ≤ 5 % de sonidos confundidos entre melodía y batería.
2. Con ayuda, en el protocolo de §9: ≥ 90 % de las notas con la clase de altura correcta y el inicio a ≤ 1 celda. Todas en la escala del estilo y ninguna nota de menos de una celda.
3. Sin ayuda: ≥ 80 % de las notas con la altura correcta (al semitono). El inicio suena donde lo cantaste con la resolución de la rejilla fina (un cuarto de semicorchea, §5), sin `.nudge()`.
4. El vibrato de ±40 cents no parte una nota larga, y el glissando entre dos notas no crea una nota intermedia (tests sintéticos).
5. Con "Voz como: bajo", una frase cantada suena como bajo y **el bajo del fondo se retira** mientras suena. Al silenciarla, vuelve.
6. La melodía tiene su bola blanca, sus notas en su franja del aro con el contorno visible y su línea `note("…")` en el código. Pegado en strudel.cc, suena igual.
7. El sinte se cambia en ⋯ y se oye al momento (en la siguiente nota).
8. El análisis no bloquea el hilo principal: ninguna tarea de más de 50 ms; el agua y el audio no se cortan.
9. Con fuga del fondo por el micro (sin cascos), no nacen melodías y se ve el icono de cascos.

## 12. Plan (por fases, revisado el 2026-11-14)

- **F0. Laboratorio** (solo dev): `/lab/voz` con YIN, puerta de tono, segmentación y comprobación de `.nudge()` / `.late()` en sintes; ruta de desarrollo para guardar las tomas. **Grabas tus 9 tomas** y decidimos umbrales con datos (y si hace falta pYIN). Hito: te enseño curvas y precisión antes de seguir.
- **F1. Mínimo: cantar "na-na" y oír una melodía afinada.**
  - `lib/pitch.ts`, `notes.ts` y `melodyAssist.ts` (escala del estilo, rejilla y registro) con tests sintéticos.
  - Loop `'mel'` en el modelo, con su validación estricta y su generador `note("…")` en `song.ts`, con tests de inyección.
  - Worker: notas desde el buffer circular; la melodía se decide solo con la puerta de tono (sin clase "na").
  - `PhraseTracker` con golpes de melodía con altura, nacimiento en la línea de compás y sustituye o completa.
  - Un sinte por estilo y orbit 5.
  - Bola blanca y línea de código.
  - Interruptor "Melodía (beta)" en ⋯, apagado por defecto y desactivado si hay fuga.
  - Sin franja en el aro todavía.
- **F2. Visual:** franja con notas (arcos), punto de altura en vivo con destello al encajar, editar la nota subiendo o bajando el punto, onda del canal A y carril "na". Ideas del 2026-11-14 (a detallar al empezar la F2):
  - **Estirar el arco para cambiar la duración de una nota.** Las notas son arcos (003, E3.1); se agarra el extremo final del arco y se estira o se acorta, con ayuda en pasos de semicorchea (sin ayuda, en la rejilla fina) y recortado en la línea de compás (§5). Cambia la línea `note()` igual que lo demás.
  - **El órgano de la célula.** Tocar la franja de la melodía la abre **a pantalla completa**, como un instrumento ("caja de música") de esa célula: **horizontal = tiempo** (los pasos de los compases del loop) y **vertical = solo las notas de la escala del estilo** (una fila por grado, en el registro del sinte). Tocar un hueco pone una nota, arrastrar la mueve, estirar el arco cambia su duración, tocar una nota la borra. Con **transición de agua** al abrir y al cerrar (como la de las células, 005 §5.2). Mientras está abierto, la célula sigue sonando y las notas suenan al ponerlas. Para decidir entonces: qué pasa con los loops de batería (no se ven), el gesto para cerrar y cómo se toca en vertical en el móvil.
- **F3. Calibración del "na" jugando** (el reto), clase "na" del clasificador, rango de voz, métricas con tus tomas y selector de sinte en ⋯.
- **F4. Bajo con la voz** ("Voz como: bajo" y retirar el bajo del fondo, §7).
- **F5. Prueba con tu voz en el ordenador y en el móvil, y ajuste fino.**

## 13. Preguntas abiertas

**Resueltas (2026-11-14):**
1. **Sin ayuda: semitono o microtonos** → **semitono** (§5). Es una constante por si se cambia.
2. **Longitud máxima de la frase** → **la misma que la batería** (1, 2 o 4 compases según ⋯ → Frase). La melodía comparte el `PhraseTracker`; una nota que llega al final de la frase se recorta (§5).

Resueltas con la spec 003: sin botón "♪" (la melodía es un instrumento más), color blanco, y bajo con la voz solo explícito en ⋯.

## 14. Ideas: afinar fácil (revisadas el 2026-11-14)

| Idea | Primera versión |
|---|---|
| **La app afina por ti** (con ayuda, siempre a la escala; sin ayuda, se respetan tus notas, §5) | **Sí**: es el núcleo (F1) |
| **Ver tu voz**: punto de altura en vivo en la franja de la melodía | **Sí** (F2): sin él no sabes si te oye |
| **Destello al encajar**: el punto brilla cuando está a ±0,3 semitonos de un grado de la escala | **Sí** (F2), es barato |
| Onda pequeña en el centro del aro que se aprieta o se abre con el tono | No (decorativo) |
| **Calibrar el "na" jugando**: la app toca una nota, tú la imitas y te dice cuánto te acercas (0–10); 5 notas, de grave a aguda | **Sí, en la F3**: sustituye a la toma de calibración del "na" y da muestras de "na" y rango |
| **Rango de voz**: la escala se coloca donde canta cómodo cada uno | **Sí** (F3), sale del reto sin pedir nada más (amplía el registro de §5) |
| Modo reto para practicar el oído, con tarjeta para compartir (negro, números grandes, rosa `#F496BC`) | No, más adelante |

## 15. Revisión del 2026-11-14 contra el código

Lo que cambió respecto al borrador del 2026-11-13, y por qué.

1. **`.nudge()` no vale para sintes.** En `node_modules/superdough` solo `sampler.mjs` lo aplica; la 002 lo usaba para el inicio exacto sin ayuda (§5, criterio 3). Ahora, rejilla fina en la mini-notación. Medido en el laboratorio: `.nudge()` no tiene efecto en sintes y `.late()` sí (mueve patrones enteros, no notas sueltas).
2. **YIN primero, pYIN solo si hace falta, y sin essentia.js** (§4.1): menos código y menos CPU en el worker; la decisión sale de tus tomas.
3. **Datos** (§8.1): `FreeLoop.instrument` pasa a `LoopInstrument` (afecta a ~90 usos: kits, demos, mezcla, carriles, bolas y `loopEdit`); el sinte es un ajuste de canción y no un campo del loop; la persistencia es `coderbeats:song:v1` y la biblioteca; la validación estricta de `isFreeLoop` y `isSong` se amplía con `midi` y `dur`, con el nombre de nota sacado de una tabla.
4. **Notas que cruzan compás:** se recortan en la línea de compás (§5).
5. **Células y grupos** (005): como mucho un `'mel'` y un `'bass'` por célula; el generador por loop es el mismo en canción y en grupos; con varias células en estado canción no se graba (§8.6).
6. **Carriles** (003 E4): la melodía es un carril interruptor ("na") y su franja se ve tenue desde el principio, no solo al existir una melodía (§8.6).
7. **Ayuda por carril** (003 E5): la melodía usa semicorcheas siempre, también en drum and bass (§5).
8. **Retraso de imagen** (003 E6): inicio de nota con el onset de energía y la latencia de entrada; el punto en vivo no se retrasa (§8.6).
9. **Sidechain** (§6): `DUCK` solo incluye los orbits 5 y 6 cuando hay melodía o bajo en el bloque, para no cambiar el código ni los tests de siempre.
10. **Bajo con la voz** (§7): fase propia por la coordinación con el nodo nativo del orbit 2 y `cell.parts.bass`.
11. **Calibración y ajustes** (§8.1): la clase "na" y los ajustes nuevos son opcionales; lo guardado hasta hoy sigue valiendo.
12. **Plan** (§12): F0–F5, con la F1 como lo mínimo para cantar "na-na" y oír una melodía afinada.
13. **Laboratorio** (§9): una novena toma (fuga sin cascos), ruta de desarrollo para guardar tomas, y repetir las tomas clave con el iPhone.
14. **Tomas reales (2026-11-14, voz grave A2–D3, PC con cascos de cable)** — tomas 1, 2, 7 y 8:
    - Toma 1 (escala) y toma 2 (melodía "da"): el 100 % de las notas con la altura exacta, pero con **fragmentos de más** al entrar o al caer. Arreglado con la absorción de fragmentos (§4.2.3) y el pico de volumen mínimo (§4.2.4): 8 de 8 y 5 de 5 notas, sin sobrantes. El inicio por onset de energía solo da 6 onsets para 8 notas ("na" suave): el inicio de nota no puede depender solo de él.
    - Toma 7 (mezcla): la puerta por onset dejaba pasar 1 "na"; el volumen de los "na" decae de 0,019 a ~0,002 en décimas de segundo con el tono limpio.
    - Toma 8 (solo beatbox, 29 onsets): 0 notas con cualquier combinación de umbrales de volumen (0,001–0,004), probabilidad (0,6–0,8) y duración mínima (0,1–0,2 s). Con la puerta por onset, hasta 6 confundidos de 29.
    - Consecuencia: criterio "notas primero" (§4.3) y los valores por defecto de §4.2. Quedan por medir con más tomas: el 90 % de la ayuda (la ayuda aún no existe) y la toma 9 (fuga).
15. **Toma 9 (fuga, sin cascos, fondo de prueba por los altavoces; 2026-11-14):** el micro marca 0,0043 de volumen solo con el fondo; ahí salen notas **G5** (pico 0,0048, probabilidad de voz media 0,55): es la fuga de verdad. De 1,5 s a 14 s el volumen es 3–8 veces mayor y la correlación con el fondo conocido es baja (0,06–0,28): las ~24 notas entre A2 y D3 son voz (tu rango), no fondo. Reglas añadidas (§4.2): pico mayor que 2 veces el piso (el 5 % más bajo del volumen de la toma, con tope de 0,006) y probabilidad de voz media ≥ 0,7; el pico es el percentil 80 de la nota. No se pudo usar la correlación con el fondo como detector de fuga: con un fondo sin fase conocida (las sierras y los triángulos no son periódicos juntos) la correlación sale baja incluso solo con fondo.

## 16. Decisiones a revisar

Cosas que se decidieron sin preguntar durante la implementación de la F1 (2026-11-14). Cada una dice qué se eligió y qué alternativa quedó. Se revisan al final de la F1.

1. **Melodía = notas primero** (§4.3) y no la puerta por onset: decidido con las tomas 7 y 8.
2. **El piso de volumen** (§4.2) se calcula sobre la toma entera (el 5 % más bajo, con tope 0,006). En vivo hará falta una ventana móvil de ~10 s; si nadie calla en 10 s, el tope evita que el piso sea la propia voz. Alternativa: medir el piso en la prueba de eco al empezar, con el fondo sonando.
3. **Corrección de octava relajada** (§5.1): la spec pedía estar a ±12 (±0,5) de las dos vecinas; (57, 69, 59) no lo cumplía. Ahora: una nota a más de 7 semitonos de las dos vecinas que, desplazada una octava, queda a ≤ 7 de ambas, se desplaza. Alternativa: volver a la regla estricta.
4. **Mezcla de la melodía:** −3 dB respecto al bombo (`INSTRUMENT_BALANCE_DB.mel`), con el reparto 1/√n como los demás. Comparte los efectos del bloque (espacio y calor) y el sidechain del bombo (orbit 5). Se afinan de oído.
5. **Sinte:** el del estilo (hip hop 90 → piano, house → lead, drum and bass → pad). `SongState.melodySynth` existe pero aún no se guarda ni se elige (F3, junto al selector de ⋯). Las líneas Strudel son las de la spec y están comprobadas en el laboratorio (§9, "Sintes de la melodía"): las seis combinaciones de estilo y sinte suenan en superdough 1.3 (`fm`, `fmh`, `supersaw`, `attack` y `release` valen), con picos de 0,22 a 0,36.
6. **Aviso de notas en vivo:** una nota se avisa en cuanto dura 0,1 s, aunque luego resulte ser un fragmento de entrada que se absorbe. Los avisos de más solo cuentan como actividad de la frase (mantienen abierta la frase mientras cantas); al nacer el loop se usa el registro final de notas. Alternativa: avisar a los 0,22 s (probado: se pierden los "na" staccato de la toma 7).
7. **La batería espera ~0,35 s con la melodía activada:** cada golpe necesita saber si cayó dentro de una nota. La decisión de cierre de la frase se adelanta lo mismo (0,35 + 0,05 s) para que los golpes de los últimos instantes del compás entren en su frase. Con la melodía apagada nada cambia. A probar: si se nota el retraso en el visual de la batería.
8. **Carril "na" y franja del aro:** no hay en la F1 (los carriles siguen siendo solo de batería y la melodía siempre graba si está activada); llegan en la F2, junto a la franja con las notas. El loop de melodía tiene su bola blanca pero no se dibuja en el aro ni se edita todavía.
9. **Completar** una melodía existente (modo "completa" de ⋯): monofónica; solo entran notas en huecos libres, recortadas contra la siguiente y la línea de compás.
10. **La prueba de eco decide la fuga una sola vez**, al empezar. Si te quitas los cascos con la sesión en marcha, la melodía sigue activa y puede colar notas (la regla del piso de volumen ayuda; ver §15.15). Alternativa: una ventana móvil que detecte fuga en vivo (y la tomaría de la correlación con la salida, que no se pudo probar con los datos que hay).
11. **Ajustes y datos guardados:** el interruptor de la melodía se guarda en los ajustes del dispositivo (apagado por defecto, "beta"). Los loops de melodía se guardan con la canción (y en Mis canciones) con la validación estricta de §8.1; el sinte no.
12. **Sin ayuda:** la melodía se escribe con la rejilla fina de un cuarto de paso (sin `.nudge()`, que los sintes no aplican) y sin escala; el registro sí se corrige siempre.
13. **El análisis corre en el worker mientras suena:** YIN cada ~5 ms y una revisión de notas cada 50 ms de audio, solo con la melodía activada y en marcha. Sin medir todavía en el iPhone (objetivo: ninguna tarea de más de 50 ms).

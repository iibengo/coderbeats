# 002 · Melodía con la voz

> Estado: **borrador, pendiente de aprobación** (2026-11-13). No se programa nada hasta que se apruebe.
> Parte de: spec 001 (coderbeats MVP, con sus enmiendas hasta §16.20). Hoja de ruta §14, punto 4 ("tararear el bajo, con ajuste a escala").
> Revisada el 2026-11-13 con la spec 003 (el aro, enmienda 1): **la melodía es un instrumento más**, sin botón ni modo aparte, y sus notas se ven en su franja del aro.

## 1. Idea

Cantas o tarareas una melodía corta y se convierte en un **loop de sintetizador que parte de tu melodía pero suena bien**: afinado a la escala del estilo, cuantizado a la rejilla y limpio. **Se canta como se hace el beatbox**: con el loop sonando, sin botón ni modo aparte. Si eliges "Voz como: bajo" en ⋯, suena como bajo y sustituye al bajo del fondo.

## 2. Alcance

**Dentro**
- **La melodía como instrumento más**: el detector separa el canto ("na", "da", "mmm") del beatbox ("bum", "pff", "ts") y la melodía entra por las mismas frases que la batería.
- Una **toma de calibración de "na"** (a varias alturas) junto a las de bombo, caja y platillo.
- Detección de **notas** (altura, inicio y duración) de una voz monofónica.
- **Ayuda** (activada por defecto): afinación a la escala del estilo, cuantización del ritmo y limpieza (notas muy cortas, errores de octava, deslizamientos). Sin ayuda, se respetan tus notas y tu ritmo.
- **Sonido**: un sinte por estilo que encaja con su fondo (lead, piano o pad), cambiable en ⋯.
- **Bajo con la voz**: solo si lo eliges en ⋯ ("Voz como: melodía · bajo"). Sustituye al bajo del fondo mientras suena.
- **Integración**: una bola blanca, su franja en el aro (spec 003) y su línea `note("…")` en el código Strudel.
- Herramientas para probar con tu voz: un **laboratorio de afinación** (`/lab/voz`, solo en desarrollo) y tomas de prueba locales.

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

### 4.1 Algoritmo de altura: **pYIN** (propio, en el worker de análisis)

| Opción | Pros | Contras |
|---|---|---|
| **YIN** (de Cheveigné y Kawahara, 2002) | Simple, rápido, bien estudiado; vale para voz | Una sola estimación por frame: **errores de octava** y decisiones de voz/no voz frágiles con voz suave |
| **pYIN** (Mauch y Dixon, 2014) | YIN con varios umbrales (probabilidades) y una **cadena de Markov con Viterbi** que elige la trayectoria más probable: muchos menos errores de octava y una **probabilidad de voz** por frame. Es la base de *Tony*, la referencia para transcribir canto monofónico | Más cálculo (Viterbi), pero sobra margen en el worker |
| MPM / McLeod (Pitchy) | Muy bueno en tiempo real para instrumentos | Mismos problemas de octava y de voz/no voz que YIN con canto suave |
| CREPE (red neuronal) | El más preciso | Modelo de MB, TF.js y mucho cálculo en móvil: excesivo |
| essentia.js (`PitchYinProbabilistic` + segmentación) | pYIN ya hecho, en WASM; licencia AGPL (a verificar), compatible con la nuestra | ~2–3 MB de WASM y menos control; en el iPhone cargaría lento |

**Propuesta: pYIN implementado por nosotros** en `lib/pitch.ts`. Es puro, se puede testear y no añade dependencias.
- Cálculo: función diferencia de YIN con FFT, frame de 2048 muestras con salto de 256 (unos 5 ms a 48 kHz) y rango de 65–1000 Hz (C2–B5).
- Candidatos: varios umbrales con su distribución a priori.
- Trayectoria: Viterbi sobre estados de altura en pasos de 20 cents más un estado "sin voz".

En el laboratorio (§9) se compara con un **YIN simple** y, solo como referencia, con **essentia.js**, para comprobar que nuestro pYIN no es peor.

**Cuándo se analiza:** en el worker, **mientras la frase está abierta**, por tramos con voz: cada tramo se analiza con pYIN (Viterbi sobre el tramo) en cuanto termina. Las notas tienen que estar listas cuando se decide la frase (0,3 s antes de la línea de compás, §16.12). Mientras cantas, un **YIN ligero en streaming** alimenta el punto de altura en vivo y la puerta de tono (§4.3).

### 4.2 Segmentación en notas (`lib/notes.ts`)

Sobre la trayectoria de pYIN (MIDI decimal por frame y probabilidad de voz):
1. **Tramos con voz**: probabilidad de voz > 0,5 durante ≥ 40 ms.
2. **Cortes dentro de un tramo**:
   - Por **onset de energía**: se reutiliza el detector de la spec 001, así que las consonantes ("na-na", "da-da") separan notas repetidas.
   - Por **cambio de altura sostenido**: más de 0,7 semitonos respecto a la mediana del tramo durante ≥ 60 ms. Así el vibrato no corta.
3. **Altura de cada nota**: la **mediana** de los frames centrales (se descartan el primer y el último 20 %). Así no cuentan los deslizamientos de entrada y salida ni la oscilación del vibrato.
4. **Inicio** = inicio del tramo (corregido de latencia, como la batería). **Duración** = longitud del tramo.

### 4.3 Melodía o beatbox (`lib/classifier.ts` y el worker)

Cada sonido se decide en dos pasos:
1. **Puerta de tono**: probabilidad de voz > 0,5 y altura estable (±1 semitono) durante **≥ 80 ms**. Un "bum" tiene tono, pero cae en menos tiempo y con ataque explosivo; un "na" sostiene el tono.
2. **Clasificador** (el de la spec 001, vecinos más cercanos) con una **4.ª clase, "na"**, calibrada con su toma. Si pasa la puerta y el clasificador dice "na", es melodía; si no pasa la puerta, solo puede ser batería.

- Los umbrales (80 ms, ±1 semitono) se fijan con tus tomas en el laboratorio (M0).
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
   - El inicio se cuantiza a la rejilla del estilo (semicorcheas; corcheas en drum and bass, como la batería).
   - La duración, a celdas (mínimo 1).
   - Si entre dos notas queda un hueco de menos de una celda, la primera se alarga (legato).
5. **Registro**: se transpone por octavas para que la mediana caiga en el rango del sinte: lead C4–C6, piano C3–C5, pad C3–C5, bajo E1–E3.

**Sin ayuda** (respetar tus notas y tu ritmo):
- Sin escala ni cuantización; solo el registro.
- Altura redondeada al **semitono** más cercano (pregunta abierta 2: o microtonos exactos con `note(60.27)`).
- Inicio exacto con `.nudge()` (como en §16.6). Duración redondeada a celdas, con el inicio exacto.

## 6. Sonido

Sintes de superdough (los de serie: no hay que cargar soundfonts). **Por defecto** encajan con el fondo del estilo y se pueden cambiar en ⋯ → "Melodía: lead · piano · pad".

| Sinte | Línea Strudel (intención; se afina de oído) | Por defecto en |
|---|---|---|
| **piano** (eléctrico, FM) | `.s("triangle").fm(1.5).fmh(2).decay(0.6).sustain(0.2).room(0.4)` | hip hop 90 |
| **lead** | `.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)` | house |
| **pad** | `.s("supersaw").attack(0.08).release(0.6).lpf(1200).room(0.8)` | drum and bass |
| **bajo** (con la voz) | el mismo timbre que el bajo del fondo del estilo (en dnb, el de tu reel: `.s("sawtooth").lpf(400).distort(0.3)`) | — |

- Bus propio: **orbit 5** (melodía) y **orbit 6** (bajo con la voz). El sidechain del bombo también los empuja: `.duckorbit("2:3:5:6")`.
- En el arranque de la implementación se comprobarán (como en `/spike`) `fm`/`fmh` y `attack`/`release` en superdough 1.3.

## 7. Bajo con la voz

- **Solo explícito**: ⋯ → "Voz como: melodía · bajo" (por defecto, melodía). Sin botón, un "dum" grave se confundiría con "bum", así que no hay detección por registro.
- **Sustituye al bajo del fondo** mientras tu bajo suena (no silenciado):
  - el bajo del fondo se retira con su rampa (§16.13);
  - la bola "bajo" lo indica;
  - si silencias o borras tu bajo, el del fondo vuelve si estaba elegido.
- El bajo con la voz tiene su propia bola y ocupa **la franja del bajo** del aro (spec 003), con el color del bajo.

## 8. Integración

### 8.1 Modelo de datos

La melodía es un loop más (`FreeLoop`), no un tipo aparte: reutiliza frases, sustituye o completa, silenciar, borrar, persistencia y la edición del aro.

```ts
export type LoopInstrument = Instrument | 'mel' | 'bass'
export type MelodySynth = 'lead' | 'piano' | 'pad'

export interface LoopHit {
  /** semicorcheas desde el inicio del loop (entero con ayuda, decimal sin ella) */
  pos: number
  strength: number
  /** solo melodía y bajo: altura MIDI (entera; decimal solo si se aceptan microtonos) */
  midi?: number
  /** solo melodía y bajo: duración en semicorcheas (≥ 1 con ayuda) */
  dur?: number
}

export interface FreeLoop {
  // … como hoy, con instrument: LoopInstrument
  /** solo melodía */
  synth?: MelodySynth
}
```

- Como mucho un loop `'mel'` y uno `'bass'` (como la batería, §16.19).
- `Instrument` (bombo, caja, platillo) no cambia: es lo que se calibra y se clasifica como batería.
- Persistencia en `coderbeats:loops:v1`, sin migración: los loops guardados son de batería y siguen valiendo.

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
  note("<[a3@2 ~ c4 e4@3 ~@2 d4@2 c4@6] [g3@4 a3@12]>").s("triangle").fm(1.5).fmh(2).decay(0.6).sustain(0.2).room(0.4).orbit(5).duckorbit("2:3:5:6")…
```

- Las notas se escriben con su nombre (`a3`, `bb3`…).
- La rotación de fase y la contracción de compases repetidos son las mismas que en la batería (§16.6).
- Sin ayuda, se añade `.nudge("…")` con la misma estructura.
- Silenciado = línea comentada. Con bajo por voz, la línea del bajo del fondo desaparece del código mostrado.
- Lo que se edita en el aro (spec 003) cambia esta línea igual que la de la batería.

## 9. Cómo probarlo con tu voz

1. **Laboratorio `/lab/voz`** (solo en desarrollo):
   - grabas una frase y ves la **curva de altura** (pYIN y YIN superpuestos, con la probabilidad de voz),
   - las **notas detectadas** antes y después de la ayuda,
   - ves qué sonidos pasan la puerta de tono y cómo los clasifica (melodía o batería);
   - escuchas el resultado con cada sinte.
   - "Guardar toma" baja WAV + JSON a `tests/fixtures/voice/` (en `.gitignore`), junto a un archivo `*.expected.txt` que escribes tú con las notas que querías (por ejemplo `A3 C4 E4 D4`).
2. **Protocolo de 8 tomas** (con cascos):
   1. escala lenta de la menor con "na";
   2. melodía de 4–6 notas con "da";
   3. tarareo legato "mmm" con deslizamientos;
   4. una nota larga con vibrato;
   5. una frase muy suave (casi susurrada);
   6. una línea de bajo grave con "dum";
   7. beatbox y "na" mezclados en la misma frase ("bum na ts na");
   8. beatbox solo ("bum pff ts"), para medir falsas melodías.
3. **Test de tus tomas** (`tests/unit/voice-fixtures.test.ts`): si existen las tomas locales, mide el % de notas con la **clase de altura correcta** y el **inicio a ≤ 1 celda**. Si no existen, se salta. **Objetivo**: ≥ 90 % con ayuda y ≥ 80 % sin ayuda. Además mide la **confusión melodía ↔ batería** en las tomas 7 y 8.
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
| **Voz suave** | Umbral de voz relativo al ruido de fondo; la frase se normaliza a −3 dBFS antes de pYIN; la probabilidad de voz de pYIN filtra el ruido. Test a −35 dBFS |
| **Errores de octava** | Los evita pYIN con Viterbi, y la ayuda corrige los que queden |
| **El fondo entra por el micro** (altavoces): el bajo y los acordes tienen tono y crearían **melodías falsas** | Con cascos no pasa. Si la prueba de eco detecta fuga, **la melodía se desactiva** y aparece un icono de cascos pequeño; la batería sigue funcionando |
| **"Bum" o "dum" confundidos con melodía**, o "na" con bombo | Puerta de tono sostenido (≥ 80 ms) y 4.ª clase calibrada (§4.3). Umbrales fijados con tus tomas; se mide la confusión (§9) |
| Respiraciones y consonantes | Son frames sin voz y se ignoran. Las consonantes sirven para separar notas repetidas |
| Cálculo en el móvil (Viterbi sobre una frase de 4 compases) | Se hace en el worker y se mide en la implementación (objetivo < 300 ms en un iPhone de gama media). Si no da tiempo, el loop nace un compás más tarde, pero nunca se corta el audio |

## 11. Criterios de aceptación

1. Cantar "na" con el loop sonando crea **un loop de melodía** en la siguiente línea de compás posible, sin botón. Un beatbox sin canto no crea melodía. En las tomas 7 y 8 de §9, ≤ 5 % de sonidos confundidos entre melodía y batería.
2. Con ayuda, en el protocolo de §9: ≥ 90 % de las notas con la clase de altura correcta y el inicio a ≤ 1 celda. Todas en la escala del estilo y ninguna nota de menos de una celda.
3. Sin ayuda: ≥ 80 % de las notas con la altura correcta (al semitono). El inicio suena donde lo cantaste (±10 ms) gracias a `.nudge()`.
4. El vibrato de ±40 cents no parte una nota larga, y el glissando entre dos notas no crea una nota intermedia (tests sintéticos).
5. Con "Voz como: bajo", una frase cantada suena como bajo y **el bajo del fondo se retira** mientras suena. Al silenciarla, vuelve.
6. La melodía tiene su bola blanca, sus notas en su franja del aro con el contorno visible y su línea `note("…")` en el código. Pegado en strudel.cc, suena igual.
7. El sinte se cambia en ⋯ y se oye al momento (en la siguiente nota).
8. El análisis no bloquea el hilo principal: ninguna tarea de más de 50 ms; el agua y el audio no se cortan.
9. Con fuga del fondo por el micro (sin cascos), no nacen melodías y se ve el icono de cascos.

## 12. Plan

- **M0. Laboratorio y comparación** (1–2 días): `/lab/voz` con YIN y pYIN propios y essentia.js como referencia, y la puerta de tono. **Grabas tus 8 tomas** y decidimos los umbrales con datos reales. Hito: te enseño las curvas y la precisión antes de seguir.
- **M1. `lib/`**: pitch (pYIN), notes (segmentación), puerta de tono y clase "na" del clasificador, melodyAssist (ayuda) y el generador `note()`, con tests sintéticos y de tus tomas.
- **M2. Motor**: toma de calibración del "na", análisis por tramos en el worker, melodía en las frases, nacimiento y sustituye/completa, sintes y orbits 5 y 6, y desactivación con fuga.
- **M3. Visual** (necesita las fases 1–3 de la spec 003): bola blanca, franja de melodía con notas y altura en vivo, edición de notas en el aro, onda en el canal A.
- **M4. Bajo con la voz**: "Voz como: bajo" en ⋯, sustitución del bajo del fondo y franja del bajo.
- **M5. Prueba con tu voz** en el ordenador y en el móvil, y ajuste fino.

## 13. Preguntas abiertas

1. **Sin ayuda**: ¿altura redondeada al semitono (propuesto) o microtonos exactos (`note(60.27)`)?
2. **Longitud máxima** de una frase de melodía: ¿4 compases como la batería, o más para melodías largas?

Resueltas con la spec 003: sin botón "♪" (la melodía es un instrumento más), color blanco, y bajo con la voz solo explícito en ⋯.

## 14. Ideas: afinar fácil (para revisar, 2026-11-13)

Ideas para el futuro. No son decisiones.

- **La app afina por ti**, igual que el imán: **con ayuda**, lo que cantas siempre se ajusta a la nota más cercana de la escala del estilo y nunca suena una nota mala; **sin ayuda**, se respetan tus notas (§5).
- **Ver tu voz**: mientras cantas, una onda pequeña en el centro del aro se aprieta (agudo) o se abre (grave) con tu tono. Al llegar a una nota de la escala, "encaja" con un destello.
- **Calibrar el "na" jugando**: un reto corto.
  - La app toca una nota, tú la imitas y te dice cuánto te acercas (0–10).
  - Son 5 notas, de grave a aguda.
  - Sirve para calibrar la clase "na" (§4.3) y aprender tu rango. Sustituiría a la toma de calibración del "na".
- **Rango de voz**: la escala se coloca donde canta cómodo cada uno, sin pedir nada (con el rango aprendido en el reto; amplía el registro de §5).
- **Más adelante**: modo reto para practicar el oído, con tarjeta de resultado para compartir, en estilo minimalista (negro, números grandes, rosa `#F496BC`).

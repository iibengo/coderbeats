# 001 · MVP de coderbeats

> Estado: **aprobada** el 2026-11-12, con cambios: estilo premium minimalista y preguntas abiertas resueltas (§13).
> **Enmienda 1 (modo looper, §15): aprobada el 2026-11-12.**
> **Enmienda 2 (instrumento para jugar: loops libres, ayuda, agua, canción, §16): aprobada el 2026-11-12.** Motor: @strudel/web (sujeto al spike A3.0); licencia del proyecto: AGPL-3.0.
> Fecha: 2026-11-12

coderbeats convierte un beatbox grabado con el micro del navegador en un loop de batería con samples de calidad y muestra el patrón como código [Strudel](https://strudel.cc) listo para copiar.

---

## 1. Punto de partida (lo que hay en el repo)

| Elemento | Estado actual |
|---|---|
| Nuxt | `^4.5.2`, `app/app.vue` con la página de bienvenida por defecto |
| Tailwind | `@nuxtjs/tailwindcss ^6.14` → **Tailwind 3.4.19**, sin `tailwind.config` propio |
| Módulos ya instalados | `@vite-pwa/nuxt`, `@nuxt/icon`, `@nuxt/fonts` |
| TypeScript | tsconfig por referencias de Nuxt; no hay `strict` explícito ni `typecheck` |
| Tests | ninguno |
| `public/` | `favicon.ico`, `robots.txt` |
| Git | `package-lock.json` modificado sin commitear (22 líneas borradas tras `npm install`) |

`package.json` sigue llamándose `nuxt-tailwind-pwa`; se renombrará a `coderbeats`.

---

## 2. Alcance

### Dentro del MVP
1. Pantalla de inicio con botón **Empezar** (desbloquea el `AudioContext` y pide el micro).
2. **Calibración de latencia**: 4 palmadas al metrónomo.
3. **Calibración de sonidos**: 5 tomas de cada sonido (bombo "bum", caja "pff", platillo "ts"), guardadas en `localStorage`.
4. **Grabación**: elegir estilo, metrónomo a 90 BPM, 1 compás de cuenta atrás y 4 compases de grabación, aviso de usar cascos.
5. **Análisis**: onsets → clasificación k-NN → cuantización a 16 pasos por compás con compensación de latencia.
6. **Reproducción** en loop con el kit elegido, al tempo del estilo.
7. **Código Strudel** con efecto de tecleo y botón de copiar.
8. Controles: kit (909 / 808 / acústico), ruedas Filtro / Espacio / Calor, **drop**, play/stop, regrabar.
9. Estética premium minimalista, mobile-first, 60 fps.
10. Tests unitarios con Vitest de la lógica pura.

### Fuera del MVP (siguientes pasos)
- **Varias capas**: grabar más pasadas encima (por ejemplo una segunda pasada solo de hi-hats) y mezclarlas.
- **Tararear el bajo**: detección de tono (YIN o pYIN) → notas cuantizadas → `note("...").s("sawtooth")` en Strudel.
- **Exportar audio o vídeo**: render offline con `Tone.Offline` a WAV, y vídeo del anillo con `MediaRecorder` sobre `canvas.captureStream()` y el audio.
- **Swing**: swing por estilo (por ejemplo unos 55 % en semicorcheas para hip hop 90), aplicado en la reproducción y en el código Strudel. Los `offsetsMs` del `Pattern` ya guardan la desviación de cada golpe y sirven de base.
- Más instrumentos (open hat, clap, rim), velocidad (dinámica) por golpe, editar pasos tocando el anillo, compartir por URL.
- Modo offline completo como PWA (precache de samples).

---

## 3. Flujo de usuario

```
[Inicio] --Empezar--> ¿hay calibración guardada?
   ├─ no ─> [Latencia: 4 palmadas] -> [Sonidos: 3 × 5 tomas] -> [Estudio]
   └─ sí ─> [Estudio]   (desde Ajustes se puede recalibrar cualquiera de las dos)

[Estudio] (vacío) --Grabar--> [Aviso cascos] -> [Cuenta atrás 1 compás] -> [Grabando 4 compases]
          -> [Analizando] -> [Estudio con patrón: loop + código]
          --Regrabar--> vuelve a [Aviso cascos]
```

### 3.1 Inicio
- Logo, una frase y un botón **Empezar** en blanco sobre negro, sin más elementos.
- Al pulsar, dentro del mismo gesto del usuario: `Tone.start()` (desbloquea iOS Safari), `getUserMedia` y carga de samples del kit por defecto.
- Si se deniega el micro: mensaje con instrucciones por navegador y botón de reintentar. Si no hay HTTPS: mensaje explicativo (el micro exige contexto seguro).
- Recomendación visible: **cascos con cable**; el Bluetooth añade entre 150 y 300 ms de latencia y estropea la cuantización.

### 3.2 Calibración de latencia
- Metrónomo a 90 BPM: 1 compás de cuenta y luego 4 tiempos en los que el usuario da una palmada con cada clic.
- Se detectan los 4 onsets y se mide el retraso de cada uno respecto al clic programado. **Latencia = mediana de los 4** (más robusta que la media ante una palmada mala). En la UI se muestra la media y la dispersión.
- Válida si se detectan ≥ 3 palmadas y la dispersión (máximo − mínimo) es ≤ 60 ms. Si no, se pide repetir.
- El valor mide la latencia de ida y vuelta (salida + entrada + reacción humana) y se resta al cuantizar.
- Si sale > 150 ms: aviso de que probablemente se están usando cascos Bluetooth.

### 3.3 Calibración de sonidos
- Para cada instrumento (bum → pff → ts): 5 tomas. En cada toma aparece "¡ahora!" y una ventana de 1,5 s con medidor de nivel.
- En cada ventana se coge el onset más fuerte y se extraen sus características (§5.3). Si no hay onset por encima del umbral, se repite la toma.
- Al terminar se calcula la **precisión leave-one-out** del k-NN sobre las 15 muestras. Si es < 80 % se avisa ("el pff y el ts se parecen mucho, exagera la diferencia") y se ofrece repetir el instrumento peor.
- Se guarda en `localStorage` (§6).

### 3.4 Grabación
- Selector de estilo: **hip hop 90** (90 BPM), **house** (124 BPM), **drum and bass** (174 BPM). El estilo solo fija el tempo de reproducción (y el `setcpm` del código).
- **Siempre se graba a 90 BPM**, sea cual sea el estilo.
- Antes de grabar se avisa de usar cascos (con casilla de "no volver a mostrar").
- Cuenta atrás: 4 clics con acento en el 1; el anillo muestra 4, 3, 2, 1.
- Grabación: 4 compases con clic. El cabezal del anillo gira y una barra muestra el compás 1-4.
- Durante la grabación el loop anterior se detiene.
- Al acabar se paran las pistas del micro (en iOS eso devuelve la salida de audio a modo reproducción, ver §9).

### 3.5 Análisis (síncrono, < 300 ms para 4 compases)
1. Detección de onsets sobre el buffer grabado (§5.2).
2. Clasificación k-NN de cada onset contra la calibración (§5.4).
3. Cuantización a semicorcheas con compensación de latencia (§5.5).
4. Si no hay ningún golpe: mensaje y volver a grabar.

### 3.6 Estudio
- Loop de 4 compases (64 pasos) con los samples del kit, al tempo del estilo.
- El anillo muestra los 16 pasos del compás que suena. El indicador de compás 1-4 se ve en el anillo.
- Panel de código que se escribe solo cada vez que cambia el patrón, con botón de copiar.

---

## 4. Arquitectura

### 4.1 Principios
- **Sin backend.** Toda la app se ejecuta en el navegador. Nitro solo sirve estáticos; el despliegue es `nuxt generate`.
- **Audio solo en cliente**: `routeRules: { '/': { ssr: false } }` en `nuxt.config.ts`. Las librerías de audio se importan con `import()` dinámico dentro de composables que solo se llaman tras el gesto de **Empezar**.
- **Lógica pura separada del audio**: todo lo que se puede testear (onsets, features, k-NN, cuantización, Strudel, latencia) vive en `app/lib/` sin tocar `window`, Web Audio ni Vue. Recibe `Float32Array` y números y devuelve datos.
- **Un único reloj**: todo se programa sobre el `AudioContext` (`Tone.Transport` / `ctx.currentTime`). Nada de `setTimeout` para audio.
- **60 fps**: las animaciones continuas (cabezal, latido, grano) se actualizan en un bucle `requestAnimationFrame` que escribe CSS custom properties o `transform` directamente en el DOM, **no** en estado reactivo de Vue. Solo usan `transform` y `opacity`.

### 4.2 Estructura de carpetas

```
app/
  app.vue                      # layout, fuentes, fondo con grano
  pages/index.vue              # máquina de estados: inicio → calibración → estudio
  components/
    StartGate.vue
    calibration/LatencyCalibration.vue
    calibration/SoundCalibration.vue
    studio/StepRing.vue        # anillo SVG de 16 pasos + cabezal
    studio/Knob.vue            # rueda grande (pointer events, arrastre vertical)
    studio/KitSwitch.vue
    studio/StyleSwitch.vue
    studio/TransportBar.vue    # play/stop, drop, regrabar
    studio/CodePanel.vue       # código con tecleo, colapsable
    studio/RecordOverlay.vue   # aviso de cascos, cuenta atrás, grabando
    ui/LevelMeter.vue
  composables/
    useAudioEngine.ts          # AudioContext/Tone, cadena de efectos, kits
    useMic.ts                  # getUserMedia + AudioWorklet de captura
    useMetronome.ts            # clics programados sobre el Transport
    useRecorder.ts             # cuenta atrás + grabación + análisis
    usePlayback.ts             # Tone.Part del patrón, drop, eventos visuales
    useCalibration.ts          # lectura y escritura en localStorage
    useFrameLoop.ts            # bucle rAF compartido
  lib/                         # PURO y testeado
    types.ts
    constants.ts               # estilos, kits, rangos de las ruedas
    onsets.ts
    features.ts
    classifier.ts
    quantize.ts
    latency.ts
    strudel.ts
    knobs.ts                   # mapeo 0..1 → Hz, wet, drive…
public/
  samples/{909,808,acoustic}/{bd,sd,hh}.wav
  samples/CREDITS.md
  worklets/capture-processor.js
tests/
  unit/*.test.ts
  helpers/synth.ts             # generador de audio sintético
specs/001-mvp/spec.md
```

### 4.3 Captura del micro
- `getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } })`. Sin esto el navegador "limpia" el beatbox y se come los transitorios.
- Captura con un **AudioWorklet** propio que copia los frames a un buffer y envía al hilo principal el `currentFrame` del primer bloque. Así se sabe en tiempo de `AudioContext` cuándo empieza el buffer y se alinea con el clic programado sin depender de `MediaRecorder` (que comprime y no da timestamps precisos).
- El mismo nodo alimenta el `LevelMeter`.

### 4.4 Cadena de audio (Tone.js)

```
Players(bd, sd, hh) ─► Calor[ Distortion → Compressor → makeup Gain ]
                     ─► Filtro[ Filter lowpass 24 dB/oct ]
                     ─┬► Master Gain ─► Limiter ─► Destination
                      └► send ─► FeedbackDelay (8n con puntillo, sincronizado) ─► Reverb ─► Master
Metrónomo (Synth corto) ─► Destination   (fuera de la cadena de efectos)
```

- **Kits**: 3 × `Tone.Players` precargados tras el primer uso (el kit por defecto se carga en **Empezar** y el resto en segundo plano). Cambiar de kit es inmediato porque solo cambia qué `Players` dispara el `Part`.
- **Patrón**: un `Tone.Part` de 64 eventos con `loop` de 4 compases. Cada evento también llama a `Tone.Draw.schedule` para encender el punto y, si es `bd`, lanzar el latido del fondo. Es audio-reactivo sincronizado con lo que suena, sin analizar la salida.
- **Mapeo de las ruedas** (0..1, en `lib/knobs.ts`):
  - Filtro: frecuencia de corte exponencial entre 120 Hz y 18 kHz; 1 = abierto. Q fijo 1.
  - Espacio: nivel del envío entre 0 y 0,6. Reverb con `decay` de 2,5 s y delay con `feedback` 0,3. Los dos se controlan con la misma rueda.
  - Calor: `distortion` entre 0 y 0,5; el umbral del compresor va de −12 a −30 dB y el ratio de 2 a 6; la ganancia de compensación sube para mantener el volumen percibido.
  - Cambios suavizados con `rampTo(…, 0.05)` para evitar chasquidos.
- **Drop**: al pulsar, el corte baja a 150 Hz en 1 tiempo (`exponentialRampTo`). Con `Transport.scheduleOnce` en el inicio del siguiente compás (`@1m` cuantizado) vuelve al valor de la rueda en 30 ms. La rueda de Filtro se anima visualmente con la bajada y la subida. Si se pulsa durante el último tiempo del compás, la bajada se acorta para soltar a tiempo en el siguiente.

### 4.5 Estado
Sin Pinia: composables con estado a nivel de módulo (`ref`/`shallowRef`), porque la app es una sola página solo en cliente. El estado de audio pesado (buffers, nodos) va en `shallowRef` o fuera de la reactividad.

---

## 5. Algoritmos

### 5.1 Tiempos de grabación
- Tempo de grabación 90 BPM, por tanto una semicorchea dura `60/90/4 = 0,1667 s`.
- `t0` = tiempo de `AudioContext` del primer tiempo del compás 1 (después de la cuenta atrás).
- Se graba desde `t0 − 0,25 s` hasta `t0 + 4 compases + 0,25 s`. Los márgenes recogen golpes un poco adelantados o atrasados.

### 5.2 Detección de onsets (`lib/onsets.ts`)
- Entrada: `Float32Array` mono y `sampleRate`. Salida: `Onset[]` con tiempo (s) y fuerza.
- **Flujo espectral** con FFT de 1024 muestras y salto de 256 (unos 5 ms a 48 kHz), magnitud logarítmica `log(1 + 100·|X|)`, diferencia rectificada positiva sumada en todas las bandas.
- **Umbral adaptativo**: `mediana(ventana de ±8 frames) · 1,5 + δ`, donde δ sale del ruido de fondo medido en los primeros 200 ms.
- **Selección de picos**: máximo local por encima del umbral y separación mínima de 60 ms entre onsets (la semicorchea más corta que se graba dura 167 ms).
- **Puerta de energía**: se descartan los picos cuyo RMS en los 20 ms siguientes no supera el ruido de fondo + 12 dB.
- **Subida real**: el RMS de los 20 ms siguientes debe superar en ≥ 6 dB al de los 20 ms anteriores. Así se descartan los picos de flujo en las colas de un golpe que decae.
- **Ajuste fino del tiempo**: desde el frame del pico se retrocede sobre la envolvente de energía (ventanas de 64 muestras) hasta el punto en que cruza el 20 % del máximo local. El onset se coloca ahí, con precisión de unos 2 ms.
- La FFT la proporciona Meyda (`amplitudeSpectrum`). El resto es código propio y determinista.

### 5.3 Características (`lib/features.ts`)
Sobre una ventana de 2048 muestras (unos 43 ms) que empieza en el onset, con ventana de Hann, calculadas con Meyda:
- `spectralCentroid` (en Hz, normalizado por Nyquist),
- **energía por bandas** como proporción del total: < 150 Hz, 150–800 Hz, 800 Hz–4 kHz, > 4 kHz,
- 13 coeficientes **MFCC** (media de 2 frames solapados),
- `zcr` y `rms` (solo para la puerta y el diagnóstico; el RMS **no** entra en la distancia, para que el volumen no influya).

El vector para el clasificador tiene 1 + 4 + 13 + 1 = **19 dimensiones**.

### 5.4 Clasificador (`lib/classifier.ts`)
- **k-NN con k = 3**, distancia euclídea sobre características **normalizadas con z-score** (media y desviación de las 15 muestras de calibración, que se guardan junto a ellas).
- Voto ponderado por `1/d`. **Confianza** = peso de la clase ganadora / peso total.
- Si la distancia al vecino más cercano es mayor que 3× la distancia media entre muestras de la calibración, el golpe se marca como `unknown` y se descarta. Así una tos o un ruido no se convierten en caja.
- Implementación propia (unas 50 líneas). No compensa añadir una librería de ML.

### 5.5 Cuantización (`lib/quantize.ts`)
- `tCorr = onset.time − latencia`
- `paso = round((tCorr − t0) / semicorchea)`
- Se descarta si `paso < 0` o `paso ≥ 64`. Los golpes adelantados hasta media semicorchea antes del compás 1 caen en el paso 0.
- **Colisiones**: si dos golpes caen en el mismo paso, gana el de mayor fuerza × confianza. El beatbox es monofónico: un instrumento por paso.
- Salida: `Pattern` (64 pasos). La desviación de cada golpe respecto a la rejilla se guarda para diagnóstico (y para un swing futuro).

### 5.6 Latencia (`lib/latency.ts`)
- Recibe los tiempos de los clics programados y los onsets detectados. Empareja cada clic con el onset más cercano en `[−50, +400] ms`.
- Devuelve `{ latencyMs (mediana), meanMs, spreadMs, matched }` y si es válida según los criterios de §3.2.

### 5.7 Generador Strudel (`lib/strudel.ts`)
Como el beatbox es monofónico, **todo el patrón cabe en un solo `s()`**. Cada compás equivale a 1 ciclo de 16 pasos.

```js
setcpm(90/4)
s("<[bd ~ ~ ~ sd ~ ~ ~ bd ~ bd ~ sd ~ ~ ~] [bd ~ ~ ~ sd ~ ~ hh bd ~ bd ~ sd ~ hh ~]>")
  .bank("RolandTR909")
  .lpf(2400).room(0.3).delay(0.2).shape(0.25)
```

Reglas:
- `setcpm(BPM/4)`: 1 ciclo = 1 compás de 4/4.
- Si los 4 compases son iguales: `s("bd ~ ~ ~ …")` sin `< >`. Si se repiten (A B A B), se emiten solo los distintos en orden: `<[A] [B]>`. Si no, los 4.
- Un compás vacío se escribe como 16 `~`.
- `.bank()` según el kit: `RolandTR909`, `RolandTR808` y `AkaiMPC60` (ver §7.4). Son los nombres que Strudel ya carga por defecto, así que el código **suena en strudel.cc tal cual**.
- Efectos (confirmado): solo se añaden los que no están en neutro. El mapeo es aproximado (Filtro → `.lpf(Hz)`, Espacio → `.room()` y `.delay()`, Calor → `.shape()`) y un tooltip junto al código lo indica ("efectos aproximados: Strudel no tiene la misma cadena").
- Salida determinista y formateada; el test compara strings exactos.

### 5.8 Efecto de tecleo
- Cuando cambia el **patrón**, el panel teclea el código nuevo: unos 600 caracteres por segundo con un poco de variación y cursor parpadeante. Dura como mucho 1,2 s; si el texto es más largo, acelera.
- Cuando solo cambia una **rueda**, el sufijo `.lpf(…)` correspondiente se actualiza al instante con un breve destello en blanco, sin volver a teclear.
- Copiar siempre copia el texto completo aunque la animación no haya terminado.

---

## 6. Modelos de datos (`lib/types.ts`)

```ts
export type Instrument = 'bd' | 'sd' | 'hh'
export type KitId = '909' | '808' | 'acoustic'
export type StyleId = 'hiphop90' | 'house' | 'dnb'

export interface Style { id: StyleId; label: string; bpm: 90 | 124 | 174 }
export interface Kit { id: KitId; label: string; strudelBank: string; samples: Record<Instrument, string> }

export interface Onset { time: number; strength: number }      // time en s desde el inicio del buffer

export interface FeatureVector {
  centroid: number
  bands: [number, number, number, number]
  mfcc: number[]          // longitud 13
  zcr: number
  rms: number             // no entra en la distancia
}

export interface CalibrationSample { instrument: Instrument; features: FeatureVector }

export interface CalibrationData {
  version: 1
  createdAt: string       // ISO
  sampleRate: number
  samples: CalibrationSample[]                 // 15
  norm: { mean: number[]; std: number[] }      // z-score, 19 dims
  latency: { ms: number; spreadMs: number; measuredAt: string } | null
}

export interface ClassifiedHit {
  onset: Onset
  instrument: Instrument | 'unknown'
  confidence: number      // 0..1
}

export interface Pattern {
  stepsPerBar: 16
  bars: 4
  steps: (Instrument | null)[]   // longitud 64
  offsetsMs: (number | null)[]   // desviación respecto a la rejilla, diagnóstico
}

export interface Knobs { filter: number; space: number; warmth: number }   // 0..1

export interface Prefs {
  version: 1
  kit: KitId
  style: StyleId
  knobs: Knobs
  hideHeadphonesWarning: boolean
}
```

**Claves de `localStorage`** (todas las lecturas van en `try/catch` y se validan con un guard de tipo; si fallan, se tratan como vacías):
- `coderbeats:calibration:v1` → `CalibrationData`
- `coderbeats:prefs:v1` → `Prefs`
- `coderbeats:last-pattern:v1` → `Pattern` (para recuperar el último loop al recargar)

Si el `sampleRate` del dispositivo no coincide con el de la calibración (por ejemplo al cambiar de 44,1 a 48 kHz con unos cascos), se avisa y se recomienda recalibrar, porque los MFCC dependen de él.

---

## 7. Dependencias propuestas

> Ninguna se instala hasta que se apruebe la spec.

### 7.1 Producción

| Paquete | Versión | Licencia | Por qué |
|---|---|---|---|
| `tone` | `^15.1.22` | MIT | Transport con un reloj de muestra preciso, `Part` en loop, `Draw` para sincronizar lo visual, `Players`, `Filter`, `Reverb`, `FeedbackDelay`, `Distortion`, `Compressor`, `Limiter` y `rampTo`. Hacerlo a mano con Web Audio serían cientos de líneas. Se carga con `import()` dinámico tras **Empezar**, así que no pesa en la carga inicial. |
| `meyda` | `^5.6.3` | MIT | MFCC, centroide espectral, ZCR, RMS y espectro de amplitud, probados y documentados. Funciona sobre `Float32Array` en Node, así que se puede usar en los tests de Vitest sin navegador. |

### 7.2 Desarrollo

| Paquete | Versión | Licencia | Por qué |
|---|---|---|---|
| `vitest` | `^5.1.0` | MIT | Tests de `app/lib/` en entorno `node`. No hace falta `@nuxt/test-utils` porque la lógica pura no depende de Nuxt. |
| `vue-tsc` | `^3.3.14` | MIT | `nuxi typecheck` en modo estricto. |

### 7.3 Ya instalados, se aprovechan
- `@nuxt/fonts`: **Inter** (UI) y **JetBrains Mono** (código), las dos con licencia OFL y autoalojadas.
- `@nuxt/icon`: iconos de play, stop, copiar, etc. (colección `lucide`, que se descarga bajo demanda).
- `@vite-pwa/nuxt`: en el MVP solo genera el manifest con colores y nombre. El precache de samples queda fuera (§2).

### 7.4 Samples (repo [`ritchse/tidal-drum-machines`](https://github.com/ritchse/tidal-drum-machines))

Un archivo por instrumento y kit, descargado de `raw.githubusercontent.com/ritchse/tidal-drum-machines/main/machines/…`, renombrado a `bd.wav`, `sd.wav` y `hh.wav` y comprobado a oído antes de commitear. Propuesta inicial:

| Kit | Carpeta | bd | sd | hh (cerrado) |
|---|---|---|---|---|
| `909` | `RolandTR909` | `rolandtr909-bd/Bassdrum-01.wav` | `rolandtr909-sd/sd01.wav` | `rolandtr909-hh/hh01.wav` |
| `808` | `RolandTR808` | `rolandtr808-bd/BD0010.WAV` (cola larga) | `rolandtr808-sd/SD0010.WAV` | `rolandtr808-hh/CH.WAV` |
| `acoustic` | `AkaiMPC60` | `akaimpc60-bd/…` | `akaimpc60-sd/…` | `akaimpc60-hh/…` |

- **Kit acústico: AkaiMPC60** (decidido). El repo no tiene un kit acústico propiamente dicho, pero la MPC60 usa samples de batería real, encaja con el hip hop de los 90 y Strudel la reconoce como `bank("AkaiMPC60")`.
- **Licencia**: el repo **no declara licencia** (no tiene LICENSE y la API de GitHub devuelve `license: null`). Son grabaciones de hardware comercial recopiladas de varias fuentes.
  - **Decisión**: el MVP es de uso personal o demo, así que se usan con atribución en `public/samples/CREDITS.md` (repo, autor, ruta original de cada archivo y nota de que no hay licencia declarada).
  - Antes de un despliegue público habrá que sustituirlos por samples **CC0** o pedir permiso. La app no depende de qué archivos sean: basta con cambiarlos en la carpeta.
- Formato: se mantienen en WAV (entre 20 y 260 KB cada uno, menos de 1 MB en total). Se recortan los silencios del final si hace falta.

---

## 8. Diseño visual: premium minimalista

Mucho espacio vacío y pocos elementos. La base es blanco y negro. **El color solo aparece cuando significa algo: cada sonido tiene el suyo.**

### 8.1 Tokens
- **Neutros** (todo lo que no es un sonido):
  - fondo `#0B0B0F`, superficie elevada `#121217` (solo en la hoja de código y los menús), líneas `rgba(255,255,255,0.08)`,
  - texto principal `#F2F2F5`, secundario `#8C8C96` y terciario `#4A4A52` (ticks y etiquetas en reposo).
  - Botones, ruedas, selectores y cabezal son **blancos o grises**, nunca de color.
- **Color por instrumento**: tres pasteles con luminosidad y saturación parecidas para que ninguno destaque sobre los otros, todos con contraste ≥ 7:1 sobre `#0B0B0F`.

  | Sonido | Token | Color | En reposo (paso con golpe) |
  |---|---|---|---|
  | Bombo `bd` | `--c-bd` | rosa `#F496BC` | `rgba(244,150,188,0.35)` |
  | Caja `sd` | `--c-sd` | lila suave `#B9A6F2` | `rgba(185,166,242,0.35)` |
  | Platillo `hh` | `--c-hh` | azul claro `#8ECFF2` | `rgba(142,207,242,0.35)` |

  Los valores finales se ajustan a ojo en el dispositivo: el rosa no se toca, y el lila y el azul se mueven para quedar a la misma altura visual.
- **Glow**: sutil y **solo en lo que suena en ese instante**: `drop-shadow(0 0 8px <color> / 0.45)` durante unos 180 ms. Nada brilla en reposo.
- **Grano**: SVG `feTurbulence` generado una vez como fondo **estático** con opacidad 0,025. Apenas se percibe y no se anima.
- Tipografía: Inter 400/500 y JetBrains Mono 400. Pocas tallas: 12, 14, 20 y 40 px. Las etiquetas van en mayúsculas pequeñas con `letter-spacing: 0.08em`. Todo se define en `tailwind.config.ts` (`font-sans`, `font-mono`, colores como tokens).

### 8.2 Anillo de 16 pasos (elemento central)
- SVG con 16 puntos finos en círculo. Los pasos vacíos son un punto gris terciario de 2 px. Los tiempos 1, 5, 9 y 13 llevan un tick un poco más largo.
- Paso con golpe: un punto de **color de su instrumento** en reposo (35 %), con un tamaño distinto por instrumento (bd 10 px, sd 8 px, hh 6 px). Así se distinguen también sin depender del color.
- Al sonar: el punto pasa al 100 % de su color con glow y escala de 1 a 1,3 a 1 en 180 ms.
- **Cabezal**: una línea fina blanca desde el centro (u opcionalmente un arco corto) que gira con el Transport. El ángulo se calcula en el bucle rAF desde `Transport.progress` y se aplica con `transform: rotate()`.
- En el centro solo el BPM en grande (40 px, peso 400) y debajo cuatro guiones para el compás 1-4 (el actual en blanco y los demás en gris).
- Durante la cuenta atrás, el centro muestra 4, 3, 2, 1 en blanco. Durante la grabación, un trazo blanco fino recorre el anillo como progreso.
- **Fondo audio-reactivo**: con cada `bd`, un degradado radial **rosa** muy tenue detrás del anillo sube de opacidad (de 0 a 0,10) y baja en unos 250 ms. Se controla con una variable CSS desde el bucle rAF. Ningún otro instrumento tiñe el fondo.

### 8.3 Ruedas
- Tres ruedas (unos 80 px en móvil y 104 px en escritorio): arco fino de 270° en gris terciario con el recorrido en **blanco**, sin glow. Debajo, la etiqueta en mayúsculas pequeñas y el valor en gris secundario, que solo aparece mientras se gira.
- Interacción: arrastre vertical con pointer events y `touch-action: none`, rueda del ratón y teclado (flechas). Doble toque devuelve el valor por defecto.
- Accesibilidad: `role="slider"` con `aria-valuenow`.

### 8.4 Panel de código
- Mono 13 px en gris secundario, sin caja ni borde en escritorio. Los nombres de sample se colorean con su instrumento (`bd` rosa, `sd` lila, `hh` azul): es el mismo código de color que en el anillo. Los `~` van en gris terciario.
- Cursor de bloque blanco parpadeante. Botón **Copiar** como icono, que cambia a "Copiado" durante 1,5 s. Al lado, un icono `ⓘ` con el tooltip de efectos aproximados (§5.7).
- En móvil está **colapsado por defecto** en una línea (`s("bd ~ ~ …` cortado) y se despliega como hoja inferior sobre la superficie `#121217`.

### 8.5 Microanimaciones
- Pocas y discretas: transiciones de 150 a 250 ms con `cubic-bezier(.2,.8,.2,1)`, botones con opacidad u escala 0,98 al pulsar y el kit activo marcado con un subrayado blanco que se desliza.
- Drop: la rueda de Filtro baja visualmente y el botón parpadea en blanco hasta el siguiente compás.
- Se respeta `prefers-reduced-motion`: sin latido de fondo y tecleo instantáneo.

### 8.6 Layout móvil (mobile-first, sin scroll en vertical)
En 100dvh, con `env(safe-area-inset-*)`. Mucho aire: el anillo ocupa el centro y el resto se reduce al mínimo.

```
┌───────────────────────────┐
│ coderbeats      909 808 AC│  cabecera: kit (texto, activo subrayado)
│                 HH HOUSE DNB│  estilo
│                           │
│                           │
│        ·  ·  ▏ ·  ·       │
│      ·             ·      │  anillo: min(76vw, 40dvh)
│     ·       90      ·     │
│      ·     — — — —  ·     │
│        ·  ·  ·  ·  ·      │
│                           │
│                           │
│   FILTRO  ESPACIO  CALOR  │  3 ruedas
│                           │
│     ↺        ▶      DROP  │  transporte; ● grabar si no hay patrón
│ s("bd ~ ~ ~ sd …       ⧉ ⌃│  código colapsado
└───────────────────────────┘
```

- Objetivo mínimo: 360 × 640 sin scroll. En pantallas bajas el anillo encoge (se limita por `dvh`).
- En escritorio (≥ 1024 px): el anillo grande a la izquierda y las ruedas y el código desplegado a la derecha, con márgenes generosos.

---

## 9. Móvil y compatibilidad

- **Navegadores objetivo**: Chrome Android (últimas 2 versiones) y Safari iOS 17+. En escritorio: Chrome, Firefox y Safari actuales.
- **iOS Safari**:
  - El `AudioContext` se crea o reanuda dentro del gesto **Empezar** (`Tone.start()`).
  - Con el micro abierto, iOS pasa la sesión a "play-and-record" y puede sacar el audio por el auricular o bajar el volumen. Se usa `navigator.audioSession.type = 'play-and-record'` al grabar y `'playback'` después cuando la API existe (Safari 16.4+). Además se paran las pistas del micro al terminar cada grabación.
  - Si la pestaña pasa a segundo plano, el contexto se suspende. Al volver se reanuda con un toque ("Toca para continuar").
  - El interruptor de silencio del iPhone puede silenciar Web Audio. Se avisa si tras Play no hay salida.
- **HTTPS**: `getUserMedia` solo funciona en contexto seguro. Para probar en el móvil durante el desarrollo: `nuxt dev --https` (certificado autofirmado) o un túnel (por ejemplo `cloudflared`). Se documentará en el README.
- **Cascos con cable** recomendados en Inicio, en calibración y en el aviso antes de grabar. Si se graba sin cascos, el clic del metrónomo entra por el micro. Para mitigarlo, el clic es corto (5 ms) y agudo, pero no se elimina: en el MVP solo se avisa.
- `sampleRate`: se usa el nativo del dispositivo, sin forzar 44,1 kHz.

---

## 10. Tests (Vitest, entorno `node`)

`tests/helpers/synth.ts` genera audio sintético determinista (PRNG con semilla):
- **bum**: seno de 60 a 45 Hz con envolvente exponencial (τ = 80 ms),
- **pff**: ruido filtrado en banda (1–4 kHz) con ataque rápido (τ = 40 ms),
- **ts**: ruido paso alto (> 6 kHz) muy corto (τ = 25 ms),
- **clap**: ráfaga de ruido de banda ancha,
- ruido de fondo blanco a −60 dBFS.

| Archivo | Casos |
|---|---|
| `onsets.test.ts` | detecta N golpes colocados en tiempos conocidos con error ≤ 5 ms · 0 onsets en silencio con ruido de fondo · respeta la separación mínima de 60 ms · golpes suaves (−30 dBFS) detectados · funciona a 44,1 y a 48 kHz |
| `features.test.ts` | centroide de "ts" > "pff" > "bum" · la banda < 150 Hz domina en "bum" · vector de 19 dimensiones sin `NaN` · la amplitud no cambia la distancia (×0,25 de ganancia) |
| `classifier.test.ts` | 3 clusters sintéticos → 100 % de acierto · k = 3 con voto ponderado · `unknown` para un punto lejano · normalización z-score correcta · leave-one-out · desviación 0 en una dimensión sin dividir por cero |
| `quantize.test.ts` | redondeo a la semicorchea más cercana · bordes (±media semicorchea) · compensación de latencia · se descartan los golpes fuera de los 64 pasos · colisión: gana fuerza × confianza · los `unknown` se ignoran |
| `latency.test.ts` | mediana de 4 · ≥ 3 emparejados para ser válido · dispersión > 60 ms inválida · ventana de emparejamiento |
| `strudel.test.ts` | snapshot exacto del ejemplo · 4 compases iguales → sin `< >` · A B A B → `<[A] [B]>` · compás vacío → 16 `~` · `setcpm` por estilo · `.bank` por kit · los efectos neutros se omiten · formateo numérico estable |
| `knobs.test.ts` | mapeo exponencial del filtro (0 → 120 Hz, 1 → 18 kHz, monótono) y rangos de Espacio y Calor |
| `pipeline.test.ts` | integración pura: buffer sintético de 4 compases con un patrón conocido (bum/pff/ts) + calibración sintética + latencia simulada de 80 ms → el `Pattern` resultante coincide exactamente |

No hay tests de micro real, de Web Audio ni de componentes en el MVP.

Scripts nuevos en `package.json`: `test` (`vitest run`), `test:watch` y `typecheck` (`nuxi typecheck`).

---

## 11. Criterios de aceptación

### Funcionales
1. **Empezar**: en iOS Safari y Chrome Android, tras pulsar **Empezar** suena el metrónomo y el micro queda activo. Si se deniega el permiso aparece un mensaje claro y un botón de reintentar.
2. **Latencia**: con 4 palmadas se obtiene un valor que se muestra en ms y se guarda. Una toma con < 3 palmadas o dispersión > 60 ms se rechaza con un mensaje.
3. **Calibración de sonidos**: se graban 5 tomas por sonido, se muestra la precisión leave-one-out y, al recargar la página, la calibración sigue (no se vuelve a pedir).
4. **Grabación**: 1 compás de cuenta atrás y 4 de grabación a 90 BPM, sea cual sea el estilo. El aviso de cascos aparece antes (salvo si se ha marcado "no volver a mostrar").
5. **Precisión**: con un beatbox razonable, cascos con cable y calibración hecha, ≥ 90 % de los golpes acaban en el paso y el instrumento correctos. Se verifica a mano con 3 patrones de referencia (básico de hip hop, four-on-the-floor y amen simplificado) documentados en `specs/001-mvp/manual-test.md`.
6. **Reproducción**: el loop suena al tempo del estilo (90, 124 o 174) sin cortes al cerrar el ciclo, y cambiar de kit no corta el loop.
7. **Ruedas**: las tres modifican el sonido de forma audible y sin chasquidos, y su valor se guarda entre sesiones.
8. **Drop**: el filtro se cierra al pulsar y se abre exactamente en el primer tiempo del compás siguiente (comprobado a oído y con log del Transport en desarrollo).
9. **Código**: el texto generado, pegado en strudel.cc, suena con el mismo patrón y el mismo kit. El botón Copiar funciona en iOS y en Android.
10. **Regrabar** sustituye el patrón y vuelve a teclear el código.

### No funcionales
11. **60 fps**: en un Android de gama media (por ejemplo Pixel 6a) con el loop sonando, el panel Performance de Chrome no muestra frames largos de más de 16,7 ms en el bucle de animación durante 10 s.
12. **Sin scroll** en vertical a 360 × 640 y 390 × 844 con el código colapsado.
13. **SSR seguro**: `nuxt generate` termina sin errores y ningún módulo de audio se evalúa en el servidor.
14. **Tipos**: `npm run typecheck` sin errores con `strict: true`.
15. **Tests**: `npm test` pasa en verde y la cobertura de `app/lib/` es ≥ 85 % de líneas.
16. **Carga**: el JS inicial (antes de **Empezar**) pesa ≤ 150 KB gzip; Tone y Meyda se cargan después.
17. **Accesibilidad básica**: los controles se pueden usar con teclado, las ruedas son `role="slider"`, el contraste de texto es AA y se respeta `prefers-reduced-motion`.

---

## 12. Plan de implementación (reordenado el 2026-11-12: primero que suene)

### Fase A: versión que suena (UI básica, para probar con la voz)
1. Base: renombrar el paquete, `strict`, `routeRules`, dependencias y Vitest.
2. `lib/` puro **que usa esta versión** y sus tests: types, onsets, features, classifier, quantize, latency, strudel y pipeline.
3. Audio: AudioWorklet de captura, metrónomo, kits con `Tone.Players` y loop con `Tone.Sequence` (sin cadena de efectos).
4. UI funcional sin pulir: Empezar → calibración de latencia → calibración de sonidos → grabar (estilo) → loop con selector de kit, play/stop, regrabar y código Strudel con botón de copiar. Rejilla simple de 16 pasos en lugar del anillo.
5. **Hito: lo pruebas con tu voz** y ajustamos umbrales y clasificador con lo que salga.

### Fase B: después de la prueba
6. Cadena de efectos, las tres ruedas (`lib/knobs.ts` y sus tests), drop y efectos en el código Strudel.
7. UI premium minimalista (§8): anillo, ruedas, código con tecleo, grano y latido.
8. Persistencia de prefs y del último patrón, avisos de iOS y pruebas en dispositivos (Chrome Android y Safari iOS).

Cada paso termina con un commit.

---

## 13. Decisiones tomadas (antes preguntas abiertas)

1. **Kit acústico**: AkaiMPC60.
2. **Samples**: uso personal o demo → tidal-drum-machines con atribución en `public/samples/CREDITS.md`. Habrá que revisarlo antes de un despliegue público.
3. **Swing**: no entra en el MVP; queda como siguiente paso (§2).
4. **Efectos en el código Strudel**: sí, aproximados y con tooltip (§5.7, §8.4).
5. **Estilo**: premium minimalista en blanco y negro, con un color por sonido (§8). Sustituye a "estudio nocturno".

---

## 14. Hoja de ruta (después del MVP)

En este orden. **Cada punto tendrá su propia spec** (`specs/00N-…/spec.md`) cuando le toque; aquí solo se fija la prioridad.

1. **Exportar a WAV**: render del loop con el kit y los efectos actuales.
2. **Swing y más estilos**: swing por estilo y nuevos estilos, empezando por **rock (~120 BPM) con el kit acústico**.
3. **Varias capas**: grabar más pasadas encima del patrón y combinarlas.
4. **Tararear el bajo**: detección de tono de la voz y **ajuste a escala tipo autotune** para convertirla en una línea de bajo.
5. **Loop crudo estilo RC-505**: grabar la voz tal cual, sin convertirla en batería, en capas, con efectos (reverb, delay, filtro, pitch, robot).
6. **Precisión**: editar pasos tocando el anillo, **aprender de mis correcciones** (que pasen a ser muestras de calibración) y usar el **contexto musical** para desempatar golpes dudosos (por ejemplo, bombo en tiempo fuerte o caja en 2 y 4).

La lista de "Fuera del MVP" de §2 queda como referencia; el orden lo fija esta hoja de ruta.

---

## 15. Enmienda 1: modo looper

> Estado: **aprobada** (2026-11-12), con las decisiones de §15.10.
> **Sustituye** a §3.4 (Grabación), §3.5 (Análisis), §5.1 (Tiempos de grabación), el `Pattern` de §6, los criterios 4, 5, 6 y 10 de §11 y la fase A de §12.
> **Adapta** §5.2 (onsets), §5.5 (cuantización) y §5.7 (Strudel).
> **No cambia**: calibración de latencia (§3.2), calibración de sonidos (§3.3), features y k-NN (§5.3, §5.4), kits, estilos, diseño (§8) ni la hoja de ruta (§14).

### 15.1 Motivo
El prototipo reconoce bien los sonidos, pero no se siente en directo: grabas 4 compases, esperas y escuchas. Pasamos a un looper tipo RC-505: el loop gira sin parar y cada golpe se detecta, se ve y se añade mientras tocas.

### 15.2 Diagnóstico: ¿por qué 48 onsets en 4 compases?

Hay dos causas, comprobadas con audio sintético (no con tu toma):

1. **El metrónomo entra por el micro.** Un clic que llega al micro a −30 dBFS o más se detecta en el **100 % de los casos**: 20 de 20, que son los 4 de la cuenta atrás y los 16 de la grabación. Además se clasifica como uno de tus sonidos. A −40 dBFS ya no se detecta. Con altavoces, o con cascos abiertos a volumen alto, −30 dBFS es fácil de alcanzar. Los clics de la cuenta atrás también quedan en el buffer: no llegan a la rejilla, pero sí suman al recuento de onsets. **20 clics más unos 28 golpes reales dan unos 48**, que encaja con lo que viste.
2. **Doble disparo del "bum".** La explosiva "b" y la vocal "um", unos 70 ms después, dan **2 onsets** en la simulación. La separación mínima actual (60 ms) es demasiado corta. A 90 BPM una semicorchea dura 167 ms, así que el segundo onset cae en el mismo paso o en el siguiente. Eso son los "bombos seguidos".

**Cómo confirmarlo con tu toma sin tocar código** (tabla Diagnóstico):
- Los onsets con `t` menor de unos 3,0 s están en la cuenta atrás, donde tú no hablas: son el metrónomo entrando por el micro.
- Las parejas de "bum" separadas menos de 0,15 s son dobles disparos.

**Correcciones (entran en esta enmienda):**
- **a) Prueba de eco** al pulsar Empezar: suenan 3 clics con el micro abierto.
  - Si se detectan (al menos 2 de 3, **con retrasos consistentes**: dispersión ≤ 15 ms, porque un eco real siempre llega con el mismo retraso y el ruido casual no), aparece el aviso "el micro oye los altavoces: usa cascos".
  - Con lo mismo se mide la **latencia pura del sistema** (salida + entrada), separada de tu tiempo de reacción.
- **b) Filtro de eco** (solo se activa si la prueba de eco detecta que el micro oye la salida):
  - Sabemos cuándo suena cada clic y cada sample. Se descartan los onsets que caen a ±25 ms del momento en que debería llegar su eco.
  - Excepción: si superan en +10 dB el nivel de eco medido, se aceptan. Cuando tocas a la vez que el loop, tu voz pegada al micro suena más fuerte que el eco.
- **c) Anti-doble disparo**: periodo refractario (gana el **primer** onset, que es el ataque, y así se decide sin esperar) ligado a la rejilla de grabación, `clamp(0,6 × celda, 60 ms, 120 ms)`. Sale 100 ms en hip hop 90, 72 ms en house 124 y 103 ms en drum and bass (celda de corchea).
- **d) Puerta relativa**: se descartan los onsets más de 24 dB por debajo de la mediana de los últimos 8 golpes (respiraciones, chasquidos de labios). Es un valor ajustable.
- **e) Botón "Descargar toma"** (solo en desarrollo): baja el WAV y un JSON con los onsets, para ajustar umbrales con tus grabaciones reales.

### 15.3 Flujo looper
Pantalla de estudio:
- **Duración del loop**: 1 compás (por defecto) o 2.
- **Tempo**: el que marca el estilo (90, 124 o 174 BPM). **Se graba al tempo del estilo**, así que desaparece la regla de grabar siempre a 90 BPM.
- **Rejilla de grabación por estilo**: hip hop y house cuantizan a semicorcheas. **Drum and bass cuantiza a corcheas al grabar** (172 ms a 174 BPM, la sensación de medio tiempo típica del dnb). El loop suena a 174 y el patrón se guarda igualmente en 16 pasos por compás; los golpes solo caen en los pasos pares.
- **▶ Play / ■ Stop**: el loop gira sin parar y el cabezal no se detiene nunca. Al parar se conserva el patrón.
- **Metrónomo**: interruptor que se puede cambiar sin cortar el loop.
- **● Overdub** (grabar/pausar):
  - Con el overdub activado, cada golpe detectado se añade. Desactivado, puedes tocar encima sin añadir nada.
  - Si pulsas REC con el loop parado, suena 1 compás de cuenta atrás y luego arrancan el loop y la grabación.
  - Si pulsas REC con el loop en marcha, la grabación empieza al instante.
- **Cada golpe**, unos 100 ms después de hacerlo:
  - se enciende en la rejilla como *pendiente* (contorno de su color),
  - aparece en el código en ese mismo instante, con un destello,
  - **suena desde la siguiente vuelta**, en su paso cuantizado. A partir de ahí la rejilla lo muestra relleno.
- **Capas**: cada vuelta con el overdub activado en la que entra al menos un golpe nuevo es una capa.
  - **Deshacer capa** quita la última capa. Se puede repetir y funciona con el loop sonando.
  - **Borrar todo** deja el loop vacío, pero sigue girando.
- **Cambiar de 1 a 2 compases** duplica el compás. **De 2 a 1** pide confirmación si el segundo compás tiene golpes.
- El kit (y en la fase B las ruedas y el drop) cambia en vivo.
- El flujo anterior (grabar 4 compases, analizar y reproducir) **desaparece de la UI**. El análisis offline se queda en `lib/` para la calibración y los tests.

### 15.4 Arquitectura de streaming

```
mic → AudioWorklet (captura) ──MessageChannel──► Web Worker de análisis
                                                 StreamingOnsetDetector → features → k-NN → filtro de eco
                                                         │ LiveHit { frame, instrument, confidence, strength }
hilo principal ◄─────────────────────────────────────────┘
  LooperEngine: frame → tiempo de contexto → − latencia → vuelta y paso del loop → capa actual
  Tone.Transport (loop de 1m/2m) + Sequence de 16/32 pasos que dispara los golpes activos
```

- **El análisis va en un Web Worker** y el hilo principal solo pinta.
  - El worklet manda bloques de unas 512 muestras (unos 10 ms) **directamente al worker** por un `MessageChannel`, sin pasar por el hilo principal.
  - Meyda funciona en el worker (no usa el DOM). El clasificador se construye en el worker a partir de la calibración que se le pasa al arrancar.
- **`lib/streamingOnsets.ts`** (puro):
  - Es el mismo algoritmo de §5.2, pero incremental.
  - Necesita mirar por delante: 8 frames de mediana (unos 43 ms) más la ventana de features (2048 muestras, unos 43 ms). Por eso **decide unos 100 ms después del golpe** (objetivo: ≤ 120 ms).
  - El ruido de fondo es el percentil 10 de los últimos 3 s.
- **Tiempos**:
  - `t = frame / sampleRate` (el reloj del AudioContext) y `tCorr = t − latencia`.
  - El Transport registra en qué tiempo de contexto empieza cada vuelta.
  - `paso = round(((tCorr − inicioVuelta) mod duraciónLoop) / semicorchea) mod N`.
- **Capa de un golpe**: la vuelta en la que lo hiciste (por `tCorr`). Deshacer capa quita lo que hiciste en esa vuelta.
- **"Suena desde la siguiente vuelta"**: cada golpe guarda `activeFromLap = vuelta cuantizada + 1`, y la Sequence solo lo dispara a partir de esa vuelta. La vuelta cuantizada es la del instante de la rejilla al que se redondea: un golpe un poco adelantado al 1 pertenece musicalmente a la vuelta siguiente, así que empieza a sonar una vuelta después. Así nunca suena encima de tu propia voz.
- Con REC desde parado, los golpes de la cuenta atrás que se redondean al paso 0 de la primera vuelta cuentan. El resto se descartan.
- **Duplicados**: si ese instrumento ya está en ese paso (en cualquier capa), el golpe se ignora y solo hay un destello visual. Dentro de una misma vuelta el beatbox es monofónico: si caen dos instrumentos en un paso, gana el más fuerte.
- **Filtro de eco**: el hilo principal manda al worker la lista de eventos de salida programados (clics y samples), con su tiempo de contexto y el nivel esperado.

### 15.5 Modelo de datos (sustituye a `Pattern`)

```ts
export type LoopBars = 1 | 2

/** worker → hilo principal */
export interface LiveHit {
  frame: number
  instrument: Instrument | 'unknown'
  confidence: number
  strength: number
}

export interface LoopHit {
  step: number            // 0..bars*16-1
  instrument: Instrument
  layerId: number
  activeFromLap: number
  strength: number
  confidence: number
  offsetMs: number        // desviación respecto a la rejilla (para el swing futuro)
}

export interface Layer { id: number; lap: number; hits: LoopHit[] }

export interface Loop {
  bars: LoopBars
  stepsPerBar: 16
  layers: Layer[]
}
```

- Derivado: `stepsOf(loop): Instrument[][]`, con **polifonía por paso**, porque varias capas pueden apilar `bd` y `hh` en el mismo paso.
- Persistencia: `coderbeats:loop:v1` guarda el último loop.

### 15.6 Código Strudel (adapta §5.7)
Con capas hay polifonía, así que el código pasa a tener **una línea por instrumento** dentro de `stack()`:

```js
setcpm(90/4)
stack(
  s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~"),
  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~"),
  s("hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~"),
).bank("RolandTR909")
```

- Solo aparecen los instrumentos con golpes. Si solo hay uno, no se usa `stack`: queda `s("…").bank("…")`.
- Con 2 compases cada línea es `"<[compás 1] [compás 2]>"`, y se colapsa a uno si los dos son iguales.
- Cada golpe nuevo cambia su token en el sitio, con un destello, sin volver a teclear todo. El tecleo completo se usa solo al cargar o al deshacer o borrar. Los efectos de las ruedas siguen como en §5.7 (fase B).

### 15.7 Tests nuevos
- **streamingOnsets**: mismo resultado que el detector offline (±1 ms) metiendo el buffer en trozos de tamaño aleatorio. La decisión llega ≤ 120 ms después del golpe.
- **Anti-doble disparo**: un "bum" con explosiva separada da 1 onset. En house 124 (separación mínima de 72 ms), dos golpes a 90 ms siguen siendo 2.
- **Filtro de eco**: descarta los onsets en los tiempos de eco esperados y conserva un golpe simultáneo 10 dB más fuerte.
- **looper** (estado puro, `lib/looper.ts`):
  - cálculo de vuelta y paso con latencia y paso por el 0,
  - `activeFromLap`,
  - duplicados y colisiones dentro de una vuelta,
  - deshacer capa, borrar todo y cambio entre 1 y 2 compases.
- **strudel**: `stack` por instrumento, una sola línea si solo hay un instrumento y 2 compases.

### 15.8 Criterios de aceptación (sustituyen a los 4, 5, 6 y 10 de §11)
1. Tras Play, el loop gira indefinidamente sin cortes. Encender o apagar el metrónomo no lo corta.
2. Con el overdub activado, cada golpe se enciende en la rejilla y aparece en el código **≤ 150 ms** después de hacerlo. En desarrollo se registra el tiempo desde el onset hasta que se pinta.
3. El golpe suena desde la vuelta siguiente, en su paso cuantizado, y **nunca en la misma vuelta**.
4. Deshacer capa quita exactamente los golpes de la última capa. Borrar todo deja el loop vacío y girando.
5. Con el overdub desactivado se puede tocar encima sin que se añada nada.
6. Con cascos con cable, un patrón de hip hop de 1 compás hecho en una vuelta a 90 BPM: **≥ 90 %** de los golpes en su paso e instrumento, y **0 golpes fantasma** del metrónomo en 8 vueltas.
7. Sin cascos (altavoces): la prueba de eco avisa. Con el filtro de eco activo el loop no se retroalimenta: 8 vueltas con el overdub activado y tú en silencio dan **0 golpes nuevos**.
8. El análisis va en el worker y no hay tareas largas de más de 50 ms en el hilo principal con el loop sonando.

### 15.9 Plan (nueva fase A2, entre la A y la B)
- **A2.1** `lib/`: streamingOnsets, anti-doble disparo, filtro de eco, estado del looper y Strudel con `stack`, con sus tests.
- **A2.2** Worker de análisis, canal entre worklet y worker, y prueba de eco.
- **A2.3** LooperEngine con Tone: loop de 1 o 2 compases, metrónomo y `activeFromLap`.
- **A2.4** UI básica: play/stop, overdub, metrónomo, 1/2 compases, deshacer capa, borrar todo, rejilla y código en vivo, y descargar toma.
- **A2.5** Lo pruebas con tu voz. Después, la fase B (diseño, ruedas y drop) sigue igual.

### 15.10 Decisiones (antes preguntas abiertas)
1. **REC con el loop parado**: 1 compás de cuenta atrás.
2. **Drum and bass a 174**: el loop suena a 174 con rejilla de 16, pero al grabar cuantiza a corcheas (172 ms). El patrón se guarda en 16 pasos (§15.3).
3. **Metrónomo**: encendido por defecto, salvo que la prueba de eco detecte que el micro oye los altavoces.
4. **Tomas de diagnóstico**: solo en local, fuera de git. Si se usan como fixtures van en `tests/fixtures/voice/`, que está en `.gitignore`, y los tests que las usan se saltan si la carpeta no existe.

---

## 16. Enmienda 2: un instrumento para jugar

> Estado: **aprobada** (2026-11-12). Motor @strudel/web y licencia AGPL-3.0 confirmados; también el interruptor de fondo, el filtro por evento y el código congelado.
> **Cambia el concepto**: coderbeats deja de ser una herramienta de producción y pasa a ser un **instrumento para jugar con el sonido**. Lo que haces suena, se queda girando y se ve como gotas en el agua.
> **Sustituye** de la enmienda 1: el botón Grabar/overdub, las capas por vuelta y "deshacer capa", el loop único de 1 o 2 compases y la rejilla en la vista principal (§15.3, partes de §15.5 y §15.6).
> **Sustituye** de la spec base: el anillo de 16 pasos y el latido de fondo (§8.2) y el layout de §8.6.
> **Mantiene** lo que funciona: calibración de latencia y de sonidos, detección en streaming, clasificación k-NN, filtro y prueba de eco, compensación de latencia y worker de análisis.

### 16.1 Loops libres

**Frase.** Es un grupo de golpes seguidos. El tempo y la rejilla son globales (los del estilo), y las frases se cortan por compases:
- Una frase **empieza** en el compás de su primer golpe. Un golpe un poco adelantado al 1 cuenta para el compás siguiente.
- Una frase **se cierra** en una línea de compás si en los **últimos 2 tiempos no ha habido ningún golpe**, o al llegar a **4 compases**. El silencio de cierre se ajusta en ajustes: **1 tiempo, 2 tiempos (por defecto) o 1 compás**.
- La longitud del loop es la de la frase **redondeada hacia arriba a 1, 2 o 4 compases**.
- Ejemplo: un bombo en 1 y 3 deja 2 tiempos de silencio al final del compás, así que nace un loop de 1 compás al instante. Si tocas sin parar 2 compases, nace un loop de 2.

**Nacimiento.**
- Al cerrarse la frase nace un **loop por cada instrumento** de la frase (decidido): un "bum pff ts" da 3 loops, uno de cada color.
- El loop empieza a sonar en la **siguiente línea de compás**. Nunca suena encima de lo que acabas de hacer.
- Cada loop conserva su **fase**: su compás 1 cae en el mismo sitio relativo a los demás loops que cuando lo tocaste. Así varios loops de distinta longitud (1, 2, 4) encajan entre sí.

**Sin duplicados.** Si la frase nueva repite lo que ya hace un loop activo (mismo instrumento, misma longitud y ≥ 80 % de golpes en los mismos pasos), no nace otro loop. El existente "brilla" como confirmación. Así, repetir tu patrón no apila copias.

**Varios del mismo instrumento.** Se permiten: 3 loops de bombo distintos conviven, cada uno como un objeto propio.

**Objetos en pantalla.**
- **Tocar** un loop lo silencia o lo activa, con un fundido de 30 ms al siguiente golpe.
- **Mantener pulsado 600 ms** lo borra: un anillo se completa mientras mantienes y el loop se disuelve en una onda.

**Máximo: 8 loops a la vez** (activos más silenciados).
- **Mezcla**: 8 capas percusivas ya están cerca del límite de lo que se distingue con 3 timbres. Con más, el auto-mix tendría que bajar tanto cada loop que todos sonarían flojos.
- **Pantalla**: en un móvil, 8 objetos flotando todavía se tocan bien con el dedo (unos 44 px de diana) sin taparse.
- **Rendimiento**: disparar samples cuesta poco. El límite real son las gotas: 8 loops a 16 pasos dan hasta unas 50 gotas por segundo en drum and bass, que la simulación de agua aguanta en el móvil.
- **Al llegar al máximo**: si nace otro, primero se borra el loop silenciado más antiguo. Si no hay ninguno silenciado, se desvanece el loop más antiguo (fundido de 1 compás).

### 16.2 Interruptor "ayuda" (activado por defecto)

**Cuantización con criterio de estilo.**
- Cada estilo define, por instrumento, cuánto "atrae" cada paso del compás (prior). Para cada golpe se elige el paso con mayor `log(prior) − (distancia en pasos)² / (2σ²)`, con σ = 0,35 pasos.
- **Nunca mueve un golpe más de 1 paso** de donde lo hiciste.

| Estilo | Bombo | Caja | Platillo |
|---|---|---|---|
| hip hop 90 | fuerte en 1; medio en 3 y en "y del 2" (paso 10) | fuerte en 2 y 4 (pasos 4, 12) | corcheas |
| house 124 | **negras** (0, 4, 8, 12) muy fuertes | 2 y 4 | contratiempos (2, 6, 10, 14) |
| drum and bass 174 | 1 y "y del 3" (pasos 0, 10) | **2 y 4** (4, 12) muy fuertes | corcheas |

En drum and bass, además, se graba en corcheas (§15.3).

**Golpe suelto → patrón típico.** Si una frase tiene **un solo golpe** de un instrumento, ese loop se convierte en el patrón típico del estilo para ese instrumento (1 compás):

| Estilo | bum | pff | ts |
|---|---|---|---|
| hip hop 90 | `bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~` | `~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~` | `hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~` |
| house 124 | `bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~` | `~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~` | `~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~` |
| drum and bass 174 | `bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~` | `~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~` | `hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~` |

Las tablas viven en `lib/styles.ts` y se pueden ampliar (la hoja de ruta prevé más estilos).

**Mezcla automática.**
- Cada loop activo se multiplica por `g(n) = 1/√n`, donde n es el número de loops activos, más un balance fijo por instrumento: bd 0 dB, sd −1 dB, hh −6 dB.
- Los cambios de ganancia se hacen en rampa de 200 ms.
- Al final de la cadena va un **Limiter a −1 dBFS**, también con la ayuda desactivada, para que nunca sature.

**Con la ayuda desactivada.**
- **Se respeta tu ritmo exacto**: cada golpe suena en su posición real dentro del compás, con la latencia compensada pero sin cuantizar.
- No hay patrones típicos ni prior de estilo. La mezcla automática y el limitador se mantienen.
- El código Strudel se aproxima a la semicorchea más cercana y lo indica ("ritmo exacto: el código está cuantizado").

### 16.3 Visual: agua

- **Toda la pantalla es una superficie de agua** oscura (`#0B0B0F`), minimalista, sin bordes ni paneles por encima salvo los controles mínimos (§16.4).
- **Gotas**: cada golpe que suena cae como una gota **en la posición de su loop** y genera ondas del color de su instrumento (rosa bombo, lila caja, azul platillo). Las ondas de varios loops se cruzan e interfieren.
- **Loops**: pequeñas formas (círculos de 28 a 36 px) que **flotan a la deriva** despacio, sin salirse de la pantalla y apartándose entre sí. Al sonar su golpe **vibran** (pulso de escala de 1 a 1,15, 120 ms).
  - Un loop silenciado se ve hueco y apagado, y no suelta gotas.
  - Con varios del mismo instrumento, se distinguen por tamaño, que crece con el número de golpes del loop.
- **Simulación**, en `components/water/`:
  1. **WebGL2**: campo de alturas 2D (ecuación de onda discreta con amortiguación) en texturas half-float con ping-pong.
     - **Un canal por instrumento** (R = bombo, G = caja, B = platillo). Así cada onda conserva su color y se cruzan de forma natural.
     - Pasada de render: el color es la suma de las alturas de cada canal por el color de su instrumento, con un brillo especular sutil a partir del gradiente.
     - Resolución de simulación reducida: unas 256 celdas en el lado largo, escaladas con filtrado. Se ajusta automáticamente si el frame pasa de 14 ms.
  2. **Respaldo WebGL1** (sin texturas flotantes renderizables): ondas **analíticas**. El shader suma anillos amortiguados de las últimas 48 gotas, pasadas como uniforms. No hay reflexiones, pero sí cruces.
  3. **Respaldo Canvas 2D**: anillos que se expanden con `globalCompositeOperation: 'lighter'`.
- **Rendimiento**: un solo bucle `requestAnimationFrame`, `devicePixelRatio` limitado a 2, y pausa con `visibilitychange`. Las gotas se programan con `Tone.Draw` para que coincidan con el audio.
- **`prefers-reduced-motion`**: sin simulación ni deriva. Los loops quedan fijos y cada golpe es un breve aumento de opacidad del loop, sin ondas.

### 16.4 Menos botones

- **El micro escucha siempre que suena el loop**: con Play activo, todo lo que haces genera frases y loops. **Desaparece el botón Grabar.** Con Stop, el micro no escucha.
- **Vista principal**: Play/Stop (centro abajo), el interruptor **fondo** junto a Play (§16.11), estilo y kit (arriba, en texto pequeño), un icono de **ajustes** y la pestaña **"ver código"**.
- **Gestos sobre el agua** (sustituyen a las ruedas de la fase B), sobre cualquier zona que no sea un loop:
  - **Arrastrar en vertical = Filtro**: arriba abre y abajo cierra (paso bajo de 200 Hz a 18 kHz, exponencial).
  - **Arrastrar en horizontal = Espacio**: hacia la derecha más reverb y delay.
  - El gesto se fija a un eje según el primer movimiento (≥ 12 px). El valor se queda donde lo sueltas.
  - Mientras arrastras, una línea fina horizontal o vertical (blanca, 20 % de opacidad) y el agua se oscurece o se suaviza ligeramente, como respuesta visual.
  - **Tocar** el agua fuera de un loop no hace nada (decidido).
- **Ajustes** (hoja inferior):
  - ayuda (sí/no) y metrónomo,
  - **Calor** (deslizador) y **Drop** (botón),
  - silencio que cierra una frase (1 tiempo, 2 tiempos o 1 compás),
  - longitud máxima de frase (1, 2 o 4 compases; por defecto 4),
  - borrar todo, recalibrar latencia y sonidos, y el diagnóstico.
- **"Ver código"** (hoja inferior plegable): una fila por loop con sus golpes y su color, y el código Strudel con botón de copiar.

### 16.5 Modelo de datos (sustituye a `Loop` y `Layer` de §15.5)

```ts
export type LoopLength = 1 | 2 | 4

export interface FreeLoop {
  id: number
  instrument: Instrument
  bars: LoopLength
  /** compás global en el que empieza (fase); suena el compás (g - phaseBar) mod bars */
  phaseBar: number
  /** posición en semicorcheas desde el inicio del loop; con ayuda = entero, sin ayuda = decimal */
  hits: { pos: number; strength: number }[]
  muted: boolean
  bornAt: number          // compás global de nacimiento
  fromTemplate: boolean   // nació de un golpe suelto
}

export interface Phrase {
  startBar: number
  hits: { tCorr: number; instrument: Instrument; strength: number; confidence: number }[]
}

export interface StudioPrefs {
  assist: boolean
  metronome: boolean
  background: boolean
  maxPhraseBars: LoopLength
  /** silencio que cierra una frase, en tiempos: 1, 2 o 4 (= 1 compás) */
  phraseCloseBeats: 1 | 2 | 4
  /** 0..1 */
  filter: number
  space: number
  warmth: number
}
```

Persistencia: `coderbeats:loops:v1` (loops) y `coderbeats:prefs:v1` (prefs, kit, estilo).

**Programación**: depende del motor (§16.11).
- Con **Strudel** (recomendado), el estado (loops, fondo, ajustes) se traduce a un patrón y se reevalúa al nacer, silenciar o borrar un loop. Los cambios se aplican en el siguiente ciclo.
- Los gestos no reevalúan: van por `ref(() => valor)`.
- Cada evento que suena llega por `onTrigger` con su tiempo de contexto. Desde ahí se avisa al worker (filtro de eco) y a la capa visual (gota).

### 16.6 Código Strudel (adapta §15.6)

**Con el motor Strudel, el código mostrado es exactamente el que suena**: es la misma cadena que se evalúa. El estado se compone así:

```js
setcpm(174/4)
stack(
  // fondo · dnb · re menor
  note("<d1 d1 bb0 c1>").s("sawtooth").lpf(380).lpenv(3).lpq(6).gain(0.55).orbit(2),
  note("<[d3,f3,a3,c4] [bb2,d3,f3,a3]>/2").s("supersaw").lpf(1800).room(0.8).gain(0.25).orbit(2),
  // tus loops
  s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").duckorbit(2).duckdepth(0.6),
  s("<[~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~] [~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ sd]>").bank("RolandTR909"),
  s("hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~").bank("RolandTR909").gain(0.5),
  // s("bd ~ ~ bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").bank("RolandTR909"),   ← silenciado
).lpf(18000).room(0.15)
```

- **Una línea por loop**, con su longitud y su fase. Los compases de un loop de L compases se rotan para que el ciclo 0 de Strudel coincida con el compás global 0. Así, pegado en strudel.cc, suena con la misma fase. Los loops silenciados aparecen comentados.
- **El fondo** va en su propio bloque comentado y desaparece del código si se quita.
- **Gestos y ajustes** se ven como los valores actuales de `.lpf()` y `.room()` / `.delay()` del final, y de `.shape()` (Calor). En el motor van por `ref()`. En el código copiado aparecen como números fijos con el valor del momento.
- **Ayuda desactivada (ritmo exacto)**: cada línea sigue en 16 pasos y añade `.nudge("…")` con el desplazamiento de cada golpe en segundos, con la misma estructura de pasos. **El código sigue siendo exactamente lo que suena.**
- **Samples**: los samples locales se registran con los nombres de Strudel (`RolandTR909_bd`, …). Para que en strudel.cc suenen **los mismos archivos**, se elige como sample de cada instrumento el que tiene índice 0 en el mapa de Strudel, o se emite `.n(k)`. Se verifica en el spike (§16.11).

### 16.7 Tests nuevos (lógica pura)
- **phrases**:
  - inicio y cierre (2 tiempos de silencio en la línea de compás o 4 compases máximo),
  - longitud redondeada a 1, 2 o 4,
  - golpe adelantado al 1,
  - una frase de varios instrumentos da un loop por instrumento.
- **freeLoops**:
  - fase y qué compás suena en cada compás global,
  - deduplicación (≥ 80 %),
  - máximo de 8 (sale primero el silenciado más antiguo y luego el más antiguo),
  - silenciar y borrar.
- **assist**:
  - prior: una caja de dnb a 0,8 pasos del 4 cae en el 4 y nunca se mueve más de 1 paso,
  - plantillas de golpe suelto por estilo,
  - con la ayuda desactivada se conservan las posiciones decimales (±1 ms).
- **mix**:
  - `g(n)` y el balance por instrumento,
  - la suma de picos con 8 loops y el limitador no supera −1 dBFS (modelo de ganancias).
- **strudel**:
  - longitudes mixtas, rotación de fase, silenciados comentados, `.gain`.
- **song** (generación del código completo):
  - fondo por estilo, sidechain (`duckorbit`) solo en las líneas de bombo,
  - `.nudge()` con la ayuda desactivada,
  - fondo desactivado = sin bloque de fondo,
  - salida determinista.
- **gestures**: fijación del eje (≥ 12 px), mapeo vertical → Hz exponencial y horizontal → espacio, límites.
- **water** (solo la parte pura):
  - un paso de la ecuación de onda en CPU (el mismo kernel que el shader) conserva la simetría y se amortigua.

### 16.8 Criterios de aceptación (sustituyen a los de §15.8 salvo el 2, el 6, el 7 y el 8)
1. Con Play, una frase de beatbox se convierte en loops que empiezan a sonar en la línea de compás siguiente a su cierre, sin pulsar nada más.
2. Repetir el mismo patrón no crea loops duplicados; el loop existente brilla.
3. Tocar un loop lo silencia o lo activa de forma audible en el siguiente golpe. Mantenerlo pulsado 600 ms lo borra.
4. Nunca hay más de 8 loops. Al llegar al máximo se aplica la regla de §16.1.
5. Con la ayuda activada:
   - un golpe suelto da el patrón típico del estilo,
   - en drum and bass una caja hecha cerca del 2 o del 4 cae en el 2 o el 4,
   - en house un bombo cerca de una negra cae en la negra.
6. Con la ayuda desactivada, los golpes suenan en su posición real (±5 ms tras compensar la latencia).
7. Con 1 a 8 loops el volumen percibido varía como mucho ±3 dB y la salida nunca supera −1 dBFS.
8. **Agua a 60 fps** en un Android de gama media (Pixel 6a) con 8 loops en drum and bass: p95 del tiempo de frame ≤ 16,7 ms. Funciona sin WebGL2 (respaldo) y respeta `prefers-reduced-motion`.
9. En la vista principal solo se ven Play/Stop, estilo, kit, ajustes y "ver código".
10. **Fondo musical**: suena al dar Play si está activado y se quita o se pone con el interruptor sin cortar la batería. El cambio se aplica en el siguiente compás.
11. **Sidechain audible**: con fondo y bombo, el bajo y los acordes bajan con cada bombo (con `duckdepth` ≥ 0,5) y la mezcla no supera −1 dBFS.
12. **Código = sonido**: el código mostrado, pegado en strudel.cc, suena igual que en coderbeats (mismo patrón, fase, kit y fondo). Las únicas diferencias admitidas son las de los propios samples si strudel.cc carga otro archivo, y eso se resuelve en el spike.
13. **Gestos**: arrastrar en vertical u horizontal cambia el filtro o el espacio de forma audible en ≤ 1 semicorchea, sin reevaluar el código y sin cortes.
14. Se mantienen los criterios 2 (≤ 150 ms del golpe a la pantalla), 6 (precisión y 0 golpes fantasma), 7 (sin retroalimentación con altavoces) y 8 (worker) de §15.8.

### 16.9 Plan (nueva fase A3; sustituye lo que quedaba de la fase B en diseño)
- **A3.0 Spike de @strudel/web** (máximo 1 día, en una rama). Hay que verificar:
  1. Comparte nuestro AudioContext (`setAudioContext`) con el worklet del micro y el worker.
  2. Los tiempos de `onTrigger` coinciden con el sonido real (±3 ms).
  3. Reevaluar al nacer un loop no produce cortes.
  4. Se desbloquea el audio en iOS.
  5. `duckorbit` y un limitador maestro sobre el nodo de salida funcionan.
  6. Peso del bundle con gzip (carga diferida tras Empezar).
  7. Índices de los samples para que coincidan con strudel.cc.

  **Si algún punto falla**, se sigue con Tone.js (§16.11, alternativa) y se te avisa antes de seguir.
- **A3.1** `lib/`: phrases, freeLoops, assist y styles (con sus fondos), mix, generador de canción (Strudel), gestures y kernel de onda, con sus tests.
- **A3.2** Motor: Strudel (o Tone si el spike falla), escucha continua con Play, fondo, sidechain, auto-mix y limitador, Calor y Drop. Se retiran el overdub y Tone si Strudel pasa el spike.
- **A3.3** Agua: simulación WebGL2 con 3 canales, respaldos y loops flotantes con toque y pulsación larga.
- **A3.4** UI mínima: interruptor de fondo, gestos de filtro y espacio, ajustes y "ver código" como hojas inferiores, y persistencia.
- **A3.5** Lo pruebas con tu voz, en el ordenador y en el móvil, y ajustamos el prior, el cierre de frase y el agua.

### 16.10 Decisiones (antes preguntas abiertas)
1. **Una frase con varios sonidos** da un loop por instrumento.
2. **Ruedas y drop**: Filtro y Espacio pasan a ser **gestos sobre el agua** (vertical y horizontal). Calor y Drop van a ajustes (§16.4).
3. **Tocar el agua** fuera de un loop no hace nada.
4. **Máximo de 8 loops.**
5. **Cierre de frase**: 2 tiempos de silencio por defecto, ajustable a 1 tiempo, 2 tiempos o 1 compás.

### 16.11 Que suene a canción, como en strudel.cc

#### Motor de sonido: @strudel/web frente a Tone.js

Datos comprobados en el código publicado: `@strudel/web` 1.3.0, `superdough` 1.3.0 y `@strudel/core` 1.2.6, todos con licencia **AGPL-3.0-or-later**.

| | **@strudel/web** | **Tone.js** (actual) |
|---|---|---|
| Código mostrado = sonido | **Sí, literalmente**: se evalúa la misma cadena | No: el código es una traducción y puede sonar distinto en strudel.cc |
| Paridad con strudel.cc | Total (mismo motor `superdough`) | Aproximada (sintes y efectos propios) |
| Sintes para el fondo | De serie: `sawtooth`, `supersaw`, `lpf` + `lpenv` + `lpq`, `room`, `delay` | Hay que construirlos (Synth, Filter, envolventes) |
| Sidechain | **De serie**: `duckorbit`, `duckdepth`, `duckattack` | A mano: automatizar la ganancia en cada bombo (fácil, porque sabemos cuándo suena) |
| Compresión y limitador | `compressor` por evento/orbit. Limitador maestro sobre el nodo de salida del controlador (a verificar en el spike) | `Compressor` y `Limiter` de serie |
| Valores en tiempo real (gestos) | `ref(() => valor)` sin reevaluar. El filtro es **por evento**: el cambio se oye en el siguiente golpe o nota, no a mitad de una nota larga | `rampTo` continuo sobre un filtro maestro |
| Ritmo exacto (ayuda desactivada) | `.nudge()` por golpe, visible en el código | Programación exacta, invisible en el código |
| Integración con micro y worker | `setAudioContext` (contexto compartido) y `onTrigger` (tiempos de contexto para el eco y las gotas) | Ya funciona |
| Peso | Mayor (el paquete web desempaquetado ocupa unos 1,5 MB; gzip por medir en el spike). Se carga tras Empezar | Menor (~200 KB min) |
| Madurez y API | 1.x, pensada para el REPL. La API de incrustado está menos documentada, así que se fija la versión exacta | Muy estable y documentada |
| **Licencia** | **AGPL-3.0**: coderbeats tendría que publicarse también como AGPL (o compatible) y **ofrecer su código fuente a quien use la web**, también desplegada (cláusula de red). Impide una versión cerrada o comercial sin otra licencia de los autores de Strudel | MIT: sin restricciones |

**Recomendación: @strudel/web**, con dos condiciones:
1. **Pasar el spike A3.0** (§16.9). Si falla, se sigue con Tone.js y se replica el fondo con sus sintes.
2. **Licenciar coderbeats como AGPL-3.0** (`LICENSE` en el repo y enlace "código fuente" en la app).

Por qué: tu objetivo explícito es que suene **igual que strudel.cc** y que el código sea **exactamente lo que suena**. Solo Strudel lo garantiza por construcción, y además trae de serie los sintes del fondo, la reverb y el sidechain. La AGPL encaja con un repo que quieres poder hacer público. Lo que cierra es la puerta a una versión privada o comercial. Si eso te importa, la recomendación cambia a Tone.js.

Con Strudel, **Tone.js se retira** y el metrónomo pasa a ser un patrón más (`s("rim*4")` o un clic propio registrado como sample). El micro, el worklet, el worker, la detección y el clasificador no cambian.

#### Fondo musical por estilo (opcional)

Cada estilo trae un **bajo y unos acordes en la misma tonalidad**, que suenan al dar Play si el fondo está activado (por defecto, activado). Los valores concretos (notas, filtros y niveles) se afinan de oído en la implementación. Esta es la intención:

| Estilo | Tonalidad | Bajo | Acordes |
|---|---|---|---|
| hip hop 90 | la menor | `triangle` grave y redondo, notas largas: `<a1 a1 d2 e2>`, `lpf` 600 | Rhodes suave (`sine`/`triangle` con `room` 0,4): `Am7 – Dm7`, 1 acorde por compás |
| house 124 | fa menor | `sawtooth` corto en contratiempo (`~ f1 ~ f1`), `lpf` 500 + `lpenv` | Stabs de `supersaw` en contratiempo: `Fm9 – B♭m9`, `room` 0,3 |
| drum and bass 174 | re menor | **`sawtooth` con filtro** (`lpf` 380, `lpenv` 3, `lpq` 6), estilo reese, `<d1 d1 b♭0 c1>` | **Pads de fondo con reverb**: `supersaw` filtrado, `Dm7 – B♭maj7`, 2 compases cada uno, `room` 0,8 |

- **Tus loops de batería se suman encima** en sus propias líneas.
- **Quitar o poner el fondo**: con el interruptor **fondo** junto a Play, siempre visible porque es parte del juego. También con un **toque con dos dedos** sobre el agua. El cambio entra en el siguiente compás con un fundido de 1 tiempo.
- Si cambias de estilo, el fondo cambia de tonalidad y tempo. Tus loops se mantienen.

#### Mezcla tipo canción

- **Buses (orbits)**: batería en el orbit 1, fondo en el orbit 2.
- **Sidechain**: las líneas de bombo llevan `.duckorbit(2).duckdepth(0.6).duckattack(0.15)`, así que cada bombo empuja el bajo y los acordes. Con la ayuda desactivada se mantiene igual.
- **Compresión**: `compressor` suave en el bus de batería (umbral −18 dB, ratio 3). El **Calor** de ajustes sube la saturación (`shape`) y la compresión.
- **Auto-mix**: el reparto de §16.2 se aplica a los loops de batería. El fondo queda fijo 4 dB por debajo de la batería.
- **Salida**: limitador maestro a −1 dBFS sobre el nodo de salida, nunca satura (se verifica en el spike).
- **Drop** (ajustes): cierra el filtro global hasta 200 Hz durante el compás actual y lo suelta en el 1 del siguiente. El fondo también se filtra, y eso es lo que da la sensación de "drop".

### 16.12 Resultados del spike A3.0 (2026-11-12): **@strudel/web validado**

Ejecutado con la página `/spike` en Chrome (escritorio, headless, micro simulado) y en **Safari iOS (iPhone)**, con resultados equivalentes. Se mide grabando la salida real de superdough con nuestro worklet.

| # | Comprobación | Escritorio | iPhone |
|---|---|---|---|
| 1 | AudioContext compartido (micro grabando mientras suena) | ✓ | ✓ |
| 2 | `onTrigger` frente al sonido real | +2,0 ms constantes | +2,0 ms constantes |
| 3 | 10 reevaluaciones sin cortes | 0 huecos y 0 duplicados | 0 huecos y 0 duplicados |
| 4 | iOS: desbloqueo de audio y altavoz | — | ✓ (se oye bien) |
| 5a | Sidechain `duckorbit` | −10,9 dB | −12,5 dB |
| 5b | Limitador maestro sobre `controller.output.destinationGain` | −1,80 dBFS | −1,76 dBFS |
| 5c | El limitador sobrevive a hush/play | ✓ | ✓ |
| 6 | Peso | 210 KB gzip (trozo diferido) | import 634 ms |
| 7 | Mismos samples que strudel.cc | ver abajo | — |
| + | `ref()` en vivo sin reevaluar | +13,2 dB | +13,3 dB |
| + | `nudge` | 50,7 ms por 50 | 50,7 ms por 50 |
| + | Bloqueo del hilo principal | 50 y 120 ms: 0 pérdidas; **250 ms: 1 semicorchea perdida** | igual |

**Decisiones que salen del spike:**
- **Samples**: en el mapa de strudel.cc, la caja del 909 (`sd01`) y el bombo y la caja del 808 (`BD0010`, `SD0010`) están en el **índice 1**. Esas líneas llevan `.n(1)` y el registro local replica el índice. El resto está en el 0.
- **`onTrigger` no incluye el `nudge`**: el filtro de eco y las gotas le suman el `nudge` de cada golpe.
- **El limitador nativo añade ~5 ms** a toda la salida. Todo (metrónomo incluido) sale por el mismo camino, y la prueba de eco mide con ese camino.
- **El planificador de Strudel corre en el hilo principal** (`setInterval`, ~100 ms de margen):
  - el agua no puede bloquear más de unos 100 ms; objetivo de frame ≤ 16,7 ms y ninguna tarea > 50 ms,
  - al pasar a segundo plano se pausa.
- **Carga**: `@strudel/web` se importa justo tras Empezar, en paralelo con la prueba de eco (en el iPhone el import son ~0,6 s).
- **El metrónomo** es un patrón de Strudel solo del motor: no aparece en el código mostrado, porque es una ayuda y no forma parte de la música.
- **Cierre de frase y planificación**: Strudel consulta unos 100–150 ms por delante. Para que un loop empiece justo en la línea de compás B, la frase se decide en **B − 0,3 s** con los golpes conocidos hasta entonces. Un golpe tardío que caiga en esos últimos 0,3 s abre la frase siguiente (normalmente es un golpe adelantado al 1).

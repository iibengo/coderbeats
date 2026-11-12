# 001 · MVP de coderbeats

> Estado: **aprobada** el 2026-11-12, con cambios: estilo premium minimalista y preguntas abiertas resueltas (§13).
> **Enmienda 1 (modo looper, §15): aprobada el 2026-11-12.**
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
  - Si se detectan, aparece el aviso "el micro oye los altavoces: usa cascos".
  - Con lo mismo se mide la **latencia pura del sistema** (salida + entrada), separada de tu tiempo de reacción.
- **b) Filtro de eco** (solo se activa si la prueba de eco detecta que el micro oye la salida):
  - Sabemos cuándo suena cada clic y cada sample. Se descartan los onsets que caen a ±25 ms del momento en que debería llegar su eco.
  - Excepción: si superan en +10 dB el nivel de eco medido, se aceptan. Cuando tocas a la vez que el loop, tu voz pegada al micro suena más fuerte que el eco.
- **c) Anti-doble disparo**: separación mínima ligada a la rejilla de grabación, `clamp(0,6 × celda, 60 ms, 120 ms)`. Sale 100 ms en hip hop 90, 72 ms en house 124 y 103 ms en drum and bass (celda de corchea).
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

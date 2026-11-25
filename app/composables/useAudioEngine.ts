import { computed, reactive, ref, shallowRef } from 'vue'
import { brightnessAtX, keysToHits, noteAtY, scaleNotes, type KeyEvent } from '~/lib/waterKeys'
import { midiToHz, noteIndexAt } from '~/lib/theremin'
import { COMMIT_IDLE, softQuantize, TapTake } from '~/lib/tapMelody'
import { DEFAULT_PRODUCTION } from '~/lib/production'
import { mergeCells as mergeCellsPure } from '~/lib/mergeCells'
import { bluetoothWarning } from '~/lib/voiceWarn'
import { firstSound } from '~/lib/audioExport'
import { encodeWav } from '~/lib/wav'
import { loadVoice, saveVoice } from '~/lib/voiceStore'
import { cutBars, fromPcm16, newVoiceId, prepareTake, type VoiceBars } from '~/lib/voiceLoop'
import { hitsFromSung, melodyCount, MAX_PART_MELODIES, type SingBars } from '~/lib/singPart'
import { checkOutcome, correctLoops, type PilotScript } from '~/lib/pilotScripts'
import { FX_DURATION, FxLimiter, fxToLoops, fxValue, type FxEvent, type FxKind } from '~/lib/stageFx'
import { timelineToSong, type BarLayers } from '~/lib/liveCompose'
import { NO_PARTS, PART_ORBIT, planTransitions, targetParts, type BackgroundMode, type Part, type Parts } from '~/lib/background'
import { KIT_ORDER, KITS, kitFromSaved, STYLES } from '~/lib/constants'
import { GUITAR_SAMPLE, guitarMap } from '~/lib/guitarSamples'
import { PERC_SAMPLES } from '~/lib/percSamples'
import { MELODY_DECISION_SEC } from '~/lib/liveMelody'
import { scaleLabel, type SongScale } from '~/lib/songScale'
import { EQ_TECHNO, glueOptions, LIMITER_TRUE } from '~/lib/masterChain'
import type { MelodyHit, MelodySynth } from '~/lib/melody'
import { melodyOfPhrase } from '~/lib/melodyAssist'
import { midiName } from '~/lib/noteScore'
import type { Remix } from '~/lib/remixes'
import { STYLE_MUSIC } from '~/lib/styles'
import { bandEdges, bandLevels } from '~/lib/cardLevels'
import { GLUE_WARM, saturationCurve } from '~/lib/masterChain'
import { DEFAULT_MODE, type Mode } from '~/lib/modes'
import { drumStepsOf, sameSuggestion, suggestFor, type Suggestion } from '~/lib/suggestion'
import { rhythmKey, suggestMelody } from '~/lib/suggestMelody'
import { varyCell, variationOrder, withVariation, type VariationKind } from '~/lib/variations'
import { convertToSong } from '~/lib/songTemplates'
import { MIN_RHYTHM_HITS } from '~/lib/suggestion'
import { demoState } from '~/lib/demos'
import { analyzeEchoTest, type EchoTestResult } from '~/lib/echoGate'
import {
  cellById,
  withoutCell,
  DEMO_KIT,
  demoSong,
  emptySong,
  endBar,
  fitTurns,
  groupIdOf,
  groupOn,
  groupSong,
  groupTriggers,
  inParallel,
  isMulti,
  MAIN,
  minTurns,
  nextDepth,
  nextInOrder,
  nextTurns,
  normalizeSong,
  orderOf,
  stepPlay,
  stressSong,
  windowAt,
  withCut,
  withOrderAfter,
  withCopy,
  withGroupOn,
  withNewCell,
  withNewGroup,
  withRestoredCell,
  withValidBpm,
  type Cell,
  type Cursor,
  type Jump,
  type Play,
  type Song,
} from '~/lib/cells'
import {
  applyTriggers,
  groupEnd,
  groupWindow,
  holdGroup,
  isRunning,
  reconcileGroup,
  releaseGroup,
  retargetMain,
  startGroup,
  stepGroup,
  stopGroup,
  tapGroup,
  type GroupPlay,
} from '~/lib/groups'
import {
  addPhrase,
  clearLoops,
  emptyLoops,
  MAX_LOOPS,
  prunePrev,
  removeLoop,
  toggleMute,
  type FreeLoop,
  type LoopEvent,
  type LoopInstrument,
  type LoopsState,
  type RepeatMode,
} from '~/lib/freeLoops'
import { DJF_MIN, filterDjf, spaceParams, SWEEP_STEPS, sweepDjf, warmthShape } from '~/lib/gestures'
import { imageDelayMs, sanitizeFine, SYNC_LOOKAHEAD_S, SYNC_PERIOD_S, takeDue } from '~/lib/imageDelay'
import type { SavedSong, SongSnapshot } from '~/lib/library'
import { effectiveBpm, TEMPO_TAPS, TEMPO_TIMEOUT_MS, tempoFromTaps } from '~/lib/tempo'
import { detectOnsets, minGapForCell } from '~/lib/onsets'
import { PhraseTracker, type ClosedPhrase, type LoopLength, type PhraseSnapshot } from '~/lib/phrases'
import { ENGINE_GLOBAL, songCode, type SongFx, type SongState } from '~/lib/song'
import { WOW_PRELUDE } from '~/lib/wowPrelude'
import type { CalibrationSample, Instrument, KitId, Norm, StyleId } from '~/lib/types'
import { allLanes, toggleLane as toggleLaneSet, type Lanes } from '~/lib/lanes'
import { fmtVolume, isTooQuiet } from '~/lib/volume'
import { readJson, writeJson } from '~/lib/storage'
import { defaultCalibration } from '~/lib/defaultModel'
import { FitMonitor, MixMonitor } from '~/lib/modelFit'
import type { FromWorker, ToWorker } from '~/lib/workerProtocol'

type StrudelModule = typeof import('@strudel/web')

export interface Take {
  buffer: Float32Array
  sampleRate: number
  /** segundos desde el inicio del buffer hasta el primer tiempo grabado (tras la cuenta atrás) */
  t0: number
  /** tiempos de los clics grabados, relativos al buffer */
  clickTimes: number[]
}

export interface TakeOptions {
  bpm: number
  countInBeats: number
  recordBeats: number
  onBeat?: (beat: number) => void
}

/** Evento de diagnóstico. */
export interface DiagEvent {
  at: number
  kind: 'hit' | 'echo' | 'unknown' | 'stopped' | 'born' | 'removed' | 'phrase' | 'error' | 'background' | 'cell' | 'melody'
  text: string
  /** ms desde el golpe hasta que llegó al hilo principal */
  uiMs?: number
}

export type PhraseMode = 'silence' | 'bar'
export type { RepeatMode } from '~/lib/freeLoops'

/**
 * Evento para la capa visual (§16.16):
 * - `hit`: suena un golpe (de un loop o del fondo), entregado en su tiempo de audio; `step` = paso
 * - `heard`: el micro acaba de oír un golpe (al instante); `step` = paso dentro del compás
 * - `birth`: nace (o se sustituye) un loop; `time` = la línea de compás en la que empieza a sonar
 */
export interface VisualHit {
  kind: 'hit' | 'heard' | 'birth'
  loopId: number | null
  instrument: LoopInstrument | 'bass' | 'chords' | null
  time: number
  /** 0..1 */
  strength: number
  step?: number
}

/** Correspondencia ciclo ↔ tiempo de contexto, a partir del último pulso. */
interface Clock {
  cycle: number
  time: number
  barSec: number
}

interface StrudelHap {
  whole: { begin: number | { valueOf(): number } }
  value: Record<string, unknown>
}

type PilotSaved = { suggestions: boolean; melody: boolean; assist: boolean; bgMode: BackgroundMode; bgManual: Parts; style: StyleId; kit: KitId; mode: Mode }
// ── Estado de módulo (una sola página, solo cliente) ───────────────────────────
let ctx: AudioContext | null = null
/** el final de la cadena maestra (tras el techo): de ahí sale una derivación para grabar el audio de la app en vídeo (spec 013); el micro nunca entra */
let masterEnd: AudioNode | null = null
/** el compresor de pegamento de la salida (worklet); `null` si no cargó */
let glueNode: AudioWorkletNode | null = null
/** el EQ de la salida (spec 047): seco y mojado en paralelo; apagado = solo el seco, exacto */
let eqNodes: { dry: GainNode; wet: GainNode } | null = null
/** el medidor de la salida (spec 047): se conecta solo mientras se mira */
let meterNode: AnalyserNode | null = null
let meterBuf: Float32Array<ArrayBuffer> | null = null
let videoTap: MediaStreamAudioDestinationNode | null = null
/** el analizador de la animación de la tarjeta (spec 061, paso 4): una rama pasiva que solo escucha el final de la cadena maestra */
let analyserNode: AnalyserNode | null = null
let analyserBuf: Uint8Array<ArrayBuffer> | null = null
const ANALYSER_FFT = 1024
let S: StrudelModule | null = null
let stream: MediaStream | null = null
/** el nodo del micro, para poder soltarlo y volver a abrirlo (spec 016 §17) */
let micSource: MediaStreamAudioSourceNode | null = null
let micIdleTimer: ReturnType<typeof setTimeout> | null = null
/** ¿la app hace caso al micro? Apagado: el micro puede seguir abierto (para no volver a pedir permiso) pero **no se analiza ni se graba nada** */
const listening = ref(true)
/** ¿el micro está abierto de verdad (el navegador lo indica)? */
const micOpen = ref(false)
let capture: AudioWorkletNode | null = null
let worker: Worker | null = null
let masterIn: GainNode | null = null
/** el wowo en el motor (spec 008, §9): enganche del código evaluado y compuertas de cada célula con wowo */
let wowDisarm: (() => void) | null = null
let chunks: { frame: number; data: Float32Array }[] = []
let onStopped: (() => void) | null = null
let clock: Clock | null = null
let tracker: PhraseTracker | null = null
let latencySec = 0
let lastPulseCycle = -1
let plannedParts: Parts = { ...NO_PARTS }
let timers: ReturnType<typeof setTimeout>[] = []
let outputBatch: number[] = []
let evalQueued = false
let dropActive = false
/** último nacimiento, para que una enmienda nazca en la misma línea de compás */
let lastBirth: { startBar: number; bornAt: number } | null = null
/** canción de varias células (spec 005): célula que suena y compás global en el que empezó */
let cursor: Cursor | null = null
/** estado bucle (§4.1): la célula del cursor se repite entera hasta "seguir" */
let loop = false
/** salto pendiente (marcador del borde o "seguir"): entra en su compás global */
let jump: Jump | null = null
/** salto ya hecho por el motor cuya célula aún no se ve (el reloj visual va con retraso): la transición lo sigue usando */
let viewJump: Jump | null = null
/** compás global en el que empezó la célula que se ve (el compás del aro se cuenta desde ahí) */
let viewStartBar = 0
/** célula que se veía antes de la actual (para apagarla en la transición); null al arrancar */
let prevViewId: number | null = null
/** barrido de filtro de la transición entre células, 0..1 (§4.3) */
let sweep = 0
/** lo que ve la interfaz: la célula está en bucle (o va a estarlo en la siguiente línea de compás) */
const looping = ref(false)
/** la célula que está en bucle (o que va a estarlo en la siguiente línea de compás); null si ninguna */
const loopTarget = ref<number | null>(null)
/** qué se puede deshacer (chip "↶ deshacer", spec 005 §7.1): lo último que se borró, o null */
const undoInfo = ref<'cell' | 'clear' | 'all' | 'made' | null>(null)
const syncLoopUi = () => {
  const j = jump ?? viewJump
  looping.value = loop || !!j?.loop
  loopTarget.value = j ? (j.loop ? j.cellId : null) : loop && cursor ? cursor.cellId : null
}
const curPlay = (): Play => ({ cursor: cursor!, loop, jump })
const bgNodes: Partial<Record<Part, { lp: BiquadFilterNode; gain: GainNode }>> = {}
const visualListeners = new Set<(h: VisualHit) => void>()

/** Valores que lee el código evaluado (refs y onTrigger). */
const cb = {
  fx: { djf: 0.5, room: 0, delay: 0, shape: 0 },
  trig: (hap: StrudelHap, t: number) => onTrigger(hap, t),
}

// ── Estado reactivo ───────────────────────────────────────────────────────────
const ready = ref(false)
const level = ref(0)
const echo = shallowRef<EchoTestResult | null>(null)
const playing = ref(false)
/** melodía con la voz (spec 002, F1): la pide el usuario en ⋯; con fuga del fondo por el micro no funciona */
const melodyOn = ref(false)
const melodyBlocked = computed(() => !!echo.value?.bleed)
const melodyActive = computed(() => melodyOn.value && !melodyBlocked.value)
const kit = ref<KitId>('electro')
/** el modo (spec 011): Jugar o Componer. Solo es una vista: no toca la canción ni lo que suena */
const mode = ref<Mode>(DEFAULT_MODE)
/** cuenta las veces que se pide repetir el primer minuto guiado (spec 011, §12.2); la gota lo vigila */
const guideNonce = ref(0)
/** Sin micro (denegado o sin dispositivo): se entra igual, con un micro mudo; se toca con el dedo (Agua, Escenario, el aro). */
const noMic = ref(false)
/** «Sugerencias» (spec 012, §3.4): la melodía sugerida y las variaciones; apagado, no se propone nada. Separado de «Ayuda» (`assist`) */
const suggestions = ref(false)
/** producción opcional (spec 014): swing y matices de volumen; apagada por defecto (las canciones no cambian solas) */
const production = ref(false)
/** el fluido del agua (estela del dedo y venas): por defecto encendido; el vigilante de frames lo apaga si va lento */
const flow = ref(true)
/** la melodía sugerida que se ve y suena en fantasma (sin aceptar); no está en la canción */
const suggestion = shallowRef<Suggestion | null>(null)
/** la semilla en curso de cada ritmo («otra» la sube: secuencia fija y reproducible) y los ritmos cuya sugerencia se descartó */
const suggestSeeds = new Map<number, number>()

/** La variación propuesta al copiar una célula (spec 012, §5): la copia ya la lleva puesta y marcada; tocarla la acepta. No está en la canción. */
export interface Proposal {
  /** la copia */
  cellId: number
  kind: VariationKind
  seed: number
  /** la original tal como era al copiar (cada «otra» parte de ella, no de la propuesta anterior) */
  source: Cell
  /** las variaciones que se ofrecen, en orden */
  kinds: VariationKind[]
}
const proposal = shallowRef<Proposal | null>(null)
/** Un aviso corto para la persona (se ve unos segundos sobre la gota) */
const notice = ref('')
let noticeTimer: ReturnType<typeof setTimeout> | null = null
function say(text: string) {
  notice.value = text
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 4500)
}
/** «Componer en directo» (spec 011 §14.1): compases grabados hasta ahora, o `null` si no se graba. */
const liveRec = ref<{ bars: number } | null>(null)
let liveTimeline: BarLayers[] = []
function cancelLive() {
  liveRec.value = null
  liveTimeline = []
}
/** Pista de voz (spec 007): `armed` espera la línea de compás, `recording` graba, `saving` corta y guarda. */
/** la envolvente de cada audio de voz (para dibujar su onda en el aro) */
const voiceEnv = shallowRef<Record<string, Float32Array>>({})
/** audios de voz que una canción pide y no están en este dispositivo (la bola se ve apagada con «audio no disponible») */
const voiceMissing = shallowRef<string[]>([])
const voiceRec = ref<'idle' | 'armed' | 'recording' | 'saving'>('idle')
/** el loop de melodía que creó «Cantar esta parte» la última vez (spec 039); `null` si no hay */
const lastSung = ref<number | null>(null)
let voiceCancel = false
/** muestras de voz ya registradas en superdough (por identificador) */
const voiceReady = new Set<string>()
async function registerVoice(id: string, samples: Float32Array, sampleRate: number) {
  if (voiceReady.has(id)) return
  const url = URL.createObjectURL(new Blob([encodeWav(samples, sampleRate)], { type: 'audio/wav' }))
  await (globalThis as unknown as { samples: (m: object) => Promise<void> }).samples({ [id]: [url] })
  voiceReady.add(id)
}
/** Antes de evaluar: las muestras de voz que usan los loops (de la sesión o de una canción guardada) se leen del almacén y se registran. */
async function ensureVoices() {
  const s = liveSong()
  for (const l of s.cells.flatMap((c) => c.loops)) {
    const id = l.instrument === 'voz' ? l.voice?.audio : undefined
    if (!id || voiceReady.has(id)) continue
    const v = await loadVoice(id)
    if (!v) {
      log('error', `voz: falta el audio ${id} (audio no disponible)`)
      if (!voiceMissing.value.includes(id)) voiceMissing.value = [...voiceMissing.value, id]
      continue
    }
    await registerVoice(id, fromPcm16(new Int16Array(v.pcm)), v.sampleRate)
    voiceEnv.value = { ...voiceEnv.value, [id]: new Float32Array(v.envelope) }
  }
}
/**
 * Modelo por defecto (spec 001 §17): sin calibración propia suena con prototipos genéricos; `personalModel` es si hay calibración propia. Si el modelo por defecto acierta
 * poco (`FitMonitor`), `calibNudge` propone calibrar («¿te afino a tu voz?»); «Ahora no» se recuerda por dispositivo.
 */
const personalModel = ref(false)
const calibNudge = ref(false)
const fitMonitor = new FitMonitor()
const mixMonitor = new MixMonitor()
const NUDGE_KEY = 'coderbeats:calib-nudge:v1'
/** los dos centros de claridad que el modelo por defecto aprendió de este micro (pff, ts): por dispositivo */
const CENTERS_KEY = 'coderbeats:auto-centers:v2'
const isCenters = (x: unknown): x is number[] => Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === 'number' && Number.isFinite(n))
const savedCenters = (): number[] | null => readJson(CENTERS_KEY, isCenters)
const nudgeDismissed = (): boolean => !!readJson(NUDGE_KEY, (x): x is { dismissed: true } => !!x && (x as { dismissed?: unknown }).dismissed === true)
/** Teclado de agua (spec 015): tocar el fondo fuera del aro suena notas de la escala del estilo; se puede grabar como melodía */
const keysOn = ref(false)
const keysRec = ref<{ count: number } | null>(null)
/** lo apuntado mientras se graba (ya cuantizado), para verlo en la franja de melodía del aro */
const keysHits = ref<MelodyHit[]>([])
/** la última nota tocada (para ondas y franja iluminada) */
const keysLast = ref<{ n: number; midi: number }>({ n: 0, midi: 60 })
let keyEvents: KeyEvent[] = []
let lastKey = { midi: -1, at: 0 }
/** el sintetizador de dedo (spec 015 §12): un oscilador continuo que se desliza entre notas de la escala */
/** el coro del laboratorio (spec 017): tres voces (la que se arrastra y dos que armonizan) por un mismo filtro */
let choir: { oscs: OscillatorNode[]; filter: BiquadFilterNode; gain: GainNode; idx: number | null } | null = null
function choirStopNow(fast: boolean) {
  const v = choir
  choir = null
  if (!v || !ctx) return
  const t = ctx.currentTime
  v.gain.gain.cancelScheduledValues(t)
  v.gain.gain.setTargetAtTime(0, t, fast ? 0.004 : 0.08)
  for (const o of v.oscs) try { o.stop(t + (fast ? 0.03 : 0.5)) } catch { /* ya parada */ }
}
let thereminVoice: { osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode; idx: number | null } | null = null
const thereminNote = ref<number | null>(null)
/** la melodía por toques de la portada (spec 016 §16): la toma en curso y el temporizador que la pasa al loop */
const tapTake = new TapTake()
let tapCommit: ReturnType<typeof setTimeout> | null = null
/** silencio total pendiente de levantar (el ■ de la portada: ver `stopAll`) */
let unmuteTimer: ReturnType<typeof setTimeout> | null = null
/** el sintetizador está abierto (los avisos de Studio se esconden) */
const thereminShown = ref(false)
/** el tutorial enseña algo: los botones avanzados se esconden (primer minuto, spec 011) */
const hideActions = ref(false)
/** cuánto adorno dibujar (lo fija el vigilante de frames): 0 = todo, 1 = sin brillos ni deformación, 2 = lo mínimo */
const drawLevel = ref<0 | 1 | 2>(0)
/** Escenario (spec 011 §13.1): la pantalla entera dispara golpes de efecto. */
const stageOn = ref(false)
const fxLimiter = new FxLimiter()
/** golpes apuntados mientras se graba la capa de efectos, o `null` */
const fxRec = ref<{ count: number } | null>(null)
let fxEvents: FxEvent[] = []
const suggestDismissed = new Set<number>()
/** si canta, manda su voz: no se sugiere hasta pasados 2 compases desde la última nota cantada */
let voiceHoldUntil = 0
let voiceHoldTimer: ReturnType<typeof setTimeout> | null = null
const style = ref<StyleId>('hiphop90')
const assist = ref(true)
const metronome = ref(false)
const bgMode = ref<BackgroundMode>('manual')
const lastBgMode = ref<Exclude<BackgroundMode, 'off'>>('manual')
/** modo manual: partes que has encendido con las bolas (§16.17) */
const bgManual = shallowRef<Parts>({ ...NO_PARTS })
const phraseCloseBeats = ref<1 | 2 | 4>(2)
const maxPhraseBars = ref<LoopLength>(4)
const phraseMode = ref<PhraseMode>('bar')
/** §16.21: completa por defecto */
const repeatMode = ref<RepeatMode>('complete')
/** frase en curso: golpes oídos (al instante) y compás en el que nacería el loop */
const phrase = shallowRef<PhraseSnapshot | null>(null)
const fx = reactive<SongFx>({ filter: 1, space: 0, warmth: 0 })
const loops = shallowRef<LoopsState>(emptyLoops())
/**
 * Canción (spec 005). La célula que se ve vive en `loops` (sus loops) y `bgManual` (su bajo y sus
 * acordes), para que todo lo de una célula funcione como antes; `liveSong()` las junta.
 */
const song = shallowRef<Song>(emptySong())
/** tempo de la canción: el suyo (tempo fácil) o el del estilo (spec 005, §6) */
const bpm = computed(() => effectiveBpm(song.value.bpm, STYLES[style.value].bpm))
/** tempo fácil: esperando cuatro toques (o cuatro bombos) */
const tempoTap = ref<{ active: boolean; count: number }>({ active: false, count: 0 })
/**
 * Retraso de imagen (spec 003, E6): la ida y vuelta de la calibración de palmadas (ms), y los dos ajustes
 * (automático y fino), que se guardan por dispositivo. Con cascos Bluetooth la latencia de salida que
 * informa el navegador es falsa y la imagen va por delante del sonido.
 */
const roundTripMs = ref(0)
/** lo guardado de la calibración tal cual (puede ser ≤ 0 en una antigua); null sin calibrar */
const savedLatencyMs = ref<number | null>(null)
const imageAuto = ref(true)
const imageFineMs = ref(0)
/** lo que se enseña en ⋯ (la salida que informa el navegador y el retraso de imagen total, en ms); se refrescan al cambiar */
const reportedOutputMs = ref(0)
const imageDelayShown = ref(0)
/** prueba de sincronía (spec 003, E6.8): un clic por segundo y un punto que se enciende con el retraso de imagen */
const syncTest = ref(false)
/** sube en cada destello (el punto lo usa como clave para reiniciar su animación) */
const syncFlash = ref(0)
let syncInterval: ReturnType<typeof setInterval> | null = null
let syncTimes: number[] = []
/** el toque del tempo fácil, para el manejador de golpes del micro (que vive fuera del composable) */
let tapTempoHook: ((at: number) => boolean) | null = null
const viewCellId = ref(1)
/** carriles que graban (spec 003, E4.1); no se guarda: al abrir, todos encendidos */
const lanes = shallowRef<Lanes>(allLanes())
/** partes del fondo que han entrado o están entrando (para el código mostrado) */
const bgParts = shallowRef<Parts>({ ...NO_PARTS })
const currentBar = ref(0)
const diag = shallowRef<DiagEvent[]>([])
const dropping = ref(false)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, Math.max(0, ms)))

/** djf que oye el motor: el drop manda; si no, tu filtro, con el barrido de la transición encima. */
const djfNow = (): number => (dropActive ? DJF_MIN : sweepDjf(sweep, filterDjf(fx.filter)))

function requireCtx(): AudioContext {
  if (!ctx) throw new Error('AudioContext no iniciado')
  return ctx
}

const toWorker = (m: ToWorker) => worker?.postMessage(m)

/** Latencia de salida que informa el navegador (s). Con Bluetooth, en iOS, no es real (E6). */
function reportedOutputLatency(): number {
  const c = ctx as (AudioContext & { outputLatency?: number }) | null
  if (!c) return 0
  return (c.baseLatency || 0) + (c.outputLatency || 0)
}

/** Retraso de imagen (s) que se suma a la latencia que informa el navegador (spec 003, E6). */
const imageDelaySec = (): number =>
  imageDelayMs({ auto: imageAuto.value, fineMs: imageFineMs.value, roundTripMs: roundTripMs.value, reportedOutputMs: reportedOutputLatency() * 1000 }) / 1000

function refreshImageDelay() {
  reportedOutputMs.value = Math.round(reportedOutputLatency() * 1000)
  imageDelayShown.value = Math.round(imageDelaySec() * 1000)
}

/**
 * Latencia de salida (s) con la que va la imagen: lo que tarda en oírse lo que el contexto reproduce
 * ahora (spec 003, E1.6) = la que informa el navegador + el retraso de imagen (E6). La latencia
 * calibrada solo corrige la entrada; de ella sale, además, el retraso de imagen automático.
 */
function outputLatency(): number {
  return reportedOutputLatency() + imageDelaySec()
}

/** cómo sonó un golpe, para el diagnóstico: centroide, cruces por cero y graves (< 800 Hz) */
const fmtFeat = (f: { c: number; z: number; low: number; mid?: number; hi?: number } | undefined): string => (f ? ` · c ${f.c.toFixed(2)} z ${f.z.toFixed(2)} graves ${f.low.toFixed(2)}${f.mid !== undefined ? ` medios ${f.mid.toFixed(2)} agudos ${f.hi!.toFixed(2)}` : ''}` : '')
function log(kind: DiagEvent['kind'], text: string, uiMs?: number) {
  diag.value = [{ at: ctx?.currentTime ?? 0, kind, text, uiMs }, ...diag.value].slice(0, 300)
}

/** Clic nativo por el mismo camino que todo lo demás (limitador incluido). */
function click(time: number, accent: boolean) {
  const c = requireCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.frequency.value = accent ? 1760 : 1320
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04)
  osc.connect(gain).connect(masterIn ?? c.destination)
  osc.start(time)
  osc.stop(time + 0.05)
}

function startCapture() {
  chunks = []
  capture?.port.postMessage('start')
}

function stopCapture(): Promise<{ buffer: Float32Array; startTime: number }> {
  const c = requireCtx()
  return new Promise((resolve) => {
    onStopped = () => {
      const first = chunks[0]
      if (!first) return resolve({ buffer: new Float32Array(0), startTime: c.currentTime })
      const last = chunks[chunks.length - 1]!
      const buffer = new Float32Array(last.frame - first.frame + last.data.length)
      for (const ch of chunks) buffer.set(ch.data, ch.frame - first.frame)
      chunks = []
      resolve({ buffer, startTime: first.frame / c.sampleRate })
    }
    capture?.port.postMessage('stop')
  })
}

/** Prueba de eco: 3 clics con el micro abierto. ¿Los oye el micro? */
async function runEchoTest(): Promise<EchoTestResult> {
  const c = requireCtx()
  const at = c.currentTime + 0.3
  const clicks = [at, at + 0.4, at + 0.8]
  clicks.forEach((t) => click(t, true))
  startCapture()
  await wait((at + 1.2 - c.currentTime) * 1000)
  const { buffer, startTime } = await stopCapture()
  const onsets = detectOnsets(buffer, c.sampleRate).map((o) => ({ time: o.time + startTime, strength: o.strength }))
  return analyzeEchoTest(clicks, onsets)
}

// ── Reloj: ciclo de Strudel = compás global ───────────────────────────────────
const stepSeconds = () => 60 / bpm.value / 4
const barTime = (bar: number): number => (clock ? clock.time + (bar - clock.cycle) * clock.barSec : Infinity)
const nextBarLine = (): number => {
  if (!clock || !ctx) return 0
  return Math.floor((ctx.currentTime + 0.15 - clock.time) / clock.barSec) + clock.cycle + 1
}

function onPulse(cycle: number, t: number) {
  if (cycle === lastPulseCycle) return
  lastPulseCycle = cycle
  const barSec = stepSeconds() * 16
  clock = { cycle, time: t, barSec }
  const c = requireCtx()
  const first = !tracker
  if (liveRec.value) {
    if (multi() || mode.value !== 'jugar') cancelLive()
    else {
      const active = loops.value.loops.filter((l) => !l.muted && l.hits.length)
      liveTimeline.push({ loops: active.map((l) => l.id), parts: targetParts(active.length, bgMode.value, bgManual.value) })
      liveRec.value = { bars: liveTimeline.length }
    }
  }
  // canción: ¿empieza otra célula en este compás? (§4.2)
  let entered: Cursor | null = null
  let consumed: Jump | null = null
  if (cursor && multi()) {
    const was = cursor
    const next = stepPlay(liveSong(), curPlay(), cycle)
    if (next.jump !== jump) consumed = jump
    loop = next.loop
    jump = next.jump
    if (next.cursor.cellId !== was.cellId || next.cursor.startBar !== was.startBar) {
      cursor = next.cursor
      entered = next.cursor
      // entrar en otra célula (no repetirse en bucle): enciende y apaga los grupos que lleva (§22)
      if (next.cursor.cellId !== was.cellId) applyGroupTriggers(next.cursor.cellId, next.cursor.startBar)
      if (consumed) viewJump = consumed
      const cell = cellById(song.value, next.cursor.cellId)
      log(
        'cell',
        `suena ${cell?.name ?? `la célula ${next.cursor.cellId}`} (${cell?.turns ?? 1} vueltas) desde el compás ${next.cursor.startBar}${loop ? ' · en bucle' : ''}`,
      )
      cutParts(cellParts(next.cursor.cellId), t)
      reevaluate()
    }
    syncLoopUi()
  }
  if (cursor && multi()) scheduleSweep(cycle, t, barSec)
  // los grupos en paralelo avanzan por su cuenta, en línea de compás; los que se apagaron salen en su línea
  if (groupPlays.size) {
    const sg = liveSong()
    let changed = false
    for (const [gid, gp] of groupPlays) {
      const next = stepGroup(groupSong(sg, gid), gp, cycle)
      if (next === null) groupPlays.delete(gid)
      else if (next !== gp) groupPlays.set(gid, next)
      if (next !== gp) changed = true
    }
    if (changed) reevaluate()
  }
  syncRunning()
  later(() => {
    // la vista sigue a la canción, salvo que se esté en una célula de un grupo en paralelo (a menos que se haya viajado a propósito)
    if (entered && (consumed || !viewAway())) showCell(entered.cellId, entered.startBar)
    // en una célula de un grupo, el compás que se ve cuenta desde que esa célula empezó a sonar
    const vgp = groupPlays.get(groupIdOf(song.value, viewCellId.value) ?? MAIN)
    if (vgp && vgp.play.cursor.cellId === viewCellId.value) viewStartBar = vgp.play.cursor.startBar
    if (consumed && viewJump === consumed) {
      viewJump = null
      syncLoopUi()
    }
    currentBar.value = cycle - viewStartBar
  }, (t + outputLatency() - c.currentTime) * 1000)
  if (!tracker) {
    tracker = new PhraseTracker(
      { anchor: t - cycle * barSec, stepSeconds: barSec / 16 },
      {
        closeBeats: phraseCloseBeats.value,
        // modo "loop de 1 compás": cada compás con golpes es una frase (§16.15)
        maxBars: phraseMode.value === 'bar' ? 1 : maxPhraseBars.value,
      },
    )
    // canción: la primera célula entra con su fondo ya en el primer compás
    if (first && cursor && multi()) cutParts(cellParts(cursor.cellId), t)
    else updateBackground()
  }
  // las versiones sustituidas ya no hacen falta en el código una vez nacida la nueva
  const pruned = prunePrev(loops.value, cycle)
  if (pruned !== loops.value) {
    loops.value = pruned
    reevaluate()
  }
  // la frase se decide poco antes de la siguiente línea de compás (§16.12)
  const next = cycle + 1
  // con melodía los golpes llegan ~0,35 s más tarde (esperan a saber si son voz): la decisión se adelanta lo mismo
  later(() => decide(next), (t + barSec - 0.3 - (melodyActive.value ? MELODY_DECISION_SEC + 0.05 : 0) - c.currentTime) * 1000)
}

function onTrigger(hap: StrudelHap, t: number) {
  const color = String(hap.value.color ?? '')
  if (color === 'pulse') return onPulse(Math.round(Number(hap.whole.begin.valueOf())), t)
  const time = t + Number(hap.value.nudge ?? 0)
  outputBatch.push(time)
  if (outputBatch.length === 1)
    queueMicrotask(() => {
      toWorker({ type: 'output', times: outputBatch })
      outputBatch = []
    })
  if (!visualListeners.size || !ctx) return
  const loopId = color.startsWith('l') ? Number(color.slice(1)) : null
  const loop = loopId !== null ? loops.value.loops.find((l) => l.id === loopId) : undefined
  const begin = Number(hap.whole.begin.valueOf())
  const visual: VisualHit = {
    kind: 'hit',
    loopId,
    instrument: loop?.instrument ?? (color === 'bass' || color === 'chords' ? color : null),
    time,
    strength: Math.min(1, Number(hap.value.gain ?? 1)),
    // paso dentro del compás (ciclo de Strudel = compás): para encender su punto en el anillo
    step: (((begin % 1) + 1) % 1) * 16,
  }
  setTimeout(
    () => visualListeners.forEach((f) => f(visual)),
    Math.max(0, (time + outputLatency() - ctx.currentTime) * 1000),
  )
}

// ── Canción: células (spec 005) ────────────────────────────────────────────────
/** La canción con la célula que se ve al día (sus loops y su fondo están en `loops` y `bgManual`). */
function liveSong(): Song {
  const s = song.value
  return {
    ...s,
    nextLoopId: Math.max(s.nextLoopId, loops.value.nextId),
    cells: s.cells.map((c) =>
      c.id === viewCellId.value
        ? { ...c, loops: loops.value.loops, parts: { ...bgManual.value }, turns: fitTurns(c.turns, loops.value.loops) }
        : c,
    ),
  }
}

const multi = () => isMulti(song.value)

/** Pasa a ver la célula `id` (que empezó en el compás global `startBar`). */
function showCell(id: number, startBar: number) {
  if (id === viewCellId.value) {
    viewStartBar = startBar
    return
  }
  const s = liveSong()
  const cell = cellById(s, id)
  if (!cell) return
  song.value = s
  prevViewId = viewCellId.value
  viewCellId.value = id
  viewStartBar = startBar
  loops.value = { loops: cell.loops, nextId: s.nextLoopId }
  bgManual.value = { ...cell.parts }
  syncGroupHolds()
}

// ── Grupos en paralelo (spec 005, enmienda 2, §16) ─────────────────────────────────
/**
 * Los grupos que suenan (o se están apagando), por id de grupo: dónde va cada uno (célula, compás de inicio,
 * salto) y cuándo se apaga. Los apagados no están. La canción (el grupo principal) tiene su propio estado.
 */
const groupPlays = new Map<number, GroupPlay>()

/** Compás global más cercano al que se puede programar un cambio: nunca uno cuyo pulso ya pasó. */
const jumpBarNow = (): number => Math.max(nextBarLine(), lastPulseCycle + 1)

/** Al dar a Play suenan, desde el compás 0 y por su primera célula, los grupos que estaban encendidos. */
/** Cuántos grupos en paralelo suenan ahora (también los que encendió un disparador y no la marca «encendido»). Para la interfaz. */
const groupsRunning = ref(0)
function syncRunning() {
  const n = [...groupPlays.values()].filter((gp) => isRunning(gp)).length
  if (n !== groupsRunning.value) groupsRunning.value = n
}

function startGroupPlays() {
  groupPlays.clear()
  for (const g of liveSong().groups) if (g.on && g.order.length) groupPlays.set(g.id, startGroup(g.order[0]!, 0))
}

/**
 * Una célula de la canción empieza en la línea de compás `line`: enciende y apaga los grupos que lleva (`groupOn`,
 * `groupOff`; spec 005, §22). Solo cambia lo que suena, no la marca "encendido" de la canción.
 */
function applyGroupTriggers(cellId: number, line: number) {
  const s = liveSong()
  const next = applyTriggers(groupPlays, s, cellId, line, viewCellId.value)
  const cell = cellById(s, cellId)
  const { on, off } = groupTriggers(s, cellId)
  if (!on.length && !off.length) return
  groupPlays.clear()
  for (const [gid, gp] of next) groupPlays.set(gid, gp)
  syncRunning()
  log('cell', `«${cell?.name ?? `célula ${cellId}`}» ${on.length ? `enciende el grupo ${on.join(', ')}` : ''}${on.length && off.length ? ' y ' : ''}${off.length ? `apaga el ${off.join(', ')}` : ''} (compás ${line})`)
  reevaluate()
}

/**
 * Se entró a editar una célula de la canción que no suena (doble toque, enmienda 3): la vista no sigue a la
 * canción hasta que se toque "◎ centrar" o se viaje a otra célula (aunque la canción llegue a ella).
 */
const pinned = ref(false)

/** ¿Se ve algo que no es lo que suena en la canción? Una célula de un grupo en paralelo, o una de la canción que se entró a editar. */
const viewAway = (): boolean =>
  inParallel(song.value, viewCellId.value) || (pinned.value && multi())

/**
 * Los loops y las partes del fondo de la célula de la canción en el modo de una sola célula: la que se ve,
 * salvo que se vea una de un grupo en paralelo (que suena aparte). Con varias células mandan las de cada una (§4.2).
 */
function songCellNow(): { loops: FreeLoop[]; parts: Parts } {
  if (!viewAway()) return { loops: loops.value.loops, parts: bgManual.value }
  const s = liveSong()
  const c = cellById(s, cursor?.cellId ?? s.order[0]!) ?? cellById(s, s.order[0]!)!
  return { loops: c.loops, parts: c.parts }
}

/**
 * Mientras se ve una célula de un grupo en paralelo (para grabar o editarla), su grupo se queda en ella en
 * bucle; al dejar de verla, sigue por su orden (§16.2). Se llama cada vez que cambia la vista o la estructura.
 */
function syncGroupHolds() {
  if (!groupPlays.size || !playing.value || !clock || !ctx) return
  const s = liveSong()
  const view = viewCellId.value
  const vg = groupIdOf(s, view)
  const line = jumpBarNow()
  for (const [gid, gp] of groupPlays) groupPlays.set(gid, gid === vg ? holdGroup(groupSong(s, gid), gp, view, line) : releaseGroup(gp, line))
}

/** Tras cambiar la estructura: los grupos que ya no existen se paran; a los que se les ha ido la célula que sonaba, vuelven a empezar. */
function reconcileGroups(next: Song) {
  const line = jumpBarNow()
  for (const [gid, gp] of groupPlays) {
    if (!next.groups.some((g) => g.id === gid)) groupPlays.delete(gid)
    else groupPlays.set(gid, reconcileGroup(groupSong(next, gid), gp, line))
  }
}

/**
 * Enciende o apaga un grupo en paralelo. El interruptor cambia al momento; sonando, entra (por `startCell`, o su
 * primera célula) en la siguiente línea de compás, y al apagarlo sigue hasta esa línea.
 */
function setGroupOn(gid: number, on: boolean, startCell?: number) {
  const next = withGroupOn(liveSong(), gid, on)
  if (!next) return
  song.value = next
  if (playing.value && clock && ctx) {
    const line = jumpBarNow()
    const gs = groupSong(next, gid)
    if (on) {
      let gp = startGroup(startCell ?? gs.order[0]!, line)
      // si se ve una célula de este grupo, se queda en ella mientras se ve
      if (groupIdOf(next, viewCellId.value) === gid) gp = holdGroup(gs, gp, viewCellId.value, line)
      groupPlays.set(gid, gp)
    } else {
      const gp = groupPlays.get(gid)
      if (gp) groupPlays.set(gid, stopGroup(gp, line))
    }
  }
  log('cell', `${on ? 'enciende' : 'apaga'} el grupo ${gid}`)
  reevaluate()
}

/** Tocar una célula de un grupo en paralelo (§16.4): apagado, lo enciende por ella; encendido, en la que suena lo apaga y en otra salta a ella. */
function tapGroupCell(id: number) {
  const gid = groupIdOf(song.value, id)
  if (gid === null || gid === MAIN) return
  const s = liveSong()
  if (!playing.value || !clock || !ctx) {
    // parado: solo el interruptor
    const next = withGroupOn(s, gid, !groupOn(s, gid))
    if (next) song.value = next
    return
  }
  const r = tapGroup(groupSong(s, gid), groupPlays.get(gid), id, jumpBarNow())
  groupPlays.set(gid, r.gp)
  const next = withGroupOn(s, gid, r.on)
  if (next) song.value = next
  log('cell', r.on ? `grupo ${gid}: suena desde la célula ${id}` : `grupo ${gid}: se apaga`)
  reevaluate()
}

/** El interruptor de un grupo (chapa del aro): lo enciende o lo apaga. */
function toggleGroup(gid: number) {
  if (gid !== MAIN) setGroupOn(gid, !groupOn(song.value, gid), cellById(song.value, viewCellId.value) && groupIdOf(song.value, viewCellId.value) === gid ? viewCellId.value : undefined)
}

/** "Apagar extras" (colonia): apaga todos los grupos menos la canción. */
function stopExtras() {
  const s = liveSong()
  let next = s
  for (const g of s.groups) if (g.on) next = withGroupOn(next, g.id, false)!
  song.value = next
  if (playing.value && clock && ctx) {
    const line = jumpBarNow()
    for (const [gid, gp] of groupPlays) groupPlays.set(gid, stopGroup(gp, line))
  }
  syncRunning()
  log('cell', 'extras apagados')
  reevaluate()
}

/** Desde qué compás cuenta la fase de una célula de un grupo que se llena: el de su inicio (se enciende sola al nacer su primer loop). */
function birthCellStart(bornAt: number): number {
  const id = viewCellId.value
  const gid = groupIdOf(song.value, id)
  // una célula de la canción que no suena: su loop nace alineado con su primer compás
  if (gid === null || gid === MAIN) return cursor && cursor.cellId !== id ? bornAt : (cursor?.startBar ?? 0)
  let gp = groupPlays.get(gid)
  if (!isRunning(gp)) {
    setGroupOn(gid, true, id)
    gp = groupPlays.get(gid)
  }
  if (!gp) return bornAt
  if (gp.play.cursor.cellId === id) return gp.play.cursor.startBar
  return gp.play.jump?.cellId === id ? gp.play.jump.startBar : gp.from
}

/**
 * Barrido de filtro (§4.3): en los 2 últimos tiempos de la última vuelta de la célula que suena,
 * el filtro se abre un poco hacia agudos y vuelve justo en la línea de compás. Como el código se
 * consulta ~0,15 s por delante, todo va con ese adelanto (igual que `drop()`).
 * `t` = tiempo de contexto del inicio del compás `cycle`.
 */
function scheduleSweep(cycle: number, t: number, barSec: number) {
  const c = ctx
  if (!c || !cursor) return
  if (cycle !== endBar(liveSong(), curPlay()) - 1) return
  const from = t + barSec / 2 - 0.15
  const set = (k: number) => () => {
    sweep = k
    cb.fx.djf = djfNow()
  }
  for (let i = 1; i <= SWEEP_STEPS; i++)
    later(set(i / SWEEP_STEPS), (from + ((i - 1) * (barSec / 2)) / SWEEP_STEPS - c.currentTime) * 1000)
  later(set(0), (t + barSec - 0.15 - c.currentTime) * 1000)
}

/** Fondo que pide una célula: sus partes, salvo con el fondo apagado. */
const cellParts = (id: number): Parts => {
  if (bgMode.value === 'off') return { ...NO_PARTS }
  const cell = cellById(liveSong(), id)
  return cell ? { ...cell.parts } : { ...NO_PARTS }
}

/**
 * Entre células, el bajo y los acordes cambian en seco en la línea de compás (§4.2), con un fundido
 * de 10 ms para que no haya chasquidos. `t` = tiempo de contexto de la línea.
 */
function cutParts(target: Parts, t: number) {
  const c = ctx
  if (!c) return
  const at = Math.max(t, c.currentTime + 0.005)
  for (const part of ['bass', 'chords'] as const) {
    if (plannedParts[part] === target[part]) continue
    const n = bgNodes[part]
    if (n) {
      for (const p of [n.lp.frequency, n.gain.gain]) {
        p.cancelScheduledValues(at)
        p.setValueAtTime(p.value, at)
      }
      n.lp.frequency.setValueAtTime(target[part] ? 20000 : 150, at + 0.01)
      n.gain.gain.linearRampToValueAtTime(target[part] ? 1 : 0, at + 0.01)
    }
    log('background', `${part === 'bass' ? 'bajo' : 'acordes'} ${target[part] ? 'entra' : 'sale'} en seco`)
  }
  plannedParts = { ...target }
  later(() => (bgParts.value = { ...target }), (at + outputLatency() - c.currentTime) * 1000)
}

// ── Evaluación del código del motor ────────────────────────────────────────────
function songState(display = false): SongState {
  const st: SongState = {
    loops: songCellNow().loops,
    style: style.value,
    bpm: song.value.bpm,
    ...(song.value.sidechain ? { sidechain: song.value.sidechain } : {}),
    kit: kit.value,
    background: { mode: bgMode.value, parts: bgParts.value },
    metronome: metronome.value,
    fx: { ...fx },
    ...(production.value ? { production: DEFAULT_PRODUCTION } : {}),
    ...(!display && suggestion.value && !multi() ? { suggestion: { hits: suggestion.value.hits, synth: suggestion.value.synth } } : {}),
  }
  // los grupos en paralelo: en el motor, sus tramos; en el código que se enseña, los encendidos enteros
  const s = liveSong()
  const items = display
    ? s.groups.filter((g) => g.on || s.cells.some((c) => c.groupOn?.includes(g.id))).map((g) => ({ id: g.id, order: g.order, window: [] }))
    : [...groupPlays].map(([gid, gp]) => ({ id: gid, order: orderOf(s, gid), window: groupWindow(groupSong(s, gid), gp) }))
  if (items.length) st.groups = { list: s.cells, items }
  if (!multi()) return st
  const at = cursor ?? { cellId: viewCellId.value, startBar: 0 }
  return { ...st, cells: { list: s.cells, order: s.order, window: windowAt(s, at, { loop, jump }) } }
}

/** Reevalúa en la siguiente microtarea (agrupa varios cambios seguidos). */
function reevaluate() {
  if (evalQueued || !S) return
  evalQueued = true
  queueMicrotask(async () => {
    evalQueued = false
    try {
      armWowo()
      await ensureVoices()
      await S!.evaluate(WOW_PRELUDE + '\n' + songCode(songState(), 'engine'), playing.value)
    } catch (e) {
      log('error', `evaluate: ${e instanceof Error ? e.message : String(e)}`)
    }
  })
}

// ── Fondo progresivo: nodos nativos en los orbits 2 y 3 (§16.13) ──────────────
function setupBackgroundNodes() {
  const controller = S!.getSuperdoughAudioController() as unknown as {
    getOrbit(n: number, ch: number[]): { output: GainNode }
    output: { connectToDestination(node: AudioNode, ch?: number[]): void }
  }
  for (const part of ['bass', 'chords'] as const) {
    const orbit = controller.getOrbit(PART_ORBIT[part], [0, 1])
    const lp = new BiquadFilterNode(ctx!, { type: 'lowpass', frequency: 150, Q: 0.7 })
    const gain = new GainNode(ctx!, { gain: 0 })
    orbit.output.disconnect()
    orbit.output.connect(lp).connect(gain)
    controller.output.connectToDestination(gain)
    bgNodes[part] = { lp, gain }
  }
}

/** Un cambio del wowo que llega del código: el bus (la célula), su wowo, el compás global en el que empieza y el `lpf`. */
interface WowChange {
  bus: number
  wow: { lpq: number; lpenv: number; lpa: number; lpd: number }
  bar: number
  value: number
}

/**
 * El wowo en el motor (spec 008, §9). El código evaluado llama a `__cbWowo(cambios)` desde `wowPlan` (ver
 * `WOW_PRELUDE` en `~/lib/song`), pero **solo si la canción tiene wowo**. Aquí, por cada célula con wowo, una
 * compuerta en su bus (`controller.getBus`, el `bus` del código: `controller.getBus`, vacío para el resto): un
 * `BiquadFilterNode` que arranca en bypass (abierto) y, en cada compás en el que cambia el filtro (por el reloj del
 * transport, `cps` del scheduler y el compás global del pulso), programa el `lpf` de esa vuelta con la envolvente del
 * wowo delante. La compuerta se planifica unos compases por delante para que el cambio llegue justo en la línea de
 * compás. Todo lo de la canción de siempre (sin wowo) no toca ningún nodo.
 */
function armWowo() {
  wowDisarm?.()
  wowDisarm = null
  const controller = S!.getSuperdoughAudioController() as unknown as {
    audioContext: AudioContext
    cps: number
    getBus(n: number): AudioNode
  }
  const g = globalThis as Record<string, unknown>
  g.__cbWowo = (changes: WowChange[]) => {
    g.__cbWowo = null
    if (!changes.length || !ctx) return
    wowDisarm = mountWowo(controller, changes)
  }
}

/**
 * Monta las compuertas del wowo y devuelve cómo desmontarlas. El reloj: `barSec` = 4 / `cps` (un compás = 1 ciclo de
 * Strudel) y el compás global sale del pulso (`lastPulseCycle`/`clock`), que el motor ya lleva para las visuales.
 */
function mountWowo(
  controller: { audioContext: AudioContext; cps: number; getBus(n: number): AudioNode },
  changes: WowChange[],
): () => void {
  const ac = controller.audioContext
  const destination = (S!.getSuperdoughAudioController() as unknown as { output: { destinationGain: AudioNode } }).output.destinationGain
  const byBus = new Map<number, WowChange[]>()
  for (const c of changes) byBus.set(c.bus, [...(byBus.get(c.bus) ?? []), c])
  const gates: { bus: number; node: BiquadFilterNode; out: StereoPannerNode; plan: WowChange[] }[] = []
  for (const [bus, plan] of byBus) {
    const node = new BiquadFilterNode(ac, { type: 'lowpass', frequency: 20000, Q: 1 })
    // la compuerta va en serie en el bus de la célula: todo lo suyo la atraviesa y luego va al mismo sitio que el bus
    // (la salida de superdough, que ya lleva el limitador maestro del motor), sin tocar el resto de la cadena
    const out = new StereoPannerNode(ac)
    controller.getBus(bus).connect(node).connect(out)
    ;(S!.getSuperdoughAudioController() as unknown as { output: { connectToDestination(n: AudioNode): void } }).output.connectToDestination(out)
    gates.push({ bus, node, out, plan: plan.sort((a, b) => a.bar - b.bar) })
  }
  // cada compás, planifica el siguiente cambio de cada compuerta (unos compases de antelación)
  const timers: ReturnType<typeof setInterval>[] = []
  for (const gate of gates) {
    const barSec = () => 4 / Math.max(0.01, controller.cps)
    const applied = new Set<number>()
    const apply = () => {
      const now = ac.currentTime
      // compás global que suena: del reloj de pulsos del motor, o 0 si aún no hay
      const base = clock ? clock.cycle - (now - clock.time) / Math.max(0.01, clock.barSec) : 0
      for (const c of gate.plan) {
        if (applied.has(c.bar) || c.bar < base - 0.01) continue
        const at = now + 0.02 + (c.bar - base) * barSec()
        if (at > now + barSec() * 2) continue
        applied.add(c.bar)
        const f = gate.node.frequency
        f.cancelScheduledValues(at)
        f.setValueAtTime(c.value, at)
        f.exponentialRampToValueAtTime(Math.min(20000, Math.max(60, c.value * 2 ** c.wow.lpenv)), at + Math.max(0.002, c.wow.lpa))
        f.exponentialRampToValueAtTime(Math.max(20, c.value), at + Math.max(0.002, c.wow.lpa) + Math.max(0.01, c.wow.lpd))
        gate.node.Q.setValueAtTime(c.wow.lpq, at)
      }
    }
    apply()
    timers.push(setInterval(apply, 120))
  }
  return () => {
    for (const t of timers) clearInterval(t)
    // fuera sin cortar el sonido: el bus pasa a ir directo (si se recarga, la compuerta nueva se pone delante)
    for (const gate of gates) {
      controller.getBus(gate.bus).disconnect(gate.node)
      gate.node.disconnect()
      gate.out.disconnect()
    }
  }
}

function rampPart(part: Part, dir: 'in' | 'out', start: number, seconds: number) {
  const n = bgNodes[part]
  const c = ctx
  if (!n || !c) return
  const beat = stepSeconds() * 4
  const t = Math.max(start, c.currentTime + 0.01)
  for (const p of [n.lp.frequency, n.gain.gain]) {
    const v = p.value
    p.cancelScheduledValues(t)
    p.setValueAtTime(v, t)
  }
  if (dir === 'in') {
    n.lp.frequency.exponentialRampToValueAtTime(20000, t + seconds)
    n.gain.gain.linearRampToValueAtTime(1, t + beat)
  } else {
    n.lp.frequency.exponentialRampToValueAtTime(150, t + seconds)
    n.gain.gain.setValueAtTime(n.gain.gain.value, t + seconds - beat)
    n.gain.gain.linearRampToValueAtTime(0, t + seconds)
  }
}

function silenceBackgroundNodes() {
  for (const n of Object.values(bgNodes)) {
    if (!n) continue
    n.lp.frequency.cancelScheduledValues(0)
    n.gain.gain.cancelScheduledValues(0)
    n.lp.frequency.value = 150
    n.gain.gain.value = 0
  }
}

function updateBackground() {
  if (!playing.value || !clock || !ctx) return
  // el fondo es el de la célula de la canción, aunque se vea una libre (que suena aparte)
  const sc = songCellNow()
  const active = sc.loops.filter((l) => !l.muted).length
  // con varias células mandan las partes de cada una (§4.2): el modo es "manual" salvo sin fondo
  const mode = multi() && bgMode.value !== 'off' ? 'manual' : bgMode.value
  const target = targetParts(active, mode, sc.parts)
  const transitions = planTransitions(plannedParts, target, nextBarLine(), style.value, mode !== 'manual')
  plannedParts = target
  const c = ctx
  for (const tr of transitions) {
    const start = barTime(tr.bar)
    const seconds = tr.bars * clock.barSec
    rampPart(tr.part, tr.dir, start, seconds)
    log('background', `${tr.part === 'bass' ? 'bajo' : 'acordes'} ${tr.dir === 'in' ? 'entra' : 'sale'} en el compás ${tr.bar}`)
    const flip = () => (bgParts.value = { ...bgParts.value, [tr.part]: tr.dir === 'in' })
    later(flip, ((tr.dir === 'in' ? start : start + seconds) - c.currentTime) * 1000)
  }
}

// ── Frases → loops ─────────────────────────────────────────────────────────────
function decide(bar: number) {
  if (!playing.value || !tracker) return
  const closed = tracker.decide(bar)
  phrase.value = tracker.snapshot()
  if (closed) finishPhrase(closed, bar)
}

// ── Melodía con la voz (spec 002, F1) ──────────────────────────────────────────
interface WorkerNote {
  start: number
  end: number
  midi: number
  rms: number
}
/** Rejilla de la duración de las notas de la voz (pasos): un cuarto de paso, cerca de lo cantado (spec 002, §17). */
const MELODY_DUR_GRID = 0.25
/** Legato: se rellenan los huecos de hasta 2 pasos entre una nota y la siguiente (spec 002, §17). */
const MELODY_LEGATO_GAP = 2
let notesSeq = 0
/** altura de la voz ahora, para el punto en vivo del aro; fuera de la reactividad (se lee en cada frame) */
let livePitchState: { midi: number | null; at: number } = { midi: null, at: 0 }
const pendingNotes = new Map<number, (n: WorkerNote[]) => void>()

/** Pide al worker las notas de la voz entre dos tiempos de contexto; si no contesta en 0,5 s, ninguna. */
function askNotes(from: number, to: number): Promise<WorkerNote[]> {
  return new Promise((resolve) => {
    const id = ++notesSeq
    const timer = setTimeout(() => {
      pendingNotes.delete(id)
      log('error', 'el worker no contestó con las notas de la melodía')
      resolve([])
    }, 500)
    pendingNotes.set(id, (n) => {
      clearTimeout(timer)
      resolve(n)
    })
    toWorker({ type: 'notes', id, from, to })
  })
}

/**
 * Una frase cerrada nace como loops. Si tiene notas de la voz, antes se piden al worker y pasan por la ayuda
 * (octavas, escala, ritmo y registro); la batería de la frase nace igual de siempre.
 */
function finishPhrase(closed: ClosedPhrase, bornAt: number, amend = false) {
  if (!melodyActive.value || !closed.hits.some((h) => h.instrument === 'mel')) return birth(closed, bornAt, amend)
  const t0 = tracker
  if (!t0 || !ctx) return
  const from = barTime(closed.startBar) - 0.5
  void askNotes(from, ctx.currentTime).then((notes) => {
    if (tracker !== t0) return // se paró o cambió el tempo mientras tanto
    const { raw, hits: melody } = melodyOfPhrase(notes, {
      assist: assist.value,
      style: style.value,
      startBar: closed.startBar,
      bars: closed.bars,
      register: STYLE_MUSIC[style.value].synth,
      stepSeconds: stepSeconds(),
      globalStep: (t) => t0.globalStep(t),
      latencySec,
      // el sonido de la melodía (spec 002, §17): la duración real de cada nota y legato en los huecos pequeños
      durGrid: MELODY_DUR_GRID,
      legatoGap: MELODY_LEGATO_GAP,
    })
    log('melody', `${raw.length} nota${raw.length === 1 ? '' : 's'} de la voz → ${melody.length} tras ${assist.value ? 'la ayuda' : 'el registro (sin ayuda)'}`)
    birth({ ...closed, melody }, bornAt, amend)
  })
}

function logLoopEvent(e: LoopEvent) {
  const steps = (l: { hits: { pos: number }[] }) => l.hits.map((h) => Math.round(h.pos * 10) / 10).join(' ')
  if (e.type === 'born')
    log(
      'born',
      `nace loop ${e.loop.id} (${e.loop.instrument}, ${e.loop.bars} c.${e.loop.fromTemplate ? ', golpe suelto → plantilla del estilo' : ''}): pasos ${steps(e.loop)}`,
    )
  else if (e.type === 'replaced') log('born', `loop ${e.loop.id} sustituido (${e.loop.instrument}, ${e.loop.bars} c.)`)
  else if (e.type === 'completed')
    log('born', `loop ${e.loop.id} completado (${e.loop.instrument}, +${e.added} golpe${e.added === 1 ? '' : 's'}): pasos ${steps(e.loop)}`)
  else log('removed', `loop ${e.id} retirado (${e.reason === 'limit' ? 'máximo de 8' : 'usuario'})`)
}

function birth(phrase: ClosedPhrase, bornAt: number, amend = false) {
  lastBirth = { startBar: phrase.startBar, bornAt }
  // diagnóstico: qué se oyó en cada frase (paso dentro de la frase) y qué pasó con cada instrumento
  const heard = phrase.hits
    .map((h) => `${h.instrument} ${(h.globalStep - phrase.startBar * 16).toFixed(1)}`)
    .join(', ')
  log(
    'phrase',
    `${amend ? 'enmienda de la frase' : 'frase'} ${phrase.startBar}–${phrase.startBar + phrase.spanBars - 1} (${repeatMode.value === 'complete' ? 'completa' : 'sustituye'}): ${phrase.hits.length} golpe${phrase.hits.length === 1 ? '' : 's'} [${heard}] → ${phrase.bars} compás(es)`,
  )
  const r = addPhrase(loops.value, phrase, {
    assist: assist.value,
    style: style.value,
    quantizeEvery: STYLES[style.value].quantizeEvery,
    bornAt,
    cellStart: birthCellStart(bornAt),
    repeat: repeatMode.value,
    amend,
  })
  loops.value = r.state
  const touched = new Set(r.events.flatMap((e) => ('loop' in e ? [e.loop.instrument] : [])))
  for (const inst of new Set(phrase.hits.map((h) => h.instrument)))
    if (inst !== 'mel' && !touched.has(inst)) log('phrase', `${inst}: sin cambios, todos sus golpes caen en pasos ya ocupados tras cuantizar`)
  for (const e of r.events) {
    logLoopEvent(e)
    if (e.type === 'born' || e.type === 'replaced' || e.type === 'completed') {
      const birthEvent: VisualHit = {
        kind: 'birth',
        loopId: e.loop.id,
        instrument: e.loop.instrument,
        time: barTime(bornAt),
        strength: 1,
      }
      visualListeners.forEach((f) => f(birthEvent))
    }
  }
  reevaluate()
  updateBackground()
}

/** Piloto automático en marcha (modo estricto): el micro real no cuenta; solo valen los golpes que mete el guion. */
let pilotStrict = false
function onWorkerMessage(m: FromWorker, fromPilot = false) {
  const c = ctx
  if (!c) return
  if (pilotStrict && !fromPilot) return
  if (m.type === 'learned') {
    writeJson(CENTERS_KEY, m.centers)
    return log('background', `el modelo por defecto aprendió tu micro: claridad pff ${m.centers[0]!.toFixed(2)} · ts ${m.centers[1]!.toFixed(2)} (el bum, por sus graves)`)
  }
  if (m.type === 'pitch') {
    livePitchState = { midi: m.midi, at: performance.now() }
    return
  }
  if (m.type === 'notes') {
    pendingNotes.get(m.id)?.(m.notes)
    pendingNotes.delete(m.id)
    return
  }
  // voz apagada (spec 016 §17): el micro puede seguir abierto, pero no se hace caso a nada de lo que oiga (las pastillas y el piloto sí entran)
  if (!listening.value && !fromPilot) return
  const uiMs = (c.currentTime - m.time) * 1000
  // con la voz grabando, el carril es exclusivo: ni golpes ni notas (spec 007 §4.1)
  if (voiceRec.value !== 'idle' && (m.type === 'hit' || m.type === 'melodic' || m.type === 'absorbed')) return log('unknown', 'ignorado: grabando voz', uiMs)
  if (m.type === 'absorbed') return log('melody', 'golpe dentro de una nota: es melodía, no batería', uiMs)
  if (m.type === 'melodic') return mode.value === 'componer' ? log('unknown', 'ignorado: modo Componer (melodía)', uiMs) : onMelodic(m, uiMs)
  if (m.type === 'echo') return log('echo', `eco descartado (${m.strength.toFixed(3)})`, uiMs)
  if (m.type === 'ignored')
    return log('unknown', `ignorado: carril apagado (${m.instrument} ${(m.confidence * 100).toFixed(0)}%)${fmtVolume(m.vol)}`, uiMs)
  // ¿acierta poco el modelo por defecto con esta voz? (spec 001 §17.4)
  if (!personalModel.value && !calibNudge.value && !fromPilot) {
    fitMonitor.push(m.instrument === 'unknown' ? null : (m.fit ?? null))
    mixMonitor.push(m.instrument)
    if ((fitMonitor.poor() || mixMonitor.allSnare()) && !nudgeDismissed()) calibNudge.value = true
  }
  if (m.instrument === 'unknown')
    return log(
      'unknown',
      `golpe desconocido (${m.strength.toFixed(3)})${fmtVolume(m.vol)}${fmtFeat(m.feat)}${lanes.value.size ? '' : ' · ningún carril graba'}`,
      uiMs,
    )
  // tempo fácil: cuatro bombos con la boca fijan el tempo (spec 005, §6)
  if (tempoTap.value.active && m.instrument === 'bd' && !isTooQuiet(m.vol) && tapTempoHook) {
    tapTempoHook(performance.now() - uiMs)
    return log('hit', `tempo: bombo ${tempoTap.value.count}/${TEMPO_TAPS}${fmtVolume(m.vol)}`, uiMs)
  }
  // ruido de fondo: un golpe mucho más flojo que los de tu calibración no cuenta (E4.5)
  if (isTooQuiet(m.vol)) return log('unknown', `flojo: descartado (${m.instrument} ${(m.confidence * 100).toFixed(0)}%)${fmtVolume(m.vol)}`, uiMs)
  if (!playing.value || !tracker) return log('stopped', `${m.instrument} sin loop en marcha`, uiMs)
  // en Componer (el mapa) no hay gota: la voz no graba (spec 011, §3.3)
  if (mode.value === 'componer') return log('unknown', `ignorado: modo Componer (${m.instrument})`, uiMs)
  // con varias células, en estado canción no se graba; en bucle, sí (spec 005, §4.4)
  if (multi() && !loop && !viewAway()) return log('unknown', `ignorado: canción avanzando (${m.instrument} ${(m.confidence * 100).toFixed(0)}%)`, uiMs)
  log('hit', `${m.instrument} ${(m.confidence * 100).toFixed(0)}%${fmtVolume(m.vol)}${fmtFeat(m.feat)}`, uiMs)
  const gs = tracker.globalStep(m.time - latencySec)
  const heard: VisualHit = {
    kind: 'heard',
    loopId: null,
    instrument: m.instrument,
    time: m.time,
    strength: Math.min(1, m.strength * 4),
    step: ((gs % 16) + 16) % 16,
  }
  visualListeners.forEach((f) => f(heard))
  const r = tracker.add({
    tCorr: m.time - latencySec,
    instrument: m.instrument,
    strength: m.strength,
    confidence: m.confidence,
  })
  phrase.value = tracker.snapshot()
  if (r.closed) finishPhrase(r.closed, nextBarLine())
  // golpe tardío de la frase recién cerrada: sus loops nacen en la misma línea de compás
  if (r.amended && lastBirth?.startBar === r.amended.startBar) finishPhrase(r.amended, lastBirth.bornAt, true)
}

/** Nace una nota de la voz (spec 002): cuenta como actividad de la frase; las notas se piden al cerrarla. */
/** Se cantó una nota: la voz manda, así que se retira la sugerida y no vuelve hasta 2 compases después (spec 012, §3.1). */
function holdVoice() {
  voiceHoldUntil = performance.now() + stepSeconds() * 16 * 2 * 1000
  if (suggestion.value) refreshSuggestion()
  if (voiceHoldTimer) clearTimeout(voiceHoldTimer)
  voiceHoldTimer = setTimeout(refreshSuggestion, stepSeconds() * 16 * 2 * 1000 + 50)
}

/** Recalcula la melodía sugerida (spec 012): la decide `suggestFor`; si cambia, se reevalúa el motor para que suene en fantasma. */
function refreshSuggestion() {
  const next = suggestFor({
    enabled: suggestions.value,
    jugar: mode.value === 'jugar',
    multi: multi(),
    loops: loops.value.loops,
    style: style.value,
    bpm: bpm.value,
    seeds: suggestSeeds,
    dismissed: suggestDismissed,
    voiceHold: performance.now() < voiceHoldUntil,
  })
  if (sameSuggestion(suggestion.value, next)) return
  suggestion.value = next
  reevaluate()
}

function onMelodic(m: Extract<FromWorker, { type: 'melodic' }>, uiMs: number) {
  const name = `${midiName(m.midi)} (${m.midi.toFixed(1)})`
  if (!playing.value || !tracker) return log('stopped', `nota ${name} sin loop en marcha`, uiMs)
  if (multi() && !loop && !viewAway()) return log('unknown', `ignorado: canción avanzando (nota ${name})`, uiMs)
  log('melody', `nota ${name}`, uiMs)
  holdVoice()
  const gs = tracker.globalStep(m.time - latencySec)
  visualListeners.forEach((f) =>
    f({ kind: 'heard', loopId: null, instrument: 'mel', time: m.time, strength: 0.6, step: ((gs % 16) + 16) % 16 }),
  )
  const r = tracker.add({ tCorr: m.time - latencySec, instrument: 'mel', strength: 0.6, confidence: 1 })
  phrase.value = tracker.snapshot()
  if (r.closed) finishPhrase(r.closed, nextBarLine())
  if (r.amended && lastBirth?.startBar === r.amended.startBar) finishPhrase(r.amended, lastBirth.bornAt, true)
}

// ── API ────────────────────────────────────────────────────────────────────────
export function useAudioEngine() {
  /**
   * Debe llamarse dentro del gesto del usuario (botón Empezar): crea y reanuda el
   * AudioContext de forma síncrona antes de cualquier await (requisito de iOS Safari).
   */
  async function start(calibration: { samples: CalibrationSample[]; norm: Norm } | null, opts: { noMic?: boolean } = {}) {
    if (ready.value) return
    ctx ??= new AudioContext({ latencyHint: 'interactive' })
    void ctx.resume()
    const silent = ctx.createBufferSource()
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silent.connect(ctx.destination)
    silent.start()

    // cadena maestra «cálida» (spec 010, §7): entrada → saturador → compresor de pegamento (worklet, sin latencia) → limitador →
    // techo −1 dB → salida (§16.12). Si el worklet no carga, sigue sin él (saturador → limitador): suena, solo que más seco.
    masterIn = new GainNode(ctx)
    const saturator = new WaveShaperNode(ctx, { curve: saturationCurve() as Float32Array<ArrayBuffer>, oversample: '2x' })
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -6, knee: 0, ratio: 20, attack: 0.001, release: 0.1 })
    const ceiling = new GainNode(ctx, { gain: 10 ** (-1 / 20) })
    // EQ de la salida (spec 047), apagado por defecto: paso alto a 30 Hz + realce de 2 a 5 kHz. Seco y mojado en paralelo: apagado, solo pasa el seco (la señal exacta de siempre)
    const eqIn = new GainNode(ctx)
    const eqOut = new GainNode(ctx)
    const eqDry = new GainNode(ctx, { gain: 1 })
    const eqWet = new GainNode(ctx, { gain: 0 })
    const eqHp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: EQ_TECHNO.highpassHz, Q: EQ_TECHNO.highpassQ })
    const eqPk = new BiquadFilterNode(ctx, { type: 'peaking', frequency: EQ_TECHNO.peakHz, Q: EQ_TECHNO.peakQ, gain: EQ_TECHNO.peakDb })
    eqIn.connect(eqDry).connect(eqOut)
    eqIn.connect(eqHp).connect(eqPk).connect(eqWet).connect(eqOut)
    eqNodes = { dry: eqDry, wet: eqWet }
    if (useStudioPrefs().eq.value) {
      eqDry.gain.value = 0
      eqWet.gain.value = 1
    }
    masterIn.connect(saturator).connect(eqIn)
    eqOut.connect(limiter).connect(ceiling).connect(ctx.destination)
    masterEnd = ceiling
    // limitador de pico del final (spec 047): techo −1 dBFS con mirada hacia delante; solo actúa si algo se pasa. Si el worklet no carga, sigue el techo de ganancia de siempre.
    const masterLimiter = async () => {
      try {
        await ctx!.audioWorklet.addModule(`${useRuntimeConfig().app.baseURL}worklets/master-limiter.js`)
        const brick = new AudioWorkletNode(ctx!, 'master-limiter', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: LIMITER_TRUE })
        ceiling.disconnect()
        ceiling.connect(brick).connect(ctx!.destination)
        masterEnd = brick
        if (videoTap) brick.connect(videoTap)
        if (analyserNode) brick.connect(analyserNode)
      } catch (e) {
        log('error', `master-limiter: ${e instanceof Error ? e.message : String(e)} (sin limitador de pico)`)
      }
    }
    const masterGlue = async () => {
      try {
        await ctx!.audioWorklet.addModule(`${useRuntimeConfig().app.baseURL}worklets/master-glue.js`)
        const glue = new AudioWorkletNode(ctx!, 'master-glue', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: GLUE_WARM })
        saturator.disconnect()
        saturator.connect(glue).connect(eqIn)
        glueNode = glue
        // spec 042: el compresor «techno» (apagado por defecto); si lo guardó la persona, entra con él
        if (useStudioPrefs().glue.value) glue.port.postMessage({ type: 'options', options: glueOptions(true) })
      } catch (e) {
        log('error', `master-glue: ${e instanceof Error ? e.message : String(e)} (sin compresor de pegamento)`)
      }
    }

    const base = useRuntimeConfig().app.baseURL
    const strudelReady = (async () => {
      S = await import('@strudel/web')
      S.setAudioContext(ctx!)
      // sin esto, los efectos con worklet (djf, shape…) fallan y abortan el evento entero
      // hasta el primer mousedown real del documento
      await S.initAudio()
      await S.initStrudel({
        prebake: async () => {
          // mismo índice que en strudel.cc (§16.12): se replica el archivo hasta su posición
          const map: Record<string, string[] | Record<string, string[]>> = {}
          map[GUITAR_SAMPLE] = guitarMap()
          Object.assign(map, PERC_SAMPLES) // la percusión del minimal (spec 045), con los nombres de strudel
          for (const k of KIT_ORDER)
            for (const inst of ['bd', 'sd', 'hh'] as const) {
              const idx = KITS[k].sampleIndex[inst]
              map[KITS[k].strudelBank ? `${KITS[k].strudelBank}_${inst}` : inst] = Array.from({ length: idx + 1 }, () => `${k}/${inst}.wav`)
            }
          // sonidos por defecto (sin .bank()), como en strudel.cc: el kit «Electrónico» (arriba) y el oh del fondo de dnb (§16.15)
          map.oh = ['default/oh.wav']
          const g = globalThis as unknown as { samples: (m: object, base: string) => Promise<void> }
          await g.samples(map, `${location.origin}${base}samples/`)
        },
      })
      ;(globalThis as Record<string, unknown>)[ENGINE_GLOBAL] = cb
      const dest = S.getSuperdoughAudioController().output.destinationGain
      dest.disconnect()
      dest.connect(masterIn!)
      setupBackgroundNodes()
    })()

    if (opts.noMic) {
      // un micro mudo: toda la cadena (captura, worker, prueba de eco) sigue igual, solo que no oye nada
      stream = ctx.createMediaStreamDestination().stream
      noMic.value = true
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
      })
      noMic.value = false
    }
    await ctx.audioWorklet.addModule(`${base}worklets/capture-processor.js`)
    await masterGlue() // antes de la prueba de eco: que mida la cadena entera
    await masterLimiter()
    const source = ctx.createMediaStreamSource(stream)
    micSource = source
    micOpen.value = !opts.noMic
    capture = new AudioWorkletNode(ctx, 'capture-processor', { numberOfInputs: 1, numberOfOutputs: 1 })
    capture.port.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; frame?: number; data?: Float32Array; peak?: number }
      if (m.type === 'chunk' && m.data && m.frame !== undefined) chunks.push({ frame: m.frame, data: m.data })
      else if (m.type === 'level') level.value = m.peak ?? 0
      else if (m.type === 'stopped') onStopped?.()
    }
    const mute = ctx.createGain()
    mute.gain.value = 0
    source.connect(capture).connect(mute).connect(ctx.destination)

    worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<FromWorker>) => onWorkerMessage(e.data)
    const channel = new MessageChannel()
    capture.port.postMessage({ type: 'stream-port' }, [channel.port1])
    const plain = JSON.parse(
      JSON.stringify(calibration?.samples.length ? { samples: calibration.samples, norm: calibration.norm } : defaultCalibration()),
    ) as { samples: CalibrationSample[]; norm: Norm }
    personalModel.value = !!calibration?.samples.length
    worker.postMessage({ type: 'init', sampleRate: ctx.sampleRate, ...plain, default: !calibration?.samples.length, centers: savedCenters() } satisfies ToWorker, [channel.port2])

    // la prueba de eco corre mientras se carga Strudel (en el iPhone el import son ~0,6 s)
    const [echoResult] = await Promise.all([runEchoTest(), strudelReady])
    echo.value = echoResult
    // con fuga del altavoz al micro, el clic se colaría en las tomas: se apaga; si no, se deja como está (apagado de entrada, o lo que la persona guardó)
    if (echoResult.bleed) metronome.value = false
    ready.value = true
    refreshImageDelay()
  }

  function setCalibration(c: { samples: CalibrationSample[]; norm: Norm }) {
    const personal = c.samples.length > 0
    const plain = JSON.parse(JSON.stringify(personal ? { samples: c.samples, norm: c.norm } : defaultCalibration())) as typeof c
    personalModel.value = personal
    calibNudge.value = false
    fitMonitor.reset()
    mixMonitor.reset()
    toWorker({ type: 'calibration', ...plain, default: !personal, centers: personal ? null : savedCenters() })
  }

  /**
   * Latencia de ida y vuelta de la calibración (s) que se usa; `rawMs` es lo guardado tal cual, para el
   * diagnóstico (una guardada negativa no se usa: `seconds` llega a 0).
   */
  function setLatency(seconds: number, rawMs: number | null | undefined = seconds * 1000) {
    latencySec = seconds
    roundTripMs.value = seconds * 1000
    savedLatencyMs.value = typeof rawMs === 'number' && Number.isFinite(rawMs) ? rawMs : null
    refreshImageDelay()
  }

  function stopSyncTest() {
    if (syncInterval) clearInterval(syncInterval)
    syncInterval = null
    syncTimes = []
    syncTest.value = false
  }

  /**
   * Prueba de sincronía (E6.8): un clic por segundo y un punto que se enciende con la latencia de la imagen
   * que haya en cada momento, así se ve al instante si el deslizador acerca el punto al clic. Para la música.
   */
  function startSyncTest() {
    const c = ctx
    if (!c || syncTest.value) return
    if (playing.value) stop()
    syncTest.value = true
    syncTimes = []
    syncFlash.value = 0
    let next = c.currentTime + 0.4
    syncInterval = setInterval(() => {
      const now = c.currentTime
      while (next < now + SYNC_LOOKAHEAD_S) {
        click(next, true)
        syncTimes.push(next)
        next += SYNC_PERIOD_S
      }
      // el destello sale cuando el reloj de la imagen alcanza al clic, con la latencia de ahora
      const { due, rest } = takeDue(syncTimes, now - outputLatency())
      syncTimes = rest
      if (due > 0) syncFlash.value++
    }, 16)
  }

  /** Ajustes del retraso de imagen (spec 003, E6): automático (según la calibración) y ajuste fino a mano. */
  function setImageDelay(p: { auto?: boolean; fineMs?: number }) {
    if (p.auto !== undefined) imageAuto.value = p.auto
    if (p.fineMs !== undefined) imageFineMs.value = sanitizeFine(p.fineMs)
    refreshImageDelay()
  }

  /** Metrónomo + grabación (calibración de latencia). */
  async function recordTake(o: TakeOptions): Promise<Take> {
    const c = requireCtx()
    stop()
    const beat = 60 / o.bpm
    const startAt = c.currentTime + 0.3
    const t0 = startAt + o.countInBeats * beat
    const end = t0 + o.recordBeats * beat
    const total = o.countInBeats + o.recordBeats
    for (let i = 0; i < total; i++) {
      const time = startAt + i * beat
      click(time, i % 4 === 0)
      setTimeout(() => o.onBeat?.(i - o.countInBeats), (time - c.currentTime) * 1000)
    }
    startCapture()
    await wait((end - c.currentTime + 0.3) * 1000)
    const { buffer, startTime } = await stopCapture()
    const clickTimes = Array.from({ length: o.recordBeats }, (_, i) => t0 + i * beat - startTime)
    return { buffer, sampleRate: c.sampleRate, t0: t0 - startTime, clickTimes }
  }

  /** Captura una ventana sin metrónomo (tomas de calibración). */
  async function captureWindow(seconds: number): Promise<{ buffer: Float32Array; sampleRate: number }> {
    const c = requireCtx()
    startCapture()
    await wait(seconds * 1000)
    const { buffer } = await stopCapture()
    return { buffer, sampleRate: c.sampleRate }
  }

  function syncFx() {
    cb.fx.djf = djfNow()
    const sp = spaceParams(fx.space)
    cb.fx.room = sp.room
    cb.fx.delay = sp.delay
    cb.fx.shape = warmthShape(fx.warmth)
  }

  /**
   * Despierta el audio si el sistema lo paró (llamada, bloqueo de pantalla o cambiar de app: en iOS el contexto queda `interrupted`/`suspended` y todo sonaría mudo).
   * Se llama desde un gesto (▶, volver a la app) y no falla si el navegador no deja.
   */
  async function wake() {
    const c = ctx
    if (!c || c.state === 'running' || c.state === 'closed') return
    try {
      await c.resume()
    } catch {
      /* sin gesto: se reintentará en el siguiente */
    }
  }

  async function play() {
    if (playing.value || !S) return
    unmute()
    await wake()
    stopSyncTest()
    // lo que informa el navegador puede cambiar al conectar o quitar unos cascos
    refreshImageDelay()
    // al arrancar, lo que ya existe suena desde el primer compás
    loops.value = { ...loops.value, loops: loops.value.loops.map((l) => ({ ...l, bornAt: 0 })) }
    // y las de las demás células (también las de los grupos en paralelo): si no, un `bornAt` de la vez anterior las deja mudas hasta ese compás
    song.value = { ...song.value, cells: song.value.cells.map((c) => ({ ...c, loops: c.loops.map((l) => ({ ...l, bornAt: 0 })) })) }
    // la canción arranca desde la célula que se ve (spec 005, §4.1); el ciclo de Strudel empieza en 0
    // con una célula de un grupo a la vista, la canción suena desde su primera célula y el grupo, aparte
    cursor = { cellId: inParallel(song.value, viewCellId.value) ? song.value.order[0]! : viewCellId.value, startBar: 0 }
    viewStartBar = 0
    prevViewId = null
    sweep = 0
    loop = false
    jump = null
    viewJump = null
    syncLoopUi()
    startGroupPlays()
    // la primera célula también puede encender o apagar grupos (compás 0)
    if (multi() && cursor) applyGroupTriggers(cursor.cellId, 0)
    syncGroupHolds()
    currentBar.value = 0
    clock = null
    tracker = null
    lastPulseCycle = -1
    plannedParts = { ...NO_PARTS }
    bgParts.value = { ...NO_PARTS }
    silenceBackgroundNodes()
    syncFx()
    const echoCfg = echo.value?.bleed ? { roundTrip: echo.value.roundTrip, echoLevel: echo.value.echoLevel } : null
    toWorker({ type: 'start', minGap: minGapForCell(stepSeconds() * STYLES[style.value].quantizeEvery), echo: echoCfg, melody: melodyActive.value })
    if (listening.value) capture?.port.postMessage('stream-on')
    playing.value = true
    try {
      armWowo()
      await S.evaluate(WOW_PRELUDE + '\n' + songCode(songState(), 'engine'), true)
    } catch (e) {
      log('error', `evaluate: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function stop() {
    if (!S) return
    cancelLive()
    if (playing.value) S.hush()
    timers.forEach(clearTimeout)
    timers = []
    capture?.port.postMessage('stream-off')
    toWorker({ type: 'stop' })
    playing.value = false
    clock = null
    tracker = null
    phrase.value = null
    lastBirth = null
    cursor = null
    sweep = 0
    groupPlays.clear()
    syncRunning()
    pinned.value = false
    loop = false
    jump = null
    viewJump = null
    syncLoopUi()
    dropActive = false
  wowDisarm?.()
  wowDisarm = null
    dropping.value = false
    plannedParts = { ...NO_PARTS }
    bgParts.value = { ...NO_PARTS }
    silenceBackgroundNodes()
  }

  /** Cambio de tempo: se para y se vuelve a arrancar (el reloj de compases cambia). */
  async function restart() {
    if (!playing.value) return reevaluate()
    stop()
    await play()
  }

  async function setStyle(id: StyleId) {
    style.value = id
    // el tempo propio es del estilo en el que se fijó: al cambiar de estilo vuelve el del nuevo
    if (song.value.bpm !== null && song.value.bpm !== undefined) song.value = { ...liveSong(), bpm: null }
    await restart()
  }

  // ── Tempo fácil (spec 005, §6): cuatro toques, o cuatro bombos con la boca ────────
  let tapTimes: number[] = []
  let tapTimer: ReturnType<typeof setTimeout> | null = null

  function cancelTempoTap() {
    if (tapTimer) clearTimeout(tapTimer)
    tapTimer = null
    tapTimes = []
    tempoTap.value = { active: false, count: 0 }
  }

  /** Enciende el tempo fácil ("toca 4 veces"); si ya estaba encendido, lo cancela. */
  function armTempoTap() {
    if (tempoTap.value.active) return cancelTempoTap()
    tapTimes = []
    tempoTap.value = { active: true, count: 0 }
    tapTimer = setTimeout(cancelTempoTap, TEMPO_TIMEOUT_MS)
  }

  /**
   * Fija el tempo de la canción (o, con `null`, vuelve al del estilo). Sonando, se aplica en la siguiente
   * línea de compás y el motor rearranca desde la célula que se ve, como al cambiar de estilo.
   */
  /** El compresor «techno» de la salida (spec 042): `true` lo enciende (ratio ~3), `false` vuelve a los ajustes de siempre. No cambia la latencia (mismo worklet). Sin el worklet, no hace nada. */
  /** El EQ de la salida (spec 047): `true` lo enciende (paso alto 30 Hz y +2,5 dB hacia 3,2 kHz), `false` deja pasar la señal exacta de siempre. Cambia con un fundido de 15 ms. */
  function setEq(on: boolean) {
    // solo en desarrollo y para el guion del navegador: la entrada de la cadena master, para mandarle una señal de prueba estable
    if (import.meta.dev && import.meta.client) (window as unknown as Record<string, unknown>).__masterIn = masterIn
    if (!ctx || !eqNodes) return
    const t = ctx.currentTime
    eqNodes.dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.005)
    eqNodes.wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.005)
    log('cell', on ? 'EQ de salida: encendido' : 'EQ de salida: apagado')
  }

  /** El medidor de la salida (spec 047): se conecta mientras se mira (`meterOn`) y se suelta al dejar de mirar (`meterOff`). `readMeter` da el pico y el RMS del último momento, en dBFS. */
  function meterOn(): boolean {
    if (!ctx || !masterEnd) return false
    if (!meterNode) {
      meterNode = ctx.createAnalyser()
      meterNode.fftSize = 2048
      meterBuf = new Float32Array(2048) as Float32Array<ArrayBuffer>
    }
    masterEnd.connect(meterNode)
    return true
  }
  function meterOff() {
    try {
      if (masterEnd && meterNode) masterEnd.disconnect(meterNode)
    } catch {
      /* ya soltado */
    }
  }
  function readMeter(): { peakDb: number; rmsDb: number } | null {
    if (!meterNode || !meterBuf) return null
    meterNode.getFloatTimeDomainData(meterBuf)
    let peak = 0
    let sum = 0
    for (const x of meterBuf) {
      const a = Math.abs(x)
      if (a > peak) peak = a
      sum += x * x
    }
    return { peakDb: 20 * Math.log10(peak + 1e-9), rmsDb: 10 * Math.log10(sum / meterBuf.length + 1e-12) }
  }

  function setGlue(on: boolean) {
    glueNode?.port.postMessage({ type: 'options', options: glueOptions(on) })
    // solo en desarrollo y para el guion del navegador: mandar unos ajustes cualquiera al compresor (comprobar que el mensaje llega)
    if (import.meta.dev && import.meta.client) (window as unknown as Record<string, unknown>).__glueSend = (o: object) => glueNode?.port.postMessage({ type: 'options', options: o })
    log('cell', on ? 'compresor techno: encendido' : 'compresor techno: apagado')
  }

  /** La escala de la canción (spec 038): se guarda con ella; `null` la quita. No toca el sonido. */
  function setSongScale(scale: SongScale | null) {
    const cur = song.value.scale ?? null
    if (cur === scale || (cur && scale && cur.tonic === scale.tonic && cur.mode === scale.mode)) return
    const { scale: _old, ...rest } = liveSong()
    song.value = scale ? { ...rest, scale } : rest
    log('cell', scale ? `escala de la canción: ${scaleLabel(scale)}` : 'sin escala de la canción')
  }

  function setBpm(value: number | null) {
    const v = value === null ? null : Math.round(value)
    const cur = song.value.bpm ?? null
    if (cur === v) return
    const apply = () => {
      song.value = { ...liveSong(), bpm: v }
      log('cell', v === null ? `tempo del estilo: ${STYLES[style.value].bpm} bpm` : `tempo: ${v} bpm`)
    }
    if (!playing.value || !clock || !ctx) {
      apply()
      return reevaluate()
    }
    later(() => {
      apply()
      void restart()
    }, (barTime(nextBarLine()) - 0.05 - ctx.currentTime) * 1000)
  }

  /**
   * Un toque (o un bombo con la boca) del tempo fácil. Devuelve true si lo ha usado (estaba encendido).
   * `at` en ms de reloj de pared; a los 4 toques fija el tempo.
   */
  function tapTempo(at: number = performance.now()): boolean {
    if (!tempoTap.value.active) return false
    tapTimes.push(at)
    if (tapTimer) clearTimeout(tapTimer)
    tapTimer = setTimeout(cancelTempoTap, TEMPO_TIMEOUT_MS)
    tempoTap.value = { active: true, count: tapTimes.length }
    if (tapTimes.length >= TEMPO_TAPS) {
      const v = tempoFromTaps(tapTimes, STYLES[style.value].bpm)
      cancelTempoTap()
      if (v !== null) setBpm(v)
    }
    return true
  }

  tapTempoHook = tapTempo

  /** Tocar el número de una célula: sus vueltas pasan a 1 → 2 → 4 → 8 → 1, sin bajar del loop más largo (§7.1). */
  function cycleTurns(id: number) {
    const s = liveSong()
    const cell = cellById(s, id)
    if (!cell) return
    const turns = nextTurns(cell.turns, minTurns(cell.loops))
    if (turns === cell.turns) return
    song.value = { ...s, cells: s.cells.map((c) => (c.id === id ? { ...c, turns } : c)) }
    log('cell', `célula ${id}: ${turns} vuelta${turns === 1 ? '' : 's'}`)
    reevaluate()
  }

  function setKit(id: KitId) {
    kit.value = id
    reevaluate()
  }

  function setMetronome(on: boolean) {
    metronome.value = on
    reevaluate()
  }

  function setAssist(on: boolean) {
    assist.value = on
  }

  function setBackgroundMode(mode: BackgroundMode) {
    const wasOff = bgMode.value === 'off'
    if (mode !== 'off') lastBgMode.value = mode
    bgMode.value = mode
    if (mode === 'off') {
      // primero se retiran con su rampa; después se quitan del código del motor
      updateBackground()
      const done = clock ? barTime(nextBarLine() + 4) : 0
      later(() => bgMode.value === 'off' && reevaluate(), (done - (ctx?.currentTime ?? 0)) * 1000)
    } else {
      if (wasOff) reevaluate()
      updateBackground()
    }
  }

  /** Bolas "bajo" / "acordes" (modo manual): entran en el siguiente compás o se retiran. */
  function toggleBackgroundPart(part: Part) {
    bgManual.value = { ...bgManual.value, [part]: !bgManual.value[part] }
    updateBackground()
  }

  function setBackgroundManual(parts: Parts) {
    bgManual.value = { ...parts }
  }

  /** Dos dedos sobre el agua: sin fondo ↔ último modo elegido. */
  function toggleBackground() {
    setBackgroundMode(bgMode.value === 'off' ? lastBgMode.value : 'off')
  }

  function setPhraseOptions(o: { closeBeats?: 1 | 2 | 4; maxBars?: LoopLength; mode?: PhraseMode }) {
    if (o.closeBeats) phraseCloseBeats.value = o.closeBeats
    if (o.maxBars) maxPhraseBars.value = o.maxBars
    if (o.mode) phraseMode.value = o.mode
    tracker = null // se recrea en el siguiente pulso con las nuevas opciones
    phrase.value = null
  }

  function setRepeatMode(m: RepeatMode) {
    repeatMode.value = m
  }

  function setFx(p: Partial<SongFx>) {
    Object.assign(fx, p)
    syncFx()
  }

  /** Drop: cierra el filtro ya y lo suelta en el 1 del compás siguiente. */
  function drop() {
    if (!playing.value || !clock || !ctx) return
    dropActive = true
    dropping.value = true
    syncFx()
    // el código se consulta ~0,15 s por delante: se suelta justo antes de la línea
    const release = barTime(nextBarLine()) - 0.15
    later(() => {
      dropActive = false
  wowDisarm?.()
  wowDisarm = null
      dropping.value = false
      syncFx()
    }, (release - ctx.currentTime) * 1000)
  }

  /** Lo que es de la canción de ahora (spec 006, §3): estilo, kit, fondo, efectos y la canción con sus células. */
  function snapshot(): SongSnapshot {
    return { style: style.value, kit: kit.value, bgMode: bgMode.value, fx: { ...fx }, song: liveSong() }
  }

  /**
   * Abre una canción guardada (spec 006, §4.3): reemplaza la de ahora (estilo, kit, fondo, efectos y
   * canción). Si sonaba, arranca de nuevo desde su primera célula, como "Cargar demo". El tempo propio va
   * dentro de la canción, así que no se pasa por `setStyle` (que lo quitaría).
   */
  async function openSaved(saved: SavedSong) {
    style.value = saved.style
    kit.value = kitFromSaved(saved.kit) ?? 'electro'
    bgMode.value = saved.bgMode
    if (saved.bgMode !== 'off') lastBgMode.value = saved.bgMode
    setFx(saved.fx)
    log('cell', `abierta «${saved.name}»`)
    await replaceSong(saved.song)
  }

  /**
   * Abre un remix (spec 008): reemplaza la canción de ahora por la del remix, con su estilo y su kit, y el fondo en
   * manual (cada célula lleva sus partes). Si sonaba, arranca de nuevo desde su primera célula. El tempo es el del
   * estilo. Los efectos de la pantalla se dejan como estaban.
   */
  async function openRemix(r: Remix) {
    style.value = r.style
    kit.value = r.kit
    bgMode.value = 'manual'
    lastBgMode.value = 'manual'
    log('cell', `remix «${r.title}» (${r.composer}) abierto: ${r.info.cells.map((c) => `${c.name} ${c.turns}`).join(' · ')}`)
    await replaceSong(r.build())
  }

  /** Pone una canción entera (guardada o demo) y enseña su primera célula. Parado. */
  function setSong(raw: Song) {
    // lo guardado antes de los grupos se migra (una libre → un grupo de una célula; una suelta, uno apagado)
    const next = normalizeSong(withValidBpm(raw))
    groupPlays.clear()
    syncRunning()
    pinned.value = false
    const first = cellById(next, next.order[0]!)!
    song.value = next
    viewCellId.value = first.id
    viewStartBar = 0
    prevViewId = null
    loops.value = { loops: first.loops.map(({ prev: _prev, ...l }) => ({ ...l, bornAt: 0 })), nextId: next.nextLoopId }
    bgManual.value = { ...first.parts }
    reevaluate()
  }

  /** Cambia de canción: si estaba sonando, para y vuelve a arrancar (el reloj de células empieza de cero). */
  async function replaceSong(next: Song) {
    const was = playing.value
    if (was) stop()
    setSong(next)
    if (was) await play()
  }

  function mute(id: number) {
    loops.value = toggleMute(loops.value, id)
    reevaluate()
    updateBackground()
  }

  function remove(id: number) {
    loops.value = removeLoop(loops.value, id)
    logLoopEvent({ type: 'removed', id, reason: 'user' })
    reevaluate()
    updateBackground()
  }

  /**
   * Carga la demo del estilo actual (§16.20): sustituye los loops por bombo, caja y platillo
   * de la demo y enciende bajo y acordes del fondo. Sonando, entra en la siguiente línea de compás.
   */
  async function loadDemo() {
    // la demo es de la canción: si se ve una célula de un grupo, se vuelve a la primera
    if (viewAway()) showCell(song.value.order[0]!, 0)
    // canción completa del estilo (spec 005), si la tiene
    const demo = demoSong(style.value)
    if (demo) {
      if (bgMode.value === 'off') {
        bgMode.value = 'manual'
        lastBgMode.value = 'manual'
      }
      // el estilo puede traer su kit (dembow: 808)
      const demoKit = DEMO_KIT[style.value]
      if (demoKit && kit.value !== demoKit) setKit(demoKit)
      log('cell', `demo-canción de ${STYLES[style.value].label} cargada: ${demo.cells.map((c) => `${c.name} ${c.turns}`).join(' · ')}`)
      return replaceSong(demo)
    }
    // el estilo puede traer su kit (hip hop: Vinilo), también en la demo de una célula
    const cellKit = DEMO_KIT[style.value]
    if (cellKit && kit.value !== cellKit) setKit(cellKit)
    // demo de una célula: si había una canción de varias, vuelve a ser de una
    if (multi()) await replaceSong({ ...emptySong(), nextLoopId: liveSong().nextLoopId })
    const bornAt = playing.value && clock ? nextBarLine() : 0
    loops.value = demoState(style.value, loops.value.nextId, bornAt)
    if (bgMode.value === 'off') {
      bgMode.value = 'manual'
      lastBgMode.value = 'manual'
    }
    bgManual.value = { bass: true, chords: true }
    log('born', `demo de ${STYLES[style.value].label} cargada`)
    for (const loop of loops.value.loops) {
      const e: VisualHit = { kind: 'birth', loopId: loop.id, instrument: loop.instrument, time: barTime(bornAt), strength: 1 }
      visualListeners.forEach((f) => f(e))
    }
    reevaluate()
    updateBackground()
  }

  /**
   * Edición en el aro (spec 003, E1.4): los loops cambian sin nacimiento (sin caída ni salpicón);
   * se reevalúa ya y suena en el siguiente paso.
   */
  function editLoops(next: LoopsState) {
    const before = loops.value.loops.length
    loops.value = next
    if (next.loops.length !== before) log('born', `edición: ${next.loops.length} loops`)
    reevaluate()
    updateBackground()
  }

  /** Enciende o apaga un carril de grabación (mantener un hueco de su franja, E4.1). */
  /** La altura de la voz ahora (MIDI decimal) si hay voz y el dato es reciente; si no, null. */
  function livePitch(): number | null {
    return melodyActive.value && playing.value && performance.now() - livePitchState.at < 200 ? livePitchState.midi : null
  }

  /**
   * Un tono corto de prueba para el órgano de la melodía (spec 002, F2): suena al poner o mover una nota, con un timbre
   * parecido al del sinte. No pasa por Strudel (es solo para oír qué nota se toca).
   */
  function previewNote(midi: number, synth: MelodySynth = STYLE_MUSIC[style.value].synth) {
    const c = ctx
    if (!c || c.state !== 'running') return
    const t = c.currentTime
    const wave = { piano: 'triangle', lead: 'square', pad: 'sawtooth', drone: 'sine', riser: 'sawtooth', crash: 'sawtooth', boom: 'sine', impacto: 'sine', downlifter: 'sawtooth', bass: 'sawtooth', keys: 'triangle', guitar: 'sawtooth', guitarDirty: 'sawtooth', guitarSample: 'sawtooth', acid: 'sawtooth', rim: 'triangle', click: 'triangle', cowbell: 'triangle', tom: 'sine', shaker: 'triangle', hat: 'triangle', hatOpen: 'triangle', sub: 'sine', cuerdas: 'sawtooth', coro: 'sawtooth', dub: 'sawtooth', stabW: 'sawtooth', leadW: 'square' }[synth] as OscillatorType
    const osc = c.createOscillator()
    const lp = c.createBiquadFilter()
    const g = c.createGain()
    osc.type = wave
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12)
    lp.type = 'lowpass'
    lp.frequency.value = synth === 'lead' ? 1800 : synth === 'guitar' || synth === 'guitarSample' ? 1500 : 2600
    const peak = 0.16
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + (synth === 'pad' ? 0.06 : 0.008))
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.42)
    osc.connect(lp).connect(g).connect(c.destination)
    osc.start(t)
    osc.stop(t + 0.45)
  }

  /** Solo desarrollo (dev/lab-aro): simula la altura de la voz para ver el punto en vivo sin micro. */
  function simulateLivePitch(midi: number | null) {
    livePitchState = { midi, at: performance.now() }
  }

  /** Enciende o apaga la melodía con la voz (⋯). En marcha, se aplica al momento. */
  function setMelody(on: boolean) {
    melodyOn.value = on
    toWorker({ type: 'melody', on: melodyActive.value })
    log('melody', `melodía con la voz ${on ? 'activada' : 'desactivada'}${on && melodyBlocked.value ? ' (pero se oye el fondo por el micro: sin efecto hasta usar cascos)' : ''}`)
  }

  function toggleLane(inst: Instrument) {
    lanes.value = toggleLaneSet(lanes.value, inst)
    toWorker({ type: 'lanes', armed: [...lanes.value] })
    log('hit', `carriles que graban: ${[...lanes.value].join(', ') || 'ninguno'}`)
  }

  /** Borrar todo: la canción vuelve a ser una célula vacía (spec 005, §11, 3.1). */
  async function clearAll() {
    setUndo({ kind: 'all', song: liveSong() })
    if (multi()) return replaceSong({ ...emptySong(), nextLoopId: liveSong().nextLoopId })
    loops.value = clearLoops(loops.value)
    reevaluate()
    updateBackground()
  }

  function onVisual(f: (h: VisualHit) => void): () => void {
    visualListeners.add(f)
    return () => visualListeners.delete(f)
  }

  /**
   * Reloj del loop para la capa visual: compás y fase (0..1) de lo que se oye ahora, es decir,
   * el tiempo de contexto menos la latencia de salida (spec 003, E1.6).
   */
  function clockNow(): { time: number; bar: number; barPhase: number } {
    const t = (ctx?.currentTime ?? 0) - outputLatency()
    if (!clock) return { time: t, bar: 0, barPhase: 0 }
    const pos = (t - clock.time) / clock.barSec + clock.cycle
    return { time: t, bar: Math.floor(pos), barPhase: pos - Math.floor(pos) }
  }

  /** Mueve una célula en el mapa (spec 005, §7.1); el orden y lo que suena no cambian. */
  function moveCell(id: number, x: number, y: number) {
    const s = liveSong()
    if (!cellById(s, id)) return
    song.value = { ...s, cells: s.cells.map((c) => (c.id === id ? { ...c, at: { ...c.at, x, y } } : c)) }
  }

  /**
   * Solo diagnóstico: la demo-canción repetida hasta `count` células, para probar el rendimiento
   * de la colonia. Devuelve false si el estilo no tiene demo-canción.
   */
  async function loadStressDemo(count: number): Promise<boolean> {
    const demo = demoSong(style.value)
    if (!demo) {
      log('cell', `prueba: ${STYLES[style.value].label} no tiene demo-canción (usa drum and bass)`)
      return false
    }
    if (bgMode.value === 'off') {
      bgMode.value = 'manual'
      lastBgMode.value = 'manual'
    }
    const song = stressSong(demo, count)
    log('cell', `prueba de rendimiento: ${song.cells.length} células`)
    await replaceSong(song)
    return true
  }

  // ── Crear, borrar y deshacer células (spec 005, §7.1, fase 3.2) ──────────────────
  /** Lo último que se borró, para "↶ deshacer" (un solo nivel; no se guarda). */
  type UndoRec =
    | { kind: 'cell'; cell: Cell; prevId: number | null; nextId: number | null; gid: number; on: boolean }
    | { kind: 'clear'; id: number; loops: FreeLoop[]; parts: Parts }
    | { kind: 'all'; song: Song }
    | { kind: 'made'; id: number }
  let undoRec: UndoRec | null = null
  let undoTimer: ReturnType<typeof setTimeout> | null = null
  const UNDO_MS = 8000

  function setUndo(rec: UndoRec) {
    if (undoTimer) clearTimeout(undoTimer)
    undoRec = rec
    undoInfo.value = rec.kind
    undoTimer = setTimeout(clearUndo, UNDO_MS)
  }
  function clearUndo() {
    if (undoTimer) clearTimeout(undoTimer)
    undoTimer = null
    undoRec = null
    undoInfo.value = null
  }

  /**
   * La canción acaba de pasar de una célula a varias (crear, o deshacer un borrado): si suena, la
   * célula que suena se queda en bucle en vez de pasar a una célula vacía; "seguir" la suelta.
   */
  function becameMulti(wasMulti: boolean) {
    if (wasMulti || !multi() || !playing.value || !cursor) return
    loop = true
    syncLoopUi()
  }

  /** Profundidad de la próxima célula nueva (para colocarla bajo el dedo en la colonia). */
  const nextCellDepth = (): number => nextDepth(liveSong().cells.length)

  /** Crea una célula vacía en `at` (mapa), al final del orden. Devuelve su id, o null con 16 células. */
  function addCell(at: { x: number; y: number; depth?: number }): number | null {
    const s = liveSong()
    const r = withNewCell(s, at)
    if (!r) {
      log('cell', 'no se crea otra célula: ya hay 16')
      return null
    }
    song.value = r.song
    log('cell', `célula nueva ${r.id}, al final del orden`)
    // una célula creada sin querer (un toque en el agua que falló al cortar un hilo) se puede deshacer
    setUndo({ kind: 'made', id: r.id })
    becameMulti(isMulti(s))
    reevaluate()
    return r.id
  }

  /** Tocar la sugerida = aceptarla: pasa a ser un loop de melodía normal (nacerá en la siguiente línea de compás, en su mismo sitio). */
  function acceptSuggestion(): boolean {
    if (pilotStrict) return false
    const sg = suggestion.value
    if (!sg || loops.value.loops.length >= MAX_LOOPS) return false
    const id = loops.value.nextId
    const born = nextBarLine()
    loops.value = {
      nextId: id + 1,
      loops: [...loops.value.loops, { id, instrument: 'mel', bars: 4, phaseBar: 0, hits: sg.hits.map((h) => ({ pos: h.pos, dur: h.dur, midi: h.midi, strength: h.strength })), muted: false, bornAt: born, fromTemplate: false }],
    }
    log('melody', `melodía sugerida aceptada (${sg.hits.length} notas, semilla ${sg.seed})`)
    suggestion.value = null
    reevaluate()
    updateBackground()
    return true
  }

  /** Al copiar, la copia sale con una variación puesta y marcada (spec 012, §5). Solo con «Sugerencias» encendido. */
  function startProposal(cellId: number, srcId: number) {
    if (pilotStrict) return
    const s = liveSong()
    const src = cellById(s, srcId)
    if (!src) return
    const g = groupIdOf(s, srcId)
    const order = g === null ? [] : orderOf(s, g)
    const kinds = variationOrder(src, order.length > 0 && order[order.length - 1] === srcId)
    const first = kinds[0]
    if (!first || first === 'same') return
    proposal.value = { cellId, kind: first, seed: 0, source: JSON.parse(JSON.stringify(src)) as Cell, kinds }
    applyProposal()
  }

  /** Pone la variación en curso en la copia. */
  function applyProposal() {
    const p = proposal.value
    if (!p) return
    const s = liveSong()
    if (!cellById(s, p.cellId)) {
      proposal.value = null // la copia ya no existe (se borró)
      return
    }
    song.value = withVariation(s, p.cellId, varyCell(p.source, p.kind, p.seed, style.value))
    loops.value = { ...loops.value, nextId: Math.max(loops.value.nextId, song.value.nextLoopId) }
    log('cell', `copia ${p.cellId}: «${p.kind}» (semilla ${p.seed})`)
    reevaluate()
  }

  /**
   * Copia la célula `srcId` en `at` (mapa): la copia es un grupo nuevo de una célula, apagado (§16.3): no
   * suena hasta que se toca. Devuelve su id, o null con 16 células.
   */
  function copyCell(srcId: number, at: { x: number; y: number }): number | null {
    const s = liveSong()
    const r = withCopy(s, srcId, at)
    if (!r) {
      log('cell', 'no se copia: ya hay 16 células')
      return null
    }
    song.value = r.song
    // los ids de loop de la copia no deben repetirse con los que se creen en la célula que se ve
    loops.value = { ...loops.value, nextId: Math.max(loops.value.nextId, r.song.nextLoopId) }
    log('cell', `célula ${srcId} copiada en la ${r.id}, grupo ${r.groupId} apagado`)
    if (suggestions.value) startProposal(r.id, srcId)
    reevaluate()
    return r.id
  }

  /**
   * Una operación de estructura (juntar, cortar): cambia qué células van en qué grupo, y con ello lo que suena.
   * La canción salta si la célula que sonaba ya no es suya; los grupos en paralelo reconcilian su posición.
   */
  function restructure(prev: Song, next: Song, what: string) {
    song.value = next
    log('cell', what)
    if (!isMulti(next)) collapseToSingle()
    else if (playing.value && cursor) {
      // la célula que suena sale de la canción: salta a la primera de las de detrás que sigan en ella
      const target = retargetMain(prev.order, next.order, cursor.cellId)
      if (target !== null) {
        loop = false
        jump = { cellId: target, startBar: jumpBarNow(), loop: false }
      } else if (jump && !next.order.includes(jump.cellId)) jump = null
    }
    becameMulti(isMulti(prev))
    reconcileGroups(next)
    syncLoopUi()
    syncGroupHolds()
    reevaluate()
    updateBackground()
  }

  /**
   * Juntar y ordenar con el asa (§16.3): `bId` pasa a sonar justo detrás de `aId`, en el grupo de `aId`; la cola de
   * un grupo sobre la cabeza de otro junta los dos enteros.
   */
  function orderAfter(aId: number, bId: number) {
    const s = liveSong()
    const next = withOrderAfter(s, aId, bId)
    if (!next) return
    restructure(s, next, `la ${bId} suena justo detrás de la ${aId}`)
  }

  /** Cortar un hilo (§16.3): el grupo se parte en dos y la parte de detrás (desde `toId`) nace apagada. */
  function cutThread(toId: number) {
    const s = liveSong()
    const next = withCut(s, toId)
    if (!next) return
    restructure(s, next, `hilo cortado: el grupo se parte antes de la célula ${toId}`)
  }

  /** Queda una sola célula en la canción: vuelve a ser la app de siempre (los demás grupos, aparte). */
  function collapseToSingle() {
    const only = cellById(song.value, song.value.order[0]!)!
    if (viewCellId.value !== only.id) showCell(only.id, 0)
    cursor = cursor && { cellId: only.id, startBar: 0 }
    viewStartBar = 0
    loop = false
    jump = null
    viewJump = null
  }

  /**
   * Borra la célula `id` (se puede deshacer). La última no se borra: se vacía. Si es la que suena,
   * deja de sonar ya y entra la siguiente en la próxima línea de compás.
   */
  function removeCell(id: number) {
    const s = liveSong()
    const cell = cellById(s, id)
    if (!cell) return
    // la última célula de la canción (la única del orden) no se borra: se vacía, aunque haya sueltas
    if (s.order.length === 1 && s.order[0] === id) {
      setUndo({ kind: 'clear', id, loops: cell.loops, parts: { ...cell.parts } })
      if (viewCellId.value === id) {
        loops.value = clearLoops(loops.value)
        bgManual.value = { ...NO_PARTS }
      } else song.value = { ...s, cells: s.cells.map((c) => (c.id === id ? { ...c, loops: [], parts: { ...NO_PARTS } } : c)) }
      log('cell', 'la última célula de la canción se vacía')
      reevaluate()
      updateBackground()
      return
    }
    const gid = groupIdOf(s, id) ?? MAIN
    const order = orderOf(s, gid)
    const i = order.indexOf(id)
    setUndo({ kind: 'cell', cell, prevId: order[i - 1] ?? null, nextId: order[i + 1] ?? null, gid, on: groupOn(s, gid) })
    const nextId = nextInOrder(s, id)
    song.value = withoutCell(s, id)
    log('cell', `célula ${id} borrada`)
    if (gid === MAIN) {
      if (!multi()) {
        // queda una sola en la canción: vuelve a ser la app de siempre
        collapseToSingle()
      } else if (playing.value && cursor) {
        if (jump?.cellId === id) jump = null
        if (viewJump?.cellId === id) viewJump = null
        if (cursor.cellId === id) {
          // suena la siguiente a partir de la próxima línea de compás; la borrada calla ya
          loop = false
          jump = jump ?? { cellId: nextId, startBar: jumpBar(), loop: false }
        }
      } else if (viewCellId.value === id) showCell(nextId, 0)
    }
    reconcileGroups(song.value)
    // si se veía la borrada y suena otra, la vista pasa a la que suena
    if (id === viewCellId.value) pinned.value = false
    if (!cellById(song.value, viewCellId.value) && !(cursor && cursor.cellId === id)) showCell(cursor?.cellId ?? nextId, cursor?.startBar ?? 0)
    syncLoopUi()
    reevaluate()
    updateBackground()
  }

  /** Deshace el último borrado (una célula, la última vaciada o "Borrar todo"). */
  function undo() {
    const rec = undoRec
    if (!rec) return
    clearUndo()
    if (rec.kind === 'all') {
      void replaceSong(rec.song)
      return
    }
    if (rec.kind === 'made') {
      // quita la célula creada, pero solo si sigue vacía (si ya la has llenado, no se pierde nada)
      const made = cellById(liveSong(), rec.id)
      if (made && !made.loops.length) {
        removeCell(rec.id)
        clearUndo()
      }
      return
    }
    const s = liveSong()
    if (rec.kind === 'clear') {
      if (!cellById(s, rec.id)) return
      if (viewCellId.value === rec.id) {
        loops.value = { loops: rec.loops, nextId: s.nextLoopId }
        bgManual.value = { ...rec.parts }
      } else song.value = { ...s, cells: s.cells.map((c) => (c.id === rec.id ? { ...c, loops: rec.loops, parts: rec.parts } : c)) }
      reevaluate()
      updateBackground()
      return
    }
    if (cellById(s, rec.cell.id) || s.cells.length >= 16) {
      log('cell', 'no se puede deshacer: la célula ya no cabe')
      return
    }
    // vuelve a su grupo, entre sus mismos vecinos; si el grupo ya no existe, como un grupo nuevo de una célula
    song.value = withRestoredCell(
      { ...s, nextLoopId: Math.max(s.nextLoopId, ...rec.cell.loops.map((l) => l.id + 1)) },
      rec.cell,
      rec.gid,
      rec.prevId,
      rec.nextId,
      rec.on,
    )
    log('cell', `célula ${rec.cell.id} recuperada`)
    // un grupo encendido que vuelve a existir suena de nuevo en la siguiente línea de compás
    const back = groupIdOf(song.value, rec.cell.id)
    if (back !== null && back !== MAIN && groupOn(song.value, back) && !groupPlays.has(back) && playing.value && clock)
      groupPlays.set(back, startGroup(orderOf(song.value, back)[0]!, jumpBarNow()))
    becameMulti(isMulti(s))
    syncGroupHolds()
    reevaluate()
  }

  /**
   * Entrar en una célula a editarla **sin cambiar lo que suena** (doble toque en la colonia o marcador del borde,
   * enmienda 3). Una de un grupo en paralelo: su grupo se queda en ella mientras se ve (§16.2). Una de la canción que
   * no suena: la vista no sigue a la canción hasta "◎ centrar". Sonando, entrar en la que suena es volver a seguirla.
   */
  function enterCell(id: number) {
    if (!cellById(song.value, id)) return
    // la que se ve y suena: doble toque = fijar la vista en ella (la canción sigue y la vista no)
    if (id === viewCellId.value) return pinView()
    const gid = groupIdOf(song.value, id)
    if (gid !== null && gid !== MAIN) {
      pinned.value = false
      const gp = groupPlays.get(gid)
      showCell(id, gp && gp.play.cursor.cellId === id ? gp.play.cursor.startBar : 0)
      reevaluate()
      return
    }
    if (!playing.value || !cursor || !multi()) {
      pinned.value = false
      showCell(id, 0)
      return
    }
    if (id === cursor.cellId) return followSong()
    pinned.value = true
    showCell(id, Math.max(0, lastPulseCycle))
    syncLoopUi()
    reevaluate()
    updateBackground()
  }

  /** Fija la vista en la célula que se ve y suena: la canción cambia de célula y la cámara se queda (enmienda 3). */
  function pinView() {
    if (!playing.value || !cursor || !multi() || cursor.cellId !== viewCellId.value) return
    pinned.value = true
    log('cell', `vista fijada en la célula ${viewCellId.value}`)
  }

  /** "◎ centrar": la vista vuelve a la célula que suena en la canción y la sigue. */
  function followSong() {
    pinned.value = false
    if (playing.value && cursor) {
      if (viewCellId.value !== cursor.cellId) showCell(cursor.cellId, cursor.startBar)
    } else if (inParallel(song.value, viewCellId.value)) showCell(song.value.order[0]!, 0)
    syncLoopUi()
    reevaluate()
    updateBackground()
  }

  /** Suelta el micro (las pistas se paran y el nodo se desconecta). */
  function closeMic() {
    if (micIdleTimer) clearTimeout(micIdleTimer)
    micIdleTimer = null
    if (noMic.value || !micOpen.value) return
    listening.value = false
    try { micSource?.disconnect() } catch { /* ya soltado */ }
    stream?.getTracks().forEach((t) => t.stop())
    micSource = null
    stream = null
    micOpen.value = false
  }

  /** Abre otra vez la salida tras el silencio de `stopAll`. */
  function unmute() {
    if (unmuteTimer) clearTimeout(unmuteTimer)
    unmuteTimer = null
    if (ctx && masterIn) {
      masterIn.gain.cancelScheduledValues(ctx.currentTime)
      masterIn.gain.setValueAtTime(1, ctx.currentTime)
    }
  }
  /** corta la voz del sintetizador sin cola */
  function thereminStopNow() {
    const v = thereminVoice
    thereminVoice = null
    thereminNote.value = null
    if (!v || !ctx) return
    v.gain.gain.cancelScheduledValues(ctx.currentTime)
    v.gain.gain.setValueAtTime(0, ctx.currentTime)
    try { v.osc.stop(ctx.currentTime + 0.02) } catch { /* ya parada */ }
  }

  /** Pasa `hits` a la célula que se ve como su loop de melodía de 4 compases (sustituye al que hubiera, que queda para deshacer). */
  function commitMelody(hits: MelodyHit[], phaseBar = 0): boolean {
    if (!hits.length) return false
    const born = clock ? nextBarLine() : 0
    const old = loops.value.loops.find((l) => l.instrument === 'mel')
    const id = old?.id ?? loops.value.nextId
    const loop: FreeLoop = { id, instrument: 'mel', bars: 4, phaseBar, hits, muted: false, bornAt: born, fromTemplate: false, ...(old?.synth ? { synth: old.synth } : {}), ...(old ? { prev: { hits: old.hits, bars: old.bars, phaseBar: old.phaseBar } } : {}) }
    if (!old && loops.value.loops.length >= MAX_LOOPS) {
      say('No caben más loops (8): quita alguno para grabar la melodía')
      return false
    }
    loops.value = { nextId: old ? loops.value.nextId : id + 1, loops: old ? loops.value.loops.map((l) => (l.id === id ? loop : l)) : [...loops.value.loops, loop] }
    reevaluate()
    updateBackground()
    say(`Melodía grabada: ${hits.length} notas${old ? ' (sustituye a la anterior)' : ''}`)
    return true
  }

  /**
   * «Proponer una melodía» (spec 060): la melodía que antes sonaba en fantasma, ahora como una capa normal de la parte que se ve, que se edita con el Órgano.
   * Se hace a petición (nunca sola): a partir del ritmo de la parte, el estilo y el tempo. `next` pide la siguiente de la misma secuencia fija. `false` si no hay ritmo.
   */
  function proposeMelody(next = false): boolean {
    if (pilotStrict) return false
    const drums = drumStepsOf(loops.value.loops)
    const key = rhythmKey(style.value, drums)
    if (next) suggestSeeds.set(key, (suggestSeeds.get(key) ?? 0) + 1)
    const hits = suggestMelody({ style: style.value, drums, bpm: bpm.value, synth: STYLE_MUSIC[style.value].synth, seed: suggestSeeds.get(key) ?? 0 })
    return commitMelody(hits)
  }

  /** Crea una célula libre (⋯ → "añadir célula libre"): un grupo nuevo de una célula, apagado y vacío; entra en ella para llenarla. */
  function addGroupCell(): number | null {
    const r = withNewGroup(liveSong())
    if (!r) {
      log('cell', 'no se crea otra célula: ya hay 16')
      return null
    }
    song.value = r.song
    log('cell', `célula libre ${r.id} creada (grupo ${r.groupId}, apagado)`)
    enterCell(r.id)
    return r.id
  }

  /** Compás global más cercano al que se puede programar un salto: nunca uno cuyo pulso ya pasó. */
  const jumpBar = () => Math.max(nextBarLine(), lastPulseCycle + 1)

  /**
   * Tocar el aro de la célula que suena la deja en bucle (§4.1). Si la transición ya está decidida
   * (a menos de 0,3 s de la línea donde acaba), el bucle es de la célula que entra.
   */
  function loopHere() {
    if (!playing.value || !cursor || !multi() || !ctx || !clock) return
    if (jump) {
      if (!jump.loop) jump = { ...jump, loop: true }
    } else if (!loop) {
      const s = liveSong()
      const end = endBar(s, curPlay())
      if (barTime(end) - ctx.currentTime < 0.3) jump = { cellId: nextInOrder(s, cursor.cellId), startBar: end, loop: true }
      else loop = true
    } else return
    syncLoopUi()
    log('cell', jump ? `bucle en la célula que entra, desde el compás ${jump.startBar}` : 'bucle en la célula que suena')
    reevaluate()
  }

  /** "▶ seguir": la célula en bucle vuelve a empezar en la siguiente línea de compás y la canción sigue (§4.1). */
  function resume() {
    if (!playing.value || !cursor || !multi() || !ctx || !clock) return
    if (jump) jump = { ...jump, loop: false }
    else if (loop) jump = { cellId: cursor.cellId, startBar: jumpBar(), loop: false }
    else return
    syncLoopUi()
    log('cell', `la canción sigue desde el compás ${jump.startBar}`)
    reevaluate()
  }

  /**
   * Viajar a una célula (marcador del borde o colonia): sonando, entra en la siguiente línea de
   * compás y queda en bucle (§4.1); parado, solo pasa a verse.
   */
  function travelTo(id: number) {
    if (!cellById(song.value, id)) return
    // una célula de un grupo en paralelo no se "viaja": se entra en ella (la canción sigue como está)
    if (inParallel(song.value, id)) return enterCell(id)
    if (!multi()) {
      // una sola célula en la canción: volver a ella es cambiar la célula que se ve
      if (id === viewCellId.value) return
      showCell(id, 0)
      if (cursor) cursor = { cellId: id, startBar: 0 }
      viewStartBar = 0
      reevaluate()
      updateBackground()
      return
    }
    if (!playing.value || !cursor || !clock || !ctx) {
      if (id !== viewCellId.value) showCell(id, 0)
      return
    }
    // si se veía algo aparte y se toca la que suena, la vista vuelve a ella; tocar otra, también (para que no haya dos "ahora")
    if (pinned.value || (!jump && id === cursor.cellId && inParallel(song.value, viewCellId.value))) {
      pinned.value = false
      if (viewCellId.value !== cursor.cellId) showCell(cursor.cellId, cursor.startBar)
    }
    if (!jump && id === cursor.cellId) return loopHere()
    const end = endBar(liveSong(), curPlay())
    jump = { cellId: id, startBar: jump ? jump.startBar : Math.min(jumpBar(), end), loop: true }
    syncLoopUi()
    log('cell', `viaja a la célula ${id}: entra en bucle en el compás ${jump.startBar}`)
    reevaluate()
  }

  /**
   * Para la transición de agua (spec 005, §5.2): la célula que se ve, de qué compás global a cuál
   * suena, la siguiente y la anterior. `null` parado o con una sola célula.
   */
  function cellPlan(): { cur: Cell; start: number; end: number; next: Cell; prev: Cell | null; loop: boolean } | null {
    // con una célula de un grupo a la vista no hay transiciones de la canción ni chapa de vueltas
    if (!playing.value || !multi() || viewAway()) return null
    const s = liveSong()
    const cur = cellById(s, viewCellId.value)
    const next = cur && cellById(s, nextInOrder(s, cur.id))
    if (!cur || !next) return null
    const prev = prevViewId === null ? null : (cellById(s, prevViewId) ?? null)
    const j = jump ?? viewJump
    const target = j && cellById(s, j.cellId)
    return {
      cur,
      start: viewStartBar,
      end: j ? j.startBar : loop ? Infinity : viewStartBar + cur.turns,
      next: target || next,
      prev,
      loop: looping.value,
    }
  }

  /**
   * Dónde va la canción (el grupo principal): su célula que suena, desde qué compás y hasta cuál. Sirve para dibujar su
   * progreso cuando se está mirando otra cosa (una célula de un grupo en paralelo), donde `cellPlan` no vale.
   */
  function songHead(): { cellId: number; start: number; end: number } | null {
    if (!playing.value || !multi() || !cursor) return null
    return { cellId: cursor.cellId, start: cursor.startBar, end: jump ? jump.startBar : loop ? Infinity : endBar(liveSong(), { cursor, loop, jump }) }
  }

  /**
   * Dónde va cada grupo en paralelo que suena (para su anillo de progreso y sus puntitos): la célula que suena, desde
   * qué compás y hasta cuál (Infinity si se repite sin fin o se queda en una célula mientras se ve).
   */
  function groupHeads(): { gid: number; cellId: number; start: number; end: number }[] {
    const s = liveSong()
    return [...groupPlays]
      .filter(([, gp]) => isRunning(gp))
      .map(([gid, gp]) => ({
        gid,
        cellId: gp.play.cursor.cellId,
        start: gp.play.cursor.startBar,
        end: gp.play.loop ? Infinity : groupEnd(groupSong(s, gid), gp),
      }))
  }

  /** Código que se muestra y se copia (§16.6). */
  const displayCode = () => songCode(songState(true), 'display')

  return {
    openRemix,
    previewNote,
    simulateLivePitch,
    livePitch,
    melodyActive,
    melodyOn,
    melodyBlocked,
    setMelody,
    ready,
    level,
    echo,
    playing,
    kit,
    mode,
    guideNonce,
    noMic,
    suggestions,
    production,
    flow,
    setFlow: (on: boolean) => {
      flow.value = on
    },
    setProduction: (on: boolean) => {
      production.value = on
      reevaluate()
    },
    suggestion,
    proposal,
    notice,
    /** ¿Se puede convertir lo que hay en una canción? Una sola célula con un ritmo hecho (spec 011 §14.2). */
    canConvert: computed(
      () =>
        !isMulti(song.value) &&
        loops.value.loops.filter((l) => l.instrument !== 'mel').reduce((n, l) => n + l.hits.length, 0) >= MIN_RHYTHM_HITS,
    ),
    /**
     * «Convertir en canción»: de un loop a la estructura del estilo (Intro, Entra, Subida, Drop, Final), con «↶ deshacer». Si había una melodía sugerida, se acepta
     * para que el Drop la lleve (con aviso). La célula de ahora se queda como el Drop.
     */
    convertSong: async (): Promise<boolean> => {
      if (isMulti(song.value)) return false
      const hadSuggestion = !!suggestion.value
      if (hadSuggestion) acceptSuggestion()
      const base = liveSong()
      const next = convertToSong(base, style.value, production.value ? { variation: true, transitions: true } : {})
      if (!next) {
        say('Hace falta un ritmo para convertirlo en canción')
        return false
      }
      setUndo({ kind: 'all', song: base })
      await replaceSong(next)
      say(`Tu canción: ${next.order.length} partes${hadSuggestion ? ' (con la melodía sugerida)' : ''}. Ábrela en Componer para retocarla`)
      log('cell', `convertida en canción: ${next.order.map((id) => next.cells.find((c) => c.id === id)?.name).join(' · ')}`)
      return true
    },
    /**
     * Piloto automático (spec 009): lo que necesita el guion del motor. **No llama a funciones internas de edición**: solo da la hora del reloj de compases y mete
     * golpes «oídos» por el mismo camino que el worker de análisis (`onWorkerMessage`), como si los hubiera oído el micro.
     */
    pilot: {
      /** el reloj: el compás que viene, su hora de contexto, lo que dura un paso y la hora ahora. `null` si no suena. */
      clock: (): { bar: number; at: (bar: number) => number; stepSec: number; now: number } | null => {
        const c = ctx
        if (!c || !clock) return null
        return { bar: nextBarLine(), at: barTime, stepSec: stepSeconds(), now: c.currentTime }
      },
      /** Un golpe «oído» en el instante de contexto `time` (se entrega ya, con el retraso del micro de mentira). */
      hear: (instrument: Instrument, time: number) =>
        onWorkerMessage({ type: 'hit', time: time + latencySec, instrument, confidence: 0.95, strength: 0.3, vol: 1, decisionMs: 30 }, true),
      /** ¿Cuánto falta (ms) para la hora de contexto `time`? (con la latencia de salida) */
      msUntil: (time: number): number => (ctx ? (time + outputLatency() - ctx.currentTime) * 1000 : 0),
      /**
       * Empieza el modo estricto: sin sugerencias, variaciones ni melodía con la voz, y el micro real no graba nada. Devuelve cómo estaba todo para `end`.
       */
      begin: () => {
        const saved = { suggestions: suggestions.value, melody: melodyOn.value, assist: assist.value, bgMode: bgMode.value, bgManual: { ...bgManual.value }, style: style.value, kit: kit.value, mode: mode.value }
        // las ayudas (sugerencias, variaciones) pueden verse, para enseñar cómo funcionan, pero **no se aplican**: solo cuenta lo que pone el guion
        pilotStrict = true
        if (melodyOn.value) setMelody(false)
        return saved
      },
      /** Comprueba que lo construido es idéntico al guion; si no, lo corrige (y lo apunta en el registro). Devuelve si cuadraba. */
      verify: (script: PilotScript): boolean => {
        const r = checkOutcome(loops.value, bgManual.value, script.final)
        if (r.ok) {
          log('cell', 'piloto: la canción es idéntica a la demo')
          return true
        }
        log('error', `piloto: no cuadraba con la demo (${r.diff.join('; ')}): corregido`)
        const next = correctLoops(loops.value, script.final, nextBarLine())
        loops.value = next
        bgManual.value = { ...script.final.parts }
        reevaluate()
        updateBackground()
        return false
      },
      /** Termina el modo estricto y deja los ajustes del usuario como estaban (lo construido se queda). */
      end: (saved: PilotSaved) => {
        pilotStrict = false
        assist.value = saved.assist
        if (melodyOn.value !== saved.melody) setMelody(saved.melody)
        refreshSuggestion()
      },
      /** El id de la última célula del orden (la que se acaba de crear o copiar). */
      lastCell: (): number => song.value.order[song.value.order.length - 1]!,
      /**
       * «Cambio lo necesario»: la célula del orden nº `index` toma el contenido de `src` (loops con ids nuevos, partes, vueltas, nombre, filtro, wowo). Lo que ningún gesto hace.
       * Devuelve si cuadra: el resultado es siempre el contenido de `src`.
       */
      fillCell: (index: number, src: Cell): boolean => {
        const s = liveSong()
        const id = s.order[index]
        if (id === undefined) return false
        let next = withVariation(s, id, src)
        next = { ...next, cells: next.cells.map((c) => (c.id === id ? { ...c, name: src.name, turns: src.turns } : c)) }
        const name = src.name
        if (!name) next = { ...next, cells: next.cells.map((c) => (c.id === id ? (({ name: _n, ...r }) => r)(c) as Cell : c)) }
        setSong(next)
        reevaluate()
        return true
      },
      /** ¿Lo construido (las células, en orden) tiene la misma música que `target`? Si no, se apunta en el registro. */
      songMatches: (target: Song): boolean => {
        const sig = (x: Song) => JSON.stringify(x.order.map((id) => { const c = x.cells.find((q) => q.id === id)!; return [c.turns, c.parts, c.lpf ?? null, c.wow ?? null, c.loops.map((l) => [l.instrument, l.bars, l.synth ?? null, l.hits.map((h) => [h.pos, h.midi ?? 0, h.dur ?? 0])])] }))
        const ok = sig(liveSong()) === sig({ ...target, order: target.order, cells: target.cells })
        log(ok ? 'cell' : 'error', ok ? 'piloto: las células construidas son idénticas a la canción' : 'piloto: las células no cuadraban con la canción (se corrige al poner la canción entera)')
        return ok
      },
      /** Copia profunda de lo del usuario (canción, estilo, kit, fondo, efectos, si sonaba) para devolverlo tal cual al acabar o parar. */
      snapshotUser: () => ({
        song: JSON.parse(JSON.stringify(liveSong())) as Song,
        style: style.value, kit: kit.value, bgMode: bgMode.value, bgManual: { ...bgManual.value }, fx: { ...fx }, playing: playing.value,
      }),
      restoreUser: async (u: { song: Song; style: StyleId; kit: KitId; bgMode: BackgroundMode; bgManual: Parts; fx: SongFx; playing: boolean }) => {
        const was = playing.value
        if (was) stop()
        style.value = u.style
        kit.value = u.kit
        bgMode.value = u.bgMode
        if (u.bgMode !== 'off') lastBgMode.value = u.bgMode
        setFx(u.fx)
        setSong(JSON.parse(JSON.stringify(u.song)) as Song)
        bgManual.value = { ...u.bgManual }
        if (u.playing) await play()
        log('cell', 'previsualización terminada: tu canción, como estaba')
      },
      /** Pone la canción previsualizada entera, sonando (la demostración final). */
      showSong: async (t: { song: Song; style: StyleId; kit: KitId }) => {
        if (playing.value) stop()
        style.value = t.style
        kit.value = t.kit
        bgMode.value = 'manual'
        setSong(JSON.parse(JSON.stringify(t.song)) as Song)
        await play()
      },
      /** «Saltar al final»: la demo de una célula del estilo (lo único que no es un gesto). */
      skipToEnd: () => loadDemo(),
    },
    /**
     * Fundir (spec 005 §21): A se añade a B y A desaparece; «↶ deshacer» devuelve las dos. Decisión simple: la canción se vuelve a poner (si sonaba, arranca de nuevo
     * desde el principio) en lugar de pasar a B en la línea de compás.
     */
    mergeCellsInto: (aId: number, bId: number): boolean => {
      const base = liveSong()
      const r = mergeCellsPure(base, aId, bId)
      if (!r) return false
      setUndo({ kind: 'all', song: base })
      void replaceSong(r.song)
      const lost = r.dropped.hits + r.dropped.notes
      say(lost ? `Fundidas · ${lost} no entraron (↶ deshacer lo devuelve todo)` : 'Fundidas')
      log('cell', `célula ${aId} fundida en ${bId}: ${r.dropped.hits} golpes iguales, ${r.dropped.notes} notas que no cupieron`)
      return true
    },
    /**
     * El audio de la app (lo que se oye, sin el micro) **sin comprimir**, para exportarlo a MP3 (spec 054): una captura estéreo de la salida maestra (después del limitador). `null` si todavía no hay audio
     * o el navegador no admite worklets. `frames()` y `firstFrame()` dicen cuánto se lleva y dónde empieza la música (el primer fotograma con sonido, −1 si aún no); `stop()` da los bloques.
     */
    pcmCapture: async (): Promise<{ sampleRate: number; start: () => void; frames: () => number; firstFrame: () => number; stop: () => Promise<{ l: Float32Array[]; r: Float32Array[] }> } | null> => {
      if (!ctx || !masterEnd) return null
      const c = ctx
      try {
        await c.audioWorklet.addModule(`${useRuntimeConfig().app.baseURL}worklets/pcm-capture.js`)
        const node = new AudioWorkletNode(c, 'pcm-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
        const mute = c.createGain()
        mute.gain.value = 0
        masterEnd.connect(node)
        node.connect(mute).connect(c.destination)
        const l: Float32Array[] = []
        const r: Float32Array[] = []
        let frames = 0
        let first = -1
        let stopped: () => void = () => {}
        const done = new Promise<void>((res) => (stopped = res))
        node.port.onmessage = (e: MessageEvent<{ type: string; l?: Float32Array; r?: Float32Array }>) => {
          if (e.data.type === 'stopped') return stopped()
          if (e.data.type !== 'chunk' || !e.data.l || !e.data.r) return
          if (first < 0) {
            const i = firstSound(e.data.l, e.data.r)
            if (i >= 0) first = frames + i
          }
          l.push(e.data.l)
          r.push(e.data.r)
          frames += e.data.l.length
        }
        return {
          sampleRate: c.sampleRate,
          start: () => node.port.postMessage('start'),
          frames: () => frames,
          firstFrame: () => first,
          stop: async () => {
            node.port.postMessage('stop')
            await done
            try {
              masterEnd?.disconnect(node)
              node.disconnect()
              mute.disconnect()
            } catch {
              /* ya desconectado */
            }
            return { l, r }
          },
        }
      } catch (e) {
        log('error', `pcm-capture: ${e instanceof Error ? e.message : String(e)}`)
        return null
      }
    },
    /** El audio de la app (lo que se oye, sin el micro) como un flujo para grabarlo en vídeo. `null` si todavía no hay audio. */
    videoAudio: (): MediaStream | null => {
      if (!ctx || !masterEnd) return null
      if (!videoTap) {
        videoTap = ctx.createMediaStreamDestination()
        masterEnd.connect(videoTap)
      }
      return videoTap.stream
    },
    /**
     * La energía del audio que se oye, en `count` bandas de 0 a 1 (la animación de la tarjeta, spec 061, paso 4). Solo escucha el final de la cadena maestra con un `AnalyserNode`:
     * no cambia el sonido ni toca el reloj. `null` si todavía no hay audio.
     */
    levels: (count = 5): number[] | null => {
      if (!ctx || !masterEnd) return null
      if (!analyserNode) {
        analyserNode = new AnalyserNode(ctx, { fftSize: ANALYSER_FFT, smoothingTimeConstant: 0.5 })
        analyserBuf = new Uint8Array(analyserNode.frequencyBinCount)
        masterEnd.connect(analyserNode)
      }
      analyserNode.getByteFrequencyData(analyserBuf!)
      return bandLevels(analyserBuf!, ctx.sampleRate, ANALYSER_FFT, bandEdges(count))
    },
    /**
     * Baja la salida a cero en `seconds` (el fundido del final del vídeo de la tarjeta, spec 061). Solo rampa la ganancia maestra: no toca el reloj. `play()` la devuelve a 1.
     */
    fadeOut: (seconds: number) => {
      if (!ctx || !masterIn) return
      const t = ctx.currentTime
      masterIn.gain.cancelScheduledValues(t)
      masterIn.gain.setValueAtTime(masterIn.gain.value, t)
      masterIn.gain.linearRampToValueAtTime(0, t + Math.max(0.05, seconds))
    },
    voiceRec,
    voiceEnv,
    voiceMissing,
    /** ¿Se puede grabar la voz? Sonando, una sola célula, y sin fuga del fondo al micro (cascos). */
    canVoice: computed(() => playing.value && !isMulti(song.value) && !melodyBlocked.value),
    /** el loop de melodía creado al cantar la última vez (para «borrar toma»); solo vale mientras siga en la parte */
    lastSung,
    /**
     * «Cantar esta parte» (spec 039): como «Grabar voz», arranca en la siguiente línea de compás (con un compás de cuenta) y graba `bars` compases; al acabar, detecta las notas
     * con el detector de siempre, las ajusta a la escala de la canción, las cuantiza a la rejilla y **añade un loop de melodía nuevo** a la parte (no sustituye nada). Devuelve el resultado.
     * Otra pulsación mientras espera o graba, lo cancela. No toca el reloj: usa la misma captura y las mismas líneas de compás que la voz.
     */
    singPart: async (bars: SingBars, scale: SongScale): Promise<'ok' | 'canceled' | 'no-play' | 'headphones' | 'full' | 'nothing'> => {
      if (voiceRec.value !== 'idle') {
        voiceCancel = true
        return 'canceled'
      }
      const c = ctx
      if (!c || !clock || !playing.value) return 'no-play'
      if (melodyBlocked.value) {
        say('Para cantar hacen falta cascos (se oye el fondo por el micro)')
        return 'headphones'
      }
      if (melodyCount(loops.value.loops) >= MAX_PART_MELODIES || loops.value.loops.length >= MAX_LOOPS) {
        say(`Ya hay ${MAX_PART_MELODIES} melodías en esta parte: borra alguna antes`)
        return 'full'
      }
      voiceCancel = false
      const bar = nextBarLine() + 1
      const start = barTime(bar)
      voiceRec.value = 'armed'
      say('Canta desde el siguiente compás')
      startCapture()
      const len = bars * 16 * stepSeconds()
      const wake = (t: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, (t - (ctx?.currentTime ?? 0)) * 1000)))
      try {
        await wake(start)
        if (!voiceCancel) voiceRec.value = 'recording'
        await wake(start + len + latencySec + 0.35)
        voiceRec.value = 'saving'
        const cap = await stopCapture()
        if (voiceCancel || !playing.value) return 'canceled'
        const cut = cutBars(cap.buffer, cap.startTime, c.sampleRate, start, bars, bpm.value, latencySec)
        const { hits, heard } = hitsFromSung(cut, c.sampleRate, { scale, bars, stepSeconds: stepSeconds(), register: STYLE_MUSIC[style.value].synth })
        log('melody', `cantar la parte: ${heard} nota${heard === 1 ? '' : 's'} oída${heard === 1 ? '' : 's'} → ${hits.length} en ${scaleLabel(scale)}`)
        if (!hits.length) {
          say('No se oyó ninguna nota: no se crea nada')
          return 'nothing'
        }
        const born = Math.max(bar + bars, nextBarLine())
        // la toma empezó en el compás `bar`; la parte empezó en `birthCellStart`: el loop (de `bars` compases) cae en el mismo sitio que lo cantado
        const phaseBar = (((bar - birthCellStart(born)) % bars) + bars) % bars
        const id = loops.value.nextId
        loops.value = { nextId: id + 1, loops: [...loops.value.loops, { id, instrument: 'mel', bars, phaseBar, hits, muted: false, bornAt: born, fromTemplate: false }] }
        lastSung.value = id
        reevaluate()
        updateBackground()
        say(`Melodía cantada: ${hits.length} notas en ${scaleLabel(scale)}`)
        return 'ok'
      } finally {
        voiceRec.value = 'idle'
        voiceCancel = false
      }
    },
    /**
     * «Grabar voz» (spec 007 F1, simplificada): arranca en la siguiente línea de compás y graba `bars` compases fijos (1, 2 o 4); al acabar corta la toma alineada
     * (con la latencia corregida), la guarda en IndexedDB y nace el loop de voz en la línea siguiente. Otra pulsación mientras espera o graba, lo cancela.
     */
    recordVoice: async (bars: VoiceBars = 2): Promise<boolean> => {
      if (voiceRec.value !== 'idle') {
        voiceCancel = true
        return false
      }
      const c = ctx
      if (!c || !clock || !playing.value || isMulti(song.value)) return false
      if (melodyBlocked.value) {
        say('Para grabar la voz hacen falta cascos (se oye el fondo por el micro)')
        return false
      }
      if (loops.value.loops.length >= MAX_LOOPS) {
        say('No caben más loops (8)')
        return false
      }
      // con Bluetooth la voz puede quedar desalineada: se avisa, pero se puede grabar
      const warn = bluetoothWarning(Math.max(roundTripMs.value, latencySec * 1000))
      if (warn) say(warn)
      voiceCancel = false
      const bar = nextBarLine() + 1
      const start = barTime(bar)
      voiceRec.value = 'armed'
      if (!warn) say('Canta desde el siguiente compás')
      startCapture()
      const len = (bars * 16 * stepSeconds())
      const wake = (t: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, (t - (ctx?.currentTime ?? 0)) * 1000)))
      await wake(start)
      if (!voiceCancel) voiceRec.value = 'recording'
      await wake(start + len + latencySec + 0.35)
      voiceRec.value = 'saving'
      const cap = await stopCapture()
      try {
        if (voiceCancel || !playing.value) return false
        const take = prepareTake({ buffer: cap.buffer, startTime: cap.startTime, sampleRate: c.sampleRate }, start, bars, bpm.value, latencySec)
        if (!take) {
          say('No se oyó voz: no se guarda')
          return false
        }
        const id = newVoiceId()
        const res = await saveVoice({ id, pcm: take.pcm.buffer as ArrayBuffer, sampleRate: take.sampleRate, envelope: take.envelope, createdAt: Date.now() })
        if (res === 'rejected') {
          say('La toma pesa demasiado: no se guarda')
          return false
        }
        await registerVoice(id, fromPcm16(take.pcm), take.sampleRate)
        voiceEnv.value = { ...voiceEnv.value, [id]: take.envelope }
        const born = Math.max(bar + bars, nextBarLine())
        const lid = loops.value.nextId
        loops.value = {
          nextId: lid + 1,
          loops: [...loops.value.loops, { id: lid, instrument: 'voz', bars, phaseBar: bar, hits: [], muted: false, bornAt: born, fromTemplate: false, voice: { audio: id, bpm: bpm.value, sampleRate: take.sampleRate } }],
        }
        log('born', `voz grabada: ${bars} compases desde el ${bar}, nace en el ${born}${res === 'memory' ? ' (solo en esta sesión: sin almacenamiento)' : ''}`)
        say(res === 'memory' ? 'Voz grabada (solo vale hasta cerrar: no hay almacenamiento)' : 'Voz grabada')
        reevaluate()
        updateBackground()
        return true
      } finally {
        voiceRec.value = 'idle'
        voiceCancel = false
      }
    },
    wake,
    thereminNote,
    thereminShown,
    hideActions,
    drawLevel,
    /** Empieza (o sigue) el sonido continuo del sintetizador: `fy` = altura (nota de la escala, con histéresis), `fx` = filtro. Devuelve la nota (MIDI) o null si no se puede. */
    thereminMove: (fx: number, fy: number, force?: number): number | null => {
      const c = ctx
      if (!c || c.state !== 'running' || !masterIn) return null
      const notes = scaleNotes(style.value)
      if (!notes.length) return null
      const forced = force !== undefined ? notes.indexOf(force) : -1
      const idx = forced >= 0 ? forced : noteIndexAt(fy, notes.length, thereminVoice?.idx ?? null)
      const midi = notes[idx]!
      const now = c.currentTime
      if (!thereminVoice) {
        const synth = STYLE_MUSIC[style.value].synth
        const type = ({ piano: 'triangle', lead: 'square', pad: 'sawtooth', drone: 'sine' } as Record<string, OscillatorType>)[synth] ?? 'triangle'
        const osc = new OscillatorNode(c, { type, frequency: midiToHz(midi) })
        const filter = new BiquadFilterNode(c, { type: 'lowpass', frequency: brightnessAtX(fx), Q: 4 })
        const gain = new GainNode(c, { gain: 0 })
        osc.connect(filter).connect(gain).connect(masterIn)
        osc.start()
        gain.gain.setTargetAtTime(0.3, now, 0.02)
        thereminVoice = { osc, filter, gain, idx: null }
      }
      const v = thereminVoice
      v.filter.frequency.setTargetAtTime(brightnessAtX(fx), now, 0.03)
      if (v.idx !== idx) {
        v.osc.frequency.setTargetAtTime(midiToHz(midi), now, 0.025) // se desliza en vez de saltar
        v.idx = idx
        thereminNote.value = midi
        keysLast.value = { n: keysLast.value.n + 1, midi }
        toWorker({ type: 'output', times: [now + 0.01] })
        if (keysRec.value && clock) {
          keyEvents.push({ time: now, midi })
          keysRec.value = { count: keyEvents.length }
          keysHits.value = keysToHits(keyEvents, barTime(0), stepSeconds(), 4)
        }
      }
      return midi
    },
    listening,
    micOpen,
    /**
     * Enciende o apaga la voz (spec 016 §17). **Apagada**: el micro sigue abierto (así no se vuelve a pedir permiso) pero no se analiza ni se graba nada; pasados 2,5 minutos
     * apagada, el micro se **cierra de verdad** (y al encenderla se vuelve a abrir). Devuelve `false` si no se pudo abrir el micro.
     */
    setListening: async (on: boolean): Promise<boolean> => {
      if (micIdleTimer) clearTimeout(micIdleTimer)
      micIdleTimer = null
      if (on) {
        if (!noMic.value && !micOpen.value && ctx && capture) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } })
            micSource = ctx.createMediaStreamSource(stream)
            micSource.connect(capture)
            micOpen.value = true
          } catch {
            say('No se pudo abrir el micro')
            return false
          }
        }
        listening.value = true
        if (playing.value) capture?.port.postMessage('stream-on')
        return true
      }
      listening.value = false
      capture?.port.postMessage('stream-off')
      micIdleTimer = setTimeout(() => closeMic(), 150_000)
      return true
    },
    /** Cierra el micro de verdad (suelta el permiso de uso: desaparece el indicador del navegador). La voz queda apagada. */
    closeMic: () => closeMic(),
    /**
     * Suena la nota `midi` de un toque de la melodía de la portada (spec 016 §16): con el sinte del estilo, **al instante** (si hay un paso del compás a ≤ 70 ms por delante, cae en él)
     * y se apunta en la toma; 1,2 s después del último toque, la toma pasa a ser el loop de melodía (cuantizado al paso más cercano, una nota por paso, 4 compases).
     */
    tapNote: (midi: number, commit = true): boolean => {
      const c = ctx
      if (!c || !S || c.state !== 'running') return false
      const now = c.currentTime + 0.01
      const t = clock ? softQuantize(now, barTime(0), stepSeconds()) : now
      const synth = STYLE_MUSIC[style.value].synth
      const wave = { piano: 'triangle', lead: 'square', pad: 'sawtooth', drone: 'sine' }[synth as 'piano'] ?? 'triangle'
      void (S as unknown as { superdough: (v: object, t: number, d: number) => Promise<unknown> }).superdough({ s: wave, note: midi, lpf: 3200, attack: 0.005, decay: 0.35, sustain: 0.25, release: 0.3, gain: 0.55, room: 0.25 }, t, 0.55)
      toWorker({ type: 'output', times: [t] })
      keysLast.value = { n: keysLast.value.n + 1, midi }
      if (clock && commit) {
        tapTake.add({ time: t, midi })
        if (tapCommit) clearTimeout(tapCommit)
        tapCommit = setTimeout(() => {
          tapCommit = null
          if (!clock) return
          const hits = keysToHits([...tapTake.list], barTime(0), stepSeconds(), 4)
          if (hits.length) commitMelody(hits)
        }, COMMIT_IDLE * 1000)
      }
      return true
    },
    /**
     * Efectos sueltos del laboratorio (DJ): un platillo de ruido (`crash`) o una subida de ruido que se abre a lo largo de `bars` compases (`riser`). Salen por la cadena maestra.
     * Sin probar de oído.
     */
    fxShot: (kind: 'crash' | 'riser', bars = 1): boolean => {
      const c = ctx
      if (!c || !S || c.state !== 'running') return false
      const sd = (S as unknown as { superdough: (v: object, t: number, d: number) => Promise<unknown> }).superdough
      const t = c.currentTime + 0.02
      if (kind === 'crash') void sd({ s: 'white', hpf: 5500, attack: 0.002, decay: 1.4, sustain: 0, release: 0.6, gain: 0.5, room: 0.35 }, t, 0.1)
      else {
        const dur = Math.max(0.5, (clock?.barSec ?? 2) * bars)
        void sd({ s: 'pink', hpf: 400, hpenv: 6, hpattack: dur, hpdecay: 0.01, attack: dur * 0.9, decay: 0.05, sustain: 1, release: 0.05, gain: 0.45 }, t, dur)
      }
      return true
    },
    /** Empezar otra melodía por toques (borrar, cambiar de tema): la toma en curso se olvida y no pasa al loop. */
    tapReset: () => {
      tapTake.reset()
      if (tapCommit) clearTimeout(tapCommit)
      tapCommit = null
    },
    /**
     * El ■ de la portada: **para todo al instante** (base, ritmo, melodía, voz del sintetizador y colas). Además de parar el reloj, la salida se silencia de golpe y se
     * vuelve a abrir al cabo de 1,5 s (para que no queden colas de reverb) o en cuanto se da a ▶.
     */
    stopAll: () => {
      if (tapCommit) clearTimeout(tapCommit)
      tapCommit = null
      tapTake.reset()
      thereminStopNow()
      choirStopNow(true)
      stop()
      if (ctx && masterIn) {
        masterIn.gain.cancelScheduledValues(ctx.currentTime)
        masterIn.gain.setTargetAtTime(0, ctx.currentTime, 0.006)
        if (unmuteTimer) clearTimeout(unmuteTimer)
        unmuteTimer = setTimeout(unmute, 1500)
      }
    },
    /**
     * Programa una nota del sintetizador **a la hora de audio `when`** (modo espiral sincronizado, spec 016 §9.3): no depende del fotograma, así cae justo en su paso del compás.
     * Si no había voz, nace en silencio y sube a esa hora. `fx` es el brillo.
     */
    thereminAt: (midi: number, when: number, fx: number): boolean => {
      const c = ctx
      if (!c || c.state !== 'running' || !masterIn) return false
      const t = Math.max(when, c.currentTime)
      if (!thereminVoice) {
        const synth = STYLE_MUSIC[style.value].synth
        const type = ({ piano: 'triangle', lead: 'square', pad: 'sawtooth', drone: 'sine' } as Record<string, OscillatorType>)[synth] ?? 'triangle'
        const osc = new OscillatorNode(c, { type, frequency: midiToHz(midi) })
        const filter = new BiquadFilterNode(c, { type: 'lowpass', frequency: brightnessAtX(fx), Q: 4 })
        const gain = new GainNode(c, { gain: 0 })
        osc.connect(filter).connect(gain).connect(masterIn)
        osc.start()
        thereminVoice = { osc, filter, gain, idx: null }
      }
      const v = thereminVoice
      v.osc.frequency.setTargetAtTime(midiToHz(midi), t, 0.02)
      v.filter.frequency.setTargetAtTime(brightnessAtX(fx), c.currentTime, 0.03)
      v.gain.gain.setTargetAtTime(0.3, t, 0.015)
      toWorker({ type: 'output', times: [t] })
      keysLast.value = { n: keysLast.value.n + 1, midi }
      const ms = Math.max(0, (t - c.currentTime) * 1000)
      setTimeout(() => (thereminNote.value = midi), ms)
      return true
    },
    /** Apaga la nota a la hora de audio `when` (cuando hay hueco hasta la siguiente). */
    thereminGateAt: (when: number) => {
      if (thereminVoice && ctx) thereminVoice.gain.gain.setTargetAtTime(0, Math.max(when, ctx.currentTime), 0.04)
    },
    /** La hora de audio ahora y la latencia de salida (s): la imagen se corrige con ella para que lo que se ve coincida con lo que se oye. */
    audioNow: (): number => ctx?.currentTime ?? 0,
    outLatencySec: (): number => outputLatency(),
    /** El reloj de compases del motor (el próximo compás, su hora y cada compás por su número), o `null` si no suena. Solo se lee: la espiral no toca el reloj. */
    barClock: (): { bar: number; at: (bar: number) => number; now: number; stepSec: number } | null => {
      const c = ctx
      if (!c || !clock) return null
      return { bar: nextBarLine(), at: barTime, now: c.currentTime, stepSec: stepSeconds() }
    },
    /**
     * Una pastilla de la portada (spec 016): suena el golpe **al instante** y entra en el loop como un golpe de voz hecho en ese momento (mismo camino: frase, compás de nacimiento,
     * gota). `false` si no suena la música o no hay audio.
     */
    tapPad: (instrument: 'bd' | 'sd' | 'hh'): boolean => {
      const c = ctx
      if (!c || !S || c.state !== 'running') return false
      const t = c.currentTime + 0.01
      const k = KITS[kit.value]
      void (S as unknown as { superdough: (v: object, t: number, d: number) => Promise<unknown> }).superdough({ s: k.strudelBank ? `${k.strudelBank}_${instrument}` : instrument, gain: 0.9 }, t, 0.6)
      toWorker({ type: 'output', times: [t] })
      if (playing.value && tracker) onWorkerMessage({ type: 'hit', time: t + latencySec, instrument, confidence: 1, strength: 0.3, vol: 1, decisionMs: 0 }, true)
      return true
    },
    /** Solo el filtro (el brillo) de la nota que suena, sin cambiar de nota (modo espiral: el dedo solo da el brillo). */
    thereminFilter: (fx: number) => {
      if (thereminVoice && ctx) thereminVoice.filter.frequency.setTargetAtTime(brightnessAtX(fx), ctx.currentTime, 0.03)
    },
    /**
     * El coro (laboratorio): `fy` (0 arriba … 1 abajo) elige la nota de la escala del estilo y suenan otras dos a dos y cuatro grados por encima (siempre en la escala: no hay nota mala);
     * `fx` es el brillo. Devuelve los tres índices de nota (del grave al agudo) y las notas MIDI, o null si no hay audio. Sin probar de oído.
     */
    choirMove: (fx: number, fy: number): { idx: number[]; midi: number[] } | null => {
      const c = ctx
      if (!c || c.state !== 'running' || !masterIn) return null
      const notes = scaleNotes(style.value)
      if (notes.length < 5) return null
      const idx0 = noteIndexAt(fy, notes.length - 4, choir?.idx ?? null)
      const idx = [idx0, idx0 + 2, idx0 + 4]
      const midi = idx.map((i) => notes[i]!)
      const now = c.currentTime
      if (!choir) {
        const synth = STYLE_MUSIC[style.value].synth
        const type = ({ piano: 'triangle', lead: 'sawtooth', pad: 'sawtooth', drone: 'sine' } as Record<string, OscillatorType>)[synth] ?? 'sawtooth'
        const filter = new BiquadFilterNode(c, { type: 'lowpass', frequency: brightnessAtX(fx), Q: 3 })
        const gain = new GainNode(c, { gain: 0 })
        const oscs = midi.map((m) => new OscillatorNode(c, { type, frequency: midiToHz(m), detune: (Math.random() - 0.5) * 12 }))
        for (const o of oscs) {
          o.connect(filter)
          o.start()
        }
        filter.connect(gain).connect(masterIn)
        gain.gain.setTargetAtTime(0.16, now, 0.05)
        choir = { oscs, filter, gain, idx: null }
      }
      const v = choir
      v.filter.frequency.setTargetAtTime(brightnessAtX(fx), now, 0.04)
      if (v.idx !== idx0) {
        v.oscs.forEach((o, k) => o.frequency.setTargetAtTime(midiToHz(midi[k]!), now, 0.04))
        v.idx = idx0
      }
      return { idx, midi }
    },
    choirStop: () => choirStopNow(false),
    /** Suelta el dedo: la nota se apaga con una cola corta. */
    thereminStop: () => {
      const v = thereminVoice
      thereminVoice = null
      thereminNote.value = null
      if (!v || !ctx) return
      const now = ctx.currentTime
      v.gain.gain.cancelScheduledValues(now)
      v.gain.gain.setTargetAtTime(0, now, 0.06)
      v.osc.stop(now + 0.5)
      setTimeout(() => { try { v.osc.disconnect(); v.filter.disconnect(); v.gain.disconnect() } catch { /* ya soltado */ } }, 700)
    },
    /** «+ melodía»: crea una célula libre de tipo melodía y entra en ella. */
    addMelodyCell: (): number | null => {
      const id = addGroupCell()
      if (id === null) return null
      song.value = { ...song.value, cells: song.value.cells.map((c) => (c.id === id ? { ...c, kind: 'melodia' as const } : c)) }
      return id
    },
    keysOn,
    keysRec,
    keysHits,
    keysLast,
    setKeys: (on: boolean) => {
      keysOn.value = on
      if (!on) {
        keysRec.value = null
        keyEvents = []
        keysHits.value = []
      }
    },
    /**
     * Una nota del agua (fx, fy en 0..1 de la pantalla), **al instante**: horizontal = nota de la escala (en los tiempos fuertes, del acorde), vertical = brillo. Arrastrando solo suena al
     * cambiar de nota (y no más de ~8 por segundo). Registrada como salida para el micro (EchoGate) y, si se graba, apuntada.
     */
    keysPlay: (fx: number, fy: number, drag = false): boolean => {
      const c = ctx
      if (!c || !S || c.state !== 'running') return false
      const stepSec = stepSeconds()
      const bar = clock ? Math.floor((c.currentTime - clock.time) / clock.barSec) + clock.cycle : 0
      const step = clock ? Math.floor((((c.currentTime - barTime(bar)) / stepSec) % 16 + 16) % 16) : 0
      const midi = noteAtY(fy, scaleNotes(style.value), style.value, bar, step % 4 === 0)
      if (drag && midi === lastKey.midi && c.currentTime - lastKey.at < 0.4) return false
      if (c.currentTime - lastKey.at < 0.12) return false
      lastKey = { midi, at: c.currentTime }
      const t = c.currentTime + 0.01
      const synth = STYLE_MUSIC[style.value].synth
      const wave = { piano: 'triangle', lead: 'square', pad: 'sawtooth', drone: 'sine' }[synth as 'piano'] ?? 'triangle'
      void (S as unknown as { superdough: (v: object, t: number, d: number) => Promise<unknown> }).superdough(
        { s: wave, note: midi, lpf: brightnessAtX(fx), attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.3, gain: 0.5, room: 0.3 }, t, 0.35,
      )
      toWorker({ type: 'output', times: [t] })
      keysLast.value = { n: keysLast.value.n + 1, midi }
      if (keysRec.value && clock) {
        keyEvents.push({ time: t, midi })
        keysRec.value = { count: keyEvents.length }
        keysHits.value = keysToHits(keyEvents, barTime(0), stepSeconds(), 4)
      }
      return true
    },
    /** «Grabar»: apunta lo tocado; al terminar pasa a la célula como un loop de melodía de 4 compases (cuantizado), sustituyendo al que hubiera. */
    toggleKeysRec: (): boolean => {
      if (!keysRec.value) {
        if (!playing.value) return false
        keyEvents = []
        keysHits.value = []
        keysRec.value = { count: 0 }
        return true
      }
      const events = keyEvents
      keyEvents = []
      keysRec.value = null
      keysHits.value = []
      if (!clock || !events.length) return false
      return commitMelody(keysToHits(events, barTime(0), stepSeconds(), 4))
    },
    /** Guarda una melodía ya hecha (el modo guiado del sintetizador) como el loop de melodía de la célula que se ve, sustituyendo al anterior (con «deshacer»). */
    saveMelody: (hits: MelodyHit[], phaseBar = 0): boolean => commitMelody(hits, phaseBar),
    stageOn,
    fxRec,
    setStage: (on: boolean) => {
      stageOn.value = on
      if (!on) {
        fxRec.value = null
        fxEvents = []
      }
    },
    /**
     * Un golpe de efecto, **al instante** (sin esperar a la rejilla). `false` si pasa del tope por segundo o no se puede sonar. Se registra como salida para que
     * el micro no lo cuente como golpe de voz (EchoGate), y si se graba, se apunta.
     */
    fireFx: (kind: FxKind): boolean => {
      const c = ctx
      if (!c || !S || c.state !== 'running' || !fxLimiter.take(c.currentTime)) return false
      const t = c.currentTime + 0.01
      // (`@strudel/web` reexporta `superdough`, aunque sus tipos no lo declaran)
      void (S as unknown as { superdough: (v: object, t: number, d: number) => Promise<unknown> }).superdough(fxValue(kind, style.value), t, FX_DURATION[kind])
      toWorker({ type: 'output', times: [t] })
      if (fxRec.value && clock) {
        fxEvents.push({ kind, time: t })
        fxRec.value = { count: fxEvents.length }
      }
      return true
    },
    /** «Grabar efectos»: apunta los golpes; al terminar pasan a la célula como loops de melodía de 4 compases (uno por tipo), cuantizados a la semicorchea. */
    toggleFxRec: (): boolean => {
      if (!fxRec.value) {
        if (!playing.value) {
          say('Pon la música en marcha para grabar los efectos')
          return false
        }
        fxEvents = []
        fxRec.value = { count: 0 }
        return true
      }
      const events = fxEvents
      fxEvents = []
      fxRec.value = null
      if (!clock || !events.length) return false
      const made = fxToLoops(events, style.value, barTime(0), stepSeconds(), 4)
      const room = MAX_LOOPS - loops.value.loops.length
      const keep = made.slice(0, Math.max(0, room))
      if (!keep.length) {
        say('No caben más loops (8): quita alguno para grabar efectos')
        return false
      }
      const born = nextBarLine()
      let id = loops.value.nextId
      const added: FreeLoop[] = keep.map((l) => ({ id: id++, instrument: 'mel', bars: 4, phaseBar: 0, hits: l.hits, synth: l.synth, muted: false, bornAt: born, fromTemplate: false }))
      loops.value = { nextId: id, loops: [...loops.value.loops, ...added] }
      reevaluate()
      updateBackground()
      say(`Efectos grabados: ${added.length} ${added.length === 1 ? 'capa' : 'capas'}${keep.length < made.length ? ' (no cupieron todas)' : ''}`)
      return true
    },
    liveRec,
    /** ¿Se puede grabar la canción en directo? Sonando, una sola célula y al menos dos capas (spec 011 §14.1). */
    canLive: computed(() => playing.value && !isMulti(song.value) && loops.value.loops.filter((l) => l.hits.length).length >= 2),
    /** «Grabar canción»: apunta, por compás, qué capas están encendidas. Otra llamada la termina y la convierte en células, con «↶ deshacer». */
    toggleLive: async (): Promise<boolean> => {
      if (!liveRec.value) {
        if (!playing.value || isMulti(song.value)) return false
        liveTimeline = []
        liveRec.value = { bars: 0 }
        say('Grabando: enciende y apaga capas al ritmo')
        return true
      }
      const timeline = liveTimeline
      cancelLive()
      const base = liveSong()
      const out = timelineToSong(base, timeline)
      if (!out) {
        say('No cambiaste ninguna capa: no hay canción que hacer')
        return false
      }
      setUndo({ kind: 'all', song: base })
      await replaceSong(out.song)
      say(`Tu canción: ${out.song.order.length} partes${out.merged ? ' (se unieron las más cortas)' : ''}. Ábrela en Componer para retocarla`)
      log('cell', `grabada en directo: ${out.song.cells.map((c) => `${c.name} ${c.turns}`).join(' · ')}`)
      return true
    },
    /** Otra variación del mismo tipo (la siguiente de la secuencia fija), partiendo de la original. */
    otherProposal: () => {
      if (!proposal.value) return
      proposal.value = { ...proposal.value, seed: proposal.value.seed + 1 }
      applyProposal()
    },
    /** Cambia el tipo de variación (+ energía, − energía…), desde su primera posibilidad. */
    setProposalKind: (kind: VariationKind) => {
      if (!proposal.value) return
      proposal.value = { ...proposal.value, kind, seed: 0 }
      applyProposal()
    },
    /** Tocar la copia = aceptar: se quita la marca y los chips; la célula se queda como está. */
    acceptProposal: () => {
      proposal.value = null
    },
    /** Enciende o apaga «Sugerencias» (spec 012, §3.4): apagado, se retira lo propuesto y no se propone nada. */
    setSuggestions: (on: boolean) => {
      suggestions.value = on
      if (!on) proposal.value = null // apagado, no se propone nada (lo propuesto se queda como está)
      refreshSuggestion()
    },
    refreshSuggestion,
    /** Tocar la sugerida = aceptarla: pasa a ser un loop de melodía normal (nacerá en la siguiente línea de compás, en su mismo sitio). */
    acceptSuggestion,
    proposeMelody,
    /** «↻ otra»: la siguiente sugerencia de este ritmo (secuencia fija). */
    otherSuggestion: () => {
      const sg = suggestion.value
      if (!sg) return
      suggestSeeds.set(sg.key, sg.seed + 1)
      refreshSuggestion()
    },
    /** «✕»: no volver a proponer esta sugerencia para este ritmo. */
    dismissSuggestion: () => {
      const sg = suggestion.value
      if (!sg) return
      suggestDismissed.add(sg.key)
      refreshSuggestion()
    },
    /** Repite el primer minuto guiado: la próxima vez que suene, sin loops, vuelve a guiar. */
    restartGuide: () => {
      guideNonce.value++
    },
    /** El fondo (bajo y acordes) encendido para el paso «Escucha» de la guía: suena el fondo del estilo y la gota espera. */
    guideBackground: () => {
      if (bgMode.value === 'off') setBackgroundMode(lastBgMode.value)
      if (bgMode.value === 'manual' && !(bgManual.value.bass && bgManual.value.chords)) {
        bgManual.value = { ...bgManual.value, bass: true, chords: true }
        updateBackground()
      }
    },
    setMode: (m: Mode) => {
      if (mode.value !== m) log('cell', `modo: ${m}`)
      mode.value = m
      proposal.value = null // al salir de Componer, lo propuesto se da por aceptado
    },
    style,
    assist,
    metronome,
    bgMode,
    bgManual,
    phraseCloseBeats,
    maxPhraseBars,
    phraseMode,
    repeatMode,
    phrase,
    fx,
    loops,
    lanes,
    toggleLane,
    bgParts,
    currentBar,
    diag,
    dropping,
    sampleRate: () => ctx?.sampleRate ?? 0,
    outputLatency,
    reportedOutputLatency,
    roundTripMs,
    savedLatencyMs,
    imageAuto,
    imageFineMs,
    reportedOutputMs,
    imageDelayShown,
    setImageDelay,
    refreshImageDelay,
    syncTest,
    syncFlash,
    startSyncTest,
    stopSyncTest,
    start,
    setCalibration,
    personalModel,
    calibNudge,
    /** «Ahora no» (o «Sí»): la propuesta no vuelve a salir sola */
    dismissCalibNudge: () => {
      calibNudge.value = false
      writeJson(NUDGE_KEY, { dismissed: true })
    },
    setLatency,
    recordTake,
    captureWindow,
    play,
    stop,
    setStyle,
    setKit,
    setMetronome,
    setAssist,
    setBackgroundMode,
    toggleBackground,
    toggleBackgroundPart,
    setBackgroundManual,
    setPhraseOptions,
    setRepeatMode,
    setFx,
    drop,
    setSong,
    liveSong,
    song,
    viewCellId,
    multi: computed(() => isMulti(song.value)),
    mute,
    remove,
    clearAll,
    loadDemo,
    loadStressDemo,
    moveCell,
    editLoops,
    onVisual,
    clockNow,
    setSongScale,
    setGlue,
    setEq,
    meterOn,
    meterOff,
    readMeter,
    cellPlan,
    looping,
    loopTarget,
    undoInfo,
    bpm,
    tempoTap,
    armTempoTap,
    cancelTempoTap,
    setBpm,
    tapTempo,
    cycleTurns,
    snapshot,
    openSaved,
    // grupos en paralelo (§16)
    viewIsFree: computed(() => inParallel(song.value, viewCellId.value)),
    /** se ve algo que no es lo que suena en la canción (enmienda 3): sale "◎ centrar" */
    viewAway: computed(() => inParallel(song.value, viewCellId.value) || (pinned.value && playing.value)),
    followSong,
    pinView,
    viewGroup: computed(() => groupIdOf(song.value, viewCellId.value) ?? MAIN),
    viewGroupOn: computed(() => groupOn(song.value, groupIdOf(song.value, viewCellId.value) ?? MAIN)),
    extrasOn: computed(() => song.value.groups.some((g) => g.on) || groupsRunning.value > 0),
    groupOf: (id: number): number => groupIdOf(song.value, id) ?? MAIN,
    groupHeads,
    songHead,
    tapGroupCell,
    toggleGroup,
    stopExtras,
    cutThread,
    addGroupCell,
    enterCell,
    // nombres de antes de los grupos, hasta que la pantalla se cambie
    toggleFree: tapGroupCell,
    addFreeCell: addGroupCell,
    detachCell: cutThread,
    addCell,
    copyCell,
    orderAfter,
    removeCell,
    undo,
    nextCellDepth,
    loopHere,
    resume,
    travelTo,
    displayCode,
  }
}

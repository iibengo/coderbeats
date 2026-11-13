import { computed, reactive, ref, shallowRef } from 'vue'
import { NO_PARTS, PART_ORBIT, planTransitions, targetParts, type BackgroundMode, type Part, type Parts } from '~/lib/background'
import { KIT_ORDER, KITS, STYLES } from '~/lib/constants'
import { demoState } from '~/lib/demos'
import { analyzeEchoTest, type EchoTestResult } from '~/lib/echoGate'
import {
  cellById,
  demoSong,
  emptySong,
  endBar,
  fitTurns,
  isLoose,
  isMulti,
  minTurns,
  nextDepth,
  nextInOrder,
  nextTurns,
  orderWith,
  stepPlay,
  stressSong,
  windowAt,
  withCopy,
  withDetached,
  withNewCell,
  withValidBpm,
  withOrderAfter,
  withoutCell,
  type Cell,
  type Cursor,
  type Jump,
  type Play,
  type Song,
} from '~/lib/cells'
import {
  addPhrase,
  clearLoops,
  emptyLoops,
  prunePrev,
  removeLoop,
  toggleMute,
  type FreeLoop,
  type LoopEvent,
  type LoopsState,
  type RepeatMode,
} from '~/lib/freeLoops'
import { DJF_MIN, filterDjf, spaceParams, SWEEP_STEPS, sweepDjf, warmthShape } from '~/lib/gestures'
import { imageDelayMs, sanitizeFine, SYNC_LOOKAHEAD_S, SYNC_PERIOD_S, takeDue } from '~/lib/imageDelay'
import { effectiveBpm, TEMPO_TAPS, TEMPO_TIMEOUT_MS, tempoFromTaps } from '~/lib/tempo'
import { detectOnsets, minGapForCell } from '~/lib/onsets'
import { PhraseTracker, type ClosedPhrase, type LoopLength, type PhraseSnapshot } from '~/lib/phrases'
import { ENGINE_GLOBAL, songCode, type SongFx, type SongState } from '~/lib/song'
import type { CalibrationSample, Instrument, KitId, Norm, StyleId } from '~/lib/types'
import { allLanes, toggleLane as toggleLaneSet, type Lanes } from '~/lib/lanes'
import { fmtVolume, isTooQuiet } from '~/lib/volume'
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
  kind: 'hit' | 'echo' | 'unknown' | 'stopped' | 'born' | 'removed' | 'phrase' | 'error' | 'background' | 'cell'
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
  instrument: Instrument | 'bass' | 'chords' | null
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

// ── Estado de módulo (una sola página, solo cliente) ───────────────────────────
let ctx: AudioContext | null = null
let S: StrudelModule | null = null
let stream: MediaStream | null = null
let capture: AudioWorkletNode | null = null
let worker: Worker | null = null
let masterIn: GainNode | null = null
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
const kit = ref<KitId>('909')
const style = ref<StyleId>('hiphop90')
const assist = ref(true)
const metronome = ref(true)
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
  later(() => {
    if (entered) showCell(entered.cellId, entered.startBar)
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
  later(() => decide(next), (t + barSec - 0.3 - c.currentTime) * 1000)
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
function songState(): SongState {
  const st: SongState = {
    loops: loops.value.loops,
    style: style.value,
    bpm: song.value.bpm,
    kit: kit.value,
    background: { mode: bgMode.value, parts: bgParts.value },
    metronome: metronome.value,
    fx: { ...fx },
  }
  if (!multi()) return st
  const s = liveSong()
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
      await S!.evaluate(songCode(songState(), 'engine'), playing.value)
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
  const active = loops.value.loops.filter((l) => !l.muted).length
  // con varias células mandan las partes de cada una (§4.2): el modo es "manual" salvo sin fondo
  const mode = multi() && bgMode.value !== 'off' ? 'manual' : bgMode.value
  const target = targetParts(active, mode, bgManual.value)
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
  if (closed) birth(closed, bar)
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
    cellStart: cursor?.startBar ?? 0,
    repeat: repeatMode.value,
    amend,
  })
  loops.value = r.state
  const touched = new Set(r.events.flatMap((e) => ('loop' in e ? [e.loop.instrument] : [])))
  for (const inst of new Set(phrase.hits.map((h) => h.instrument)))
    if (!touched.has(inst)) log('phrase', `${inst}: sin cambios, todos sus golpes caen en pasos ya ocupados tras cuantizar`)
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

function onWorkerMessage(m: FromWorker) {
  const c = ctx
  if (!c) return
  const uiMs = (c.currentTime - m.time) * 1000
  if (m.type === 'echo') return log('echo', `eco descartado (${m.strength.toFixed(3)})`, uiMs)
  if (m.type === 'ignored')
    return log('unknown', `ignorado: carril apagado (${m.instrument} ${(m.confidence * 100).toFixed(0)}%)${fmtVolume(m.vol)}`, uiMs)
  if (m.instrument === 'unknown')
    return log(
      'unknown',
      `golpe desconocido (${m.strength.toFixed(3)})${fmtVolume(m.vol)}${lanes.value.size ? '' : ' · ningún carril graba'}`,
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
  // con varias células, en estado canción no se graba; en bucle, sí (spec 005, §4.4)
  if (multi() && !loop) return log('unknown', `ignorado: canción avanzando (${m.instrument} ${(m.confidence * 100).toFixed(0)}%)`, uiMs)
  log('hit', `${m.instrument} ${(m.confidence * 100).toFixed(0)}%${fmtVolume(m.vol)}`, uiMs)
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
  if (r.closed) birth(r.closed, nextBarLine())
  // golpe tardío de la frase recién cerrada: sus loops nacen en la misma línea de compás
  if (r.amended && lastBirth?.startBar === r.amended.startBar) birth(r.amended, lastBirth.bornAt, true)
}

// ── API ────────────────────────────────────────────────────────────────────────
export function useAudioEngine() {
  /**
   * Debe llamarse dentro del gesto del usuario (botón Empezar): crea y reanuda el
   * AudioContext de forma síncrona antes de cualquier await (requisito de iOS Safari).
   */
  async function start(calibration: { samples: CalibrationSample[]; norm: Norm } | null) {
    if (ready.value) return
    ctx ??= new AudioContext({ latencyHint: 'interactive' })
    void ctx.resume()
    const silent = ctx.createBufferSource()
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silent.connect(ctx.destination)
    silent.start()

    // cadena maestra: entrada → limitador → techo −1 dB → salida (§16.12)
    masterIn = new GainNode(ctx)
    const limiter = new DynamicsCompressorNode(ctx, { threshold: -6, knee: 0, ratio: 20, attack: 0.001, release: 0.1 })
    const ceiling = new GainNode(ctx, { gain: 10 ** (-1 / 20) })
    masterIn.connect(limiter).connect(ceiling).connect(ctx.destination)

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
          const map: Record<string, string[]> = {}
          for (const k of KIT_ORDER)
            for (const inst of ['bd', 'sd', 'hh'] as const) {
              const idx = KITS[k].sampleIndex[inst]
              map[`${KITS[k].strudelBank}_${inst}`] = Array.from({ length: idx + 1 }, () => `${k}/${inst}.wav`)
            }
          // sonidos por defecto (sin .bank()), como en strudel.cc: el oh del fondo de dnb (§16.15)
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

    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    })
    await ctx.audioWorklet.addModule(`${base}worklets/capture-processor.js`)
    const source = ctx.createMediaStreamSource(stream)
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
      JSON.stringify({ samples: calibration?.samples ?? [], norm: calibration?.norm ?? { mean: [], std: [] } }),
    ) as { samples: CalibrationSample[]; norm: Norm }
    worker.postMessage({ type: 'init', sampleRate: ctx.sampleRate, ...plain } satisfies ToWorker, [channel.port2])

    // la prueba de eco corre mientras se carga Strudel (en el iPhone el import son ~0,6 s)
    const [echoResult] = await Promise.all([runEchoTest(), strudelReady])
    echo.value = echoResult
    metronome.value = !echoResult.bleed
    ready.value = true
    refreshImageDelay()
  }

  function setCalibration(c: { samples: CalibrationSample[]; norm: Norm }) {
    const plain = JSON.parse(JSON.stringify({ samples: c.samples, norm: c.norm })) as typeof c
    toWorker({ type: 'calibration', ...plain })
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

  async function play() {
    if (playing.value || !S) return
    stopSyncTest()
    // lo que informa el navegador puede cambiar al conectar o quitar unos cascos
    refreshImageDelay()
    // al arrancar, lo que ya existe suena desde el primer compás
    loops.value = { ...loops.value, loops: loops.value.loops.map((l) => ({ ...l, bornAt: 0 })) }
    // la canción arranca desde la célula que se ve (spec 005, §4.1); el ciclo de Strudel empieza en 0
    cursor = { cellId: viewCellId.value, startBar: 0 }
    viewStartBar = 0
    prevViewId = null
    sweep = 0
    // con una suelta a la vista suena ella, en bucle (para escucharla); no es parte de la canción (§15.1)
    loop = multi() && isLoose(song.value, viewCellId.value)
    jump = null
    viewJump = null
    syncLoopUi()
    currentBar.value = 0
    clock = null
    tracker = null
    lastPulseCycle = -1
    plannedParts = { ...NO_PARTS }
    bgParts.value = { ...NO_PARTS }
    silenceBackgroundNodes()
    syncFx()
    const echoCfg = echo.value?.bleed ? { roundTrip: echo.value.roundTrip, echoLevel: echo.value.echoLevel } : null
    toWorker({ type: 'start', minGap: minGapForCell(stepSeconds() * STYLES[style.value].quantizeEvery), echo: echoCfg })
    capture?.port.postMessage('stream-on')
    playing.value = true
    try {
      await S.evaluate(songCode(songState(), 'engine'), true)
    } catch (e) {
      log('error', `evaluate: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  function stop() {
    if (!S) return
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
    loop = false
    jump = null
    viewJump = null
    syncLoopUi()
    dropActive = false
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
      dropping.value = false
      syncFx()
    }, (release - ctx.currentTime) * 1000)
  }

  /** Pone una canción entera (guardada o demo) y enseña su primera célula. Parado. */
  function setSong(raw: Song) {
    const next = withValidBpm(raw)
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
    // canción completa del estilo (spec 005), si la tiene
    const demo = demoSong(style.value)
    if (demo) {
      if (bgMode.value === 'off') {
        bgMode.value = 'manual'
        lastBgMode.value = 'manual'
      }
      log('cell', `demo-canción de ${STYLES[style.value].label} cargada: ${demo.cells.map((c) => `${c.name} ${c.turns}`).join(' · ')}`)
      return replaceSong(demo)
    }
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
    | { kind: 'cell'; cell: Cell; prevId: number | null; nextId: number | null; loose: boolean }
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

  /**
   * Copia la célula `srcId` en `at` (mapa): la copia es **suelta** (enmienda 1, §15): sin hilos y sin
   * sonar, hasta que se engancha. Devuelve su id, o null con 16 células.
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
    log('cell', `célula ${srcId} copiada en la ${r.id}, suelta (no suena hasta engancharla)`)
    reevaluate()
    return r.id
  }

  /** Ordenar con el asa: `bId` pasa a sonar justo después de `aId`. */
  function orderAfter(aId: number, bId: number) {
    const s = liveSong()
    const next = withOrderAfter(s, aId, bId)
    if (!next) return
    song.value = next
    log('cell', `${isLoose(s, bId) ? 'enganchada' : 'orden'}: la ${bId} suena justo después de la ${aId}`)
    // una suelta que entra puede hacer de la canción de una célula una de varias
    becameMulti(isMulti(s))
    reevaluate()
  }

  /**
   * Cortar un hilo (enmienda 1, §15.4): la célula `id` (a la que llevaba el hilo) sale del orden y queda
   * suelta; la canción salta por encima. Si suena, sigue hasta el final de sus vueltas y entonces salta.
   */
  function detachCell(id: number) {
    const s = liveSong()
    const next = withDetached(s, id)
    if (!next) return
    const nextId = nextInOrder(s, id)
    song.value = next
    log('cell', `hilo cortado: la célula ${id} queda suelta`)
    if (!isMulti(next)) collapseToSingle()
    else if (playing.value && cursor && cursor.cellId === id && !loop && !jump) {
      // suena la cortada: acaba sus vueltas y salta a la que iba detrás
      jump = { cellId: nextId, startBar: endBar(next, curPlay()), loop: false }
    }
    syncLoopUi()
    reevaluate()
    updateBackground()
  }

  /** Queda una sola célula en el orden: vuelve a ser la app de siempre (una célula; las sueltas, aparcadas). */
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
    const i = s.order.indexOf(id)
    setUndo({ kind: 'cell', cell, prevId: i < 0 ? null : (s.order[i - 1] ?? null), nextId: i < 0 ? null : (s.order[i + 1] ?? null), loose: i < 0 })
    const nextId = nextInOrder(s, id)
    song.value = withoutCell(s, id)
    log('cell', `célula ${id} borrada`)
    if (!multi()) {
      // queda una sola en el orden: vuelve a ser la app de siempre
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
    song.value = {
      ...s,
      cells: [...s.cells, rec.cell],
      // una suelta vuelve suelta; una de la canción, entre sus mismos vecinos
      order: rec.loose ? s.order : orderWith(s.order, rec.cell.id, rec.prevId, rec.nextId),
      nextLoopId: Math.max(s.nextLoopId, ...rec.cell.loops.map((l) => l.id + 1)),
    }
    log('cell', `célula ${rec.cell.id} recuperada`)
    becameMulti(isMulti(s))
    reevaluate()
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
    if (!multi()) {
      // una sola célula en el orden (y quizá sueltas): pasar a otra es cambiar la célula que se ve, ya
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
    if (!playing.value || !multi()) return null
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

  /** Código que se muestra y se copia (§16.6). */
  const displayCode = () => songCode(songState(), 'display')

  return {
    ready,
    level,
    echo,
    playing,
    kit,
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
    addCell,
    copyCell,
    detachCell,
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

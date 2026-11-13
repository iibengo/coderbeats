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
  isMulti,
  nextInOrder,
  stepPlay,
  stressSong,
  windowAt,
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
  type LoopEvent,
  type LoopsState,
  type RepeatMode,
} from '~/lib/freeLoops'
import { DJF_MIN, filterDjf, spaceParams, SWEEP_STEPS, sweepDjf, warmthShape } from '~/lib/gestures'
import { detectOnsets, minGapForCell } from '~/lib/onsets'
import { PhraseTracker, type ClosedPhrase, type LoopLength, type PhraseSnapshot } from '~/lib/phrases'
import { ENGINE_GLOBAL, songCode, type SongFx, type SongState } from '~/lib/song'
import type { CalibrationSample, Instrument, KitId, Norm, StyleId } from '~/lib/types'
import { allLanes, toggleLane as toggleLaneSet, type Lanes } from '~/lib/lanes'
import { fmtVolume } from '~/lib/volume'
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
const syncLoopUi = () => (looping.value = loop || !!(jump ?? viewJump)?.loop)
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

/**
 * Latencia de salida (s): lo que tarda en oírse lo que el contexto reproduce ahora. La imagen va
 * con lo que se oye (spec 003, E1.6). La latencia calibrada es otra cosa: solo corrige la entrada.
 */
function outputLatency(): number {
  const c = ctx as (AudioContext & { outputLatency?: number }) | null
  if (!c) return 0
  return (c.baseLatency || 0) + (c.outputLatency || 0)
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
const stepSeconds = () => 60 / STYLES[style.value].bpm / 4
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
  }

  function setCalibration(c: { samples: CalibrationSample[]; norm: Norm }) {
    const plain = JSON.parse(JSON.stringify({ samples: c.samples, norm: c.norm })) as typeof c
    toWorker({ type: 'calibration', ...plain })
  }

  function setLatency(seconds: number) {
    latencySec = seconds
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
    // al arrancar, lo que ya existe suena desde el primer compás
    loops.value = { ...loops.value, loops: loops.value.loops.map((l) => ({ ...l, bornAt: 0 })) }
    // la canción arranca desde la célula que se ve (spec 005, §4.1); el ciclo de Strudel empieza en 0
    cursor = { cellId: viewCellId.value, startBar: 0 }
    viewStartBar = 0
    prevViewId = null
    sweep = 0
    loop = false
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
    await restart()
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
  function setSong(next: Song) {
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
    if (!multi() || !cellById(song.value, id)) return
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
    loopHere,
    resume,
    travelTo,
    displayCode,
  }
}

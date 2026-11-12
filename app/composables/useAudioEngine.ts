import { ref, shallowRef } from 'vue'
import { analyzeEchoTest, type EchoTestResult } from '~/lib/echoGate'
import { KIT_ORDER } from '~/lib/constants'
import {
  activeAt,
  addHit,
  emptyLoop,
  place,
  settle,
  totalSteps,
  type AddResult,
  type Loop,
  type LoopTiming,
} from '~/lib/looper'
import { detectOnsets, minGapForCell } from '~/lib/onsets'
import type { CalibrationSample, Instrument, KitId, Norm } from '~/lib/types'
import type { FromWorker, ToWorker } from '~/lib/workerProtocol'

type ToneModule = typeof import('tone')

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

export interface LiveEvent {
  time: number
  instrument: Instrument | 'unknown'
  confidence: number
  strength: number
  decisionMs: number
  /** ms desde el onset hasta que se procesó en el hilo principal */
  uiMs: number
  result: AddResult | 'echo' | 'unknown' | 'paused'
  step?: number
}

export interface LooperSettings {
  bpm: number
  quantizeEvery: 1 | 2
  /** latencia a compensar (calibración), s */
  latency: number
}

export interface RecordedTake {
  buffer: Float32Array
  sampleRate: number
  startTime: number
  anchor: number
  settings: LooperSettings
  events: LiveEvent[]
}

// Estado de módulo: la app es una sola página y solo corre en el cliente.
let ctx: AudioContext | null = null
let Tone: ToneModule | null = null
let stream: MediaStream | null = null
let capture: AudioWorkletNode | null = null
let worker: Worker | null = null
let chunks: { frame: number; data: Float32Array }[] = []
let onStopped: (() => void) | null = null
const players = new Map<KitId, import('tone').Players>()
let sequence: import('tone').Sequence<number> | null = null
let timing: LoopTiming | null = null
let settings: LooperSettings | null = null
let capturingTake = false

const ready = ref(false)
const level = ref(0)
const kit = ref<KitId>('909')
const echo = shallowRef<EchoTestResult | null>(null)

// looper
const loop = shallowRef<Loop>(emptyLoop(1))
const playing = ref(false)
const countingIn = ref(false)
const overdub = ref(false)
const metronome = ref(true)
const currentStep = ref(-1)
const currentLap = ref(0)
const events = shallowRef<LiveEvent[]>([])
const lastTake = shallowRef<RecordedTake | null>(null)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function requireCtx(): AudioContext {
  if (!ctx) throw new Error('AudioContext no iniciado')
  return ctx
}

const toWorker = (m: ToWorker) => worker?.postMessage(m)

/** Clic de metrónomo nativo, programado en tiempo de AudioContext. */
function click(time: number, accent: boolean) {
  const c = requireCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.frequency.value = accent ? 1760 : 1320
  gain.gain.setValueAtTime(0, time)
  gain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04)
  osc.connect(gain).connect(c.destination)
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

async function loadKit(id: KitId) {
  if (!Tone || players.has(id)) return
  const base = `${useRuntimeConfig().app.baseURL}samples/${id}/`
  const p = new Tone.Players({ bd: `${base}bd.wav`, sd: `${base}sd.wav`, hh: `${base}hh.wav` }).toDestination()
  players.set(id, p)
  await new Promise<void>((resolve) => {
    const check = () => (p.loaded ? resolve() : setTimeout(check, 50))
    check()
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

function pushEvent(e: LiveEvent) {
  events.value = [e, ...events.value].slice(0, 200)
}

function onWorkerMessage(m: FromWorker) {
  const c = ctx
  if (!c) return
  const uiMs = (c.currentTime - m.time) * 1000
  if (m.type === 'echo') {
    pushEvent({ time: m.time, instrument: 'unknown', confidence: 0, strength: m.strength, decisionMs: 0, uiMs, result: 'echo' })
    return
  }
  const base = { time: m.time, instrument: m.instrument, confidence: m.confidence, strength: m.strength, decisionMs: m.decisionMs, uiMs }
  if (m.instrument === 'unknown') return pushEvent({ ...base, result: 'unknown' })
  if (!overdub.value || !timing || !settings) return pushEvent({ ...base, result: 'paused' })
  const placement = place(m.time - settings.latency, timing)
  const r = addHit(loop.value, { placement, instrument: m.instrument, strength: m.strength, confidence: m.confidence })
  loop.value = r.loop
  pushEvent({ ...base, result: r.result, step: placement.step })
}

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

    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    })

    const base = useRuntimeConfig().app.baseURL
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

    // worker de análisis con un canal directo desde el worklet
    worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<FromWorker>) => onWorkerMessage(e.data)
    const channel = new MessageChannel()
    capture.port.postMessage({ type: 'stream-port' }, [channel.port1])
    const plain = JSON.parse(
      JSON.stringify({ samples: calibration?.samples ?? [], norm: calibration?.norm ?? { mean: [], std: [] } }),
    ) as { samples: CalibrationSample[]; norm: Norm }
    worker.postMessage(
      { type: 'init', sampleRate: ctx.sampleRate, ...plain } satisfies ToWorker,
      [channel.port2],
    )

    Tone = await import('tone')
    Tone.setContext(ctx)
    await loadKit(kit.value)
    void Promise.all(KIT_ORDER.map(loadKit))

    echo.value = await runEchoTest()
    metronome.value = !echo.value.bleed
    ready.value = true
  }

  function setCalibration(c: { samples: CalibrationSample[]; norm: Norm }) {
    const plain = JSON.parse(JSON.stringify({ samples: c.samples, norm: c.norm })) as typeof c
    toWorker({ type: 'calibration', ...plain })
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

  /** Arranca el loop. Con `countIn`, 1 compás de clics antes del primer paso. */
  function play(s: LooperSettings, countIn = false) {
    if (!Tone || !ctx) return
    stop(true)
    const T = Tone
    const c = ctx
    settings = s
    loop.value = settle(loop.value)
    const transport = T.getTransport()
    transport.bpm.value = s.bpm
    const stepSec = 60 / s.bpm / 4
    const beat = stepSec * 4
    const steps = totalSteps(loop.value)
    const loopDur = steps * stepSec

    const anchor = c.currentTime + 0.15 + (countIn ? 4 * beat : 0)
    timing = { anchor, stepSeconds: stepSec, quantizeEvery: s.quantizeEvery, totalSteps: steps }

    const echoCfg = echo.value?.bleed ? { roundTrip: echo.value.roundTrip, echoLevel: echo.value.echoLevel } : null
    toWorker({ type: 'start', minGap: minGapForCell(stepSec * s.quantizeEvery), echo: echoCfg })
    capture?.port.postMessage('stream-on')

    if (countIn) {
      countingIn.value = true
      const times = Array.from({ length: 4 }, (_, i) => anchor - (4 - i) * beat)
      times.forEach((t, i) => click(t, i === 0))
      toWorker({ type: 'output', times })
      setTimeout(() => (countingIn.value = false), (anchor - c.currentTime) * 1000)
    }

    sequence = new T.Sequence<number>(
      (time, step) => {
        const lap = Math.round((time - anchor - step * stepSec) / loopDur)
        const out: number[] = []
        const kp = players.get(kit.value)
        if (kp?.loaded)
          for (const inst of activeAt(loop.value, step, lap)) {
            kp.player(inst).start(time)
            out.push(time)
          }
        if (metronome.value && step % 4 === 0) {
          click(time, step % 16 === 0)
          out.push(time)
        }
        if (out.length) toWorker({ type: 'output', times: out })
        T.getDraw().schedule(() => {
          currentStep.value = step
          currentLap.value = lap
        }, time)
      },
      Array.from({ length: steps }, (_, i) => i),
      '16n',
    )
    sequence.start(0)
    transport.position = 0
    transport.start(anchor)
    playing.value = true

    if (import.meta.dev && !capturingTake) {
      capturingTake = true
      startCapture()
    }
  }

  /** Para el loop. Con `restart`, sigue capturando la toma de diagnóstico (se va a rearrancar). */
  function stop(restart = false) {
    if (!Tone) return
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel()
    sequence?.dispose()
    sequence = null
    capture?.port.postMessage('stream-off')
    toWorker({ type: 'stop' })
    const wasPlaying = playing.value
    playing.value = false
    countingIn.value = false
    overdub.value = false
    currentStep.value = -1
    if (!restart && capturingTake && wasPlaying && timing && settings) {
      capturingTake = false
      const t = timing
      const s = settings
      const evs = events.value
      void stopCapture().then(({ buffer, startTime }) => {
        lastTake.value = { buffer, sampleRate: requireCtx().sampleRate, startTime, anchor: t.anchor, settings: s, events: evs }
      })
    }
  }

  /** REC: parado → cuenta atrás de 1 compás y overdub; sonando → activa/pausa el overdub. */
  function toggleOverdub(s: LooperSettings) {
    if (!playing.value) {
      play(s, true)
      overdub.value = true
    } else overdub.value = !overdub.value
  }

  function setLoop(next: Loop) {
    loop.value = next
  }

  async function setKit(id: KitId) {
    kit.value = id
    await loadKit(id)
  }

  return {
    ready,
    level,
    kit,
    echo,
    loop,
    playing,
    countingIn,
    overdub,
    metronome,
    currentStep,
    currentLap,
    events,
    lastTake,
    sampleRate: () => ctx?.sampleRate ?? 0,
    start,
    setCalibration,
    recordTake,
    captureWindow,
    play,
    stop,
    toggleOverdub,
    setLoop,
    setKit,
  }
}

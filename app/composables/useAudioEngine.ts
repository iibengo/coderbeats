import { ref, shallowRef } from 'vue'
import { KITS, STEPS_PER_BAR } from '~/lib/constants'
import type { Instrument, KitId, Pattern } from '~/lib/types'

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
  /** se llama (aprox.) en cada clic; beat negativo = cuenta atrás */
  onBeat?: (beat: number) => void
}

// Estado de módulo: la app es una sola página y solo corre en el cliente.
let ctx: AudioContext | null = null
let Tone: ToneModule | null = null
let stream: MediaStream | null = null
let capture: AudioWorkletNode | null = null
let chunks: { frame: number; data: Float32Array }[] = []
let onStopped: (() => void) | null = null
const players = new Map<KitId, import('tone').Players>()
let sequence: import('tone').Sequence<number> | null = null

const ready = ref(false)
const level = ref(0)
const playing = ref(false)
const currentStep = ref(-1)
const kit = ref<KitId>('909')
const pattern = shallowRef<Pattern | null>(null)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function requireCtx(): AudioContext {
  if (!ctx) throw new Error('AudioContext no iniciado')
  return ctx
}

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

export function useAudioEngine() {
  /**
   * Debe llamarse dentro del gesto del usuario (botón Empezar): crea y reanuda el
   * AudioContext de forma síncrona antes de cualquier await (requisito de iOS Safari).
   */
  async function start() {
    if (ready.value) return
    ctx ??= new AudioContext({ latencyHint: 'interactive' })
    void ctx.resume()
    // buffer silencioso para terminar de desbloquear iOS
    const silent = ctx.createBufferSource()
    silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    silent.connect(ctx.destination)
    silent.start()

    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    })

    await ctx.audioWorklet.addModule(`${useRuntimeConfig().app.baseURL}worklets/capture-processor.js`)
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

    Tone = await import('tone')
    Tone.setContext(ctx)
    await loadKit(kit.value)
    void Promise.all((Object.keys(KITS) as KitId[]).map(loadKit))
    ready.value = true
  }

  /** Metrónomo + grabación. Devuelve el buffer y la posición del primer tiempo grabado. */
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

  function setPattern(p: Pattern | null) {
    pattern.value = p
  }

  function play(bpm: number) {
    if (!Tone || !pattern.value) return
    stop()
    const T = Tone
    const transport = T.getTransport()
    transport.bpm.value = bpm
    const steps = pattern.value.bars * STEPS_PER_BAR
    sequence = new T.Sequence<number>(
      (time, step) => {
        const inst: Instrument | null = pattern.value?.steps[step] ?? null
        const kp = players.get(kit.value)
        if (inst && kp?.loaded) kp.player(inst).start(time)
        T.getDraw().schedule(() => (currentStep.value = step), time)
      },
      Array.from({ length: steps }, (_, i) => i),
      '16n',
    )
    sequence.start(0)
    transport.position = 0
    transport.start('+0.05')
    playing.value = true
  }

  function stop() {
    if (!Tone) return
    const transport = Tone.getTransport()
    transport.stop()
    transport.cancel()
    sequence?.dispose()
    sequence = null
    playing.value = false
    currentStep.value = -1
  }

  function setBpm(bpm: number) {
    if (Tone) Tone.getTransport().bpm.value = bpm
  }

  async function setKit(id: KitId) {
    kit.value = id
    await loadKit(id)
  }

  return {
    ready,
    level,
    playing,
    currentStep,
    kit,
    pattern,
    sampleRate: () => ctx?.sampleRate ?? 0,
    start,
    recordTake,
    captureWindow,
    setPattern,
    play,
    stop,
    setBpm,
    setKit,
  }
}

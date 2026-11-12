import { extract } from './meyda'
import type { Onset } from './types'

export interface OnsetOptions {
  frameSize: number
  hop: number
  /** periodo refractario tras un onset, en segundos (anti-doble disparo; gana el primero) */
  minGap: number
  /** multiplicador de la mediana local del flujo */
  thresholdK: number
  /** frames a cada lado para la mediana local (también es la anticipación del detector) */
  medianRadius: number
  /** el golpe debe superar el ruido de fondo en estos dB */
  gateDb: number
  /** RMS mínimo absoluto (≈ -50 dBFS) */
  minRms: number
  /** la energía tras el onset debe superar a la de justo antes en estos dB (descarta colas) */
  riseDb: number
  /** descarta golpes más de estos dB por debajo de la mediana de los últimos golpes; Infinity lo desactiva */
  relativeGateDb: number
  /** ventana de las estadísticas móviles (ruido de fondo, mediana del flujo), en segundos */
  statsWindow: number
}

export const DEFAULT_ONSET_OPTIONS: OnsetOptions = {
  frameSize: 1024,
  hop: 256,
  minGap: 0.06,
  thresholdK: 1.5,
  medianRadius: 8,
  gateDb: 12,
  minRms: 0.003,
  riseDb: 6,
  relativeGateDb: 24,
  statsWindow: 3,
}

/** Separación mínima según la celda de la rejilla de grabación: clamp(0,6 × celda, 60, 120 ms). */
export const minGapForCell = (cellSeconds: number): number => Math.min(0.12, Math.max(0.06, 0.6 * cellSeconds))

/** Onset con su posición absoluta en muestras desde que empezó el stream. */
export interface StreamOnset extends Onset {
  sample: number
}

const ENV_WIN = 64
const RELATIVE_HISTORY = 8

function median(values: number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!
}

/**
 * Detector de onsets incremental: flujo espectral + umbral adaptativo + puertas de energía.
 * Se le pasan trozos de cualquier tamaño con `push` y devuelve los onsets ya decididos.
 * El resultado no depende de cómo se trocee la entrada.
 */
export class StreamingOnsetDetector {
  readonly o: OnsetOptions
  /** audio retenido: muestras absolutas [base, base + length) */
  private buf: Float32Array
  private base = 0
  private length = 0
  private nextFrame = 0
  private prevLog: number[] | null = null
  private flux: number[] = []
  private frameRms: number[] = []
  /** índice de frame absoluto de flux[0] */
  private fluxBase = 0
  private nextEval = 1
  private lastKept = -Infinity
  private recent: number[] = []
  private readonly statsFrames: number
  private readonly gateLen: number
  private readonly retain: number

  constructor(
    readonly sampleRate: number,
    options: Partial<OnsetOptions> = {},
  ) {
    this.o = { ...DEFAULT_ONSET_OPTIONS, ...options }
    this.statsFrames = Math.max(8, Math.round((this.o.statsWindow * sampleRate) / this.o.hop))
    this.gateLen = Math.round(0.02 * sampleRate)
    // retiene audio suficiente para refinar, puertas y extraer features (~4 s)
    this.retain = Math.round(4 * sampleRate)
    this.buf = new Float32Array(this.retain * 2)
  }

  /** Total de muestras recibidas. */
  get received(): number {
    return this.base + this.length
  }

  /** Copia muestras absolutas [start, start + len) del audio retenido (ceros fuera). */
  slice(start: number, len: number): Float32Array {
    const out = new Float32Array(len)
    const a = Math.max(start, this.base)
    const b = Math.min(start + len, this.base + this.length)
    if (b > a) out.set(this.buf.subarray(a - this.base, b - this.base), a - start)
    return out
  }

  private sample(i: number): number {
    const k = i - this.base
    return k >= 0 && k < this.length ? this.buf[k]! : 0
  }

  private rms(start: number, len: number): number {
    let sum = 0
    let n = 0
    for (let i = Math.max(start, 0); i < start + len && i < this.received; i++) {
      const v = this.sample(i)
      sum += v * v
      n++
    }
    return n ? Math.sqrt(sum / n) : 0
  }

  private append(chunk: Float32Array) {
    if (this.length + chunk.length > this.buf.length) {
      // descarta lo antiguo, conservando `retain` muestras
      const keep = Math.min(this.length, this.retain)
      const drop = this.length - keep
      this.buf.copyWithin(0, drop, this.length)
      this.base += drop
      this.length = keep
      if (this.length + chunk.length > this.buf.length) {
        const bigger = new Float32Array((this.length + chunk.length) * 2)
        bigger.set(this.buf.subarray(0, this.length))
        this.buf = bigger
      }
    }
    this.buf.set(chunk, this.length)
    this.length += chunk.length
  }

  private computeFrames() {
    const { frameSize, hop } = this.o
    while (this.nextFrame * hop + frameSize <= this.received) {
      const start = this.nextFrame * hop
      const frame = this.slice(start, frameSize)
      const spec = extract(['amplitudeSpectrum'], frame, this.sampleRate).amplitudeSpectrum
      const log = Array.from(spec ?? [], (x) => Math.log1p(x))
      let f = 0
      if (this.prevLog) for (let k = 0; k < log.length; k++) f += Math.max(0, log[k]! - this.prevLog[k]!)
      this.prevLog = log
      this.flux.push(f)
      let sum = 0
      for (let i = 0; i < frameSize; i++) sum += frame[i]! * frame[i]!
      this.frameRms.push(Math.sqrt(sum / frameSize))
      this.nextFrame++
    }
  }

  private fluxAt(frame: number): number {
    return this.flux[frame - this.fluxBase] ?? 0
  }

  /** Estadísticas móviles hasta el frame `f` (incluido). */
  private stats(f: number) {
    const end = f - this.fluxBase + 1
    const start = Math.max(0, end - this.statsFrames)
    const noiseFloor = percentile(this.frameRms.slice(start, end), 0.1)
    const delta = median(this.flux.slice(start, end)) * 0.5 + 1e-6
    return { noiseFloor, delta }
  }

  private refine(from: number, to: number, floor: number): number {
    const env: number[] = []
    for (let i = from; i < to; i += ENV_WIN) env.push(this.rms(i, ENV_WIN))
    if (env.length === 0) return Math.max(0, from)
    let peak = 0
    for (let i = 1; i < env.length; i++) if (env[i]! > env[peak]!) peak = i
    const target = Math.max(env[peak]! * 0.2, floor)
    let i = peak
    while (i > 0 && env[i - 1]! >= target) i--
    return Math.max(0, from + i * ENV_WIN)
  }

  /** Evalúa el frame `f` como candidato y devuelve el onset si lo es. */
  private evaluate(f: number, lastFrame: number): StreamOnset | undefined {
    const { hop, frameSize, medianRadius, thresholdK, gateDb, minRms, riseDb } = this.o
    const v = this.fluxAt(f)
    if (v < this.fluxAt(f - 1) || (f + 1 <= lastFrame && v <= this.fluxAt(f + 1))) return
    const local: number[] = []
    for (let g = Math.max(this.fluxBase, f - medianRadius); g <= Math.min(lastFrame, f + medianRadius); g++)
      local.push(this.fluxAt(g))
    const { noiseFloor, delta } = this.stats(f)
    if (v <= median(local) * thresholdK + delta) return

    const frameStart = f * hop
    const sample = this.refine(frameStart - hop, frameStart + frameSize, noiseFloor * 2)
    const strength = this.rms(sample, this.gateLen)
    if (strength < Math.max(minRms, noiseFloor * 10 ** (gateDb / 20))) return
    if (strength < this.rms(sample - this.gateLen, this.gateLen) * 10 ** (riseDb / 20)) return

    // periodo refractario: el primer golpe gana y se decide al momento
    if (sample - this.lastKept < this.o.minGap * this.sampleRate) return
    if (Number.isFinite(this.o.relativeGateDb) && this.recent.length >= 3) {
      if (strength < median(this.recent) * 10 ** (-this.o.relativeGateDb / 20)) return
    }
    this.lastKept = sample
    this.recent.push(strength)
    if (this.recent.length > RELATIVE_HISTORY) this.recent.shift()
    return { sample, time: sample / this.sampleRate, strength }
  }

  private trimHistory() {
    // conserva flujo/rms de la ventana de estadísticas + margen
    const keepFrom = this.nextEval - this.statsFrames - this.o.medianRadius - 2
    const drop = keepFrom - this.fluxBase
    if (drop > 512) {
      this.flux.splice(0, drop)
      this.frameRms.splice(0, drop)
      this.fluxBase += drop
    }
  }

  private run(final: boolean): StreamOnset[] {
    this.computeFrames()
    const out: StreamOnset[] = []
    const lastFrame = this.nextFrame - 1
    const limit = final ? lastFrame : lastFrame - this.o.medianRadius
    for (; this.nextEval <= limit; this.nextEval++) {
      const done = this.evaluate(this.nextEval, lastFrame)
      if (done) out.push(done)
    }
    this.trimHistory()
    return out
  }

  push(chunk: Float32Array): StreamOnset[] {
    this.append(chunk)
    return this.run(false)
  }

  /** Fin del stream: decide lo que quede pendiente. */
  flush(): StreamOnset[] {
    return this.run(true)
  }
}

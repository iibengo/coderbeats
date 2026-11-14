/**
 * Altura de la voz (spec 002, §4.1): YIN (de Cheveigné y Kawahara, 2002) con probabilidad de voz. Puro y sin
 * dependencias; la función diferencia se calcula con FFT. Una estimación por frame (MIDI decimal, o NaN sin
 * voz), su probabilidad de voz (1 − aperiodicidad) y su volumen; luego una mediana que quita los saltos de
 * octava de pocos frames.
 */
import { Fft } from './fft'

export interface PitchOptions {
  /** muestras por ventana (potencia de 2); la integración usa la mitad */
  frame: number
  /** salto entre ventanas (muestras) */
  hop: number
  fmin: number
  fmax: number
  /** umbral absoluto de YIN sobre la diferencia normalizada */
  threshold: number
  /** frames de la mediana (impar; 1 = sin mediana) */
  median: number
}

export const DEFAULT_PITCH_OPTIONS: PitchOptions = { frame: 2048, hop: 256, fmin: 65, fmax: 1000, threshold: 0.15, median: 7 }

export interface PitchTrack {
  sampleRate: number
  hop: number
  /** tiempo del centro de cada frame (s) */
  times: Float32Array
  /** altura MIDI decimal; NaN si no hay estimación */
  midi: Float32Array
  /** 0..1: 1 − aperiodicidad de YIN */
  prob: Float32Array
  /** volumen RMS del frame */
  rms: Float32Array
}

export const hzToMidi = (hz: number): number => 69 + 12 * Math.log2(hz / 440)
export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12)

const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(n))

/** Mediana de los valores no NaN de `a[lo..hi]`; NaN si no hay ninguno. */
function medianOf(a: ArrayLike<number>, lo: number, hi: number): number {
  const v: number[] = []
  for (let i = Math.max(0, lo); i <= Math.min(a.length - 1, hi); i++) if (!Number.isNaN(a[i]!)) v.push(a[i]!)
  if (!v.length) return Number.NaN
  v.sort((x, y) => x - y)
  return v[v.length >> 1]!
}

/** Estimador YIN reutilizable (tablas y buffers del tamaño de ventana). */
export class YinEstimator {
  private readonly fft: Fft
  private readonly n: number
  private readonly half: number
  private readonly ar: Float64Array
  private readonly ai: Float64Array
  private readonly br: Float64Array
  private readonly bi: Float64Array
  private readonly d: Float64Array
  private readonly dn: Float64Array
  private readonly prefix: Float64Array

  constructor(
    readonly sampleRate: number,
    readonly o: Pick<PitchOptions, 'frame' | 'fmin' | 'fmax' | 'threshold'> = DEFAULT_PITCH_OPTIONS,
  ) {
    this.half = o.frame >> 1
    this.n = nextPow2(o.frame + this.half)
    this.fft = new Fft(this.n)
    this.ar = new Float64Array(this.n)
    this.ai = new Float64Array(this.n)
    this.br = new Float64Array(this.n)
    this.bi = new Float64Array(this.n)
    this.d = new Float64Array(this.half + 1)
    this.dn = new Float64Array(this.half + 1)
    this.prefix = new Float64Array(o.frame + 1)
  }

  /** Estima una ventana (`x` desde `start`, `frame` muestras). */
  estimate(x: Float32Array, start: number): { midi: number; prob: number; rms: number } {
    const { frame, fmin, fmax, threshold } = this.o
    const { half, n } = this
    this.ar.fill(0)
    this.ai.fill(0)
    this.br.fill(0)
    this.bi.fill(0)
    let sum2 = 0
    this.prefix[0] = 0
    for (let i = 0; i < frame; i++) {
      const v = x[start + i] ?? 0
      this.br[i] = v
      if (i < half) this.ar[i] = v
      this.prefix[i + 1] = this.prefix[i]! + v * v
      sum2 += v * v
    }
    const rms = Math.sqrt(sum2 / frame)
    if (rms < 1e-6) return { midi: Number.NaN, prob: 0, rms }

    // correlación cruzada de la primera mitad con la ventana entera, por FFT
    this.fft.transform(this.ar, this.ai)
    this.fft.transform(this.br, this.bi)
    for (let i = 0; i < n; i++) {
      // conj(A) · B: lag τ = Σ_j a_j · b_(j+τ)
      const re = this.ar[i]! * this.br[i]! + this.ai[i]! * this.bi[i]!
      const im = this.ar[i]! * this.bi[i]! - this.ai[i]! * this.br[i]!
      this.ar[i] = re
      this.ai[i] = im
    }
    this.fft.transform(this.ar, this.ai, true)

    const tauMax = Math.min(Math.floor(this.sampleRate / fmin), half)
    const tauMin = Math.max(2, Math.floor(this.sampleRate / fmax))
    const e0 = this.prefix[half]!
    // d(τ) = Σ_{j<W} (x_j − x_{j+τ})²
    this.d[0] = 0
    for (let tau = 1; tau <= tauMax; tau++) {
      const cross = this.ar[tau]! / n
      this.d[tau] = e0 + (this.prefix[half + tau]! - this.prefix[tau]!) - 2 * cross
    }
    // diferencia normalizada con la media acumulada
    const dn = this.dn
    dn[0] = 1
    let run = 0
    for (let tau = 1; tau <= tauMax; tau++) {
      run += Math.max(0, this.d[tau]!)
      dn[tau] = run > 0 ? (Math.max(0, this.d[tau]!) * tau) / run : 1
    }
    // primer valle por debajo del umbral; si no hay, el mínimo global
    let best = -1
    for (let tau = tauMin; tau < tauMax; tau++) {
      if (dn[tau]! < threshold) {
        while (tau + 1 < tauMax && dn[tau + 1]! < dn[tau]!) tau++
        best = tau
        break
      }
    }
    if (best < 0) {
      let min = Infinity
      for (let tau = tauMin; tau <= tauMax; tau++)
        if (dn[tau]! < min) {
          min = dn[tau]!
          best = tau
        }
    }
    if (best < 0) return { midi: Number.NaN, prob: 0, rms }
    const aper = dn[best]!
    // interpolación parabólica
    let tauF = best
    if (best > 1 && best < tauMax) {
      const a = dn[best - 1]!
      const b = dn[best]!
      const c = dn[best + 1]!
      const den = a - 2 * b + c
      if (Math.abs(den) > 1e-12) tauF = best + (0.5 * (a - c)) / den
    }
    const prob = Math.min(1, Math.max(0, 1 - aper))
    return { midi: hzToMidi(this.sampleRate / tauF), prob, rms }
  }
}

/** Sigue la altura de un buffer entero (el laboratorio y los tests; en vivo se usa `YinEstimator` por frames). */
export function trackPitch(x: Float32Array, sampleRate: number, options: Partial<PitchOptions> = {}): PitchTrack {
  const o = { ...DEFAULT_PITCH_OPTIONS, ...options }
  const est = new YinEstimator(sampleRate, o)
  const count = Math.max(0, Math.floor((x.length - o.frame) / o.hop) + 1)
  const times = new Float32Array(count)
  const midi = new Float32Array(count)
  const prob = new Float32Array(count)
  const rms = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const start = i * o.hop
    const r = est.estimate(x, start)
    times[i] = (start + o.frame / 2) / sampleRate
    midi[i] = r.midi
    prob[i] = r.prob
    rms[i] = r.rms
  }
  return { sampleRate, hop: o.hop, times, midi: o.median > 1 ? medianTrack(midi, prob, o.median) : midi, prob, rms }
}

/**
 * Mediana de la altura sobre los frames con voz (prob ≥ 0,5) de alrededor: quita los saltos de octava de
 * hasta `(width − 1) / 2` frames sin mover los bordes de las notas.
 */
export function medianTrack(midi: Float32Array, prob: Float32Array, width: number): Float32Array {
  const r = width >> 1
  const out = new Float32Array(midi.length)
  const voiced = Float32Array.from(midi, (m, i) => (prob[i]! >= 0.5 ? m : Number.NaN))
  for (let i = 0; i < midi.length; i++) out[i] = Number.isNaN(voiced[i]!) ? midi[i]! : medianOf(voiced, i - r, i + r)
  return out
}

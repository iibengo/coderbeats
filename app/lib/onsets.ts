import { extract } from './meyda'
import type { Onset } from './types'

export interface OnsetOptions {
  frameSize: number
  hop: number
  /** separación mínima entre onsets, en segundos */
  minGap: number
  /** multiplicador de la mediana local del flujo */
  thresholdK: number
  /** frames a cada lado para la mediana local */
  medianRadius: number
  /** el golpe debe superar el ruido de fondo en estos dB */
  gateDb: number
  /** RMS mínimo absoluto (≈ -50 dBFS) */
  minRms: number
  /** la energía tras el onset debe superar a la de justo antes en estos dB (descarta colas) */
  riseDb: number
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
}

const ENV_WIN = 64

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

export function rms(buf: Float32Array, start: number, length: number): number {
  const a = Math.max(0, start)
  const b = Math.min(buf.length, start + length)
  if (b <= a) return 0
  let sum = 0
  for (let i = a; i < b; i++) sum += buf[i]! * buf[i]!
  return Math.sqrt(sum / (b - a))
}

/** Flujo espectral (log-magnitud, rectificado) por frame. */
export function spectralFlux(buf: Float32Array, sampleRate: number, frameSize: number, hop: number): number[] {
  const flux: number[] = []
  let prev: number[] | null = null
  for (let i = 0; i + frameSize <= buf.length; i += hop) {
    const spec = extract(['amplitudeSpectrum'], buf.subarray(i, i + frameSize), sampleRate).amplitudeSpectrum
    const log = Array.from(spec ?? [], (x) => Math.log1p(x))
    let f = 0
    if (prev) for (let k = 0; k < log.length; k++) f += Math.max(0, log[k]! - prev[k]!)
    flux.push(f)
    prev = log
  }
  return flux
}

/**
 * Coloca el onset donde la envolvente de energía cruza el 20 % del máximo local,
 * retrocediendo desde el pico. Devuelve un índice de muestra.
 */
function refineOnset(buf: Float32Array, from: number, to: number, floor: number): number {
  const a = Math.max(0, from)
  const b = Math.min(buf.length, to)
  const env: number[] = []
  for (let i = a; i < b; i += ENV_WIN) env.push(rms(buf, i, ENV_WIN))
  if (env.length === 0) return a
  let peak = 0
  for (let i = 1; i < env.length; i++) if (env[i]! > env[peak]!) peak = i
  const target = Math.max(env[peak]! * 0.2, floor)
  let i = peak
  while (i > 0 && env[i - 1]! >= target) i--
  return a + i * ENV_WIN
}

export function detectOnsets(
  buf: Float32Array,
  sampleRate: number,
  options: Partial<OnsetOptions> = {},
): Onset[] {
  const o = { ...DEFAULT_ONSET_OPTIONS, ...options }
  const flux = spectralFlux(buf, sampleRate, o.frameSize, o.hop)
  if (flux.length < 3) return []

  // Ruido de fondo: percentil 10 del RMS por frame (los huecos entre golpes).
  const frameRms: number[] = []
  for (let i = 0; i + o.frameSize <= buf.length; i += o.hop) frameRms.push(rms(buf, i, o.frameSize))
  const noiseFloor = percentile(frameRms, 0.1)
  const gate = Math.max(o.minRms, noiseFloor * 10 ** (o.gateDb / 20))

  const delta = median(flux) * 0.5 + 1e-6
  const gapSamples = o.minGap * sampleRate
  const gateLen = Math.round(0.02 * sampleRate)
  const onsets: { sample: number; strength: number; flux: number }[] = []

  for (let f = 1; f < flux.length - 1; f++) {
    const v = flux[f]!
    if (v < flux[f - 1]! || v <= flux[f + 1]!) continue
    const local = flux.slice(Math.max(0, f - o.medianRadius), f + o.medianRadius + 1)
    if (v <= median(local) * o.thresholdK + delta) continue

    const frameStart = f * o.hop
    const sample = refineOnset(buf, frameStart - o.hop, frameStart + o.frameSize, noiseFloor * 2)
    const strength = rms(buf, sample, gateLen)
    if (strength < gate) continue
    if (strength < rms(buf, sample - gateLen, gateLen) * 10 ** (o.riseDb / 20)) continue

    const last = onsets[onsets.length - 1]
    if (last && sample - last.sample < gapSamples) {
      if (strength > last.strength) onsets[onsets.length - 1] = { sample, strength, flux: v }
      continue
    }
    onsets.push({ sample, strength, flux: v })
  }

  return onsets.map(({ sample, strength }) => ({ time: sample / sampleRate, strength }))
}

import { extract } from './meyda'
import type { FeatureVector } from './types'

export const FEATURE_WINDOW = 2048
export const BAND_EDGES_HZ = [150, 800, 4000] as const

const finite = (x: number | undefined): number => (x !== undefined && Number.isFinite(x) ? x : 0)

/** Ventana de `size` muestras desde `start`, con ceros al final y normalizada a pico 1. */
function normalizedWindow(buf: Float32Array, start: number, size: number): Float32Array {
  const out = new Float32Array(size)
  const s = Math.max(0, Math.round(start))
  out.set(buf.subarray(s, Math.min(buf.length, s + size)))
  let peak = 0
  for (let i = 0; i < size; i++) peak = Math.max(peak, Math.abs(out[i]!))
  if (peak > 0) for (let i = 0; i < size; i++) out[i] = out[i]! / peak
  return out
}

/**
 * Características de un golpe a partir de su onset (índice de muestra).
 * La ventana se normaliza a pico 1, así que el volumen no cambia el resultado
 * (salvo `rms`, que se calcula antes y no entra en la distancia).
 */
export function extractFeatures(buf: Float32Array, sampleRate: number, onsetSample: number): FeatureVector {
  const s = Math.max(0, Math.round(onsetSample))
  const raw = buf.subarray(s, Math.min(buf.length, s + FEATURE_WINDOW))
  let sum = 0
  for (let i = 0; i < raw.length; i++) sum += raw[i]! * raw[i]!
  const rms = raw.length ? Math.sqrt(sum / raw.length) : 0

  const w = normalizedWindow(buf, s, FEATURE_WINDOW)
  const r = extract(['spectralCentroid', 'amplitudeSpectrum', 'mfcc', 'zcr'], w, sampleRate)
  const half = FEATURE_WINDOW / 2

  const spec = r.amplitudeSpectrum ?? new Float32Array(half)
  const binHz = sampleRate / FEATURE_WINDOW
  const bands: [number, number, number, number] = [0, 0, 0, 0]
  let total = 0
  for (let k = 0; k < spec.length; k++) {
    const p = spec[k]! * spec[k]!
    const hz = k * binHz
    const b = hz < BAND_EDGES_HZ[0] ? 0 : hz < BAND_EDGES_HZ[1] ? 1 : hz < BAND_EDGES_HZ[2] ? 2 : 3
    bands[b] += p
    total += p
  }
  if (total > 0) for (let b = 0; b < 4; b++) bands[b] = bands[b]! / total

  // MFCC: media de 2 frames solapados (inicio y mitad de la ventana).
  const second = extract(['mfcc'], normalizedWindow(buf, s + half, FEATURE_WINDOW), sampleRate).mfcc ?? []
  const first = r.mfcc ?? []
  const mfcc = Array.from({ length: 13 }, (_, i) => (finite(first[i]) + finite(second[i])) / 2)

  return {
    centroid: finite(r.spectralCentroid) / half,
    bands,
    mfcc,
    zcr: finite(r.zcr) / FEATURE_WINDOW,
    rms,
  }
}

/** Vector para el clasificador: 1 + 4 + 13 + 1 = 19 dimensiones (sin rms). */
export function toVector(f: FeatureVector): number[] {
  return [f.centroid, ...f.bands, ...f.mfcc, f.zcr]
}

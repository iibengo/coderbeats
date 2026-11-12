import { KnnClassifier } from './classifier'
import { extractFeatures } from './features'
import { detectOnsets } from './onsets'
import { quantize } from './quantize'
import type { ClassifiedHit, Onset, Pattern } from './types'

export interface AnalyzeOptions {
  /** segundos desde el inicio del buffer hasta el primer tiempo del compás 1 */
  t0: number
  latency: number
  stepSeconds: number
  bars: number
}

export interface AnalyzeResult {
  onsets: Onset[]
  hits: ClassifiedHit[]
  pattern: Pattern
}

/** Pipeline puro: buffer → onsets → k-NN → patrón cuantizado. */
export function analyzeTake(
  buf: Float32Array,
  sampleRate: number,
  classifier: KnnClassifier,
  o: AnalyzeOptions,
): AnalyzeResult {
  const onsets = detectOnsets(buf, sampleRate)
  const hits: ClassifiedHit[] = onsets.map((onset) => {
    const c = classifier.classify(extractFeatures(buf, sampleRate, onset.time * sampleRate))
    return { onset, instrument: c.instrument, confidence: c.confidence }
  })
  return { onsets, hits, pattern: quantize(hits, o) }
}

/** El onset más fuerte de una toma de calibración, o null si no hay ninguno. */
export function strongestOnset(buf: Float32Array, sampleRate: number): Onset | null {
  const onsets = detectOnsets(buf, sampleRate)
  return onsets.reduce<Onset | null>((best, o) => (!best || o.strength > best.strength ? o : best), null)
}

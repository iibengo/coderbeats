import { toVector } from './features'
import type { CalibrationSample, FeatureVector, Instrument, Norm } from './types'

export interface Classification {
  instrument: Instrument | 'unknown'
  confidence: number
  nearestDistance: number
  /** proporción del voto de cada instrumento entre los k vecinos (suman 1); vacío si es desconocido */
  scores: Partial<Record<Instrument, number>>
}

export function computeNorm(vectors: number[][]): Norm {
  const dims = vectors[0]?.length ?? 0
  const mean = new Array<number>(dims).fill(0)
  const std = new Array<number>(dims).fill(0)
  if (vectors.length === 0) return { mean, std }
  for (const v of vectors) for (let d = 0; d < dims; d++) mean[d]! += v[d]! / vectors.length
  for (const v of vectors) for (let d = 0; d < dims; d++) std[d]! += (v[d]! - mean[d]!) ** 2 / vectors.length
  for (let d = 0; d < dims; d++) {
    const s = Math.sqrt(std[d]!)
    std[d] = s > 1e-9 ? s : 1
  }
  return { mean, std }
}

export const normalize = (v: number[], n: Norm): number[] => v.map((x, d) => (x - n.mean[d]!) / n.std[d]!)

export function distance(a: number[], b: number[]): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += (a[i]! - b[i]!) ** 2
  return Math.sqrt(s)
}

/** Clasificador k-NN ya preparado: normaliza la calibración una sola vez. */
export class KnnClassifier {
  private readonly points: { instrument: Instrument; v: number[] }[]
  /** distancia media entre todos los pares de la calibración */
  readonly meanPairDistance: number

  constructor(
    samples: CalibrationSample[],
    readonly norm: Norm = computeNorm(samples.map((s) => toVector(s.features))),
    readonly k = 3,
    readonly unknownFactor = 3,
  ) {
    this.points = samples.map((s) => ({ instrument: s.instrument, v: normalize(toVector(s.features), norm) }))
    let sum = 0
    let n = 0
    for (let i = 0; i < this.points.length; i++)
      for (let j = i + 1; j < this.points.length; j++) {
        sum += distance(this.points[i]!.v, this.points[j]!.v)
        n++
      }
    this.meanPairDistance = n ? sum / n : Infinity
  }

  classify(features: FeatureVector, exclude?: number): Classification {
    const v = normalize(toVector(features), this.norm)
    const ranked = this.points
      .map((p, i) => ({ i, instrument: p.instrument, d: distance(v, p.v) }))
      .filter((p) => p.i !== exclude)
      .sort((a, b) => a.d - b.d)
    const nearest = ranked[0]
    if (!nearest) return { instrument: 'unknown', confidence: 0, nearestDistance: Infinity, scores: {} }
    if (nearest.d > this.unknownFactor * this.meanPairDistance)
      return { instrument: 'unknown', confidence: 0, nearestDistance: nearest.d, scores: {} }

    const weights = new Map<Instrument, number>()
    let total = 0
    for (const p of ranked.slice(0, this.k)) {
      const w = 1 / (p.d + 1e-9)
      weights.set(p.instrument, (weights.get(p.instrument) ?? 0) + w)
      total += w
    }
    let best: Instrument = nearest.instrument
    for (const [inst, w] of weights) if (w > (weights.get(best) ?? 0)) best = inst
    const scores: Partial<Record<Instrument, number>> = {}
    for (const [inst, w] of weights) scores[inst] = w / total
    return { instrument: best, confidence: (weights.get(best) ?? 0) / total, nearestDistance: nearest.d, scores }
  }

  /** Precisión leave-one-out sobre la propia calibración y la precisión por instrumento. */
  leaveOneOut(samples: CalibrationSample[]): { accuracy: number; perInstrument: Record<Instrument, number> } {
    const hits: Record<Instrument, [number, number]> = { bd: [0, 0], sd: [0, 0], hh: [0, 0] }
    let ok = 0
    samples.forEach((s, i) => {
      const c = this.classify(s.features, i)
      const h = hits[s.instrument]
      h[1]++
      if (c.instrument === s.instrument) {
        ok++
        h[0]++
      }
    })
    const ratio = ([a, b]: [number, number]) => (b ? a / b : 0)
    return {
      accuracy: samples.length ? ok / samples.length : 0,
      perInstrument: { bd: ratio(hits.bd), sd: ratio(hits.sd), hh: ratio(hits.hh) },
    }
  }
}

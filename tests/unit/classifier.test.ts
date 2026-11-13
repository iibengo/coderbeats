import { describe, expect, it } from 'vitest'
import { computeNorm, KnnClassifier, normalize } from '../../app/lib/classifier'
import { extractFeatures } from '../../app/lib/features'
import type { CalibrationSample, FeatureVector, Instrument } from '../../app/lib/types'
import { place, prng, silence, sound } from '../helpers/synth'

const SR = 48000
const KIND = { bd: 'bum', sd: 'pff', hh: 'ts' } as const

function synthFeatures(inst: Instrument, seed: number, gain = 0.8): FeatureVector {
  const buf = silence(0.4, SR, -60, seed + 100)
  place(buf, sound(KIND[inst], SR, gain, seed), 0.05, SR)
  return extractFeatures(buf, SR, 0.05 * SR)
}

function calibration(): CalibrationSample[] {
  return (['bd', 'sd', 'hh'] as const).flatMap((instrument, j) =>
    Array.from({ length: 5 }, (_, i) => ({ instrument, features: synthFeatures(instrument, j * 10 + i) })),
  )
}

/** Vector artificial alrededor de un centro (para tests de geometría). */
function fake(center: number, rand: () => number): FeatureVector {
  const j = () => center + (rand() - 0.5) * 0.1
  return { centroid: j(), bands: [j(), j(), j(), j()], mfcc: Array.from({ length: 13 }, j), zcr: j(), rms: 0.5 }
}

describe('computeNorm', () => {
  it('media y desviación por dimensión; desviación 0 → 1', () => {
    const n = computeNorm([
      [1, 5],
      [3, 5],
    ])
    expect(n.mean).toEqual([2, 5])
    expect(n.std).toEqual([1, 1])
    expect(normalize([3, 5], n)).toEqual([1, 0])
  })
})

describe('KnnClassifier', () => {
  it('clasifica bien 3 clusters sintéticos', () => {
    const rand = prng(3)
    const centers = { bd: 0, sd: 1, hh: 2 } as const
    const samples = (['bd', 'sd', 'hh'] as const).flatMap((instrument) =>
      Array.from({ length: 5 }, () => ({ instrument, features: fake(centers[instrument], rand) })),
    )
    const knn = new KnnClassifier(samples)
    for (const inst of ['bd', 'sd', 'hh'] as const) {
      const c = knn.classify(fake(centers[inst], rand))
      expect(c.instrument).toBe(inst)
      expect(c.confidence).toBeGreaterThan(0.9)
    }
  })

  it('clasifica golpes sintéticos nuevos (otra semilla y otro volumen)', () => {
    const knn = new KnnClassifier(calibration())
    for (const inst of ['bd', 'sd', 'hh'] as const)
      for (const seed of [500, 501, 502]) expect(knn.classify(synthFeatures(inst, seed, 0.3)).instrument).toBe(inst)
  })

  it('leave-one-out del 100 % con sonidos bien separados', () => {
    const samples = calibration()
    const r = new KnnClassifier(samples).leaveOneOut(samples)
    expect(r.accuracy).toBe(1)
    expect(r.perInstrument).toEqual({ bd: 1, sd: 1, hh: 1 })
  })

  it('marca como unknown un punto muy lejano', () => {
    const rand = prng(9)
    const samples = (['bd', 'sd', 'hh'] as const).flatMap((instrument, i) =>
      Array.from({ length: 5 }, () => ({ instrument, features: fake(i, rand) })),
    )
    expect(new KnnClassifier(samples).classify(fake(100, rand)).instrument).toBe('unknown')
  })

  it('voto ponderado con k = 3: dos vecinos de una clase ganan a uno más cercano', () => {
    const at = (x: number): FeatureVector => ({ ...fake(0, () => 0.5), centroid: x })
    const samples: CalibrationSample[] = [
      { instrument: 'bd', features: at(0) },
      { instrument: 'sd', features: at(0.6) },
      { instrument: 'sd', features: at(0.7) },
      { instrument: 'hh', features: at(5) },
    ]
    const knn = new KnnClassifier(samples)
    expect(knn.classify(at(0.4)).instrument).toBe('sd')
    expect(knn.classify(at(0.05)).instrument).toBe('bd')
  })
})

describe('votos por instrumento (para los carriles, spec 003 E4.2)', () => {
  it('suman 1 y el ganador es el de más voto', () => {
    const knn = new KnnClassifier(calibration())
    const c = knn.classify(synthFeatures('hh', 702))
    const total = Object.values(c.scores).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1)
    expect(c.scores[c.instrument as 'hh']).toBeCloseTo(c.confidence)
  })
})

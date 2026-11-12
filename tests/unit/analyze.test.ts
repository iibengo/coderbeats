import { describe, expect, it } from 'vitest'
import { analyzeTake, strongestOnset } from '../../app/lib/analyze'
import { KnnClassifier } from '../../app/lib/classifier'
import { extractFeatures } from '../../app/lib/features'
import { generateStrudel } from '../../app/lib/strudel'
import type { CalibrationSample, Instrument } from '../../app/lib/types'
import { place, silence, sound } from '../helpers/synth'

const SR = 48000
const KIND = { bd: 'bum', sd: 'pff', hh: 'ts' } as const
const STEP = 60 / 90 / 4

function calibrate(): KnnClassifier {
  const samples: CalibrationSample[] = []
  for (const inst of ['bd', 'sd', 'hh'] as const)
    for (let i = 0; i < 5; i++) {
      const take = silence(1.5, SR, -60, 50 + i)
      place(take, sound(KIND[inst], SR, 0.5 + i * 0.1, 200 + i), 0.4 + i * 0.05, SR)
      const onset = strongestOnset(take, SR)
      expect(onset).not.toBeNull()
      samples.push({ instrument: inst, features: extractFeatures(take, SR, onset!.time * SR) })
    }
  return new KnnClassifier(samples)
}

describe('analyzeTake (pipeline puro)', () => {
  it('recupera un patrón de 4 compases con latencia simulada de 80 ms', () => {
    const bar: (Instrument | null)[] = ['bd', null, 'hh', null, 'sd', null, 'hh', null, 'bd', null, 'bd', null, 'sd', null, 'hh', null]
    const expected = [...bar, ...bar, ...bar, ...bar]
    const t0 = 0.25
    const latency = 0.08
    const buf = silence(t0 + 4 * 16 * STEP + 0.5, SR, -60, 3)
    expected.forEach((inst, step) => {
      if (!inst) return
      // humanización determinista de ±15 ms
      const jitter = (((step * 7) % 5) - 2) * 0.0075
      place(buf, sound(KIND[inst], SR, 0.4 + (step % 3) * 0.2, 1000 + step), t0 + step * STEP + latency + jitter, SR)
    })

    const { pattern, onsets } = analyzeTake(buf, SR, calibrate(), { t0, latency, stepSeconds: STEP, bars: 4 })
    expect(onsets).toHaveLength(expected.filter(Boolean).length)
    expect(pattern.steps).toEqual(expected)
    expect(generateStrudel(pattern, { bpm: 90, bank: 'RolandTR909' })).toContain(
      's("bd ~ hh ~ sd ~ hh ~ bd ~ bd ~ sd ~ hh ~")',
    )
  })

  it('strongestOnset devuelve null en silencio', () => {
    expect(strongestOnset(silence(1.5, SR), SR)).toBeNull()
  })
})

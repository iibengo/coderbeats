import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultCalibration, defaultClassifier, PROTOTYPES } from '../../app/lib/defaultModel'
import { extractFeatures } from '../../app/lib/features'
import { detectOnsets } from '../../app/lib/onsets'
import { repeatPattern, sequenceScore, lcsLength } from '../../app/lib/sequenceScore'
import { decodeWav } from '../../app/lib/wav'
import type { Instrument } from '../../app/lib/types'

describe('modelo por defecto (spec 001): prototipos genéricos de bum · pff · ts', () => {
  const clf = defaultClassifier()
  const feat = (i: Instrument, mfccNoise = 0) => ({ centroid: PROTOTYPES[i].centroid, bands: PROTOTYPES[i].bands, mfcc: Array.from({ length: 13 }, (_, k) => (k - 6) * mfccNoise), zcr: PROTOTYPES[i].zcr, rms: 0.1 })
  it('es determinista y trae 5 muestras de cada clase, sin volumen de referencia', () => {
    const a = defaultCalibration()
    expect(a).toEqual(defaultCalibration())
    for (const i of ['bd', 'sd', 'hh'] as const) expect(a.samples.filter((s) => s.instrument === i)).toHaveLength(5)
    expect(a.samples.every((s) => s.features.rms === 0)).toBe(true)
  })
  it('reconoce sus propios prototipos y no se despista con MFCC de cualquier voz', () => {
    for (const i of ['bd', 'sd', 'hh'] as const) {
      for (const noise of [0, 3, 12]) expect(clf.classify(feat(i, noise)).instrument, `${i} mfcc×${noise}`).toBe(i)
    }
  })
  it('un golpe cualquiera siempre cae en alguna clase razonable (la nube no se rechaza por tener MFCC distintos)', () => {
    const c = clf.classify({ centroid: 0.45, bands: [0.01, 0.02, 0.2, 0.77], mfcc: new Array<number>(13).fill(30), zcr: 0.42, rms: 0.2 })
    expect(c.instrument).not.toBe('unknown')
  })
  it('la subsecuencia común mide el acierto de un patrón repetido', () => {
    expect(lcsLength([1, 2, 3], [1, 3])).toBe(2)
    const exp = repeatPattern(['bd', 'sd', 'hh'], 3)
    expect(sequenceScore(exp, exp)).toMatchObject({ precision: 1, coverage: 1 })
    const s = sequenceScore(['bd', 'bd', 'sd', 'hh', 'hh', 'sd'], exp)
    expect(s.precision).toBeLessThan(1)
    expect(s.coverage).toBeGreaterThan(0)
    expect(sequenceScore([], exp).precision).toBe(0)
  })
})

// Las tomas del laboratorio (tests/fixtures/voice/, fuera del repositorio): «Beatbox solo» dice «bum pff ts» en bucle. Se salta si no están.
const DIR = join(__dirname, '..', 'fixtures', 'voice')
const take = join(DIR, 't8-beatbox_pc_141159.wav')
describe.skipIf(!existsSync(take))('modelo por defecto con tus tomas del laboratorio (t8: «bum pff ts» en bucle)', () => {
  it('mide el acierto por secuencia y no baja del mínimo', () => {
    const w = decodeWav(readFileSync(take).buffer.slice(0) as ArrayBuffer)!
    const clf = defaultClassifier()
    const pred: Instrument[] = []
    for (const o of detectOnsets(w.samples, w.sampleRate)) {
      const c = clf.classify(extractFeatures(w.samples, w.sampleRate, o.time * w.sampleRate))
      if (c.instrument !== 'unknown') pred.push(c.instrument)
    }
    const s = sequenceScore(pred, repeatPattern<Instrument>(['bd', 'sd', 'hh'], 10))
    // eslint-disable-next-line no-console
    console.info(`[modelo por defecto] t8: ${pred.length} golpes · precisión ${(s.precision * 100).toFixed(0)} % · cobertura ${(s.coverage * 100).toFixed(0)} % · ${pred.join(' ')}`)
    expect(s.precision).toBeGreaterThanOrEqual(0.6)
  })
})

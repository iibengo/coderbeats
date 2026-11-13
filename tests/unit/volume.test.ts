import { describe, expect, it } from 'vitest'
import type { CalibrationSample, Instrument } from '../../app/lib/types'
import { fmtVolume, relativeVolume, volumeRefs } from '../../app/lib/volume'

const sample = (instrument: Instrument, rms: number): CalibrationSample => ({
  instrument,
  features: { centroid: 0, bands: [0, 0, 0, 0], mfcc: [], zcr: 0, rms },
})

describe('volumen relativo a la calibración (E4.0)', () => {
  const refs = volumeRefs([sample('bd', 0.2), sample('bd', 0.4), sample('bd', 0.3), sample('hh', 0.05), sample('hh', 0.07)])
  it('referencia = mediana del rms por instrumento y de todos', () => {
    expect(refs.bd).toBeCloseTo(0.3)
    expect(refs.hh).toBeCloseTo(0.06)
    expect(refs.sd).toBeUndefined()
    expect(refs.all).toBeCloseTo(0.2)
  })
  it('un golpe como los tuyos da ~1; uno flojo, mucho menos', () => {
    expect(relativeVolume(0.3, 'bd', refs)).toBeCloseTo(1)
    expect(relativeVolume(0.06, 'bd', refs)).toBeCloseTo(0.2)
    expect(relativeVolume(0.06, 'hh', refs)).toBeCloseTo(1)
  })
  it('sin referencia del instrumento (o desconocido) usa la de todos; sin calibración, null', () => {
    expect(relativeVolume(0.1, 'sd', refs)).toBeCloseTo(0.5)
    expect(relativeVolume(0.1, 'unknown', refs)).toBeCloseTo(0.5)
    expect(relativeVolume(0.1, 'bd', {})).toBeNull()
  })
  it('formato del registro', () => {
    expect(fmtVolume(0.4214)).toBe(' · vol 0,42')
    expect(fmtVolume(null)).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import type { CalibrationSample, Instrument } from '../../app/lib/types'
import { fmtVolume, isTooQuiet, MIN_HIT_VOLUME, relativeVolume, volumeRefs } from '../../app/lib/volume'

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

describe('umbral de volumen (E4.5, 30 %)', () => {
  it('el umbral de partida es el 30 % del volumen de tus golpes', () => {
    expect(MIN_HIT_VOLUME).toBe(0.3)
  })
  it('el ruido del registro (vol 0,02–0,12) se descarta; tus golpes, no', () => {
    for (const v of [0.02, 0.05, 0.12, 0.29]) expect(isTooQuiet(v)).toBe(true)
    for (const v of [0.3, 0.45, 1, 1.8]) expect(isTooQuiet(v)).toBe(false)
  })
  it('sin calibración (sin volumen) no se descarta nada', () => {
    expect(isTooQuiet(null)).toBe(false)
    expect(isTooQuiet(undefined)).toBe(false)
  })
  it('el umbral se puede ajustar', () => {
    expect(isTooQuiet(0.4, 0.5)).toBe(true)
    expect(isTooQuiet(0.4, 0.2)).toBe(false)
  })
})

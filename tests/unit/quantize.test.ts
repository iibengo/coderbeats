import { describe, expect, it } from 'vitest'
import { hitCount, quantize } from '../../app/lib/quantize'
import type { ClassifiedHit, Instrument } from '../../app/lib/types'

const STEP = 60 / 90 / 4
const base = { t0: 1, latency: 0, stepSeconds: STEP, bars: 4 }
const hit = (time: number, instrument: Instrument | 'unknown' = 'bd', strength = 1, confidence = 1): ClassifiedHit => ({
  onset: { time, strength },
  instrument,
  confidence,
})

describe('quantize', () => {
  it('redondea a la semicorchea más cercana', () => {
    const p = quantize([hit(1 + STEP * 4 + 0.03, 'sd')], base)
    expect(p.steps[4]).toBe('sd')
    expect(p.offsetsMs[4]).toBeCloseTo(30, 6)
    expect(hitCount(p)).toBe(1)
  })

  it('bordes: justo antes y después de media semicorchea', () => {
    const p = quantize([hit(1 + STEP * 2.49), hit(1 + STEP * 5.51)], base)
    expect(p.steps[2]).toBe('bd')
    expect(p.steps[6]).toBe('bd')
  })

  it('compensa la latencia', () => {
    const p = quantize([hit(1 + STEP * 8 + 0.08)], { ...base, latency: 0.08 })
    expect(p.steps[8]).toBe('bd')
    expect(p.offsetsMs[8]).toBeCloseTo(0, 6)
  })

  it('un golpe un poco adelantado al compás 1 cae en el paso 0', () => {
    expect(quantize([hit(1 - STEP * 0.4)], base).steps[0]).toBe('bd')
  })

  it('descarta golpes fuera de los 64 pasos', () => {
    const p = quantize([hit(1 - STEP), hit(1 + STEP * 64)], base)
    expect(hitCount(p)).toBe(0)
    expect(p.steps).toHaveLength(64)
  })

  it('colisión: gana fuerza × confianza', () => {
    const p = quantize([hit(1 + STEP * 3 - 0.01, 'hh', 1, 0.5), hit(1 + STEP * 3 + 0.01, 'sd', 0.8, 0.9)], base)
    expect(p.steps[3]).toBe('sd')
  })

  it('ignora los unknown', () => {
    expect(hitCount(quantize([hit(1, 'unknown')], base))).toBe(0)
  })
})

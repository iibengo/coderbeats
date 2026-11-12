import { describe, expect, it } from 'vitest'
import { PhraseTracker, roundUpLength, type PhraseHit } from '../../app/lib/phrases'
import type { Instrument } from '../../app/lib/types'

const STEP = 60 / 90 / 4
const at = (step: number, instrument: Instrument = 'bd'): PhraseHit => ({
  tCorr: 100 + step * STEP,
  instrument,
  strength: 0.5,
  confidence: 1,
})
const tracker = (closeBeats: 1 | 2 | 4 = 2, maxBars: 1 | 2 | 4 = 4) =>
  new PhraseTracker({ anchor: 100, stepSeconds: STEP }, { closeBeats, maxBars })

describe('roundUpLength', () => {
  it('redondea hacia arriba a 1, 2 o 4 y respeta el máximo', () => {
    expect([1, 2, 3, 4].map((n) => roundUpLength(n, 4))).toEqual([1, 2, 4, 4])
    expect(roundUpLength(3, 2)).toBe(2)
  })
})

describe('PhraseTracker', () => {
  it('bombo en 1 y 3: 2 tiempos de silencio → cierra en la línea siguiente como loop de 1 compás', () => {
    const t = tracker()
    t.add(at(0))
    t.add(at(8))
    const p = t.decide(1)
    expect(p).toMatchObject({ startBar: 0, spanBars: 1, bars: 1 })
    expect(p!.hits).toHaveLength(2)
    expect(t.open).toBe(false)
  })

  it('golpe en los últimos 2 tiempos → no cierra; sigue en el compás siguiente', () => {
    const t = tracker()
    t.add(at(0))
    t.add(at(12))
    expect(t.decide(1)).toBeNull()
    t.add(at(16 + 4))
    expect(t.decide(2)).toMatchObject({ startBar: 0, bars: 2 })
  })

  it('3 compases seguidos → loop de 4', () => {
    const t = tracker()
    for (const s of [0, 14, 16, 30, 32, 40]) t.add(at(s))
    expect(t.decide(1)).toBeNull()
    expect(t.decide(2)).toBeNull()
    expect(t.decide(3)).toMatchObject({ spanBars: 3, bars: 4 })
  })

  it('el silencio de cierre se ajusta (1 tiempo / 1 compás)', () => {
    const one = tracker(1)
    one.add(at(0))
    one.add(at(10))
    expect(one.decide(1)).not.toBeNull()
    const bar = tracker(4)
    bar.add(at(2))
    expect(bar.decide(1)).toBeNull()
    expect(bar.decide(2)).toMatchObject({ startBar: 0, bars: 1 })
  })

  it('un golpe adelantado al 1 pertenece al compás siguiente', () => {
    const t = tracker()
    t.add({ ...at(16), tCorr: 100 + 16 * STEP - 0.04 })
    expect(t.barOf(100 + 16 * STEP - 0.04)).toBe(1)
    expect(t.decide(1)).toBeNull()
    expect(t.decide(2)).toMatchObject({ startBar: 1 })
  })

  it('al pasar del máximo de compases, cierra y empieza otra frase', () => {
    const t = tracker(2, 1)
    t.add(at(0))
    t.add(at(14))
    const closed = t.add(at(16 + 2))
    expect(closed).toMatchObject({ startBar: 0, bars: 1 })
    expect(t.open).toBe(true)
    expect(t.decide(2)).toMatchObject({ startBar: 1, bars: 1 })
  })

  it('una frase con varios instrumentos conserva todos los golpes', () => {
    const t = tracker()
    t.add(at(0, 'bd'))
    t.add(at(4, 'sd'))
    t.add(at(2, 'hh'))
    expect(t.decide(1)!.hits.map((h) => h.instrument).sort()).toEqual(['bd', 'hh', 'sd'])
  })
})

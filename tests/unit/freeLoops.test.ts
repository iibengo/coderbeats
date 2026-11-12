import { describe, expect, it } from 'vitest'
import {
  addPhrase,
  candidatesFromPhrase,
  clearLoops,
  emptyLoops,
  loopBarAt,
  MAX_LOOPS,
  overlap,
  removeLoop,
  toggleMute,
  type BirthOptions,
  type LoopsState,
} from '../../app/lib/freeLoops'
import type { ClosedPhrase } from '../../app/lib/phrases'
import type { Instrument } from '../../app/lib/types'

const opts = (o: Partial<BirthOptions> = {}): BirthOptions => ({
  assist: true,
  style: 'hiphop90',
  quantizeEvery: 1,
  bornAt: 1,
  ...o,
})

function phrase(hits: [number, Instrument][], startBar = 0, bars: 1 | 2 | 4 = 1): ClosedPhrase {
  return {
    startBar,
    spanBars: bars,
    bars,
    hits: hits.map(([step, instrument]) => ({
      tCorr: 0,
      instrument,
      strength: 0.5,
      confidence: 1,
      globalStep: startBar * 16 + step,
    })),
  }
}

describe('candidatesFromPhrase', () => {
  it('un loop por instrumento', () => {
    const c = candidatesFromPhrase(phrase([[0, 'bd'], [4, 'sd'], [8, 'bd'], [12, 'sd']]), opts())
    expect(c.map((l) => [l.instrument, l.hits.map((h) => h.pos)])).toEqual([
      ['bd', [0, 8]],
      ['sd', [4, 12]],
    ])
  })

  it('golpe suelto con ayuda → plantilla del estilo (repetida en cada compás)', () => {
    const [l] = candidatesFromPhrase(phrase([[5, 'hh']], 0, 2), opts({ style: 'house' }))
    expect(l!.fromTemplate).toBe(true)
    expect(l!.hits.map((h) => h.pos)).toEqual([2, 6, 10, 14, 18, 22, 26, 30])
  })

  it('sin ayuda: posiciones decimales exactas y sin plantilla', () => {
    const [l] = candidatesFromPhrase(phrase([[4.37, 'sd']]), opts({ assist: false }))
    expect(l!.fromTemplate).toBe(false)
    expect(l!.hits[0]!.pos).toBeCloseTo(4.37, 9)
  })

  it('con ayuda cuantiza con el prior del estilo', () => {
    const [l] = candidatesFromPhrase(phrase([[4.75, 'bd'], [8.2, 'bd']]), opts({ style: 'house' }))
    expect(l!.hits.map((h) => h.pos)).toEqual([4, 8])
  })
})

describe('loopBarAt (fase)', () => {
  it('un loop de 2 compases nacido en el compás 3 suena su compás 0 en los impares', () => {
    const l = { bars: 2 as const, phaseBar: 3 }
    expect([3, 4, 5, 6, 7].map((g) => loopBarAt(l, g))).toEqual([0, 1, 0, 1, 0])
  })
})

describe('addPhrase', () => {
  it('nace un loop y repetir el mismo patrón lo refuerza en vez de duplicarlo', () => {
    let s: LoopsState = emptyLoops()
    const p = phrase([[0, 'bd'], [8, 'bd'], [10, 'bd']])
    let r = addPhrase(s, p, opts())
    expect(r.events.map((e) => e.type)).toEqual(['born'])
    s = r.state
    r = addPhrase(s, phrase([[0, 'bd'], [8, 'bd'], [10, 'bd']], 3), opts({ bornAt: 4 }))
    expect(r.events).toEqual([{ type: 'reinforced', id: 1 }])
    expect(r.state.loops).toHaveLength(1)
  })

  it('varios loops del mismo instrumento si el patrón es distinto', () => {
    let s = emptyLoops()
    s = addPhrase(s, phrase([[0, 'bd'], [8, 'bd']]), opts()).state
    s = addPhrase(s, phrase([[2, 'bd'], [6, 'bd'], [14, 'bd']]), opts()).state
    s = addPhrase(s, phrase([[0, 'bd'], [3, 'bd'], [11, 'bd']]), opts()).state
    expect(s.loops.filter((l) => l.instrument === 'bd')).toHaveLength(3)
  })

  it('overlap considera la fase global', () => {
    const a = { bars: 2 as const, phaseBar: 0, hits: [{ pos: 0, strength: 1 }] }
    const b = { bars: 2 as const, phaseBar: 1, hits: [{ pos: 16, strength: 1 }] }
    expect(overlap(a, b)).toBe(1)
    expect(overlap(a, { ...b, phaseBar: 0 })).toBe(0)
  })

  it(`máximo ${MAX_LOOPS}: sale primero el silenciado más antiguo y luego el más antiguo`, () => {
    let s = emptyLoops()
    for (let i = 0; i < MAX_LOOPS; i++) s = addPhrase(s, phrase([[i, 'hh'], [i + 3, 'hh']]), opts({ bornAt: i })).state
    s = toggleMute(s, 3)
    let r = addPhrase(s, phrase([[1, 'sd'], [9, 'sd']]), opts({ bornAt: 20 }))
    expect(r.events[0]).toEqual({ type: 'removed', id: 3, reason: 'limit' })
    expect(r.state.loops).toHaveLength(MAX_LOOPS)
    r = addPhrase(r.state, phrase([[2, 'sd'], [7, 'sd']]), opts({ bornAt: 21 }))
    expect(r.events[0]).toEqual({ type: 'removed', id: 1, reason: 'limit' })
  })

  it('silenciar, borrar y borrar todo', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [4, 'sd']]), opts()).state
    s = toggleMute(s, 1)
    expect(s.loops[0]!.muted).toBe(true)
    s = removeLoop(s, 2)
    expect(s.loops.map((l) => l.id)).toEqual([1])
    expect(clearLoops(s).loops).toEqual([])
  })
})

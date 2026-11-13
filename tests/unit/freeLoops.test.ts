import { describe, expect, it } from 'vitest'
import {
  addPhrase,
  candidatesFromPhrase,
  clearLoops,
  emptyLoops,
  loopBarAt,
  MAX_LOOPS,
  mergeLoops,
  prunePrev,
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
  it('grabado en bucle de una célula que empezó en el compás 40: la fase se cuenta desde ella', () => {
    const [l] = candidatesFromPhrase(phrase([[0, 'bd'], [8, 'bd']], 43, 1), opts({ cellStart: 40, bornAt: 44 }))
    expect(l!.phaseBar).toBe(3)
    expect(l!.hits.map((h) => h.pos)).toEqual([0, 8])
    // sin célula (canción de una sola), la fase es el compás global, como siempre
    expect(candidatesFromPhrase(phrase([[0, 'bd']], 43, 1), opts())[0]!.phaseBar).toBe(43)
  })

  it('un loop por instrumento', () => {
    const c = candidatesFromPhrase(phrase([[0, 'bd'], [4, 'sd'], [8, 'bd'], [12, 'sd']]), opts())
    expect(c.map((l) => [l.instrument, l.hits.map((h) => h.pos)])).toEqual([
      ['bd', [0, 8]],
      ['sd', [4, 12]],
    ])
  })

  it('golpe suelto con ayuda: se queda como golpe, sin plantilla (§16.21)', () => {
    const [l] = candidatesFromPhrase(phrase([[5, 'hh']], 0, 2), opts({ style: 'house' }))
    expect(l!.fromTemplate).toBe(false)
    expect(l!.hits.map((h) => h.pos)).toEqual([5])
  })

  it('dos golpes que la ayuda llevaría al mismo paso no se funden (§16.21)', () => {
    // hip hop: caja en 12 (típico) y en 12,6, que la ayuda acercaría al 12
    const [l] = candidatesFromPhrase(phrase([[12.6, 'sd'], [12, 'sd']]), opts())
    expect(l!.hits.map((h) => h.pos)).toEqual([12, 13])
  })

  it('pero el mismo golpe repetido (mismo paso de la rejilla) cuenta una vez', () => {
    const [l] = candidatesFromPhrase(phrase([[12.2, 'sd'], [11.9, 'sd']]), opts())
    expect(l!.hits.map((h) => h.pos)).toEqual([12])
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
  it('nace un loop por instrumento nuevo', () => {
    const r = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd'], [4, 'sd']]), opts())
    expect(r.events.map((e) => e.type)).toEqual(['born', 'born'])
  })

  it('ya no descarta "copias": repetir el patrón con un golpe más no se pierde (§16.19)', () => {
    const c = opts({ repeat: 'complete' })
    let s = addPhrase(emptyLoops(), phrase([[0, 'hh'], [4, 'hh'], [8, 'hh'], [12, 'hh']]), c).state
    const r = addPhrase(s, phrase([[0, 'hh'], [4, 'hh'], [8, 'hh'], [12, 'hh'], [14, 'hh']], 1), { ...c, bornAt: 2 })
    expect(r.events).toMatchObject([{ type: 'completed', added: 1 }])
    s = r.state
    expect(s.loops).toHaveLength(1)
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 4, 8, 12, 14])
  })

  it('como mucho una bola por instrumento, en los dos modos', () => {
    for (const repeat of ['replace', 'complete'] as const) {
      let s = emptyLoops()
      for (let i = 0; i < 5; i++) s = addPhrase(s, phrase([[i, 'bd'], [i + 6, 'bd']], i), opts({ repeat, bornAt: i + 1 })).state
      expect(s.loops.filter((l) => l.instrument === 'bd')).toHaveLength(1)
    }
  })

  it(`máximo ${MAX_LOOPS}: sale primero el silenciado más antiguo y luego el más antiguo`, () => {
    // estado heredado con muchos loops (p. ej. guardado antes de §16.19)
    const many: LoopsState = {
      nextId: MAX_LOOPS + 1,
      loops: Array.from({ length: MAX_LOOPS }, (_, i) => ({
        id: i + 1,
        instrument: (['bd', 'sd'] as const)[i % 2]!,
        bars: 1 as const,
        phaseBar: 0,
        hits: [{ pos: i, strength: 1 }],
        muted: i === 2,
        bornAt: i,
        fromTemplate: false,
      })),
    }
    const r = addPhrase(many, phrase([[1, 'hh'], [9, 'hh']]), opts({ bornAt: 20 }))
    expect(r.events[0]).toEqual({ type: 'removed', id: 3, reason: 'limit' })
    expect(r.state.loops).toHaveLength(MAX_LOOPS)
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

describe('modo completa (overdub, §16.19)', () => {
  const c = opts({ repeat: 'complete' })

  it('repetir golpes que ya están no cambia nada (sin evento)', () => {
    const s = addPhrase(emptyLoops(), phrase([[0, 'hh'], [8, 'hh']]), c).state
    const r = addPhrase(s, phrase([[0, 'hh'], [8, 'hh']], 1), { ...c, bornAt: 2 })
    expect(r.events).toEqual([])
    expect(r.state.loops[0]).toEqual(s.loops[0])
  })

  it('mergeLoops respeta la fase del loop existente', () => {
    const m = mergeLoops(
      { bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 1 }] },
      { bars: 1, phaseBar: 3, hits: [{ pos: 6, strength: 1 }] },
    )
    expect(m.hits.map((h) => h.pos)).toEqual([0, 6])
    expect(m.added).toBe(1)
  })

  it('una frase más larga alarga el loop repitiendo su patrón', () => {
    const m = mergeLoops(
      { bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 1 }, { pos: 8, strength: 1 }] },
      { bars: 2, phaseBar: 0, hits: [{ pos: 20, strength: 1 }] },
    )
    expect(m.bars).toBe(2)
    expect(m.hits.map((h) => h.pos)).toEqual([0, 8, 16, 20, 24])
  })

  it('no duplica pasos ya ocupados (también sin ayuda, a ±0,5 pasos)', () => {
    const m = mergeLoops(
      { bars: 1, phaseBar: 0, hits: [{ pos: 4.2, strength: 1 }] },
      { bars: 1, phaseBar: 0, hits: [{ pos: 3.9, strength: 1 }, { pos: 10.1, strength: 1 }] },
    )
    expect(m.hits.map((h) => h.pos)).toEqual([4.2, 10.1])
  })

  it('un golpe suelto completa con ese golpe, no con la plantilla del estilo', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'hh'], [8, 'hh']]), c).state
    s = addPhrase(s, phrase([[6, 'hh']], 1), { ...c, bornAt: 2 }).state
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 6, 8])
  })

  it('y si el instrumento no tiene loop, un golpe suelto también se queda como golpe (§16.21)', () => {
    const s = addPhrase(emptyLoops(), phrase([[3, 'hh']]), { ...c, style: 'house' }).state
    expect(s.loops[0]!.fromTemplate).toBe(false)
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([3])
  })

  it('golpes de uno en uno con pausas: se quedan todos (el bug de §16.21)', () => {
    let s = emptyLoops()
    for (const [step, bar] of [[3, 2], [6, 5], [7, 8]] as const)
      s = addPhrase(s, phrase([[step, 'bd']], bar), { ...c, bornAt: bar + 1 }).state
    expect(s.loops).toHaveLength(1)
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([3, 6, 7])
  })

  it('si la ayuda lo lleva a un paso ocupado, va a su paso de la rejilla más cercano', () => {
    let s = addPhrase(emptyLoops(), phrase([[4, 'sd'], [12, 'sd']]), c).state
    s = addPhrase(s, phrase([[12.6, 'sd']], 3), { ...c, bornAt: 4 }).state
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([4, 12, 13])
  })

  it('si ese paso también está ocupado, es el mismo golpe y no se añade', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd']]), c).state
    const r = addPhrase(s, phrase([[7.6, 'bd']], 3), { ...c, bornAt: 4 })
    expect(r.events).toEqual([])
    expect(r.state.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 8])
  })

  it('repetir encima el ritmo que ya está no lo ensucia', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd'], [10, 'bd']]), c).state
    const r = addPhrase(s, phrase([[0.3, 'bd'], [7.8, 'bd'], [10.2, 'bd']], 3), { ...c, bornAt: 4 })
    expect(r.state.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 8, 10])
  })

  it('una enmienda no duplica un golpe que la ayuda había movido a su paso alternativo', () => {
    let s = addPhrase(emptyLoops(), phrase([[4, 'sd'], [12, 'sd']]), c).state
    s = addPhrase(s, phrase([[12.6, 'sd']], 3), { ...c, bornAt: 4 }).state
    s = addPhrase(s, phrase([[12.6, 'sd'], [2, 'sd']], 3), { ...c, bornAt: 4, amend: true }).state
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([2, 4, 12, 13])
    expect(s.loops[0]!.prev!.hits.map((h) => h.pos)).toEqual([4, 12])
  })

  it('por defecto, completa (§16.21)', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'hh']]), opts()).state
    const r = addPhrase(s, phrase([[8, 'hh']], 1), opts({ bornAt: 2 }))
    expect(r.events.map((e) => e.type)).toEqual(['completed'])
    expect(r.state.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 8])
  })

  it('la versión anterior sigue sonando hasta el nacimiento; un loop silenciado se reactiva', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd']]), c).state
    const r = addPhrase(s, phrase([[10, 'bd'], [12, 'bd']], 1), { ...c, bornAt: 2 })
    expect(r.state.loops[0]!.prev!.hits.map((h) => h.pos)).toEqual([0, 8])
    s = toggleMute(r.state, 1)
    s = addPhrase(s, phrase([[14, 'bd'], [4, 'bd']], 2), { ...c, bornAt: 3 }).state
    expect(s.loops[0]!.muted).toBe(false)
    expect(s.loops[0]!.prev).toBeUndefined()
  })

  it('enmienda en modo completa: añade el golpe tardío sin duplicar la frase', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'hh'], [8, 'hh']]), c).state
    s = addPhrase(s, phrase([[4, 'hh'], [12, 'hh']], 1), { ...c, bornAt: 2 }).state
    s = addPhrase(s, phrase([[4, 'hh'], [12, 'hh'], [15, 'hh']], 1), { ...c, bornAt: 2, amend: true }).state
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 4, 8, 12, 15])
    expect(s.loops[0]!.prev!.hits.map((h) => h.pos)).toEqual([0, 8])
  })
})

describe('modo sustituye (§16.15)', () => {
  const r = (o: Partial<BirthOptions> = {}) => opts({ repeat: 'replace', ...o })

  it('un loop nuevo de un instrumento sustituye al anterior, con el mismo id y la versión previa', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd']]), r()).state
    const res = addPhrase(s, phrase([[0, 'bd'], [6, 'bd'], [10, 'bd']], 2), r({ bornAt: 3 }))
    expect(res.events.map((e) => e.type)).toEqual(['replaced'])
    s = res.state
    expect(s.loops).toHaveLength(1)
    expect(s.loops[0]!.id).toBe(1)
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 6, 10])
    expect(s.loops[0]!.prev!.hits.map((h) => h.pos)).toEqual([0, 8])
    expect(s.loops[0]!.bornAt).toBe(3)
  })

  it('otros instrumentos no se tocan; uno nuevo sí nace', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd']]), r()).state
    s = addPhrase(s, phrase([[4, 'sd'], [12, 'sd']]), r()).state
    expect(s.loops.map((l) => l.instrument)).toEqual(['bd', 'sd'])
  })

  it('si el anterior estaba silenciado, no hay versión previa que tocar', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'hh'], [2, 'hh']]), r()).state
    s = toggleMute(s, 1)
    s = addPhrase(s, phrase([[1, 'hh'], [5, 'hh'], [9, 'hh']]), r()).state
    expect(s.loops[0]!.prev).toBeUndefined()
    expect(s.loops[0]!.muted).toBe(false)
  })

  it('prunePrev quita la versión previa cuando ya ha nacido la nueva', () => {
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd']]), r()).state
    s = addPhrase(s, phrase([[0, 'bd'], [6, 'bd'], [10, 'bd']], 2), r({ bornAt: 3 })).state
    expect(prunePrev(s, 2).loops[0]!.prev).toBeDefined()
    expect(prunePrev(s, 3).loops[0]!.prev).toBeUndefined()
  })
})

describe('enmienda (amend)', () => {
  it('regenera en su sitio los loops nacidos de esa frase', () => {
    const r = opts({ repeat: 'replace', bornAt: 1 })
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd']]), r).state
    const res = addPhrase(s, phrase([[0, 'bd'], [8, 'bd'], [14, 'bd']]), { ...r, amend: true })
    expect(res.events.map((e) => e.type)).toEqual(['replaced'])
    s = res.state
    expect(s.loops).toHaveLength(1)
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 8, 14])
  })

  it('conserva la versión previa original (la que sonaba antes)', () => {
    const r = opts({ repeat: 'replace' })
    let s = addPhrase(emptyLoops(), phrase([[0, 'bd'], [8, 'bd']]), r).state
    s = addPhrase(s, phrase([[0, 'bd'], [6, 'bd'], [10, 'bd']], 2), { ...r, bornAt: 3 }).state
    s = addPhrase(s, phrase([[0, 'bd'], [6, 'bd'], [10, 'bd'], [14, 'bd']], 2), { ...r, bornAt: 3, amend: true }).state
    expect(s.loops[0]!.prev!.hits.map((h) => h.pos)).toEqual([0, 8])
    expect(s.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 6, 10, 14])
  })
})

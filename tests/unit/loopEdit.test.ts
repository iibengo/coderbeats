import { describe, expect, it } from 'vitest'
import { emptyLoops, MAX_LOOPS, type FreeLoop, type LoopsState } from '../../app/lib/freeLoops'
import { addHit, moveHit, removeHit, snapStep, type EditOptions } from '../../app/lib/loopEdit'
import type { Instrument } from '../../app/lib/types'

const help: EditOptions = { assist: true, quantizeEvery: 1 }
const dnb: EditOptions = { assist: true, quantizeEvery: 2 }
const free: EditOptions = { assist: false, quantizeEvery: 1 }

const loop = (id: number, instrument: Instrument, pos: number[], extra: Partial<FreeLoop> = {}): FreeLoop => ({
  id,
  instrument,
  bars: 1,
  phaseBar: 0,
  hits: pos.map((p) => ({ pos: p, strength: 0.5 })),
  muted: false,
  bornAt: 3,
  fromTemplate: true,
  ...extra,
})
const state = (...loops: FreeLoop[]): LoopsState => ({ loops, nextId: Math.max(0, ...loops.map((l) => l.id)) + 1 })
const posOf = (s: LoopsState, id: number) => s.loops.find((l) => l.id === id)?.hits.map((h) => h.pos)

describe('snapStep (imán = ayuda)', () => {
  it('con ayuda va al paso de la rejilla del estilo', () => {
    expect(snapStep(3.4, help)).toBe(3)
    expect(snapStep(3.6, help)).toBe(4)
    expect(snapStep(3.4, dnb)).toBe(4)
    expect(snapStep(2.9, dnb)).toBe(2)
  })
  it('da la vuelta al compás', () => {
    expect(snapStep(15.8, help)).toBe(0)
    expect(snapStep(-0.2, help)).toBe(0)
    expect(snapStep(17, help)).toBe(1)
  })
  it('sin ayuda se queda donde lo sueltas (dos decimales)', () => {
    expect(snapStep(3.456, free)).toBe(3.46)
  })
})

describe('moveHit', () => {
  it('cambia de paso dentro del mismo loop, sin nacimiento', () => {
    const s = state(loop(1, 'bd', [0, 8]))
    const r = moveHit(s, 1, 8, 'bd', 5.2, 0, help)!
    expect(posOf(r.state, 1)).toEqual([0, 5])
    expect(r.hit).toEqual({ loopId: 1, pos: 5 })
    const l = r.state.loops[0]!
    expect(l.bornAt).toBe(3)
    expect(l.fromTemplate).toBe(false)
  })
  it('soltado sobre otro golpe del mismo loop, quedan fundidos en uno', () => {
    const s = state(loop(1, 'bd', [0, 8]))
    expect(posOf(moveHit(s, 1, 8, 'bd', 0.3, 0, help)!.state, 1)).toEqual([0])
  })
  it('en un loop de varios compases edita el compás que se ve', () => {
    const s = state(loop(1, 'hh', [0, 16, 32, 48], { bars: 4, phaseBar: 0 }))
    // compás global 6 → compás 2 del loop
    const r = moveHit(s, 1, 32, 'hh', 4, 6, help)!
    expect(posOf(r.state, 1)).toEqual([0, 16, 36, 48])
  })
  it('a otra franja de batería: pasa a ese loop', () => {
    const s = state(loop(1, 'bd', [0, 8]), loop(2, 'sd', [4]))
    const r = moveHit(s, 1, 8, 'sd', 12, 0, help)!
    expect(posOf(r.state, 1)).toEqual([0])
    expect(posOf(r.state, 2)).toEqual([4, 12])
    expect(r.hit).toEqual({ loopId: 2, pos: 12 })
  })
  it('a otra franja sin loop: lo crea; si el origen queda vacío, se borra', () => {
    const s = state(loop(1, 'bd', [8]))
    const r = moveHit(s, 1, 8, 'hh', 2, 0, help)!
    expect(r.state.loops.map((l) => [l.instrument, l.hits.map((h) => h.pos)])).toEqual([['hh', [2]]])
    expect(r.hit.loopId).toBe(2)
    expect(r.state.loops[0]!.bornAt).toBe(0)
  })
  it('golpe que no existe: null', () => {
    expect(moveHit(state(loop(1, 'bd', [0])), 1, 3, 'bd', 4, 0, help)).toBeNull()
  })
})

describe('addHit', () => {
  it('añade al loop del instrumento, imantado', () => {
    const r = addHit(state(loop(1, 'sd', [4])), 'sd', 11.7, 0, help)!
    expect(posOf(r.state, 1)).toEqual([4, 12])
  })
  it('no duplica un paso ocupado', () => {
    expect(addHit(state(loop(1, 'sd', [4])), 'sd', 4.2, 0, help)).toBeNull()
  })
  it('sin loop del instrumento crea uno de un compás que suena ya', () => {
    const r = addHit(emptyLoops(), 'hh', 6, 0, help)!
    expect(r.state.loops).toHaveLength(1)
    expect(r.state.loops[0]).toMatchObject({ instrument: 'hh', bars: 1, bornAt: 0, muted: false, hits: [{ pos: 6 }] })
    expect(r.state.nextId).toBe(2)
  })
  it('con 8 loops no crea otro', () => {
    const full = state(...Array.from({ length: MAX_LOOPS }, (_, i) => loop(i + 1, 'bd', [0])))
    expect(addHit(full, 'hh', 2, 0, help)).toBeNull()
  })
})

describe('removeHit', () => {
  it('quita el golpe y, si era el último, el loop', () => {
    const s = state(loop(1, 'bd', [0, 8]))
    const once = removeHit(s, 1, 8)
    expect(posOf(once, 1)).toEqual([0])
    expect(removeHit(once, 1, 0).loops).toHaveLength(0)
  })
})

import { describe, expect, it } from 'vitest'
import type { FreeLoop, LoopsState } from '../../app/lib/freeLoops'
import { HISTORY_MAX, LoopHistory, loopsSignature } from '../../app/lib/loopHistory'

const loop = (id: number, instrument: FreeLoop['instrument'], pos: number[], bornAt = 0): FreeLoop => ({ id, instrument, bars: 1, phaseBar: 0, hits: pos.map((p) => ({ pos: p, strength: 0.8 })) as FreeLoop['hits'], muted: false, bornAt, fromTemplate: false })
const st = (...l: FreeLoop[]): LoopsState => ({ loops: l, nextId: l.length + 1 })

describe('deshacer de la portada (spec 016)', () => {
  it('registra cambios, vuelve atrás y adelante, y rehacer se pierde al hacer algo nuevo', () => {
    const h = new LoopHistory()
    const a = st()
    const b = st(loop(1, 'bd', [0, 8]))
    const c = st(loop(1, 'bd', [0, 8]), loop(2, 'sd', [4, 12]))
    h.record(a); h.record(b); h.record(c)
    expect(h.canUndo).toBe(true)
    expect(h.undo()).toBe(b)
    expect(h.canRedo).toBe(true)
    expect(h.undo()).toBe(a)
    expect(h.undo()).toBeNull()
    expect(h.redo()).toBe(b)
    h.record(st(loop(1, 'bd', [0, 8]), loop(3, 'hh', [2]))) // algo nuevo: lo rehecho se borra
    expect(h.canRedo).toBe(false)
  })
  it('reescribir el compás de nacimiento no cuenta como cambio', () => {
    const h = new LoopHistory()
    h.record(st(loop(1, 'bd', [0], 0)))
    h.record(st(loop(1, 'bd', [0], 7)))
    h.record(st(loop(1, 'bd', [0], 9)))
    expect(h.canUndo).toBe(false)
    expect(loopsSignature(st(loop(1, 'bd', [0], 0)))).toBe(loopsSignature(st(loop(1, 'bd', [0], 99))))
  })
  it('una frase entera de la voz (varios loops a la vez) se deshace de una vez; la historia tiene tope', () => {
    const h = new LoopHistory()
    h.record(st())
    h.record(st(loop(1, 'bd', [0]), loop(2, 'sd', [4]), loop(3, 'hh', [2, 6])))
    expect(h.undo()?.loops).toHaveLength(0)
    const g = new LoopHistory()
    g.record(st())
    for (let i = 1; i <= HISTORY_MAX + 10; i++) g.record(st(loop(1, 'bd', Array.from({ length: i }, (_, k) => k))))
    let n = 0
    while (g.undo()) n++
    expect(n).toBe(HISTORY_MAX)
  })
})

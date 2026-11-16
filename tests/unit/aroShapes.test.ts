import { describe, expect, it } from 'vitest'
import { shapeSteps, type ShapeDot } from '../../app/lib/aro/shapes'

const d = (voice: ShapeDot['voice'], step: number, o: Partial<ShapeDot> = {}): ShapeDot => ({ voice, step, muted: false, loopId: 1, ...o })

describe('la forma de tu ritmo (spec 016 §15)', () => {
  it('una figura por instrumento, con los pasos ordenados y sin repetir', () => {
    const s = shapeSteps([d('bd', 8), d('bd', 0), d('bd', 4), d('bd', 4), d('sd', 12), d('sd', 4), d('hh', 2), d('hh', 6), d('hh', 10)])
    expect(s.bd).toEqual([0, 4, 8])
    expect(s.sd).toEqual([4, 12])
    expect(s.hh).toEqual([2, 6, 10])
  })
  it('hacen falta 2 golpes; los silenciados, el bajo y la melodía no dibujan figura', () => {
    const s = shapeSteps([d('bd', 0), d('sd', 4), d('sd', 12, { muted: true }), d('bass', 0), d('bass', 8, { loopId: -1 }), d('mel', 0), d('mel', 4)])
    expect(s).toEqual({})
  })
  it('varios loops del mismo instrumento forman una sola figura', () => {
    expect(shapeSteps([d('hh', 0, { loopId: 1 }), d('hh', 8, { loopId: 2 })]).hh).toEqual([0, 8])
  })
})

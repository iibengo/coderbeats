import { describe, expect, it } from 'vitest'
import { absStep, hasDrums, hasMelody, isMyLayers, melodyFrom, recordNote } from '~/lib/myLayers'

describe('mis capas', () => {
  it('cuantiza el instante a la semicorchea más cercana', () => {
    expect(absStep(3, 0.5)).toBe(56)
    expect(absStep(0, 0.03)).toBe(0)
  })
  it('se queda con los últimos 4 compases', () => {
    let b = recordNote([], 0, 60)
    b = recordNote(b, 70, 62)
    expect(b.map((n) => n.abs)).toEqual([70])
    b = recordNote(b, 80, 64)
    expect(b.length).toBe(2)
  })
  it('una misma semicorchea: gana la última', () => {
    let b = recordNote([], 10, 60)
    b = recordNote(b, 10, 65)
    expect(b).toEqual([{ abs: 10, midi: 65 }])
  })
  it('la melodía lleva posiciones del loop y duraciones hasta la siguiente (con vuelta y tope 8)', () => {
    const m = melodyFrom([{ abs: 64 + 4, midi: 60 }, { abs: 64 + 6, midi: 62 }, { abs: 64 + 40, midi: 64 }])
    expect(m.map((h) => [h.pos, h.midi, h.dur])).toEqual([[4, 60, 2], [6, 62, 8], [40, 64, 8]])
  })
  it('una sola nota dura el tope', () => {
    expect(melodyFrom([{ abs: 3, midi: 60 }])[0]!.dur).toBe(8)
  })
  it('valida el guardado y rechaza basura', () => {
    expect(isMyLayers({ drums: null, melody: null })).toBe(true)
    expect(isMyLayers({ drums: { bd: [{ pos: 0, strength: 1 }], sd: [], hh: [] }, melody: [{ pos: 0, strength: 1, midi: 60 }] })).toBe(true)
    expect(isMyLayers({ drums: { bd: 3 }, melody: null })).toBe(false)
    expect(isMyLayers({ drums: null, melody: [{ pos: 0, strength: 1 }] })).toBe(false)
    expect(isMyLayers(null)).toBe(false)
  })
  it('hay batería con algún golpe, melodía con dos notas', () => {
    expect(hasDrums({ drums: { bd: [], sd: [], hh: [] }, melody: null })).toBe(false)
    expect(hasDrums({ drums: { bd: [{ pos: 0, strength: 1 }], sd: [], hh: [] }, melody: null })).toBe(true)
    expect(hasMelody({ drums: null, melody: [{ pos: 0, strength: 1, midi: 60 }] })).toBe(false)
  })
})

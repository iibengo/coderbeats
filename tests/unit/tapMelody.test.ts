import { describe, expect, it } from 'vitest'
import { SOFT_AHEAD, softQuantize, TAKE_GAP, TapTake } from '../../app/lib/tapMelody'
import { keysToHits } from '../../app/lib/waterKeys'

describe('melodía por toques (spec 016 §16)', () => {
  it('cuantizado suave: cae en el paso si está a ≤ 70 ms por delante; si no, suena ya; nunca se adelanta', () => {
    const origin = 10
    const step = 0.2
    expect(softQuantize(10.35, origin, step)).toBeCloseTo(10.4) // 50 ms por delante: cae en el paso
    expect(softQuantize(10.3, origin, step)).toBeCloseTo(10.3)
    expect(softQuantize(10.4, origin, step)).toBeCloseTo(10.4) // justo en el paso
    for (let t = 10; t < 12; t += 0.0137) {
      const q = softQuantize(t, origin, step)
      expect(q).toBeGreaterThanOrEqual(t - 1e-9)
      expect(q - t).toBeLessThanOrEqual(SOFT_AHEAD + 1e-9)
    }
    expect(softQuantize(5, NaN, step)).toBe(5)
    expect(softQuantize(5, 0, 0)).toBe(5)
  })
  it('una toma: los toques seguidos se suman; tras una pausa larga empieza otra', () => {
    const t = new TapTake()
    t.add({ time: 1, midi: 60 })
    t.add({ time: 2, midi: 62 })
    expect(t.count).toBe(2)
    expect(t.add({ time: 2 + TAKE_GAP + 0.1, midi: 64 })).toHaveLength(1)
    t.reset()
    expect(t.count).toBe(0)
  })
  it('lo grabado: cada nota en el paso más cercano a tu toque, una por paso, 4 compases', () => {
    const step = 0.2
    const hits = keysToHits([{ time: 0.02, midi: 60 }, { time: 0.41, midi: 62 }, { time: 1.02, midi: 64 }], 0, step, 4)
    expect(hits.map((h) => [h.pos, h.midi])).toEqual([[0, 60], [2, 62], [5, 64]])
  })
})

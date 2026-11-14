import { describe, expect, it } from 'vitest'
import { allLanesFilled, REWARD_FADE, rewardFrame, type RewardLoop } from '../../app/lib/reward'

const loop = (instrument: string, hits = 1, muted = false): RewardLoop => ({ instrument, hits: Array(hits).fill({}), muted })

describe('la recompensa: todos los carriles con algo (spec 011, §12.3)', () => {
  it('bombo, caja y platillo con golpes; sin melodía activada, basta con la batería', () => {
    expect(allLanesFilled([loop('bd'), loop('sd'), loop('hh')], false)).toBe(true)
    expect(allLanesFilled([loop('bd'), loop('sd')], false)).toBe(false)
    expect(allLanesFilled([], false)).toBe(false)
  })
  it('con la melodía activada, también hace falta una melodía; sin activarla, no cuenta', () => {
    const drums = [loop('bd'), loop('sd'), loop('hh')]
    expect(allLanesFilled(drums, true)).toBe(false)
    expect(allLanesFilled([...drums, loop('mel')], true)).toBe(true)
    expect(allLanesFilled([...drums, loop('mel')], false)).toBe(true)
  })
  it('un loop vacío o silenciado no cuenta', () => {
    expect(allLanesFilled([loop('bd'), loop('sd'), loop('hh', 0)], false)).toBe(false)
    expect(allLanesFilled([loop('bd'), loop('sd'), loop('hh', 3, true)], false)).toBe(false)
  })
  it('la forma del destello: la luz barre el disco en una vuelta y se apaga deprisa; fuera de eso, nada', () => {
    expect(rewardFrame(-0.1)).toBeNull()
    expect(rewardFrame(0)).toEqual({ sweep: 0, glow: 0.35 })
    expect(rewardFrame(0.5)).toEqual({ sweep: 0.5, glow: 0.675 })
    expect(rewardFrame(1)).toEqual({ sweep: 1, glow: 1 })
    const fade = rewardFrame(1 + REWARD_FADE / 2)!
    expect(fade.sweep).toBe(1)
    expect(fade.glow).toBeCloseTo(0.5, 5)
    expect(rewardFrame(1 + REWARD_FADE + 0.01)).toBeNull()
    expect(rewardFrame(Number.NaN)).toBeNull()
  })
  it('el brillo nunca se sale de 0..1', () => {
    for (let p = 0; p <= 1.3; p += 0.05) {
      const f = rewardFrame(p)
      if (f) {
        expect(f.glow).toBeGreaterThanOrEqual(0)
        expect(f.glow).toBeLessThanOrEqual(1)
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { songCode, type SongState } from '../../app/lib/song'

let id = 0
const D = (instrument: 'bd' | 'sd' | 'hh'): FreeLoop => ({ id: ++id, instrument, bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 0.9 }], muted: false, bornAt: 0, fromTemplate: false })
const mel = (strengths: number[]): FreeLoop => ({ id: ++id, instrument: 'mel', bars: 1, phaseBar: 0, hits: strengths.map((s, i) => ({ pos: i * 4, strength: s, midi: 60 + i, dur: 4 })) as never, muted: false, bornAt: 0, fromTemplate: false })
const state = (loops: FreeLoop[]): SongState => ({ loops, style: 'techno2', kit: 'electro', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } })

describe('la dinámica por nota y el reparto del volumen (corrección)', () => {
  it('con varios loops (ganancia < 1), TODAS las notas del patrón se multiplican igual, también la primera del compás (antes se saltaba la que sigue a un «[»)', () => {
    const m = mel([0.9, 0.5, 0.5, 0.5])
    const code = songCode(state([D('bd'), D('sd'), D('hh'), m]), 'display')
    const pat = /\.gain\("([^"]*)"\)/.exec(code.split('\n').find((l) => l.includes('note('))!)![1]!
    const nums = [...pat.matchAll(/(\d+(?:\.\d+)?)@/g)].map((x) => Number(x[1]))
    expect(nums.length).toBe(4)
    // el cociente entre la primera y la segunda es el de sus pesos (0,955 y 0,775), sea cual sea el reparto
    expect(nums[0]! / nums[1]!).toBeCloseTo((0.55 + 0.45 * 0.9) / (0.55 + 0.45 * 0.5), 1)
    expect(nums[0]!).toBeLessThan(0.6) // y todas ya bajadas por el reparto (con 4 loops, 1/√4 · ≈ 0,955 · −3 dB ≈ 0,34)
  })
  it('con un solo loop solo se aplica el balance de la melodía (−3 dB ≈ 0,708) a todas las notas por igual', () => {
    const code = songCode(state([mel([0.9, 0.5, 0.5, 0.5])]), 'display')
    expect(code).toContain('0.68@4 0.55@4 0.55@4 0.55@4')
  })
})

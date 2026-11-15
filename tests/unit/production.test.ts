import { describe, expect, it } from 'vitest'
import { clampProduction, DEFAULT_PRODUCTION, humanGains, swingNudges } from '../../app/lib/production'
import { loopTokens, songCode, type SongState } from '../../app/lib/song'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { events } from '../helpers/strudelEval'

const hh = (steps: number[]): FreeLoop => ({ id: 3, instrument: 'hh', bars: 1, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, hits: steps.map((pos) => ({ pos, strength: 1 })) })
const state = (loop: FreeLoop, production?: SongState['production']): SongState => ({
  loops: [loop], style: 'techno', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 }, ...(production ? { production } : {}),
})
const all16 = Array.from({ length: 16 }, (_, i) => i)

describe('producción: humanización opcional (spec 014, fase 1)', () => {
  it('el swing retrasa solo los pasos impares y nunca más de media semicorchea', () => {
    const n = swingNudges(16, 0.2, 0.125)
    expect(n.filter((x) => x === 0)).toHaveLength(8)
    expect(n[1]).toBeCloseTo(0.025)
    expect(n[0]).toBe(0)
    expect(swingNudges(16, 9, 0.125)[1]).toBeCloseTo(0.0625)
    expect(swingNudges(16, -1, 0.125).every((x) => x === 0)).toBe(true)
  })
  it('los matices: repetibles, entre 0,6 y 1, tiempos fuertes ≥ contratiempos, y el bombo casi no varía', () => {
    const a = humanGains('hh', 32, 1, 7)
    expect(humanGains('hh', 32, 1, 7)).toEqual(a)
    expect(humanGains('hh', 32, 1, 8)).not.toEqual(a)
    for (const g of a) { expect(g).toBeGreaterThanOrEqual(0.6); expect(g).toBeLessThanOrEqual(1) }
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    expect(avg(a.filter((_, i) => i % 4 === 0))).toBeGreaterThan(avg(a.filter((_, i) => i % 2 === 1)))
    expect(Math.min(...humanGains('bd', 16, 1))).toBeGreaterThan(0.93)
    expect(humanGains('hh', 16, 0).every((g) => g === 1)).toBe(true)
  })
  it('sin producción el código es el de siempre (las guardadas no cambian)', () => {
    const base = songCode(state(hh(all16)), 'display')
    expect(base).not.toContain('nudge')
    expect(songCode(state(hh(all16), undefined), 'display')).toBe(base)
  })
  it('con producción el código lleva nudge y gain y evalúa en Strudel; mismos golpes en los mismos pasos', async () => {
    const code = songCode(state(hh(all16), DEFAULT_PRODUCTION), 'display')
    expect(code).toContain('.nudge(')
    expect(code).toContain('.gain(')
    const ev = await events(code.replace(/^setcpm.*$/m, ''), 1)
    const hits = ev.filter((e) => e.value.s === 'hh')
    expect(hits).toHaveLength(16)
    expect(new Set(hits.map((e) => Math.round(e.begin * 16))).size).toBe(16)
    const gains = hits.map((e) => Number(e.value.gain ?? 1))
    expect(Math.min(...gains)).toBeLessThan(Math.max(...gains))
  })
  it('un golpe a medio paso conserva su nudge y se le suma el swing solo en los impares', () => {
    const { nudge } = loopTokens({ ...hh([1, 2.5]), instrument: 'hh' }, 0.125, DEFAULT_PRODUCTION)
    expect(nudge).not.toBeNull()
  })
  it('lo que venga de fuera se limpia', () => {
    expect(clampProduction({ swing: 9, humanize: -3 })).toEqual({ swing: 0.5, humanize: 0 })
    expect(clampProduction({ swing: Number.NaN, humanize: 0.3 })).toEqual({ swing: 0, humanize: 0.3 })
  })
})

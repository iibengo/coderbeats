import { describe, expect, it } from 'vitest'
import { melodyGains, melodyMini } from '../../app/lib/melody'
import { songCode, type SongState } from '../../app/lib/song'
import type { FreeLoop } from '../../app/lib/freeLoops'

const h = (pos: number, dur: number, midi: number, strength = 1) => ({ pos, dur, midi, strength })
const mel = (hits: ReturnType<typeof h>[]): FreeLoop => ({
  id: 1, instrument: 'mel', bars: 1, phaseBar: 0, hits, muted: false, bornAt: 0, fromTemplate: false, synth: 'lead',
})
const state = (loops: FreeLoop[]): SongState => ({
  loops,
  style: 'dembow',
  kit: '808',
  background: { mode: 'off', parts: { bass: false, chords: false } },
  metronome: false,
  fx: { filter: 1, space: 0, warmth: 0 },
})

describe('dinámica por nota (spec 029 §2)', () => {
  it('todas a 1 (lo de siempre): no hay patrón y el código no cambia', () => {
    const hits = [h(0, 4, 60), h(4, 4, 62, 0.8)]
    expect(melodyGains(hits.map((x) => ({ ...x, strength: 1 })), 1, 0)).toBeNull()
    expect(songCode(state([mel(hits.map((x) => ({ ...x, strength: 1 })))]))).toContain('note("c4@4 d4@4 ~@8").s("square")')
    expect(songCode(state([mel(hits.map((x) => ({ ...x, strength: 1 })))]))).not.toContain('.gain("')
  })

  it('con fuerzas distintas: patrón con la misma estructura que las notas', () => {
    const hits = [h(0, 4, 60, 1), h(4, 4, 62, 0.5)]
    const mini = melodyMini(hits, 1, 0)
    const gains = melodyGains(hits, 1, 0)!
    expect(mini).toBe('c4@4 d4@4 ~@8')
    // misma estructura: los mismos pesos (@) en el mismo orden
    expect(gains.split(' ').map((x) => x.split('@')[1])).toEqual(mini.split(' ').map((x) => x.split('@')[1]))
    // 1 → 1, 0,5 → 0.775
    expect(gains).toBe('1@4 0.775@4 ~@8')
  })

  it('un acorde comparte el peso (Strudel aplica el gain a todo el hap)', () => {
    const hits = [h(0, 8, 60, 0.8), h(0, 8, 64, 0.8), h(8, 8, 67, 1)]
    expect(melodyGains(hits, 1, 0)).toBe('0.91@8 1@8')
  })

  it('nunca llega a 0: una fuerza 0 sigue sonando, suave', () => {
    expect(melodyGains([h(0, 4, 60, 0)], 1, 0)).toBe('0.55@4 ~@12')
  })

  it('la línea de la melodía lleva el gain por nota', () => {
    const code = songCode(state([mel([h(0, 4, 60, 1), h(4, 4, 62, 0.5)])]))
    expect(code).toMatch(/\.gain\("0\.7\d*@4 0\.5\d*@4 ~@8"\)/)
  })
})

describe('tresillo de negra (spec 029 §1)', () => {
  it('tres notas repartidas en el compás, en doceavos', () => {
    const hits = [h(0, 16 / 3, 60), h(16 / 3, 16 / 3, 62), h(32 / 3, 16 / 3, 64)]
    expect(melodyMini(hits, 1, 0)).toBe('c4@64 d4@64 e4@64')
    expect(songCode(state([mel(hits)]))).toContain('note("c4@64 d4@64 e4@64")')
  })
  it('dos tresillos de negra seguidos en un compás', () => {
    const t = (o: number) => [h(o, 8 / 3, 60), h(o + 8 / 3, 8 / 3, 62), h(o + 16 / 3, 8 / 3, 64)]
    const hits = [...t(0), ...t(8)]
    const m = melodyMini(hits, 1, 0)
    // suma exactamente los 192 doceavos del compás
    const total = [...m.matchAll(/@(\d+)/g)].reduce((n, x) => n + Number(x[1]), 0)
    expect(total).toBe(192)
  })
})

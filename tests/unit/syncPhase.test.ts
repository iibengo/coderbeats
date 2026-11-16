import { describe, expect, it } from 'vitest'
import { songCode } from '../../app/lib/song'
import { phaseBarOf } from '../../app/lib/spiral'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { events } from '../helpers/strudelEval'

const mel = (phaseBar: number): FreeLoop => ({ id: 1, instrument: 'mel', bars: 4, phaseBar, hits: [{ pos: 0, dur: 2, midi: 72, strength: 0.8 }, { pos: 16, dur: 2, midi: 74, strength: 0.8 }], muted: false, bornAt: 0, fromTemplate: false })
const code = (loop: FreeLoop) =>
  songCode({ loops: [loop], style: 'hiphop90', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } }, 'display')

describe('la melodía grabada con sincronía suena donde se tocó (spec 016 §9.3)', () => {
  it('con la fase del compás de salida, la primera nota suena en los compases ≡ salida (mod 4) y la segunda un compás después', async () => {
    for (const startBar of [0, 1, 2, 3, 5, 10, 13]) {
      const phase = phaseBarOf(startBar)
      const ev = await events(code(mel(phase)), 12)
      const starts = ev.map((e) => e.begin).filter((b) => Math.abs(b - Math.round(b)) < 1e-6).map(Math.round)
      expect(starts.length, `salida ${startBar}`).toBeGreaterThan(0)
      // todo suena en compases ≡ phase (primera nota) o ≡ phase+1 (segunda), nunca en otro
      for (const b of starts) expect([0, 1].includes((((b - phase) % 4) + 4) % 4), `salida ${startBar}: compás ${b}`).toBe(true)
      // y la de la posición 0 cae justo en cada compás ≡ phase
      expect(starts.some((b) => (((b - phase) % 4) + 4) % 4 === 0)).toBe(true)
    }
  })
})

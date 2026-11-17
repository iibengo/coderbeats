import { describe, expect, it } from 'vitest'
import { isFreeLoop } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

const loop = (bars: FreeLoop['bars'], hits: { pos: number; dur: number; midi: number }[]): FreeLoop => ({ id: 1, instrument: 'mel', bars, phaseBar: 0, hits: hits.map((h) => ({ ...h, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false, synth: 'lead' })
const state = (loops: FreeLoop[]): SongState => ({ loops, style: 'techno2', kit: 'electro', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0.5 } })

describe('loops de 8 y 16 compases (spec 028 §2)', () => {
  it('la validación de lo guardado acepta 8 y 16 y sigue rechazando lo demás', () => {
    for (const b of [1, 2, 4, 8, 16]) expect(isFreeLoop(loop(b as FreeLoop['bars'], [{ pos: 0, dur: 2, midi: 60 }]))).toBe(true)
    for (const b of [3, 5, 32, 0, -1, '8', null]) expect(isFreeLoop({ ...loop(4, [{ pos: 0, dur: 2, midi: 60 }]), bars: b })).toBe(false)
  })
  it('un loop de 8 compases suena su compás 0 en los ciclos 0 y 8, el 4 en el 4 y el 12, el 7 en el 7 y el 15', async () => {
    const l = loop(8, [{ pos: 0, dur: 4, midi: 60 }, { pos: 4 * 16 + 2, dur: 4, midi: 64 }, { pos: 7 * 16 + 8, dur: 4, midi: 67 }])
    const ev = (await events(songCode(state([l]), 'display'), 16)).filter((e) => e.value.s === 'square')
    const at = (midi: string) => ev.filter((e) => e.value.note === midi).map((e) => Math.floor(e.begin))
    expect(at('c4')).toEqual([0, 8])
    expect(at('e4')).toEqual([4, 12])
    expect(at('g4')).toEqual([7, 15])
  })
  it('un loop de 16 compases da una vuelta cada 16 ciclos', async () => {
    const l = loop(16, [{ pos: 15 * 16, dur: 8, midi: 62 }])
    const ev = (await events(songCode(state([l]), 'display'), 32)).filter((e) => e.value.s === 'square')
    expect(ev.map((e) => Math.floor(e.begin))).toEqual([15, 31])
  })
  it('lo de 1, 2 y 4 compases genera lo mismo que antes', async () => {
    const l = loop(4, [{ pos: 0, dur: 4, midi: 60 }, { pos: 3 * 16, dur: 4, midi: 62 }])
    const code = songCode(state([l]), 'display')
    expect(code).toContain('note("<[c4@4 ~@12] [~@16] [~@16] [d4@4 ~@12]>")')
  })
})

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

describe('ligaduras en Strudel (spec 028 §2)', () => {
  it('la nota que cruza el compás lleva el clip y suena en su ciclo; la de siempre no lleva clip', async () => {
    const l = loop(2, [{ pos: 14, dur: 6, midi: 60 }])
    const code = songCode(state([l]), 'display')
    expect(code).toContain('.clip("<[~@14 3@2] [~@16]>")')
    const ev = (await events(code, 4)).filter((e) => e.value.s === 'square')
    expect(ev.map((e) => [Math.floor(e.begin), e.value.clip])).toEqual([[0, 3], [2, 3]])
    expect(songCode(state([loop(2, [{ pos: 0, dur: 4, midi: 60 }])]), 'display')).not.toContain('.clip(')
  })
})

describe('bajo y acordes propios en Strudel (spec 028 §5)', () => {
  it('«keys» toca un acorde de tres notas a la vez y «bass» una nota grave; cada uno con su sonido', async () => {
    const mk = (id: number, synth: FreeLoop['synth'], hits: { pos: number; dur: number; midi: number }[]): FreeLoop => ({ ...loop(1, hits), id, synth })
    const keys = mk(1, 'keys', [{ pos: 0, dur: 8, midi: 55 }, { pos: 0, dur: 8, midi: 58 }, { pos: 0, dur: 8, midi: 62 }])
    const bass = mk(2, 'bass', [{ pos: 0, dur: 4, midi: 31 }])
    const code = songCode(state([keys, bass]), 'display')
    expect(code).toContain('note("[g3,bb3,d4]@8 ~@8")')
    const ev = await events(code, 1)
    expect(ev.filter((e) => e.value.s === 'triangle').map((e) => e.value.note).sort()).toEqual(['bb3', 'd4', 'g3'])
    expect(ev.filter((e) => e.value.s === 'sawtooth').map((e) => e.value.note)).toEqual(['g1'])
  })
})

import { STYLES } from '../../app/lib/constants'
describe('el tempo elegido es el que suena (todos los estilos)', () => {
  const barSecOfCode = (code: string): number => {
    const m = /^setcpm\(([\d.]+)\/4\)/m.exec(code)
    expect(m).not.toBeNull()
    return 240 / Number(m![1]) // un compás (un ciclo) = 4 tiempos a N bpm
  }
  for (const id of Object.keys(STYLES) as (keyof typeof STYLES)[]) {
    it(`${id}: sin tempo propio, el del estilo (${STYLES[id].bpm} bpm); con tempo propio, el de la canción`, () => {
      const base = { ...state([loop(1, [{ pos: 0, dur: 4, midi: 60 }])]), style: id }
      expect(barSecOfCode(songCode(base, 'display'))).toBeCloseTo(240 / STYLES[id].bpm, 6)
      expect(barSecOfCode(songCode({ ...base, bpm: 108 }, 'display'))).toBeCloseTo(240 / 108, 6)
      expect(barSecOfCode(songCode({ ...base, bpm: 108 }, 'engine'))).toBeCloseTo(240 / 108, 6)
      expect(barSecOfCode(songCode({ ...base, bpm: null }, 'display'))).toBeCloseTo(240 / STYLES[id].bpm, 6)
    })
  }
})

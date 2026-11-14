import { describe, expect, it } from 'vitest'
import { emptySong, isFreeLoop, isSong, type Song } from '../../app/lib/cells'
import type { FreeLoop, LoopHit } from '../../app/lib/freeLoops'
import { loopGains } from '../../app/lib/mix'
import { songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

let id = 0
const drum = (instrument: 'bd' | 'sd' | 'hh', pos: number[], o: Partial<FreeLoop> = {}): FreeLoop => ({
  id: ++id, instrument, bars: 1, phaseBar: 0, hits: pos.map((p) => ({ pos: p, strength: 0.5 })), muted: false, bornAt: 0, fromTemplate: false, ...o,
})
const mel = (hits: [number, number, number][], o: Partial<FreeLoop> = {}): FreeLoop => ({
  id: ++id, instrument: 'mel', bars: 1, phaseBar: 0, hits: hits.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.5 })), muted: false, bornAt: 0, fromTemplate: false, ...o,
})
const state = (loops: FreeLoop[], o: Partial<SongState> = {}): SongState => ({
  loops, style: 'hiphop90', kit: '909', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 }, ...o,
})

describe('línea de la melodía en el código', () => {
  const m = mel([[0, 4, 57], [4, 2, 60], [8, 4, 64]])

  it('note() con duraciones y silencios, el sinte del estilo y el orbit 5', () => {
    const code = songCode(state([m]))
    expect(code).toContain('note("a3@4 c4@2 ~@2 e4@4 ~@4").s("triangle").fm(1.5).fmh(2).decay(0.6).sustain(0.2).room(0.4).orbit(5)')
  })

  it('cada estilo tiene su sinte por defecto y se puede cambiar', () => {
    expect(songCode(state([m], { style: 'house' }))).toContain('.s("square").lpf(1800)')
    expect(songCode(state([m], { style: 'dnb' }))).toContain('.s("supersaw").attack(0.08)')
    expect(songCode(state([m], { style: 'dnb', melodySynth: 'lead' }))).toContain('.s("square")')
  })

  it('el sidechain del bombo incluye el orbit 5 solo si hay melodía en el bloque', () => {
    expect(songCode(state([drum('bd', [0]), m], { background: { mode: 'manual', parts: { bass: true, chords: false } } }))).toContain('.duckorbit("2:3:5")')
    expect(songCode(state([drum('bd', [0])], { background: { mode: 'manual', parts: { bass: true, chords: false } } }))).toContain('.duckorbit("2:3")')
    expect(songCode(state([drum('bd', [0])], { background: { mode: 'manual', parts: { bass: true, chords: false } } }))).not.toContain('2:3:5')
  })

  it('en el motor lleva el color del loop y el filtro de nacimiento, y su versión anterior', () => {
    const born = mel([[0, 4, 57]], { id: 77, bornAt: 8, prev: { hits: [{ pos: 0, dur: 2, midi: 55, strength: 1 } as LoopHit], bars: 1, phaseBar: 0 } })
    const code = songCode(state([born]), 'engine')
    expect(code).toContain('note("a3@4 ~@12")')
    expect(code).toContain('.color("l77").filterHaps((h) => h.whole.begin >= 8)')
    expect(code).toContain('note("g3@2 ~@14")')
    expect(code).toContain('.filterHaps((h) => h.whole.begin < 8)')
  })

  it('silenciada, la línea va comentada; la ganancia sale de la mezcla', () => {
    expect(songCode(state([mel([[0, 4, 57]], { muted: true })]))).toMatch(/\/\/ note\("a3@4 ~@12"\)/)
    const a = mel([[0, 4, 57]])
    const g = loopGains([drum('bd', [0]), a]).get(a.id)!
    expect(g).toBeLessThan(0.7)
    expect(songCode(state([drum('bd', [0]), a]))).toMatch(/\.orbit\(5\)\.gain\(0\.5\)/)
  })

  it('con loops de varias células (arrange) y fase', () => {
    const song = emptySong()
    const cell = { ...song.cells[0]!, turns: 2 as const, loops: [mel([[0, 4, 57], [16, 4, 60]], { bars: 2, phaseBar: 1 })] }
    const st = state([], { cells: { list: [cell, { ...cell, id: 2 }], order: [1, 2], window: [] } })
    const code = songCode(st, 'display')
    expect(code).toContain('note("<[c4@4 ~@12] [a3@4 ~@12]>")')
    expect(code.startsWith('setcpm(90/4)\n')).toBe(true)
  })
})

describe('validación estricta de los loops de melodía', () => {
  const ok = mel([[0, 4, 57]])
  const J = (l: FreeLoop) => JSON.parse(JSON.stringify(l))

  it('un loop de melodía válido pasa; y una canción con él', () => {
    expect(isFreeLoop(J(ok))).toBe(true)
    const s = emptySong()
    expect(isSong({ ...s, cells: [{ ...s.cells[0]!, loops: [J(ok)] }] })).toBe(true)
  })

  it('midi y dur: enteros en rango y números positivos', () => {
    const bad = (h: object) => expect(isFreeLoop({ ...J(ok), hits: [{ pos: 0, strength: 0.5, ...h }] })).toBe(false)
    bad({ midi: '60', dur: 4 })
    bad({ midi: '60) || evil() //', dur: 4 })
    bad({ midi: 60.5, dur: 4 })
    bad({ midi: 23, dur: 4 })
    bad({ midi: 97, dur: 4 })
    bad({ midi: NaN, dur: 4 })
    bad({ midi: 60, dur: '4' })
    bad({ midi: 60, dur: 0 })
    bad({ midi: 60, dur: -2 })
    bad({ midi: 60, dur: Infinity })
    bad({ dur: 4 })
    bad({ midi: 60 })
  })

  it('la batería no lleva midi ni dur; la melodía no puede ser de otro instrumento raro', () => {
    expect(isFreeLoop({ ...J(drum('bd', [0])), hits: [{ pos: 0, strength: 1, midi: 60 }] })).toBe(false)
    expect(isFreeLoop({ ...J(drum('bd', [0])), hits: [{ pos: 0, strength: 1, dur: 2 }] })).toBe(false)
    expect(isFreeLoop({ ...J(ok), instrument: 'bass' })).toBe(false)
    expect(isFreeLoop({ ...J(ok), instrument: 'mel") .hush("' })).toBe(false)
  })

  it('la versión anterior (prev) también se valida', () => {
    const l = { ...J(ok), prev: { hits: [{ pos: 0, strength: 1, midi: 'x', dur: 2 }], bars: 1, phaseBar: 0 } }
    expect(isFreeLoop(l)).toBe(false)
    expect(isFreeLoop({ ...J(ok), prev: { hits: [{ pos: 0, strength: 1, midi: 55, dur: 2 }], bars: 1, phaseBar: 0 } })).toBe(true)
  })

  it('aunque la validación fallara, el generador no escribe un midi raro ni un peso que no es número', () => {
    const evil = mel([[0, 4, 57]], { hits: [{ pos: 0, strength: 1, midi: '60) || hush() //' as never, dur: 4 }, { pos: 4, strength: 1, midi: 64, dur: '4); evil()' as never }] })
    const code = songCode(state([evil]), 'engine')
    expect(code).not.toMatch(/hush|evil/)
    expect(code).toContain('note("~@16")')
  })

  it('un loop de melodía guardado con un id o bornAt malicioso tampoco entra', () => {
    expect(isFreeLoop({ ...J(ok), id: '1")||x//' })).toBe(false)
    expect(isFreeLoop({ ...J(ok), bornAt: '0)' })).toBe(false)
  })
})

describe('duración real y legato en el código (compatible con strudel.cc)', () => {
  it('las duraciones de cuarto de paso se escriben con pesos enteros y Strudel las toca con su duración exacta', async () => {
    const m = mel([[0, 4, 57], [4, 1.75, 60], [10, 2.25, 64]])
    const code = songCode(state([m]))
    // rejilla fina: pesos en cuartos de paso (16 pasos = 64 partes)
    expect(code).toContain('note("a3@16 c4@7 ~@17 e4@9 ~@15")')
    const ev = (await events(code, 1)).filter((e) => e.value.note !== undefined)
    // en un ciclo de 16 pasos: cada paso = 1/16 de ciclo
    expect(ev.map((e) => [e.value.note, Math.round(e.begin * 16 * 100) / 100, Math.round((e.end - e.begin) * 16 * 100) / 100])).toEqual([
      ['a3', 0, 4],
      ['c4', 4, 1.75],
      ['e4', 10, 2.25],
    ])
  })
})

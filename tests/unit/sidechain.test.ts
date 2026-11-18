import { describe, expect, it } from 'vitest'
import { emptySong, isSong } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

let id = 0
const D = (instrument: 'bd' | 'sd', steps: number[]): FreeLoop => ({ id: ++id, instrument, bars: 1, phaseBar: 0, hits: steps.map((pos) => ({ pos, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false })
const M = (synth?: FreeLoop['synth']): FreeLoop => ({ id: ++id, instrument: 'mel', bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 0.8, midi: 48, dur: 8 } as never], muted: false, bornAt: 0, fromTemplate: false, ...(synth ? { synth } : {}) })
const BASE = [D('bd', [0, 4, 8, 12]), M('bass'), M('keys'), M('lead'), M('riser')]
const st = (extra: Partial<SongState> = {}, mode: 'off' | 'manual' = 'manual'): SongState => ({ loops: BASE, style: 'techno2', kit: 'electro', background: { mode, parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0.5 }, ...extra })
const line = (code: string, re: RegExp) => code.split('\n').find((l) => re.test(l)) ?? ''

describe('sidechain de la canción (spec 041)', () => {
  it('sin el campo, el código es el de siempre: motor con fondo, el bombo empuja 2:3:5; sin fondo y en el código mostrado, nada', () => {
    const eng = songCode(st(), 'engine')
    expect(line(eng, /s\("bd/)).toContain('.duckorbit("2:3:5").duckdepth(0.6).duckattack(0.15)')
    const own = eng.split('\n').filter((x) => /"sawtooth"|"triangle"|"square"/.test(x) && x.includes('.color("l'))
    expect(own.length).toBe(3)
    for (const l of own) expect(l).toContain('.orbit(5)')
    expect(eng).not.toContain('orbit(6)')
    expect(songCode(st({}, 'off'), 'engine')).not.toContain('duckorbit')
    expect(songCode(st(), 'display')).not.toContain('duckorbit')
    // y poner el campo a undefined no cambia nada
    expect(songCode(st({ sidechain: undefined }), 'engine')).toBe(eng)
    expect(songCode(st({ sidechain: undefined }), 'display')).toBe(songCode(st(), 'display'))
  })
  it("con 'si': el bombo empuja el bajo y los acordes (también en el código mostrado) y la melodía no se toca", () => {
    for (const mode of ['display', 'engine'] as const) {
      const code = songCode(st({ sidechain: 'si' }, 'off'), mode)
      expect(line(code, /s\("bd/), mode).toContain('.duckorbit("2:3:6").duckdepth(0.6).duckattack(0.15)')
      const bass = line(code, /note\(.*"sawtooth"/)
      const keys = line(code, /note\(.*"triangle"/)
      expect(bass, mode).toContain('.orbit(6)')
      expect(keys, mode).toContain('.orbit(6)')
      expect(line(code, /"square"/), mode).toContain('.orbit(5)') // la melodía, donde estaba
      expect(line(code, /"pink"/), mode).toContain('.orbit(5)') // los adornos, también
    }
  })
  it("con 'no': nada de sidechain, ni en el motor con fondo", () => {
    expect(songCode(st({ sidechain: 'no' }), 'engine')).not.toContain('duckorbit')
  })
  it('lo que ve el motor de patrones: el bombo lleva el duck a 2:3:6 y el bajo y los acordes están en el orbit 6', async () => {
    const ev = await events(songCode(st({ sidechain: 'si' }, 'off'), 'display'), 1)
    const bd = ev.find((e) => e.value.s === 'bd')
    expect(String(bd?.value.duckorbit).replace(/,/g, ':')).toBe('2:3:6')
    const orbits = new Set(ev.filter((e) => e.value.note !== undefined).map((e) => `${e.value.s}:${e.value.orbit}`))
    expect(orbits.has('sawtooth:6')).toBe(true)
    expect(orbits.has('triangle:6')).toBe(true)
    expect(orbits.has('square:5')).toBe(true)
  })
  it('el campo se valida: si, no o nada', () => {
    expect(isSong({ ...emptySong(), sidechain: 'si' })).toBe(true)
    expect(isSong({ ...emptySong(), sidechain: 'no' })).toBe(true)
    expect(isSong(emptySong())).toBe(true)
    for (const bad of ['sí', 'yes', 1, true, null, {}, [], 'SI']) expect(isSong({ ...emptySong(), sidechain: bad }), JSON.stringify(bad)).toBe(false)
  })
})

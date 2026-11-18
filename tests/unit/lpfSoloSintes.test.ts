import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { emptySong, isSong } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { songCode, type SongState } from '../../app/lib/song'

// ids fijos: el código lleva `color("l<id>")` y el test compara texto exacto
const D = (id: number, instrument: 'bd' | 'sd' | 'hh', steps: number[]): FreeLoop => ({ id, instrument, bars: 1, phaseBar: 0, hits: steps.map((pos) => ({ pos, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false })
const M = (id: number, synth: FreeLoop['synth'], midi: number): FreeLoop => ({ id, instrument: 'mel', bars: 4, phaseBar: 0, hits: [{ pos: 0, strength: 0.8, midi, dur: 16 } as never], muted: false, bornAt: 0, fromTemplate: false, synth })
const LOOPS = [D(1, 'bd', [0, 4, 8, 12]), D(2, 'sd', [4, 12]), D(3, 'hh', [2, 6, 10, 14]), M(4, 'bass', 38), M(5, 'lead', 62), M(6, 'riser', 60)]
const cell = (extra: object = {}) => ({ id: 1, name: 'A', loops: LOOPS, parts: { bass: false, chords: false }, turns: 8 as const, lpf: [400, 800, 1600], ...extra })
const state = (c: ReturnType<typeof cell>, mode: 'manual' | 'off' = 'manual'): SongState =>
  ({ loops: [], style: 'techno2', kit: 'electro', background: { mode, parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 }, cells: { list: [c, { ...c, id: 2 }], order: [1, 2], window: [{ cellId: 1, from: 0, to: 8 }, { cellId: 2, from: 8, to: 16 }] } }) as never

describe('el lpf solo en los sintes (lpfSoloSintes)', () => {
  // referencia: el código de hoy (generado ANTES de añadir el campo, tests/unit/golden/): sin el campo, byte a byte
  for (const mode of ['display', 'engine'] as const)
    it(`sin el campo, el código de una parte con lpf es exactamente el de siempre (${mode})`, () => {
      const f = `tests/unit/golden/lpf-${mode}.txt`
      const code = songCode(state(cell()), mode)
      if (!existsSync(f)) writeFileSync(f, code)
      expect(code).toBe(readFileSync(f, 'utf8'))
    })

  const lines = (code: string) => code.split('\n')
  it("con el campo, el filtro envuelve solo los sintes (bajo, melodía y efectos, que también son sintes) y el bombo, la caja y el charle quedan fuera, sin lpf", () => {
    for (const mode of ['display', 'engine'] as const) {
      const code = songCode(state(cell({ lpfSoloSintes: true })), mode)
      const l = lines(code)
      // la parte A: el filtro por vuelta aparece una vez por parte y justo después de los sintes
      const lpfLines = l.filter((x) => x.includes('.lpf("<'))
      expect(lpfLines.length, mode).toBe(2)
      for (const drum of l.filter((x) => /s\("(bd|~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd|~ ~ hh)/.test(x))) expect(drum, `${mode}: ${drum.slice(0, 50)}`).not.toContain('lpf')
      // los sintes están dentro del stack del filtro: la línea del filtro cierra un stack que contiene el bajo, la melodía y el riser
      const iLpf = l.findIndex((x) => x.includes('.lpf("<'))
      const stackOpen = l.slice(0, iLpf).map((x, i) => [x, i] as const).filter(([x]) => x.trim().startsWith('stack(')).at(-1)![1]
      const inside = l.slice(stackOpen, iLpf).join('\n')
      for (const synth of ['"sawtooth"', '"square"', '"pink"']) expect(inside, `${mode} ${synth}`).toContain(synth)
      expect(inside, mode).not.toMatch(/s\("bd/)
      expect(inside, mode).not.toMatch(/hh/)
    }
  })
  it('sin lpf, el campo no hace nada (el código es el mismo)', () => {
    for (const mode of ['display', 'engine'] as const)
      expect(songCode(state(cell({ lpf: undefined, lpfSoloSintes: true })), mode)).toBe(songCode(state(cell({ lpf: undefined })), mode))
  })
  it('con wowo, el comportamiento es el de siempre (el wowo ya dejaba la batería limpia): el campo no cambia nada', () => {
    const wow = { depth: 2, q: 6, attack: 0.005, decay: 0.15 }
    for (const mode of ['display', 'engine'] as const)
      expect(songCode(state(cell({ wow, lpfSoloSintes: true })), mode)).toBe(songCode(state(cell({ wow })), mode))
  })
  it('el campo se valida: solo true o false', () => {
    const song = (v: unknown) => ({ ...emptySong(), cells: [{ ...emptySong().cells[0]!, lpf: [400], lpfSoloSintes: v }] })
    expect(isSong(song(true))).toBe(true)
    expect(isSong(song(false))).toBe(true)
    expect(isSong(song(undefined))).toBe(true)
    for (const bad of ['si', 1, null, {}, []]) expect(isSong(song(bad)), JSON.stringify(bad)).toBe(false)
  })
  it('el volumen no cambia: cada loop lleva la misma ganancia con el campo que sin él (el reparto se hace sobre toda la parte)', () => {
    const gains = (code: string) => lines(code).flatMap((x) => [...x.matchAll(/\.gain\(([\d.]+)\)/g)].map((m) => m[1]!)).sort()
    for (const mode of ['display', 'engine'] as const) {
      const sin = gains(songCode(state(cell()), mode))
      const con = gains(songCode(state(cell({ lpfSoloSintes: true })), mode))
      expect(con, mode).toEqual(sin)
    }
  })
})

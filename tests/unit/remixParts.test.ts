import { describe, expect, it } from 'vitest'
import { songBars, type Cell, type Song } from '~/lib/cells'
import type { FreeLoop } from '~/lib/freeLoops'
import { LAB_REMIXES } from '~/lib/labRemixes'
import { MAX_LAYERS, MAX_PARTS, layersOfCell, partsFromSong, patternOf, roleOf } from '~/lib/remixParts'
import { REMIXES } from '~/lib/remixes'

let id = 1
const drum = (instrument: 'bd' | 'sd' | 'hh', steps: number[], bars: 1 | 4 = 1): FreeLoop => ({ id: id++, instrument, bars, phaseBar: 0, hits: steps.map((pos) => ({ pos, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false })
const mel = (synth: FreeLoop['synth'], n = 10, bars: 1 | 4 = 4): FreeLoop => ({ id: id++, instrument: 'mel', bars, phaseBar: 0, hits: Array.from({ length: n }, (_, i) => ({ pos: i * 2, dur: 2, midi: 60 + (i % 5), strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false, synth })
const cell = (cid: number, name: string | undefined, loops: FreeLoop[], parts = { bass: false, chords: false }, turns: 1 | 2 | 4 | 8 = 4, extra: Partial<Cell> = {}): Cell => ({ id: cid, ...(name ? { name } : {}), loops, parts, turns, at: { x: 0, y: 0, depth: 0 }, ...extra })
const song = (cells: Cell[], groups: Song['groups'] = []): Song => ({ version: 1, cells, order: cells.filter((c) => !groups.some((g) => g.order.includes(c.id))).map((c) => c.id), groups, nextGroupId: groups.length + 1, bpm: null, nextCellId: 99, nextLoopId: 999 })
const K = [0, 4, 8, 12]
const full = (cid: number, name?: string) => cell(cid, name, [drum('bd', K), drum('sd', [4, 12]), drum('hh', [0, 2, 4, 6]), mel('lead')], { bass: true, chords: true })

describe('de canción a partes', () => {
  it('células seguidas con las mismas capas se juntan en una sola parte (los compases se suman)', () => {
    const s = song([cell(1, 'Intro', [drum('bd', K)]), cell(2, 'Pulso', [drum('bd', K)]), cell(3, 'Pulso 2', [drum('bd', K)]), full(4, 'DROP'), cell(5, 'Salida', [], { bass: false, chords: true })])
    const p = partsFromSong(s)
    expect(p.map((x) => [x.name, x.bars])).toEqual([['Intro', 12], ['Drop', 4], ['Final', 4]])
  })
  it('sin nombre claro se nombra por lo que lleva y por dónde está', () => {
    const s = song([cell(1, undefined, [drum('bd', K)]), cell(2, 'Build', [drum('sd', [0, 4, 8, 12]), mel('riser', 12)], { bass: true, chords: false }), full(3), cell(4, undefined, [mel('lead')], { bass: false, chords: true }), cell(5, undefined, [], { bass: false, chords: true })])
    expect(partsFromSong(s).map((x) => x.name)).toEqual(['Intro', 'Subida', 'Drop', 'Break', 'Final'])
  })
  it('los nombres se repiten con número', () => {
    const s = song([cell(1, 'Intro', [drum('bd', K)]), full(2, 'Drop'), cell(3, 'Break', [mel('pad')], { bass: false, chords: true }), full(4, 'Drop'), cell(5, 'Final', [], { bass: false, chords: true })])
    expect(partsFromSong(s).map((x) => x.name)).toEqual(['Intro', 'Drop', 'Break', 'Drop 2', 'Final'])
  })
  it('nunca más de 8 partes: se juntan los vecinos más parecidos y los compases se conservan', () => {
    const cells = Array.from({ length: 14 }, (_, i) => (i % 2 ? full(i + 1) : cell(i + 1, undefined, [drum('bd', K), ...(i % 4 ? [drum('hh', [0, 2])] : [])], { bass: i % 3 === 0, chords: false })))
    const s = song(cells)
    const p = partsFromSong(s)
    expect(p.length).toBeLessThanOrEqual(MAX_PARTS)
    expect(p.reduce((n, x) => n + x.bars, 0)).toBe(songBars(s))
  })
  it('un grupo en paralelo suena dentro de la parte que lo enciende, y hasta que otra lo apaga', () => {
    const tema = mel('lead', 12)
    const g = cell(10, 'Tema A', [tema])
    const base = (cid: number, name: string, extra: Partial<Cell> = {}) => cell(cid, name, [drum('bd', K)], { bass: true, chords: false }, 4, extra)
    const s = song([base(1, 'Intro'), base(2, 'Groove', { groupOn: [1] }), cell(3, 'Break', [], { bass: false, chords: true }, 4, { groupOff: [1] }), g], [{ id: 1, order: [10], on: false }])
    const p = partsFromSong(s)
    expect(p.find((x) => x.name === 'Intro')!.layers.some((l) => l.key === 'tema')).toBe(false)
    expect(p.find((x) => x.name === 'Estrofa' || x.name === 'Groove')!.layers.some((l) => l.key === 'tema')).toBe(true)
    expect(p[p.length - 1]!.layers.some((l) => l.key === 'tema')).toBe(false)
  })
  it('como mucho 4 capas por parte, sin quitar nunca el ritmo ni el tema', () => {
    const c = cell(1, 'Drop', [drum('bd', K), drum('sd', [4]), drum('hh', [0]), mel('lead'), mel('riser', 12), mel('pad', 3), mel('crash', 1)], { bass: true, chords: true })
    const l = layersOfCell(c)
    expect(l.length).toBeLessThanOrEqual(MAX_LAYERS)
    expect(l.some((x) => x.key === 'ritmo') && l.some((x) => x.key === 'tema')).toBe(true)
  })
  it('lo silenciado no cuenta y una célula vacía no es una parte', () => {
    const muted = { ...drum('bd', K), muted: true }
    expect(partsFromSong(song([cell(1, 'Intro', [muted]), cell(2, 'Drop', [drum('bd', K)])])).map((x) => x.name)).toEqual(['Drop'])
  })
  it('los patrones de 2 compases se repiten y los de 1 compás miden 16', () => {
    expect(patternOf(drum('bd', [0, 4])).split(' ').length).toBe(16)
    expect(patternOf({ ...drum('bd', [0, 20]), bars: 4, hits: [{ pos: 0, strength: 1 }, { pos: 40, strength: 1 }] }).split(' ').filter((t) => t === 'x').length).toBe(2)
  })
  it('el papel de una parte', () => {
    expect(roleOf([{ key: 'ritmo', label: '' }, { key: 'acordes', label: '' }], 2, 5)).toBe('Drop')
    expect(roleOf([{ key: 'tema', label: '' }], 0, 5)).toBe('Intro')
  })
})

describe('un remix, una sola canción (dos caras)', () => {
  it('las partes de cada remix principal salen de su canción y vuelven a dar las mismas', () => {
    for (const r of LAB_REMIXES) {
      const again = partsFromSong(r.song)
      expect(again.map((p) => [p.name, p.bars, p.layers.map((l) => l.key).join()])).toEqual(r.parts.map((p) => [p.name, p.bars, p.layers.map((l) => l.key).join()]))
    }
  })
  it('los remixes largos del Estudio (12 células y grupos en paralelo) también dan como mucho 8 partes con los compases enteros', () => {
    for (const rm of REMIXES) {
      const s = rm.build()
      const p = partsFromSong(s)
      expect(p.length).toBeGreaterThan(2)
      expect(p.length).toBeLessThanOrEqual(MAX_PARTS)
      for (const part of p) expect(part.layers.length).toBeLessThanOrEqual(MAX_LAYERS)
      expect(p.reduce((n, x) => n + x.bars, 0)).toBeGreaterThan(0)
      // el tema aparece (los de grupos en paralelo, dentro de su parte)
      expect(p.some((x) => x.layers.some((l) => l.key === 'tema'))).toBe(true)
    }
  })
})

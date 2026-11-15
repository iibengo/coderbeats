import { describe, expect, it } from 'vitest'
import { demoSong, emptySong, isSong, withNewCell, type Song } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { mergeCells } from '../../app/lib/mergeCells'
import { REMIXES } from '../../app/lib/remixes'

const loop = (id: number, instrument: FreeLoop['instrument'], steps: number[], o: Partial<FreeLoop> = {}): FreeLoop => ({
  id, instrument, bars: 1, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false,
  hits: steps.map((pos) => (instrument === 'mel' ? { pos, strength: 1, midi: 60, dur: 2 } : { pos, strength: 1 })), ...o,
})
/** dos células: la 1 (B) y la 2 (A) */
function two(a: FreeLoop[], b: FreeLoop[], pa = { bass: false, chords: false }, pb = { bass: false, chords: false }): Song {
  let s = emptySong()
  s = { ...s, cells: [{ ...s.cells[0]!, loops: b, parts: pb, turns: 2, name: 'B' }], nextLoopId: 100 }
  const r = withNewCell(s, { x: 3, y: 0 })!
  return { ...r.song, cells: r.song.cells.map((c) => (c.id === r.id ? { ...c, loops: a, parts: pa, turns: 4, name: 'A' } : c)) }
}
const cell = (s: Song, id: number) => s.cells.find((c) => c.id === id)!

describe('fundir células (spec 005 §21)', () => {
  it('no se funde una con sí misma ni con una que no existe', () => {
    const s = two([], [])
    expect(mergeCells(s, 1, 1)).toBeNull()
    expect(mergeCells(s, 1, 99)).toBeNull()
  })
  it('un instrumento en las dos: un solo loop con los golpes de las dos; A desaparece y B se queda con su nombre', () => {
    const s = two([loop(10, 'bd', [4, 12])], [loop(1, 'bd', [0, 8])])
    const r = mergeCells(s, 2, 1)!
    expect(r.song.cells.map((c) => c.id)).toEqual([1])
    expect(r.song.order).toEqual([1])
    const bd = cell(r.song, 1).loops.filter((l) => l.instrument === 'bd')
    expect(bd).toHaveLength(1)
    expect(bd[0]!.hits.map((h) => h.pos)).toEqual([0, 4, 8, 12])
    expect(cell(r.song, 1).name).toBe('B')
    expect(isSong(r.song)).toBe(true)
  })
  it('un instrumento en una sola se pasa tal cual', () => {
    const r = mergeCells(two([loop(10, 'sd', [4])], [loop(1, 'bd', [0])]), 2, 1)!
    expect(cell(r.song, 1).loops.map((l) => l.instrument).sort()).toEqual(['bd', 'sd'])
  })
  it('dos golpes en el mismo paso quedan en uno (el de B); a más de media semicorchea, los dos', () => {
    const same = mergeCells(two([loop(10, 'bd', [4])], [loop(1, 'bd', [4, 8])]), 2, 1)!
    expect(cell(same.song, 1).loops[0]!.hits.map((h) => h.pos)).toEqual([4, 8])
    expect(same.dropped.hits).toBe(1)
    const close = mergeCells(two([loop(10, 'bd', [4.6])], [loop(1, 'bd', [4])]), 2, 1)!
    expect(cell(close.song, 1).loops[0]!.hits).toHaveLength(2)
    const very = mergeCells(two([loop(10, 'bd', [4.3])], [loop(1, 'bd', [4])]), 2, 1)!
    expect(cell(very.song, 1).loops[0]!.hits).toHaveLength(1)
  })
  it('longitudes distintas: el de 1 compás se repite sobre el de 4 y suena en los 4 como sonaba', () => {
    const r = mergeCells(two([loop(10, 'bd', [0, 8], { bars: 1 })], [loop(1, 'bd', [2], { bars: 4 })]), 2, 1)!
    const bd = cell(r.song, 1).loops[0]!
    expect(bd.bars).toBe(4)
    expect(bd.hits.map((h) => h.pos)).toEqual([0, 2, 8, 16, 24, 32, 40, 48, 56])
  })
  it('las fases se respetan (un loop de 2 compases con fase 1 suena su compás 0 en el compás 1 de la célula)', () => {
    const a = loop(10, 'sd', [0], { bars: 2, phaseBar: 1 })
    const r = mergeCells(two([a], [loop(1, 'sd', [0], { bars: 2 })]), 2, 1)!
    expect(cell(r.song, 1).loops.find((l) => l.instrument === 'sd')!.hits.map((h) => h.pos)).toEqual([0, 16])
  })
  it('los silenciados no se funden: si el de B suena se queda el suyo; si solo suena el de A, se pasa el de A', () => {
    const r1 = mergeCells(two([loop(10, 'bd', [4], { muted: true })], [loop(1, 'bd', [0])]), 2, 1)!
    expect(cell(r1.song, 1).loops[0]!.hits.map((h) => h.pos)).toEqual([0])
    const r2 = mergeCells(two([loop(10, 'bd', [4])], [loop(1, 'bd', [0], { muted: true })]), 2, 1)!
    expect(cell(r2.song, 1).loops[0]!.hits.map((h) => h.pos)).toEqual([4])
    const r3 = mergeCells(two([loop(10, 'bd', [4], { muted: true })], [loop(1, 'bd', [0], { muted: true })]), 2, 1)!
    expect(cell(r3.song, 1).loops[0]!.muted).toBe(true)
  })
  it('el fondo es un O lógico y las vueltas, el mayor', () => {
    const r = mergeCells(two([], [], { bass: true, chords: false }, { bass: false, chords: true }), 2, 1)!
    expect(cell(r.song, 1).parts).toEqual({ bass: true, chords: true })
    expect(cell(r.song, 1).turns).toBe(4)
  })
  it('melodías: gana B; una nota de A entra solo en un hueco libre y se recorta; las que empiezan dentro de una de B no entran', () => {
    const b = loop(1, 'mel', [0, 8])
    const a = loop(10, 'mel', [1, 4, 7, 15])
    const r = mergeCells(two([a], [b]), 2, 1)!
    const mel = cell(r.song, 1).loops.find((l) => l.instrument === 'mel')!
    // B: 0 (dur 2) y 8 (dur 2). A: 1 cae dentro de la de 0 → fuera; 4 entra (dur 2); 7 entra pero recortada contra la de 8 (dur 1); 15 entra y se recorta a la línea de compás (dur 1)
    expect(mel.hits.map((h) => [h.pos, h.dur])).toEqual([[0, 2], [4, 2], [7, 1], [8, 2], [15, 1]])
    expect(r.dropped.notes).toBe(1)
  })
  it('la melodía de una sola célula se pasa con su sinte propio; si las dos tienen, gana el de B', () => {
    const only = mergeCells(two([loop(10, 'mel', [0], { synth: 'drone' })], []), 2, 1)!
    expect(cell(only.song, 1).loops[0]!.synth).toBe('drone')
    const both = mergeCells(two([loop(10, 'mel', [8], { synth: 'drone' })], [loop(1, 'mel', [0], { synth: 'lead' })]), 2, 1)!
    expect(cell(both.song, 1).loops[0]!.synth).toBe('lead')
  })
  it('vacía + llena: se queda el contenido de la otra', () => {
    const r = mergeCells(two([loop(10, 'bd', [0])], []), 2, 1)!
    expect(cell(r.song, 1).loops.map((l) => l.instrument)).toEqual(['bd'])
  })
  it('los ids de loop no se repiten y la canción es válida, con las células de los remixes', () => {
    for (const rx of REMIXES) {
      const song = rx.build()
      const [aId, bId] = [song.order[1]!, song.order[2]!]
      const r = mergeCells(song, aId, bId)!
      const ids = r.song.cells.flatMap((c) => c.loops.map((l) => l.id))
      expect(new Set(ids).size, rx.id).toBe(ids.length)
      expect(isSong(r.song), rx.id).toBe(true)
      expect(r.song.order).not.toContain(aId)
      expect(r.song.cells.length).toBe(song.cells.length - 1)
    }
  })
  it('con la demo de dnb: de dos células salen una, y A sale del orden', () => {
    const s = demoSong('dnb')!
    const r = mergeCells(s, s.order[0]!, s.order[1]!)!
    expect(r.song.order).toEqual(s.order.slice(1))
  })
})

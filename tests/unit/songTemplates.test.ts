import { describe, expect, it } from 'vitest'
import { emptySong, isSong, songBars, type Cell, type Song } from '../../app/lib/cells'
import { REMIXES } from '../../app/lib/remixes'
import { songCode } from '../../app/lib/song'
import { PART_TURNS, convertToSong } from '../../app/lib/songTemplates'
import type { StyleId } from '../../app/lib/types'
import { events } from '../helpers/strudelEval'

/** una canción de una sola célula con los loops de una célula de un remix */
const single = (cell: Cell): Song => {
  const e = emptySong()
  const c: Cell = { ...cell, id: 1, name: undefined, turns: 4, loops: cell.loops.map((l, i) => ({ ...l, id: i + 1 })), at: { x: 0, y: 0, depth: 0 } }
  delete c.groupOn
  delete c.groupOff
  return { ...e, cells: [c], nextLoopId: c.loops.length + 1 }
}

const full = (style: StyleId, which: string): Song => {
  const r = REMIXES.find((x) => x.style === style && x.id.includes(which))!
  const song = r.build()
  return single(song.cells.find((c) => c.name === (style === 'dembow' ? 'Subidón' : 'DROP'))!)
}
const names = (s: Song) => s.order.map((id) => s.cells.find((c) => c.id === id)!.name)
const kinds = (c: Cell) => c.loops.map((l) => l.instrument)

describe('Convertir en canción (spec 011 §14.2, 012 §6): una receta de variaciones', () => {
  it('de un loop lleno a la estructura del estilo: Intro, Entra, Subida, Drop y Final, en ese orden', () => {
    const song = full('techno', 'dies')
    const out = convertToSong(song, 'techno')!
    expect(out).not.toBeNull()
    expect(names(out)).toEqual(['Intro', 'Entra', 'Subida', 'Drop', 'Final'])
    expect(isSong(out)).toBe(true)
    expect(songBars(out)).toBe(Object.values(PART_TURNS.techno).reduce((a, b) => a + b, 0))
  })
  it('la célula original se queda como el Drop (mismo id y mismos loops); las demás son nuevas, con ids únicos', () => {
    const song = full('techno', 'dies')
    const out = convertToSong(song, 'techno')!
    const drop = out.cells.find((c) => c.name === 'Drop')!
    expect(drop.id).toBe(song.cells[0]!.id)
    expect(drop.loops).toEqual(song.cells[0]!.loops)
    const ids = out.cells.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    const loopIds = out.cells.flatMap((c) => c.loops.map((l) => l.id))
    expect(new Set(loopIds).size).toBe(loopIds.length)
    expect(out.nextCellId).toBeGreaterThan(Math.max(...ids))
    expect(out.nextLoopId).toBeGreaterThan(Math.max(...loopIds))
    expect(song.cells).toHaveLength(1) // la dada no cambia
  })
  it('la intro tiene menos capas que el drop; la subida, sin bombo, con redoble y el filtro que se abre; el final, solo los acordes con el filtro que baja', () => {
    const out = convertToSong(full('techno', 'dies'), 'techno')!
    const by = (n: string) => out.cells.find((c) => c.name === n)!
    expect(by('Intro').loops.length).toBeLessThan(by('Drop').loops.length)
    expect(kinds(by('Subida'))).not.toContain('bd')
    const sd = by('Subida').loops.find((l) => l.instrument === 'sd')!
    expect(sd.bars).toBe(4)
    expect([60, 61, 62, 63].every((p) => sd.hits.some((h) => h.pos === p))).toBe(true) // el redoble del último compás
    expect(by('Subida').lpf).toEqual([600, 1500, 4000, 12000])
    expect(by('Final').loops).toEqual([])
    expect(by('Final').parts).toEqual({ bass: false, chords: true })
    expect(by('Final').lpf).toEqual([1800, 1100, 650, 350])
    expect(by('Drop').lpf).toBeUndefined()
  })
  it('sigue el estilo: las vueltas de cada parte son las de su estilo', () => {
    for (const [style, which] of [['techno', 'dies'], ['dembow', 'oda']] as const) {
      const out = convertToSong(full(style, which), style)!
      for (const c of out.cells) expect(c.turns, `${style} ${c.name}`).toBe(PART_TURNS[style][c.name as keyof (typeof PART_TURNS)['techno']])
    }
  })
  it('se salta las partes que quedarían iguales: un loop pobre (solo un bombo) da pocas partes, sin partes vacías ni repetidas', () => {
    const poor = single({ id: 1, loops: [{ id: 1, instrument: 'bd', bars: 1, phaseBar: 0, hits: [0, 4, 8, 12].map((p) => ({ pos: p, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false }], parts: { bass: false, chords: false }, turns: 4, at: { x: 0, y: 0, depth: 0 } })
    const out = convertToSong(poor, 'techno')!
    expect(out).not.toBeNull()
    expect(out.cells.length).toBeLessThan(5)
    const sigs = out.cells.filter((c) => c.name !== 'Final' && c.name !== 'Drop').map((c) => JSON.stringify([c.loops.map((l) => l.hits), c.parts]))
    expect(new Set(sigs).size).toBe(sigs.length)
    expect(isSong(out)).toBe(true)
  })
  it('no convierte lo que no se puede: una canción de varias células, o una célula vacía', () => {
    const multi = REMIXES[0]!.build()
    expect(convertToSong(multi, 'dembow')).toBeNull()
    expect(convertToSong(emptySong(), 'techno')).toBeNull()
  })
  it('funciona con cada célula con batería de cada remix, y la canción resultante da código válido que se evalúa en Strudel', async () => {
    for (const r of REMIXES) {
      const song = r.build()
      for (const c of song.cells.filter((x) => x.loops.some((l) => l.instrument !== 'mel' && l.hits.length)).slice(0, 4)) {
        const out = convertToSong(single(c), r.style)
        if (!out) continue
        expect(isSong(out), `${r.id} ${c.name}`).toBe(true)
        expect(out.order.length).toBeLessThanOrEqual(5)
      }
    }
    const out = convertToSong(full('techno', 'dies'), 'techno')!
    const code = songCode(
      { loops: [], style: 'techno', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 }, cells: { list: out.cells, order: out.order, window: [] } },
      'display',
    )
    const ev = await events(code, songBars(out))
    expect(ev.length).toBeGreaterThan(100)
    // el Drop tiene bombo; la Subida no
    const starts: Record<string, number> = {}
    let bar = 0
    for (const id of out.order) {
      const c = out.cells.find((x) => x.id === id)!
      starts[c.name!] = bar
      bar += c.turns
    }
    const bd = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to && e.value.s === 'bd').length
    expect(bd(starts.Subida!, starts.Subida! + 4)).toBe(0)
    expect(bd(starts.Drop!, starts.Drop! + 8)).toBeGreaterThan(0)
  })
})

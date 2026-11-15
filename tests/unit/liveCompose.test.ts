import { describe, expect, it } from 'vitest'
import { emptySong, isSong, type FreeLoop, type Song } from '../../app/lib/cells'
import { layersKey, mergeRuns, roundTurns, runsOf, timelineToSong, type BarLayers } from '../../app/lib/liveCompose'

const loop = (id: number, instrument: FreeLoop['instrument'], bars: 1 | 4 = 1): FreeLoop => ({
  id, instrument, bars, phaseBar: 0, hits: [{ pos: 0, strength: 1 }], muted: false, bornAt: 0, fromTemplate: false,
})
const base = (): Song => {
  const s = emptySong()
  s.cells[0]!.loops = [loop(1, 'bd'), loop(2, 'sd'), loop(3, 'hh')]
  return { ...s, nextLoopId: 4 }
}
const L = (loops: number[], bass = false, chords = false): BarLayers => ({ loops, parts: { bass, chords } })
const rep = (l: BarLayers, n: number) => Array.from({ length: n }, () => l)

describe('componer en directo (spec 011 §14.1)', () => {
  it('runsOf parte por tramos de capas iguales (el orden de los ids no importa)', () => {
    const r = runsOf([L([1, 2]), L([2, 1]), L([1])])
    expect(r.map((x) => x.bars)).toEqual([2, 1])
  })
  it('roundTurns redondea hacia abajo al 1/2/4/8/16/32', () => {
    expect([1, 2, 3, 5, 7, 8, 15, 20, 40].map(roundTurns)).toEqual([1, 2, 2, 4, 4, 8, 8, 16, 32])
  })
  it('un tramo corto se une al vecino; el primero, con el siguiente', () => {
    const r = mergeRuns([{ layers: L([1]), bars: 1 }, { layers: L([1, 2]), bars: 4 }], 2)
    expect(r.runs.map((x) => x.bars)).toEqual([5])
    const q = mergeRuns([{ layers: L([1]), bars: 4 }, { layers: L([1, 2]), bars: 1 }, { layers: L([1, 2, 3]), bars: 4 }], 2)
    expect(q.runs.map((x) => x.bars)).toEqual([5, 4])
    expect(q.merged).toBe(true)
  })
  it('más de 16 tramos: se unen los más cortos hasta 16', () => {
    const runs = Array.from({ length: 20 }, (_, i) => ({ layers: L(i % 2 ? [1] : [1, 2]), bars: 2 + (i % 3) }))
    expect(mergeRuns(runs, 1).runs.length).toBeLessThanOrEqual(16)
  })
  it('una grabación: intro con el bombo, entra todo, final con poco → 3 células con nombre, una canción válida', () => {
    const t = [...rep(L([1]), 4), ...rep(L([1, 2, 3], true, true), 8), ...rep(L([3]), 2)]
    const out = timelineToSong(base(), t)!
    expect(out.song.cells.map((c) => c.name)).toEqual(['Intro', 'Drop', 'Final'])
    expect(out.song.cells.map((c) => c.turns)).toEqual([4, 8, 2])
    expect(out.song.cells[1]!.parts).toEqual({ bass: true, chords: true })
    expect(out.song.cells[0]!.loops.map((l) => l.instrument)).toEqual(['bd'])
    expect(isSong(out.song)).toBe(true)
  })
  it('los ids de loop y de célula no se repiten', () => {
    const out = timelineToSong(base(), [...rep(L([1]), 2), ...rep(L([1, 2]), 2), ...rep(L([1, 2, 3]), 2)])!.song
    const ids = out.cells.flatMap((c) => c.loops.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(out.cells.map((c) => c.id)).size).toBe(out.cells.length)
    expect(out.nextLoopId).toBeGreaterThan(Math.max(...ids))
  })
  it('con loops de 4 compases, cada tramo dura al menos 4 vueltas', () => {
    const s = base()
    s.cells[0]!.loops = s.cells[0]!.loops.map((l) => ({ ...l, bars: 4 }))
    const out = timelineToSong(s, [...rep(L([1]), 1), ...rep(L([1, 2]), 5), ...rep(L([1, 2, 3]), 4)])!
    expect(out.song.cells.every((c) => c.turns >= 4)).toBe(true)
  })
  it('sin cambios no hay canción', () => {
    expect(timelineToSong(base(), rep(L([1, 2]), 8))).toBeNull()
    expect(timelineToSong(base(), [])).toBeNull()
  })
  it('layersKey distingue el fondo', () => {
    expect(layersKey(L([1], true))).not.toBe(layersKey(L([1], false, true)))
  })
})

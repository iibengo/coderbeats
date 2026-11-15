import { describe, expect, it } from 'vitest'
import { demoSong, emptySong, songBars, type Song } from '../../app/lib/cells'
import { demoState } from '../../app/lib/demos'
import { checkOutcome, correctLoops, outcomeOf } from '../../app/lib/pilotScripts'
import { gestureSteps, previewScript, showBars } from '../../app/lib/previewScript'
import { REMIXES } from '../../app/lib/remixes'
import type { StyleId } from '../../app/lib/types'

const songs: [string, Song, StyleId][] = [
  ...(['dnb', 'dembow'] as const).map((s) => [`demo ${s}`, demoSong(s)!, s] as [string, Song, StyleId]),
  ...REMIXES.map((r) => [`remix ${r.id}`, r.build(), r.style] as [string, Song, StyleId]),
  ['una célula con loops', { ...emptySong(), cells: [{ ...emptySong().cells[0]!, loops: demoState('techno', 1, 0).loops, parts: { bass: true, chords: false } }], nextLoopId: 4 }, 'techno'],
]
const ALLOWED = new Set(['caption', 'tap', 'mouth', 'wait', 'copy', 'fill'])

describe('previsualizar cualquier canción (spec 009)', () => {
  it.each(songs)('%s: el guion solo usa gestos que existen y empieza dando a Play', (_n, song, style) => {
    const s = previewScript(song, style, 'electro')
    expect(s.steps.every((x) => ALLOWED.has(x.do))).toBe(true)
    expect(s.steps.find((x) => x.do === 'tap')).toEqual({ do: 'tap', on: { t: 'play' } })
    for (const st of s.steps) if (st.do === 'mouth') expect(st.steps.every((p) => Number.isInteger(p) && p >= 0 && p < 16)).toBe(true)
  })
  it.each(songs)('%s: lo que construyen los gestos es lo gesticulable de la primera célula, y la comprobación cuadra', (_n, song, style) => {
    const s = previewScript(song, style, 'electro')
    expect(outcomeOf(s)).toEqual(s.final)
    const first = song.cells.find((c) => c.id === song.order[0])!
    for (const l of first.loops) {
      const g = gestureSteps(l.hits, l.bars)
      if (['bd', 'sd', 'hh'].includes(l.instrument) && g && !l.muted) expect(s.final.loops[l.instrument as 'bd']).toEqual(g)
      else expect(s.final.loops[l.instrument as 'bd']).toBeUndefined()
    }
    expect(s.final.parts).toEqual({ bass: first.parts.bass, chords: first.parts.chords })
  })
  it.each(songs)('%s: aunque el micro o las ayudas hayan ensuciado lo construido, la corrección deja exactamente el guion', (_n, song, style) => {
    const s = previewScript(song, style, 'electro')
    const dirty = { loops: [...demoState(style, 20, 2).loops.map((l) => ({ ...l, hits: [...l.hits, { pos: 7.4, strength: 1 }] })), { ...demoState(style, 30, 0).loops[0]!, id: 40, instrument: 'mel' as const }], nextId: 41 }
    const fixed = correctLoops(dirty, s.final, 4)
    expect(checkOutcome(fixed, s.final.parts, s.final).ok).toBe(true)
  })
  it.each(songs)('%s: construye la canción completa: una célula por cada una del orden (la primera y una copia por cada siguiente), en orden', (_n, song, style) => {
    const s = previewScript(song, style, 'electro')
    const copies = s.steps.filter((x) => x.do === 'copy').length
    const fills = s.steps.filter((x) => x.do === 'fill').map((x) => (x as { cell: number }).cell)
    expect(copies).toBe(Math.min(song.order.length, 16) - 1)
    expect(fills).toEqual(Array.from({ length: copies + 1 }, (_, i) => i))
    // el orden de los pasos: cada copia va seguida de su relleno
    const seq = s.steps.filter((x) => x.do === 'copy' || x.do === 'fill').map((x) => x.do)
    expect(seq.join(',')).toBe(['fill', ...Array.from({ length: copies }, () => ['copy', 'fill']).flat()].join(','))
  })
  it('lo que no se puede con un gesto (golpe a medio paso, 4 compases) no se inventa', () => {
    expect(gestureSteps([{ pos: 2.5 }], 1)).toBeNull()
    expect(gestureSteps([{ pos: 2 }], 4)).toBeNull()
    expect(gestureSteps([], 1)).toBeNull()
    expect(gestureSteps([{ pos: 4 }, { pos: 0 }, { pos: 4 }], 1)).toEqual([0, 4])
  })
  it('la demostración de la canción entera dura entre 2 y 8 compases', () => {
    for (const [, song] of songs) expect(showBars(songBars(song))).toBeGreaterThanOrEqual(2)
    expect(showBars(100)).toBe(8)
  })
  it('restaurar la canción del usuario la deja idéntica (copia profunda: nada del guion se le pega)', () => {
    const mine = demoSong('dnb')!
    const snap = JSON.parse(JSON.stringify(mine)) as Song
    previewScript(songs[3]![1], 'techno', 'electro')
    expect(snap).toEqual(mine)
  })
})

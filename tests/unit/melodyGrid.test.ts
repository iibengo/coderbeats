import { describe, expect, it } from 'vitest'
import { colsOf, fitShift, GRID_ROWS, maxShift, noteAt, normalize, rowsFor, soundingAt, stretchNote, tapCell } from '~/lib/melodyGrid'
import { scaleNotes } from '~/lib/waterKeys'

const n = (pos: number, midi: number, dur = 2) => ({ pos, dur, midi, strength: 0.8 })

describe('editor de melodía: cuadrícula', () => {
  it('8 columnas por compás y filas solo de la escala del estilo', () => {
    expect(colsOf(2)).toBe(16)
    for (const s of ['hiphop90', 'house', 'dnb', 'dembow', 'techno'] as const) {
      const all = scaleNotes(s)
      const rows = rowsFor(s, 0)
      expect(rows.length).toBe(Math.min(GRID_ROWS, all.length))
      for (const m of rows) expect(all).toContain(m)
      expect([...rows].sort((a, b) => a - b)).toEqual(rows)
      expect(rowsFor(s, 999)).toEqual(rowsFor(s, maxShift(s)))
    }
  })
  it('tocar una casilla vacía pone una corchea; otra vez la quita', () => {
    const a = tapCell([], 3, 60, 1)
    expect(a).toEqual([n(6, 60)])
    expect(tapCell(a, 3, 60, 1)).toEqual([])
  })
  it('misma columna, otra altura: cambia la nota (monofónico)', () => {
    const a = tapCell(tapCell([], 2, 60, 1), 2, 64, 1)
    expect(a).toEqual([n(4, 64)])
  })
  it('una nota larga se acorta si pongo otra dentro; no hay solapes', () => {
    const long = [n(0, 60, 8)]
    const b = tapCell(long, 2, 62, 1)
    expect(b.map((h) => [h.pos, h.dur])).toEqual([[0, 4], [4, 2]])
    expect(soundingAt(b, 1)!.midi).toBe(60)
    expect(soundingAt(b, 2)!.midi).toBe(62)
  })
  it('estirar llega hasta la columna pedida, sin pasar de la siguiente nota ni del final', () => {
    const base = [n(0, 60), n(8, 62)]
    expect(stretchNote(base, 0, 2, 1).map((h) => h.dur)).toEqual([6, 2])
    expect(stretchNote(base, 0, 6, 1).map((h) => h.dur)).toEqual([8, 2])
    expect(stretchNote(base, 4, 99, 1).map((h) => h.dur)).toEqual([2, 8])
    expect(stretchNote(base, 5, 6, 1)).toEqual(base) // no empieza ahí
  })
  it('lo de fuera del loop se descarta y las posiciones decimales caen en su columna', () => {
    expect(normalize([n(40, 60), n(3.2, 62)], 1).map((h) => h.pos)).toEqual([4])
    expect(tapCell([], 99, 60, 1)).toEqual([])
    expect(noteAt([n(3.8, 60)], 2)!.midi).toBe(60)
  })
  it('la ventana se centra en las notas que hay', () => {
    const rows = rowsFor('techno', fitShift('techno', [n(0, 72), n(2, 74), n(4, 75)]))
    expect(rows).toContain(74)
    expect(fitShift('techno', [])).toBeGreaterThanOrEqual(0)
  })
})

import { describe, expect, it } from 'vitest'
import { answerPhrase, ANSWER_VARIANTS, colsOf, fitShift, GRID_ROWS, maxShift, noteAt, normalize, rowsFor, soundingAt, stretchNote, tapCell } from '~/lib/melodyGrid'
import { STYLE_MUSIC } from '~/lib/styles'
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

describe('↻ responder', () => {
  const sc = scaleNotes('techno')
  const phrase = [n(0, sc[7]!), n(4, sc[9]!), n(8, sc[8]!), n(16, sc[7]!), n(20, sc[10]!), n(28, sc[9]!)]
  it('deja un loop de 4 compases: la pregunta igual y la respuesta con el mismo ritmo desplazado 2 compases', () => {
    const r = answerPhrase(phrase, 'techno', 0)!
    expect(r.length).toBe(phrase.length * 2)
    expect(r.slice(0, phrase.length).map((h) => [h.pos, h.midi])).toEqual(phrase.map((h) => [h.pos, h.midi]))
    expect(r.slice(phrase.length).map((h) => h.pos)).toEqual(phrase.map((h) => h.pos + 32))
    expect(r.every((h) => h.pos < 64)).toBe(true)
  })
  it('el 3.er compás repite la pregunta y la respuesta cierra en la tónica, siempre en la escala', () => {
    for (const style of ['hiphop90', 'house', 'dnb', 'dembow', 'techno'] as const) {
      const all = scaleNotes(style)
      const ph = [n(0, all[3]!), n(4, all[5]!), n(16, all[4]!), n(24, all[6]!)]
      for (let seed = 0; seed < ANSWER_VARIANTS * 2; seed++) {
        const r = answerPhrase(ph, style, seed)!
        const ans = r.slice(ph.length)
        expect(ans[0]!.midi).toBe(ph[0]!.midi)
        expect(ans[ans.length - 1]!.midi % 12).toBe(STYLE_MUSIC[style].scale[0])
        for (const h of r) expect(all).toContain(h.midi)
      }
    }
  })
  it('cada variación cambia algo y la secuencia es fija (misma semilla, mismo resultado)', () => {
    const a = JSON.stringify(answerPhrase(phrase, 'techno', 1))
    expect(a).toBe(JSON.stringify(answerPhrase(phrase, 'techno', 1)))
    expect(a).not.toBe(JSON.stringify(answerPhrase(phrase, 'techno', 0)))
  })
  it('sin notas en la frase no hay respuesta; lo que pasa del compás 2 se ignora', () => {
    expect(answerPhrase([], 'techno', 0)).toBeNull()
    expect(answerPhrase([n(40, 60)], 'techno', 0)).toBeNull()
  })
})

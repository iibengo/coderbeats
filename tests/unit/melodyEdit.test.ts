import { describe, expect, it } from 'vitest'
import { emptyLoops, type FreeLoop, type LoopsState } from '../../app/lib/freeLoops'
import { addMelNote, melLoopOf, moveMelNote, resizeMelNote, setMelBars, snapMelMidi, snapMelStep, type MelEditOptions } from '../../app/lib/melodyEdit'
import { fitToScale, fracToMidi, isTonic, midiToFrac, nearestScaleNote, rangeOf, rowOf, scaleNotes } from '../../app/lib/melodyView'
import { removeHit } from '../../app/lib/loopEdit'
import { STYLE_MUSIC } from '../../app/lib/styles'

const A: MelEditOptions = { assist: true, style: 'hiphop90' }
const N: MelEditOptions = { assist: false, style: 'hiphop90' }
const mel = (hits: [number, number, number][], o: Partial<FreeLoop> = {}): FreeLoop => ({
  id: 7, instrument: 'mel', bars: 1, phaseBar: 0, hits: hits.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false, ...o,
})
const st = (...loops: FreeLoop[]): LoopsState => ({ loops, nextId: 20 })
const notes = (s: LoopsState) => melLoopOf(s)!.hits.map((h) => [h.pos, h.dur, h.midi])

describe('vista de la melodía', () => {
  it('la altura va de 0 a 1 en su registro, cada semitono lo mismo, y vuelve', () => {
    const r = rangeOf('piano') // 48–72
    expect(midiToFrac(48, r)).toBeCloseTo(0.5 / 25)
    expect(midiToFrac(72, r)).toBeCloseTo(24.5 / 25)
    expect(midiToFrac(10, r)).toBe(0)
    expect(midiToFrac(100, r)).toBe(1)
    for (const m of [48, 55, 60, 71]) expect(fracToMidi(midiToFrac(m, r), r)).toBeCloseTo(m, 9)
  })
  it('las notas de la escala en el registro, de grave a aguda', () => {
    const notes = scaleNotes('hiphop90', rangeOf('piano'))
    expect(notes[0]).toBe(48) // do3 (la menor: A B C D E F G)
    expect(notes.every((m) => STYLE_MUSIC.hiphop90.scale.includes(m % 12))).toBe(true)
    expect([...notes].sort((a, b) => a - b)).toEqual(notes)
    expect(notes).toHaveLength(15) // dos octavas de 7 grados y el do de arriba
    expect(scaleNotes('dembow', rangeOf('lead')).every((m) => STYLE_MUSIC.dembow.scale.includes(m % 12))).toBe(true)
  })
  it('encaja en la escala a ±0,3 semitonos', () => {
    expect(fitToScale(60.2, 'hiphop90')).toEqual({ fit: true, note: 60 })
    expect(fitToScale(61, 'hiphop90').fit).toBe(false)
    expect(fitToScale(59.75, 'hiphop90')).toEqual({ fit: true, note: 59 + 1 }) // si 59 (la menor tiene si: 71 → pc 11)
    expect(nearestScaleNote(61.2, 'hiphop90')).toBe(62)
  })
  it('fila más cercana y tónica', () => {
    const rows = scaleNotes('hiphop90', rangeOf('piano'))
    expect(rows[rowOf(60.4, rows)]).toBe(60)
    expect(rows[rowOf(100, rows)]).toBe(rows.at(-1))
    expect(isTonic(57, 'hiphop90')).toBe(true) // la
    expect(isTonic(60, 'hiphop90')).toBe(false)
  })
})

describe('crear notas', () => {
  it('sin loop de melodía lo crea (1 compás), con la nota en la escala y su paso en la rejilla', () => {
    const r = addMelNote(emptyLoops(), 4.4, 61.2, 0, A)!
    expect(r.state.loops).toHaveLength(1)
    expect(r.state.loops[0]).toMatchObject({ instrument: 'mel', bars: 1, phaseBar: 0, bornAt: 0 })
    expect(notes(r.state)).toEqual([[4, 2, 62]]) // do# → re (la menor), paso 4
    expect(r.hit).toEqual({ loopId: 1, pos: 4 })
  })
  it('sin ayuda respeta el semitono y la rejilla fina', () => {
    const r = addMelNote(emptyLoops(), 4.4, 61.2, 0, N)!
    expect(notes(r.state)).toEqual([[4.5, 2, 61]])
  })
  it('en un loop de varios compases, el paso es del compás que se ve', () => {
    const r = addMelNote(st(mel([[0, 2, 57]], { bars: 2 })), 3, 60, 1, A)!
    expect(notes(r.state).map((n) => n[0])).toEqual([0, 19])
    // y con fase: el compás visible `g` es el (g − phaseBar) mod bars del loop
    const p = addMelNote(st(mel([[0, 2, 57]], { bars: 2, phaseBar: 1 })), 3, 60, 1, A)!
    expect(notes(p.state).map((n) => n[0])).toEqual([0, 3])
  })
  it('dentro de otra nota no entra; en un hueco se recorta contra la siguiente y la línea de compás', () => {
    const s = st(mel([[0, 4, 57], [8, 4, 60]]))
    expect(addMelNote(s, 2, 62, 0, A)).toBeNull()
    expect(notes(addMelNote(s, 5, 62, 0, A, 6)!.state)).toEqual([[0, 4, 57], [5, 3, 62], [8, 4, 60]])
    expect(notes(addMelNote(st(mel([[0, 2, 57]])), 14, 62, 0, A, 6)!.state)).toEqual([[0, 2, 57], [14, 2, 62]])
  })
  it('en el límite de 8 loops no crea otro', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...mel([[0, 2, 57]]), id: i + 1, instrument: 'bd' as const, hits: [{ pos: 0, strength: 1 }] }))
    expect(addMelNote({ loops: many, nextId: 9 }, 0, 60, 0, A)).toBeNull()
  })
  it('snap', () => {
    expect(snapMelStep(15.7, A)).toBe(0)
    expect(snapMelStep(3.3, A)).toBe(3)
    expect(snapMelStep(3.3, N)).toBe(3.25)
    expect(snapMelMidi(61.2, A)).toBe(62)
    expect(snapMelMidi(61.2, N)).toBe(61)
    expect(snapMelMidi(500, N)).toBe(96)
  })
})

describe('mover notas', () => {
  const s = st(mel([[0, 4, 57], [8, 4, 60]]))
  it('cambia de momento y de altura (a la escala con ayuda), sin tocar su duración', () => {
    const r = moveMelNote(s, 7, 8, 12, 64.1, 0, A)!
    expect(notes(r.state)).toEqual([[0, 4, 57], [12, 4, 64]])
    expect(r.hit).toEqual({ loopId: 7, pos: 12 })
  })
  it('solo altura: el mismo paso', () => {
    expect(notes(moveMelNote(s, 7, 0, 0, 62, 0, A)!.state)).toEqual([[0, 4, 62], [8, 4, 60]])
  })
  it('si cae dentro de otra nota, no se puede (vuelve a su sitio)', () => {
    expect(moveMelNote(s, 7, 0, 9, 57, 0, A)).toBeNull()
  })
  it('se recorta contra la siguiente nota y contra la línea de compás', () => {
    expect(notes(moveMelNote(s, 7, 0, 6, 57, 0, A)!.state)).toEqual([[6, 2, 57], [8, 4, 60]])
    expect(notes(moveMelNote(st(mel([[0, 8, 57]])), 7, 0, 12, 57, 0, A)!.state)).toEqual([[12, 4, 57]])
  })
  it('un golpe que no existe o un loop que no es de melodía: null', () => {
    expect(moveMelNote(s, 7, 3, 0, 57, 0, A)).toBeNull()
    expect(moveMelNote(s, 99, 0, 0, 57, 0, A)).toBeNull()
  })
})

describe('estirar y encoger', () => {
  const s = st(mel([[0, 4, 57], [8, 4, 60]]))
  it('a la rejilla (con ayuda, celdas enteras; mínimo una)', () => {
    expect(notes(resizeMelNote(s, 7, 0, 2.6, A)!.state)[0]).toEqual([0, 3, 57])
    expect(notes(resizeMelNote(s, 7, 0, 0.1, A)!.state)[0]).toEqual([0, 1, 57])
  })
  it('sin ayuda, a un cuarto de paso', () => {
    expect(notes(resizeMelNote(s, 7, 0, 2.6, N)!.state)[0]).toEqual([0, 2.5, 57])
  })
  it('no pasa de la siguiente nota ni de la línea de compás', () => {
    expect(notes(resizeMelNote(s, 7, 0, 20, A)!.state)[0]).toEqual([0, 8, 57])
    expect(notes(resizeMelNote(s, 7, 8, 20, A)!.state)[1]).toEqual([8, 8, 60])
  })
  it('un golpe que no existe: null', () => expect(resizeMelNote(s, 7, 3, 2, A)).toBeNull())
})

describe('borrar y longitud del loop', () => {
  it('borrar la última nota borra el loop (como la batería)', () => {
    const s = st(mel([[0, 4, 57]]))
    expect(removeHit(s, 7, 0).loops).toEqual([])
    expect(notes(removeHit(st(mel([[0, 4, 57], [8, 4, 60]])), 7, 0))).toEqual([[8, 4, 60]])
  })
  it('alargar repite el patrón; acortar quita lo de fuera; vaciarlo lo borra', () => {
    const s = st(mel([[0, 4, 57], [8, 4, 60]]))
    const two = setMelBars(s, 7, 2)
    expect(notes(two)).toEqual([[0, 4, 57], [8, 4, 60], [16, 4, 57], [24, 4, 60]])
    expect(notes(setMelBars(two, 7, 1))).toEqual([[0, 4, 57], [8, 4, 60]])
    expect(setMelBars(st(mel([[20, 4, 57]], { bars: 2 })), 7, 1).loops).toEqual([])
    expect(setMelBars(s, 7, 1)).toBe(s)
  })
  it('las ediciones no cambian el nacimiento ni la versión previa', () => {
    const born = mel([[0, 4, 57]], { bornAt: 9, prev: { hits: [{ pos: 0, strength: 1, midi: 55, dur: 2 } as never], bars: 1, phaseBar: 0 } })
    const r = addMelNote(st(born), 8, 60, 0, A)!
    expect(r.state.loops[0]).toMatchObject({ bornAt: 9, prev: born.prev })
  })
})

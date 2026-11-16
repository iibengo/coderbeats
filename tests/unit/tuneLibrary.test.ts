import { describe, expect, it } from 'vitest'
import { STYLES } from '../../app/lib/constants'
import { adaptTune, TUNES, tuneById } from '../../app/lib/tuneLibrary'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { scaleNotes } from '../../app/lib/waterKeys'
import type { StyleId } from '../../app/lib/types'

const styles = Object.keys(STYLES) as StyleId[]

describe('biblioteca de melodías (spec 015 §13)', () => {
  it('hay al menos 5 temas, con id único y dentro de 4 compases', () => {
    expect(TUNES.length).toBeGreaterThanOrEqual(5)
    expect(new Set(TUNES.map((t) => t.id)).size).toBe(TUNES.length)
    for (const t of TUNES) for (const [pos, dur] of t.notes) {
      expect(pos).toBeGreaterThanOrEqual(0)
      expect(pos + dur).toBeLessThanOrEqual(64)
    }
    expect(tuneById('oda')?.name).toMatch(/alegría/)
  })
  it('adaptado a cada estilo: todas las notas son de la escala del estilo y del registro, monofónico, mismas posiciones, determinista', () => {
    for (const style of styles) {
      const list = new Set(scaleNotes(style))
      for (const t of TUNES) {
        const hits = adaptTune(t, style)
        expect(hits.length, `${style} ${t.id}`).toBe(t.notes.length)
        expect(hits.map((h) => h.pos)).toEqual([...t.notes].map((n) => n[0]).sort((a, b) => a - b))
        for (const h of hits) expect(list.has(h.midi), `${style} ${t.id} ${h.midi}`).toBe(true)
        for (let i = 1; i < hits.length; i++) expect(hits[i - 1]!.pos + hits[i - 1]!.dur).toBeLessThanOrEqual(hits[i]!.pos)
        expect(adaptTune(t, style)).toEqual(hits)
      }
    }
  })
  it('conserva el dibujo del tema: la tónica del tema cae en la tónica del estilo (Himno: la última nota de la frase A, mi, sube igual que en el original)', () => {
    const t = tuneById('jacques')!
    const hits = adaptTune(t, 'techno') // do menor: la tónica coincide, solo se ajusta a la escala
    const tonic = STYLE_MUSIC.techno.scale[0]!
    expect(hits[0]!.midi % 12).toBe(tonic)
    // el contorno sube y baja como el original (do re mi do): el segundo > primero, el tercero > segundo
    expect(hits[1]!.midi).toBeGreaterThan(hits[0]!.midi)
    expect(hits[2]!.midi).toBeGreaterThan(hits[1]!.midi)
    expect(hits[3]!.midi).toBeLessThan(hits[2]!.midi)
  })
})

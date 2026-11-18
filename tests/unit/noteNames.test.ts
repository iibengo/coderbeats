import { describe, expect, it } from 'vitest'
import { noteName, rowLabel, usesLetters } from '../../app/lib/noteNames'
import { midiName } from '../../app/lib/noteScore'

describe('nombres de nota del Órgano (spec 037)', () => {
  it('sin el interruptor, el rótulo de las filas es exactamente el de siempre, en cualquier idioma y para toda la gama', () => {
    const antes = (m: number) => midiName(m).replace('#', '♯') // lo que dibujaba el Órgano antes de esta spec
    for (const lang of ['es', 'en', 'eu', 'fr'])
      for (let m = 24; m <= 96; m++) expect(rowLabel(m, lang, false), `${lang} ${m}`).toBe(antes(m))
  })
  it('con el interruptor, sigue el idioma: do re mi en español y euskera, C D E en inglés', () => {
    expect(noteName(60, 'es')).toBe('do4')
    expect(noteName(67, 'es')).toBe('sol4')
    expect(noteName(70, 'eu')).toBe('la♯4')
    expect(noteName(60, 'en')).toBe('C4')
    expect(noteName(66, 'en-GB')).toBe('F♯4')
    expect(usesLetters('en')).toBe(true)
    expect(usesLetters('es')).toBe(false)
    expect(rowLabel(62, 'es', true)).toBe('re4')
  })
  it('la octava cambia en el do (si3 → do4)', () => {
    expect(noteName(59, 'es')).toBe('si3')
    expect(noteName(60, 'es')).toBe('do4')
    expect(noteName(48, 'en')).toBe('C3')
  })
})

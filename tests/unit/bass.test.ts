import { describe, expect, it } from 'vitest'
import { barMini, bassCode, notesInBar, type BassPattern } from '../../app/lib/bass'
import { STYLE_MUSIC } from '../../app/lib/styles'

describe('bassCode', () => {
  it('genera exactamente las líneas literales de antes (suena igual)', () => {
    expect(bassCode(STYLE_MUSIC.hiphop90.background.bass)).toBe('note("<a1 d2>").s("triangle").lpf(600).gain(0.7)')
    expect(bassCode(STYLE_MUSIC.house.background.bass)).toBe(
      'note("<[~ f1 ~ f1] [~ bb0 ~ bb0]>").s("sawtooth").lpf(500).lpenv(2).decay(0.15).sustain(0).gain(0.6)',
    )
    expect(bassCode(STYLE_MUSIC.dnb.background.bass)).toBe('note("<d1 d1 f1 c1>").s("sawtooth").lpf(400).distort(0.3)')
  })
  it('un patrón de un compás no lleva < >', () => {
    const p: BassPattern = { bars: 1, notes: [{ pos: 0, dur: 8, note: 'a1' }], sound: '' }
    expect(bassCode(p)).toBe('note("[a1 ~]")')
  })
})

describe('barMini', () => {
  it('usa la rejilla más gruesa y alarga con @ las notas largas', () => {
    expect(barMini([])).toBe('~')
    expect(barMini([{ pos: 0, dur: 16, note: 'a1' }])).toBe('a1')
    expect(barMini([{ pos: 4, dur: 4, note: 'f1' }])).toBe('[~ f1 ~ ~]')
    expect(barMini([{ pos: 4, dur: 8, note: 'f1' }])).toBe('[~ f1@2 ~]')
    // fuera de la rejilla de corcheas: semicorcheas
    expect(barMini([{ pos: 5, dur: 4, note: 'f1' }])).toBe('[~ ~ ~ ~ ~ f1@4 ~ ~ ~ ~ ~ ~ ~]')
  })
  it('una nota que llegaría más allá del compás se recorta', () => {
    expect(barMini([{ pos: 8, dur: 16, note: 'c1' }])).toBe('[~ c1]')
  })
})

describe('notesInBar', () => {
  it('devuelve las notas del compás que suena, relativas al compás, y da la vuelta', () => {
    const p = STYLE_MUSIC.house.background.bass
    expect(notesInBar(p, 0).map((n) => [n.pos, n.note])).toEqual([
      [4, 'f1'],
      [12, 'f1'],
    ])
    expect(notesInBar(p, 1).map((n) => [n.pos, n.note])).toEqual([
      [4, 'bb0'],
      [12, 'bb0'],
    ])
    expect(notesInBar(p, 7).map((n) => n.note)).toEqual(['bb0', 'bb0'])
    expect(notesInBar(p, -1).map((n) => n.note)).toEqual(['bb0', 'bb0'])
  })
})

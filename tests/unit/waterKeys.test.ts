import { describe, expect, it } from 'vitest'
import { brightnessAtY, freeWater, keysToHits, nearestChordTone, noteAtX, scaleNotes } from '../../app/lib/waterKeys'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { REGISTER } from '../../app/lib/melody'
import type { StyleId } from '../../app/lib/types'

const STYLES: StyleId[] = ['hiphop90', 'house', 'dnb', 'dembow', 'techno']

describe('teclado de agua: partes puras (spec 015)', () => {
  it('las notas son de la escala del estilo y están en el registro del sinte, de graves a agudas', () => {
    for (const s of STYLES) {
      const n = scaleNotes(s)
      const [lo, hi] = REGISTER[STYLE_MUSIC[s].synth]
      expect(n.length, s).toBeGreaterThan(6)
      expect(n.every((m) => STYLE_MUSIC[s].scale.includes(m % 12) && m >= lo && m <= hi), s).toBe(true)
      expect([...n].sort((a, b) => a - b)).toEqual(n)
    }
  })
  it('de izquierda a derecha sube y cualquier punto da una nota válida (aunque se toque fuera o mal)', () => {
    for (const s of STYLES) {
      const n = scaleNotes(s)
      expect(noteAtX(0, n, s, 0, false)).toBe(n[0])
      expect(noteAtX(1, n, s, 0, false)).toBe(n.at(-1))
      for (const x of [-5, 0.3, 0.77, 3, Number.NaN]) expect(n).toContain(noteAtX(x, n, s, 2, false))
      let prev = -1
      for (let i = 0; i <= 20; i++) { const m = noteAtX(i / 20, n, s, 0, false); expect(m).toBeGreaterThanOrEqual(prev); prev = m }
    }
  })
  it('en los tiempos fuertes se pega al acorde del compás; la más cercana', () => {
    for (const s of STYLES) {
      const n = scaleNotes(s)
      for (let bar = 0; bar < 4; bar++) {
        const ch = STYLE_MUSIC[s].chordTones[bar % STYLE_MUSIC[s].chordTones.length]!
        for (let i = 0; i <= 10; i++) {
          const m = noteAtX(i / 10, n, s, bar, true)
          if (n.some((x) => ch.includes(x % 12))) expect(ch, `${s} compás ${bar}`).toContain(m % 12)
        }
      }
    }
    const s: StyleId = 'techno'
    const n = scaleNotes(s)
    const c = nearestChordTone(s, 0, n[3]!, n)
    expect(STYLE_MUSIC[s].chordTones[0]).toContain(c % 12)
  })
  it('el brillo: arriba brillante, abajo cálido, siempre en su rango', () => {
    expect(brightnessAtY(0)).toBeGreaterThan(brightnessAtY(1))
    expect(brightnessAtY(0)).toBe(9000)
    expect(brightnessAtY(1)).toBe(700)
    expect(brightnessAtY(Number.NaN)).toBe(700)
    expect(brightnessAtY(7)).toBe(700)
  })
  it('lo tocado pasa a un loop de melodía: cuantizado, una nota por paso (gana la última), duración hasta la siguiente y monofónico', () => {
    const h = keysToHits([{ time: 0.01, midi: 60 }, { time: 0.13, midi: 62 }, { time: 0.5, midi: 64 }, { time: 0.51, midi: 65 }], 0, 0.125, 4)
    expect(h.map((x) => [x.pos, x.midi])).toEqual([[0, 60], [1, 62], [4, 65]])
    expect(h[0]!.dur).toBe(1)
    expect(h[1]!.dur).toBe(3)
    for (let i = 0; i < h.length - 1; i++) expect(h[i]!.pos + h[i]!.dur).toBeLessThanOrEqual(h[i + 1]!.pos)
    expect(h.at(-1)!.dur).toBeLessThanOrEqual(4)
  })
  it('una nota tocada tras el final del loop envuelve al principio; sin notas, no hay loop', () => {
    expect(keysToHits([{ time: 64 * 0.125 + 0.26, midi: 60 }], 0, 0.125, 4)[0]!.pos).toBe(2)
    expect(keysToHits([], 0, 0.125)).toEqual([])
  })
  it('el espacio libre: en un móvil vertical queda poco a los lados y bastante abajo; en uno pequeño, casi nada', () => {
    const phone = freeWater({ w: 400, h: 800, top: 120, bottom: 230, cx: 200, cy: 340, R: 175 })
    expect(phone.left).toBeCloseTo(25)
    expect(phone.below).toBeCloseTo(800 - 230 - 515)
    const small = freeWater({ w: 360, h: 640, top: 110, bottom: 220, cx: 180, cy: 300, R: 170 })
    expect(small.usable).toBe(false)
    expect(freeWater({ w: 800, h: 400, top: 20, bottom: 20, cx: 400, cy: 200, R: 150 }).usable).toBe(true)
  })
})

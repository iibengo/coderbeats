import { describe, expect, it } from 'vitest'
import { assistQuantize, laneGrid, templateFor } from '../../app/lib/assist'

describe('assistQuantize', () => {
  it('house: un bombo a 0,75 del 4 (0,25 del 5) cae en la negra', () => {
    expect(assistQuantize(4.75, 'bd', 'house', 1, 16)).toBe(4)
    expect(assistQuantize(7.3, 'bd', 'house', 1, 16)).toBe(8)
  })

  it('dnb (corcheas): una caja cerca del 2 o del 4 cae en el 2 o el 4', () => {
    expect(assistQuantize(4.8, 'sd', 'dnb', 2, 16)).toBe(4)
    expect(assistQuantize(3.2, 'sd', 'dnb', 2, 16)).toBe(4)
    expect(assistQuantize(11.4, 'sd', 'dnb', 2, 16)).toBe(12)
  })

  it('nunca mueve un golpe más de 1 paso', () => {
    for (let pos = 0; pos < 16; pos += 0.1)
      for (const style of ['hiphop90', 'house', 'dnb'] as const)
        for (const inst of ['bd', 'sd', 'hh'] as const) {
          const q = style === 'dnb' ? 2 : 1
          const step = assistQuantize(pos, inst, style, q, 16)
          const d = Math.min(Math.abs(step - pos), Math.abs(step + 16 - pos), Math.abs(step - 16 - pos))
          expect(d).toBeLessThanOrEqual(1 + 1e-9)
        }
  })

  it('un golpe justo en la rejilla se queda donde está aunque el estilo prefiera otro paso', () => {
    expect(assistQuantize(6, 'bd', 'house', 1, 16)).toBe(6)
  })

  it('el final del loop pasa al paso 0', () => {
    expect(assistQuantize(15.8, 'bd', 'house', 1, 16)).toBe(0)
  })
})

describe('templateFor', () => {
  it('plantillas por estilo', () => {
    expect(templateFor('bd', 'house')).toEqual([0, 4, 8, 12])
    expect(templateFor('sd', 'dnb')).toEqual([4, 12])
    expect(templateFor('hh', 'house')).toEqual([2, 6, 10, 14])
    expect(templateFor('hh', 'hiphop90')).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
  })
})

describe('laneGrid (E5.1: la rejilla se adapta al carril)', () => {
  const at = (...p: number[]) => p.map((pos) => ({ pos }))

  it('con golpes solo en la rejilla del estilo, no cambia', () => {
    expect(laneGrid(2, at(0, 2, 4, 6, 8, 12))).toBe(2)
    expect(laneGrid(2, [])).toBe(2)
    expect(laneGrid(2, at(16, 18, 30))).toBe(2) // loops de varios compases
  })

  it('con algún golpe fuera de ella (pasos impares), el carril admite semicorcheas', () => {
    expect(laneGrid(2, at(1, 3, 5, 6, 8))).toBe(1)
    expect(laneGrid(2, at(6, 8, 9))).toBe(1)
    expect(laneGrid(2, at(6, 8, 7.37))).toBe(1) // también decimales (ayuda apagada, o movidos con el dedo)
  })

  it('la rejilla de semicorcheas del estilo no cambia', () => {
    expect(laneGrid(1, at(0, 4, 8))).toBe(1)
  })
})

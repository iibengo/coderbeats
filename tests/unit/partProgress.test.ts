import { describe, expect, it } from 'vitest'
import { borderAngle, partProgress } from '../../app/lib/partProgress'

describe('el progreso de una parte (spec 050)', () => {
  it('cuenta los compases desde que la parte empezó a sonar y da la vuelta al acabar (con Auto entra la siguiente; sin Auto, empieza otra vez)', () => {
    // una parte de 8 compases que empezó en el compás 10
    expect(partProgress(10, 0, 10, 8)).toBe(0)
    expect(partProgress(12, 0.5, 10, 8)).toBeCloseTo(2.5 / 8, 9)
    expect(partProgress(13, 0, 10, 8)).toBeCloseTo(3 / 8, 9)
    expect(partProgress(17, 0.99, 10, 8)).toBeGreaterThan(0.99)
    expect(partProgress(18, 0, 10, 8)).toBe(0) // los 8 compases: vuelve a empezar
    expect(partProgress(21, 0.5, 10, 8)).toBeCloseTo(3.5 / 8, 9) // y sigue en la segunda vuelta
  })
  it('antes de empezar, o con datos raros, no hay progreso', () => {
    expect(partProgress(9, 0.5, 10, 8)).toBe(0)
    expect(partProgress(Number.NaN, 0, 10, 8)).toBe(0)
    expect(partProgress(10, Number.NaN, 10, 8)).toBe(0)
    expect(partProgress(10, 0.5, Number.NaN, 8)).toBe(0)
    expect(partProgress(12, 0, 10, 0)).toBe(0)
    expect(partProgress(12, 0, 10, -3)).toBe(0)
  })
  it('una parte de 1 compás se rellena en cada compás', () => {
    expect(partProgress(5, 0.25, 5, 1)).toBeCloseTo(0.25, 9)
    expect(partProgress(6, 0.25, 5, 1)).toBeCloseTo(0.25, 9)
  })
})

describe('el ángulo del borde (spec 050)', () => {
  it('empieza arriba (0°), acaba dando la vuelta entera (360°) y avanza siempre', () => {
    expect(borderAngle(0, 180, 64)).toBe(0)
    expect(borderAngle(1, 180, 64)).toBe(360)
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const a = borderAngle(i / 100, 180, 64)
      expect(a).toBeGreaterThanOrEqual(prev)
      expect(a).toBeLessThanOrEqual(360)
      prev = a
    }
  })
  it('en un cuadrado, las esquinas y los centros de los lados caen donde toca: 45° a 1/8, 90° a 1/4, 180° a la mitad, 270° a 3/4', () => {
    expect(borderAngle(0.125, 100, 100)).toBeCloseTo(45, 6)
    expect(borderAngle(0.25, 100, 100)).toBeCloseTo(90, 6)
    expect(borderAngle(0.5, 100, 100)).toBeCloseTo(180, 6)
    expect(borderAngle(0.75, 100, 100)).toBeCloseTo(270, 6)
    expect(borderAngle(0.875, 100, 100)).toBeCloseTo(315, 6)
  })
  it('en un botón ancho y bajo, avanza con la longitud del borde y no con el ángulo', () => {
    // 180 × 64: el perímetro es 488; a 0,2 (97,6) está en el lado derecho, un poco por debajo de la esquina: atan2(90, 24,4) ≈ 74,8°
    expect(borderAngle(0.2, 180, 64)).toBeCloseTo((Math.atan2(90, 24.4) * 180) / Math.PI, 6)
    // y justo a 1/4 del perímetro está en el centro del lado derecho: 90°
    expect(borderAngle(0.25, 180, 64)).toBeCloseTo(90, 6)
    // la mitad del perímetro es el centro del lado de abajo: 180° (aunque ya ha recorrido casi todo el borde derecho y el de abajo)
    expect(borderAngle(0.5, 180, 64)).toBeCloseTo(180, 6)
    // la esquina de arriba a la derecha está a (w/2)/perímetro = 90/488
    expect(borderAngle(90 / 488, 180, 64)).toBeCloseTo((Math.atan2(90, 32) * 180) / Math.PI, 6)
  })
  it('datos raros: tamaño cero, negativo o fracción que no es un número dan 0; una fracción fuera de 0..1 se acota', () => {
    expect(borderAngle(0.5, 0, 64)).toBe(0)
    expect(borderAngle(0.5, 180, -1)).toBe(0)
    expect(borderAngle(Number.NaN, 180, 64)).toBe(0)
    expect(borderAngle(-3, 180, 64)).toBe(0)
    expect(borderAngle(7, 180, 64)).toBe(360)
  })
})

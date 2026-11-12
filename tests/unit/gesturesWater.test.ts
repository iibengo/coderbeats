import { describe, expect, it } from 'vitest'
import { dragValue, filterDjf, lockAxis, spaceParams, warmthShape } from '../../app/lib/gestures'
import { drop, energy, waveStep } from '../../app/lib/water'

describe('gestos', () => {
  it('fija el eje tras 12 px según la dirección dominante', () => {
    expect(lockAxis(5, 6)).toBeNull()
    expect(lockAxis(3, -14)).toBe('y')
    expect(lockAxis(20, 5)).toBe('x')
  })

  it('arrastre: arriba sube el filtro, derecha sube el espacio; la pantalla entera = rango completo', () => {
    expect(dragValue(0.5, 'y', -400, 800)).toBe(1)
    expect(dragValue(0.5, 'y', 200, 800)).toBe(0.25)
    expect(dragValue(0.2, 'x', 100, 400)).toBeCloseTo(0.45, 9)
    expect(dragValue(0.9, 'x', 1000, 400)).toBe(1)
    expect(dragValue(0.1, 'x', -1000, 400)).toBe(0)
  })

  it('mapeos', () => {
    expect(filterDjf(1)).toBe(0.5)
    expect(filterDjf(0)).toBe(0.1)
    expect(filterDjf(0.5)).toBe(0.3)
    expect(spaceParams(1)).toEqual({ room: 0.6, delay: 0.35 })
    expect(spaceParams(0)).toEqual({ room: 0, delay: 0 })
    expect(warmthShape(1)).toBe(0.5)
  })
})

describe('kernel de onda', () => {
  const W = 41
  const H = 41

  it('una gota central genera ondas simétricas', () => {
    let prev = new Float32Array(W * H)
    let cur = new Float32Array(W * H)
    drop(cur, W, H, 20, 20, 2, 1)
    for (let i = 0; i < 10; i++) {
      const next = waveStep(prev, cur, W, H, 0.99)
      prev = cur
      cur = next
    }
    const at = (x: number, y: number) => cur[y * W + x]!
    expect(at(20 + 7, 20)).toBeCloseTo(at(20 - 7, 20), 5)
    expect(at(20, 20 + 7)).toBeCloseTo(at(20 + 7, 20), 5)
    expect(Math.abs(at(27, 20))).toBeGreaterThan(1e-4)
  })

  it('la energía se amortigua', () => {
    let prev = new Float32Array(W * H)
    let cur = new Float32Array(W * H)
    drop(cur, W, H, 20, 20, 2, 1)
    const e0 = energy(cur)
    for (let i = 0; i < 300; i++) {
      const next = waveStep(prev, cur, W, H, 0.98)
      prev = cur
      cur = next
    }
    expect(energy(cur)).toBeLessThan(e0 * 0.05)
  })
})

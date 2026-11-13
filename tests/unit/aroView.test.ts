import { describe, expect, it } from 'vitest'
import {
  approachTilt,
  followBase,
  parallaxOffset,
  PARALLAX_MAX,
  TILT,
  TILT_AFTER_S,
  tiltTarget,
  toFront,
  toScreen,
} from '../../app/lib/aro/view'

describe('inclinación al soltar (E3.5)', () => {
  it('de frente mientras tocas y los primeros segundos; después, inclinado', () => {
    expect(tiltTarget(0.5, false, false)).toBe(1)
    expect(tiltTarget(TILT_AFTER_S + 1, true, false)).toBe(1)
    expect(tiltTarget(TILT_AFTER_S + 1, false, false)).toBe(TILT)
  })
  it('sin inclinación con movimiento reducido', () => {
    expect(tiltTarget(60, false, true)).toBe(1)
  })
  it('se inclina despacio y vuelve de frente en unos 0,3 s', () => {
    let sy = 1
    for (let i = 0; i < 18; i++) sy = approachTilt(sy, TILT, 1 / 60) // 0,3 s
    expect(sy).toBeGreaterThan(TILT + (1 - TILT) * 0.6) // aún lejos de inclinado
    let back = TILT
    for (let i = 0; i < 18; i++) back = approachTilt(back, 1, 1 / 60)
    expect(back).toBeGreaterThan(0.98)
  })
})

describe('tocar con el aro inclinado o desplazado', () => {
  const v = { sy: TILT, ox: 7, oy: -5 }
  it('toFront es el inverso de toScreen', () => {
    const [sx, sy] = toScreen(120, 300, v, 195, 380)
    const [x, y] = toFront(sx, sy, v, 195, 380)
    expect(x).toBeCloseTo(120)
    expect(y).toBeCloseTo(300)
  })
  it('de frente y sin parallax no cambia nada', () => {
    expect(toFront(10, 20, { sy: 1, ox: 0, oy: 0 }, 195, 380)).toEqual([10, 20])
  })
})

describe('giroscopio (E3.6)', () => {
  it('desplaza poco y nunca más de 12 px', () => {
    const base = { beta: 40, gamma: 0 }
    expect(parallaxOffset({ beta: 45, gamma: 5 }, base)).toEqual({ ox: 3, oy: 3 })
    const far = parallaxOffset({ beta: 140, gamma: -90 }, base)
    expect(far.oy).toBe(PARALLAX_MAX)
    expect(far.ox).toBe(-PARALLAX_MAX)
  })
  it('el reposo sigue despacio a cómo sujetas el móvil', () => {
    let base = followBase(null, { beta: 40, gamma: 0 }, 1 / 60)
    expect(base).toEqual({ beta: 40, gamma: 0 })
    for (let i = 0; i < 60; i++) base = followBase(base, { beta: 60, gamma: 0 }, 1 / 60)
    expect(base.beta).toBeGreaterThan(40)
    expect(base.beta).toBeLessThan(50)
  })
})

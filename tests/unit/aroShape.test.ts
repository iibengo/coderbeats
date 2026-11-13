import { describe, expect, it } from 'vitest'
import { allWeights, bandAt, bandLayout, bandMid, stepWeights, BAND_ORDER } from '../../app/lib/aro/bands'
import {
  angleStep,
  bumpAt,
  bumpEnvelope,
  FULL_BAR_GAP,
  noteArc,
  locate,
  outerRadius,
  pointAt,
  smin,
  stepAngle,
  TAU,
  wallDistance,
  WALL_GAP,
  type DropGeo,
} from '../../app/lib/aro/shape'

const phone: DropGeo = { cx: 195, cy: 380, R: 150, core: 24, free: { x0: 0, y0: 60, x1: 390, y1: 700 } }

describe('smin', () => {
  it('nunca pasa del mínimo y se le acerca cuando los valores están lejos', () => {
    for (const [a, b] of [
      [10, 200],
      [100, 100],
      [5000, 3],
    ] as const) {
      expect(smin(a, b, 16)).toBeLessThanOrEqual(Math.min(a, b))
    }
    expect(smin(10, 400, 16)).toBeCloseTo(10, 3)
    expect(smin(100, 100, 16)).toBeCloseTo(100 - 16 * Math.log(2), 6)
  })
  it('no se desborda con valores grandes', () => {
    expect(Number.isFinite(smin(1e6, 2e6, 16))).toBe(true)
  })
})

describe('wallDistance', () => {
  it('mide hasta el lado del rectángulo libre en cada dirección', () => {
    expect(wallDistance(0, phone)).toBeCloseTo(195 - WALL_GAP)
    expect(wallDistance(Math.PI, phone)).toBeCloseTo(195 - WALL_GAP)
    expect(wallDistance(-Math.PI / 2, phone)).toBeCloseTo(320 - WALL_GAP)
    expect(wallDistance(Math.PI / 2, phone)).toBeCloseTo(320 - WALL_GAP)
  })
})

describe('outerRadius', () => {
  it('nunca cruza el rectángulo libre, aunque la gota sea más grande que la pantalla', () => {
    const big = { ...phone, R: 400 }
    for (let t = 0; t < 20; t += 1.3)
      for (let k = 0; k < 360; k++) {
        const th = (k / 360) * TAU
        const [x, y] = pointAt(th, 1, big, t)
        expect(x).toBeGreaterThanOrEqual(big.free.x0)
        expect(x).toBeLessThanOrEqual(big.free.x1)
        expect(y).toBeGreaterThanOrEqual(big.free.y0)
        expect(y).toBeLessThanOrEqual(big.free.y1)
      }
  })
  it('lejos de las paredes es una gota que respira alrededor de R', () => {
    const small = { ...phone, R: 100 }
    for (let k = 0; k < 64; k++) {
      const r = outerRadius((k / 64) * TAU, small, 3)
      expect(r).toBeGreaterThan(100 * 0.94)
      expect(r).toBeLessThan(100 * 1.06)
    }
  })
  it('sin respiración no cambia con el tiempo (movimiento reducido)', () => {
    expect(outerRadius(1, phone, 0, 0)).toBe(outerRadius(1, phone, 9, 0))
  })
  it('es continua: dos ángulos vecinos dan radios parecidos (sin esquinas)', () => {
    const big = { ...phone, R: 400 }
    for (let k = 0; k < 720; k++) {
      const a = outerRadius((k / 720) * TAU, big, 2)
      const b = outerRadius(((k + 1) / 720) * TAU, big, 2)
      expect(Math.abs(a - b)).toBeLessThan(6)
    }
  })
})

describe('locate', () => {
  it('es el inverso de pointAt (sin ondulación interior)', () => {
    for (const [th, u] of [
      [0.3, 0.5],
      [-1.2, 0.1],
      [2.8, 0.95],
    ] as const) {
      const [x, y] = pointAt(th, u, phone, 4, undefined, 0)
      const p = locate(x, y, phone, 4)
      expect(p.th).toBeCloseTo(th, 6)
      expect(p.u).toBeCloseTo(u, 6)
    }
  })
  it('el centro da u < 0 y fuera de la gota u > 1', () => {
    expect(locate(phone.cx + 3, phone.cy, phone, 0).u).toBeLessThan(0)
    expect(locate(phone.cx + 300, phone.cy, phone, 0).u).toBeGreaterThan(1)
  })
})

describe('pasos y ángulos', () => {
  it('el paso 0 está arriba y el 4 a la derecha', () => {
    expect(stepAngle(0)).toBeCloseTo(-Math.PI / 2)
    expect(stepAngle(4)).toBeCloseTo(0)
  })
  it('angleStep es el inverso de stepAngle en 0..16', () => {
    for (const s of [0, 1, 3.5, 8, 15.9]) expect(angleStep(stepAngle(s))).toBeCloseTo(s, 6)
  })
})

describe('franjas', () => {
  it('reparten 0..1 en el orden bombo, bajo, caja, melodía, platillo', () => {
    const l = bandLayout(allWeights(1))
    expect(BAND_ORDER).toEqual(['bd', 'bass', 'sd', 'mel', 'hh'])
    expect(l.bd.a).toBe(0)
    expect(l.hh.b).toBeCloseTo(1)
    expect(l.bass.a).toBeCloseTo(l.bd.b)
    expect(l.bd.b).toBeCloseTo(0.2)
  })
  it('una franja oculta no ocupa sitio y no se puede tocar', () => {
    const w = { ...allWeights(1), bass: 0, mel: 0 }
    const l = bandLayout(w)
    expect(l.bass.b - l.bass.a).toBe(0)
    expect(l.sd.a).toBeCloseTo(1 / 3)
    expect(bandAt(bandMid('sd', l), l, w)).toBe('sd')
    expect(bandAt(0.999, l, w)).toBe('hh')
    expect(bandAt(1.2, l, w)).toBeNull()
  })
  it('la transición es suave, no depende de los fps y llega al objetivo', () => {
    const from = { ...allWeights(1), bass: 0 }
    const to = allWeights(1)
    let a = from
    for (let i = 0; i < 6; i++) a = stepWeights(a, to, 1 / 60)
    let b = from
    for (let i = 0; i < 3; i++) b = stepWeights(b, to, 1 / 30)
    expect(a.bass).toBeGreaterThan(0)
    expect(a.bass).toBeLessThan(0.5)
    expect(a.bass).toBeCloseTo(b.bass, 6)
    let c = from
    for (let i = 0; i < 120; i++) c = stepWeights(c, to, 1 / 60)
    expect(c.bass).toBe(1)
    expect(stepWeights(from, to, 1 / 60, true).bass).toBe(1)
  })
})

describe('latido del bombo en el borde', () => {
  it('empuja solo cerca de su ángulo y nunca hace cruzar la pared', () => {
    const bumps = [{ th: 0, a: 9 }]
    expect(bumpAt(0, bumps)).toBeCloseTo(9)
    expect(bumpAt(Math.PI, bumps)).toBeLessThan(0.01)
    expect(bumpAt(TAU - 0.01, bumps)).toBeGreaterThan(8) // da la vuelta
    const pressed = { ...phone, R: 400 }
    expect(outerRadius(0, pressed, 0, 0, 9)).toBeLessThanOrEqual(wallDistance(0, pressed))
    expect(outerRadius(0, phone, 0, 0, 9)).toBeGreaterThan(outerRadius(0, phone, 0, 0))
  })
  it('la envolvente sube, baja y termina en cero', () => {
    expect(bumpEnvelope(0)).toBe(0)
    expect(bumpEnvelope(0.3)).toBeGreaterThan(0.4)
    expect(bumpEnvelope(1)).toBe(0)
  })
})

describe('noteArc (E3.1)', () => {
  it('el arco mide lo que dura la nota', () => {
    const { a0, a1 } = noteArc(4, 4)
    expect(a0).toBeCloseTo(stepAngle(4))
    expect(a1 - a0).toBeCloseTo(TAU / 4)
  })
  it('una nota de todo el compás deja un hueco antes de su inicio', () => {
    const { a0, a1 } = noteArc(0, 16)
    expect(a1 - a0).toBeLessThan(TAU)
    expect(TAU - (a1 - a0)).toBeCloseTo((FULL_BAR_GAP / 16) * TAU)
  })
  it('nunca mide menos de un cuarto de paso', () => {
    const { a0, a1 } = noteArc(3, 0)
    expect(a1 - a0).toBeCloseTo((0.25 / 16) * TAU)
  })
})

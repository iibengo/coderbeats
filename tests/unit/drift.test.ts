import { describe, expect, it } from 'vitest'
import { spawnPoint, stepDrift, type Body, type DriftBounds } from '../../app/lib/drift'

const bounds: DriftBounds = {
  w: 390,
  h: 844,
  margin: 16,
  avoid: [
    { x: 195, y: 380, r: 120 }, // anillo
    { x: 195, y: 780, r: 40 }, // Play
  ],
}

function simulate(bodies: Body[], seconds: number): Body[] {
  let b = bodies
  for (let t = 0; t < seconds; t += 1 / 60) b = stepDrift(b, 1 / 60, t, bounds)
  return b
}

describe('stepDrift', () => {
  const start: Body[] = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, x: 195 + i, y: 380 + i, vx: 0, vy: 0, r: 18 }))

  it('tras un rato, todos dentro de la pantalla, fuera de las zonas y sin solaparse', () => {
    const end = simulate(start, 30)
    for (const p of end) {
      expect(p.x).toBeGreaterThan(bounds.margin - 2)
      expect(p.x).toBeLessThan(bounds.w - bounds.margin + 2)
      expect(p.y).toBeGreaterThan(bounds.margin - 2)
      expect(p.y).toBeLessThan(bounds.h - bounds.margin + 2)
      for (const z of bounds.avoid) expect(Math.hypot(p.x - z.x, p.y - z.y)).toBeGreaterThan(z.r + p.r - 8)
    }
    for (let i = 0; i < end.length; i++)
      for (let j = i + 1; j < end.length; j++)
        expect(Math.hypot(end[i]!.x - end[j]!.x, end[i]!.y - end[j]!.y)).toBeGreaterThan(end[i]!.r + end[j]!.r - 4)
  })

  it('es lento y determinista', () => {
    const a = simulate(start, 5)
    const b = simulate(start, 5)
    expect(a).toEqual(b)
    for (const p of a) expect(Math.hypot(p.vx, p.vy)).toBeLessThanOrEqual(18 + 1e-9)
  })
})

describe('spawnPoint', () => {
  it('cae lejos de los loops y de las zonas reservadas', () => {
    const bodies = [{ x: 60, y: 100, r: 18 }]
    const p = spawnPoint(bodies, bounds, 18)
    expect(Math.hypot(p.x - 60, p.y - 100)).toBeGreaterThan(100)
    for (const z of bounds.avoid) expect(Math.hypot(p.x - z.x, p.y - z.y)).toBeGreaterThan(z.r + 18)
    expect(p.x).toBeGreaterThan(bounds.margin)
    expect(p.y).toBeLessThan(bounds.h - bounds.margin)
  })
})

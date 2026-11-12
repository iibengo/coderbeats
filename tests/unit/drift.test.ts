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

describe('órbita alrededor del anillo (§16.18)', () => {
  const desk: DriftBounds = {
    w: 1440,
    h: 761,
    margin: 16,
    avoid: [
      { x: 720, y: 327, r: 186 },
      { x: 720, y: 705, r: 52 },
    ],
    orbit: { x: 720, y: 327, r: 200, band: 90 },
  }

  it('los loops nacen en la banda alrededor del anillo, no en una esquina', () => {
    const bodies: { x: number; y: number; r: number }[] = []
    for (let i = 0; i < 8; i++) {
      const p = spawnPoint(bodies, desk, 18)
      const d = Math.hypot(p.x - 720, p.y - 327)
      expect(d).toBeGreaterThanOrEqual(200 - 1)
      expect(d).toBeLessThanOrEqual(290 + 1)
      bodies.push({ ...p, r: 18 })
    }
  })

  it('y se quedan flotando en ella (y giran)', () => {
    let b: Body[] = []
    for (let i = 0; i < 6; i++) {
      const p = spawnPoint(b, desk, 18)
      b.push({ id: i + 1, x: p.x, y: p.y, vx: 0, vy: 0, r: 18 })
    }
    const start = b.map((p) => Math.atan2(p.y - 327, p.x - 720))
    for (let t = 0; t < 30; t += 1 / 60) b = stepDrift(b, 1 / 60, t, desk)
    for (const p of b) {
      const d = Math.hypot(p.x - 720, p.y - 327)
      expect(d).toBeGreaterThan(190)
      expect(d).toBeLessThan(310)
    }
    const moved = b.map((p, i) => Math.abs(Math.atan2(p.y - 327, p.x - 720) - start[i]!))
    expect(Math.max(...moved)).toBeGreaterThan(0.05)
  })
})

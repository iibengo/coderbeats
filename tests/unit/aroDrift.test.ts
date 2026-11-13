import { describe, expect, it } from 'vitest'
import {
  Drift,
  driftTargets,
  GLIDE_MAX,
  GLIDE_TAU,
  glideEnd,
  linkedIds,
  OFFSET_MAX,
  PULL,
  REPEL_DIST,
  REST_SPRING,
  releaseVelocity,
  stepBody,
  type Body,
} from '../../app/lib/aro/drift'

const cell = (id: number, x: number, y = 0) => ({ id, at: { x, y } })
const run = (b: Body, target: { x: number; y: number }, seconds: number, step = 1 / 60) => {
  const path: number[] = []
  for (let t = 0; t < seconds; t += step) {
    stepBody(b, target, step, REST_SPRING)
    path.push(b.x)
  }
  return path
}

describe('inercia al soltar', () => {
  const trail = (dx: number, ms: number, now = 1000) => [
    { t: now - ms, x: 0, y: 0 },
    { t: now - ms / 2, x: dx / 2, y: 0 },
    { t: now, x: dx, y: 0 },
  ]

  it('la velocidad sale de los últimos 100 ms y se limita para no deslizarse más de 2,5 radios', () => {
    expect(releaseVelocity(trail(0.4, 80), 1000).x).toBeCloseTo(5, 3)
    const fast = releaseVelocity(trail(5, 80), 1000)
    expect(Math.hypot(fast.x, fast.y) * GLIDE_TAU).toBeCloseTo(GLIDE_MAX, 5)
  })

  it('si el dedo estaba parado o hay pocas muestras, no hay inercia', () => {
    expect(releaseVelocity(trail(1, 80, 1000), 1200)).toEqual({ x: 0, y: 0 }) // última muestra vieja
    expect(releaseVelocity([{ t: 990, x: 0, y: 0 }], 1000)).toEqual({ x: 0, y: 0 })
    expect(releaseVelocity([], 1000)).toEqual({ x: 0, y: 0 })
    expect(releaseVelocity([{ t: 995, x: 0, y: 0 }, { t: 1000, x: 1, y: 0 }], 1000)).toEqual({ x: 0, y: 0 }) // intervalo demasiado corto
  })

  it('al soltar con velocidad v la célula acaba v·τ más allá, y llega frenando sola', () => {
    const v = { x: 4, y: -2 }
    const from = { x: 3, y: 1 }
    const end = glideEnd(from, v)
    expect(end.x).toBeCloseTo(3 + 4 * GLIDE_TAU)
    expect(end.y).toBeCloseTo(1 - 2 * GLIDE_TAU)
    // simulación: el desplazamiento parte de (soltado − final) y llega a 0 sin pasarse
    const b: Body = { x: from.x - end.x, y: from.y - end.y, vx: v.x, vy: v.y, glide: true }
    let prev = Math.abs(b.x)
    for (let i = 0; i < 90; i++) {
      stepBody(b, { x: 0, y: 0 }, 1 / 60)
      expect(Math.abs(b.x)).toBeLessThanOrEqual(prev + 1e-9)
      prev = Math.abs(b.x)
    }
    expect(Math.abs(b.x)).toBeLessThan(0.02)
    expect(Math.abs(b.y)).toBeLessThan(0.02)
    expect(b.vx * b.vx + b.vy * b.vy).toBeLessThan(0.05)
  })
})

describe('vuelta con vaivén', () => {
  it('vuelve a su sitio con un pequeño rebote, sin pasarse mucho, y se para', () => {
    const b: Body = { x: 1, y: 0, vx: 0, vy: 0, glide: false }
    const path = run(b, { x: 0, y: 0 }, 3)
    expect(Math.min(...path)).toBeLessThan(0) // pasa de largo: vaivén
    expect(Math.min(...path)).toBeGreaterThan(-0.3) // pero poco (menos del 30 %)
    expect(Math.abs(b.x)).toBeLessThan(0.005)
    expect(Math.abs(b.vx)).toBeLessThan(0.01)
  })

  it('es estable con pasos grandes (un frame lento)', () => {
    const b: Body = { x: 1, y: 1, vx: 0, vy: 0, glide: false }
    for (let i = 0; i < 40; i++) stepBody(b, { x: 0, y: 0 }, 0.05)
    expect(Math.hypot(b.x, b.y)).toBeLessThan(0.01)
  })
})

describe('arrastrar: hilo elástico y apartarse', () => {
  const cells = [cell(1, 0), cell(2, 3), cell(3, 6), cell(4, 9)]

  it('las unidas por hilo se llevan una fracción de lo que se mueve la arrastrada', () => {
    const t = driftTargets(cells, { id: 2, x: 3, y: 5, from: { x: 3, y: 0 } }, [1, 3])
    expect(t.get(1)!.y).toBeCloseTo(5 * PULL)
    expect(t.get(3)!.y).toBeCloseTo(5 * PULL)
    expect(t.has(4)).toBe(false) // la que no está unida ni cerca no se entera
    expect(t.has(2)).toBe(false) // la arrastrada va con el dedo
  })

  it('el hilo no tira más de lo debido', () => {
    const t = driftTargets(cells, { id: 2, x: 3, y: 80, from: { x: 3, y: 0 } }, [1])
    expect(Math.hypot(t.get(1)!.x, t.get(1)!.y)).toBeLessThanOrEqual(1 + 1e-9)
  })

  it('las cercanas se apartan, hacia fuera y más cuanto más se acerca', () => {
    const far = driftTargets(cells, { id: 2, x: 3 + 2, y: 0, from: { x: 3, y: 0 } }, [])
    expect(far.has(3)).toBe(true)
    expect(far.get(3)!.x).toBeGreaterThan(0) // 3 está a la derecha: la empuja hacia la derecha
    const close = driftTargets(cells, { id: 2, x: 5, y: 0, from: { x: 3, y: 0 } }, [])
    const closer = driftTargets(cells, { id: 2, x: 5.8, y: 0, from: { x: 3, y: 0 } }, [])
    expect(closer.get(3)!.x).toBeGreaterThan(close.get(3)!.x)
    expect(REPEL_DIST).toBeGreaterThan(2) // por encima de tocarse
  })

  it('nunca se desplazan más del máximo, ni siquiera encima de otra', () => {
    const t = driftTargets(cells, { id: 2, x: 6, y: 0, from: { x: 3, y: 0 } }, [3])
    expect(Math.hypot(t.get(3)!.x, t.get(3)!.y)).toBeLessThanOrEqual(OFFSET_MAX + 1e-9)
  })
})

describe('Drift', () => {
  const cells = [cell(1, 0), cell(2, 3), cell(3, 6)]

  it('sin movimiento no hay nada activo ni desplazamientos', () => {
    const d = new Drift()
    d.step(1 / 60, cells, null, [], false)
    expect(d.active).toBe(false)
    expect(d.offset(1)).toEqual({ x: 0, y: 0 })
  })

  it('arrastrando, las vecinas se desplazan; al soltar vuelven y la física se apaga sola', () => {
    const d = new Drift()
    for (let i = 0; i < 60; i++) d.step(1 / 60, cells, { id: 2, x: 3, y: 6, from: { x: 3, y: 0 } }, [1, 3], false)
    expect(d.active).toBe(true)
    expect(d.offset(1).y).toBeGreaterThan(0.3)
    expect(d.offset(3).y).toBeGreaterThan(0.3)
    expect(d.offset(2)).toEqual({ x: 0, y: 0 }) // la arrastrada no lleva desplazamiento propio
    for (let i = 0; i < 240; i++) d.step(1 / 60, cells, null, [], false)
    expect(d.active).toBe(false)
    expect(d.offset(1)).toEqual({ x: 0, y: 0 })
  })

  it('la célula movida se desliza y se frena sola', () => {
    const d = new Drift()
    d.glide(2, { x: -1, y: 0 }, { x: 2.857, y: 0 })
    d.step(1 / 60, cells, null, [], false)
    expect(d.offset(2).x).toBeGreaterThan(-1)
    for (let i = 0; i < 240; i++) d.step(1 / 60, cells, null, [], false)
    expect(d.active).toBe(false)
  })

  it('con movimiento reducido no hay física', () => {
    const d = new Drift()
    d.glide(2, { x: -1, y: 0 }, { x: 2, y: 0 })
    d.step(1 / 60, cells, { id: 1, x: 0, y: 5, from: { x: 0, y: 0 } }, [2], true)
    expect(d.active).toBe(false)
    expect(d.offset(2)).toEqual({ x: 0, y: 0 })
  })

  it('olvida las células que ya no existen', () => {
    const d = new Drift()
    d.glide(9, { x: 1, y: 0 }, { x: 0, y: 0 })
    d.step(1 / 60, cells, null, [], false)
    expect(d.offset(9)).toEqual({ x: 0, y: 0 })
    expect(d.active).toBe(false)
  })
})

describe('linkedIds', () => {
  it('la anterior y la siguiente en el orden, sin cerrar el círculo', () => {
    expect(linkedIds([4, 1, 3, 2], 1)).toEqual([4, 3])
    expect(linkedIds([4, 1, 3, 2], 4)).toEqual([1])
    expect(linkedIds([4, 1, 3, 2], 2)).toEqual([3])
    expect(linkedIds([4, 1, 3, 2], 9)).toEqual([])
    expect(linkedIds([7], 7)).toEqual([])
  })
})

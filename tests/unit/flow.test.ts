import { describe, expect, it } from 'vitest'
import { TRAIL_LIFE, TRAIL_MAX, VEIN_MAX, trailAlpha, trailPrune, trailPush, veinDots, type TrailPoint, type VeinSeg } from '../../app/lib/flow'

describe('estela del dedo', () => {
  it('un dedo quieto no llena la estela; moverse sí; lo viejo se quita', () => {
    const tr: TrailPoint[] = []
    trailPush(tr, 10, 10, 0)
    trailPush(tr, 11, 10, 0.01)
    expect(tr).toHaveLength(1)
    trailPush(tr, 40, 10, 0.02)
    expect(tr).toHaveLength(2)
    trailPrune(tr, TRAIL_LIFE + 0.015)
    expect(tr).toHaveLength(1)
    trailPrune(tr, 5)
    expect(tr).toHaveLength(0)
  })
  it('tope duro de puntos y valores raros ignorados', () => {
    const tr: TrailPoint[] = []
    for (let i = 0; i < 200; i++) trailPush(tr, i * 10, 0, i * 0.001)
    expect(tr.length).toBeLessThanOrEqual(TRAIL_MAX)
    const n = tr.length
    trailPush(tr, Number.NaN, 5, 0.3)
    expect(tr).toHaveLength(n)
  })
  it('la opacidad baja de 1 a 0', () => {
    expect(trailAlpha({ x: 0, y: 0, t: 1 }, 1)).toBe(1)
    expect(trailAlpha({ x: 0, y: 0, t: 1 }, 1 + TRAIL_LIFE)).toBe(0)
    expect(trailAlpha({ x: 0, y: 0, t: 1 }, 99)).toBe(0)
  })
})

const thread = (from: number, to: number, x0: number): VeinSeg[] => [
  { fromId: from, toId: to, a: { x: x0, y: 0 }, b: { x: x0 + 50, y: 0 } },
  { fromId: from, toId: to, a: { x: x0 + 50, y: 0 }, b: { x: x0 + 100, y: 0 } },
]
describe('venas', () => {
  it('reparte las partículas por hilo, dentro del hilo y corriendo hacia el destino', () => {
    const segs = [...thread(1, 2, 0), ...thread(2, 3, 200)]
    const a = veinDots(segs, 0)
    expect(a).toHaveLength(6)
    expect(a.slice(0, 3).every((d) => d.x >= 0 && d.x <= 100)).toBe(true)
    expect(a.slice(3).every((d) => d.x >= 200 && d.x <= 300)).toBe(true)
    const b = veinDots(segs, 0.5)
    expect(b[0]!.x).not.toBe(a[0]!.x)
    // más tarde, más cerca del destino (salvo al dar la vuelta)
    expect(veinDots(segs, 0.1)[0]!.x).toBeGreaterThan(a[0]!.x)
  })
  it('sin hilos, o con hilos de longitud cero, no hay partículas; hay tope', () => {
    expect(veinDots([], 3)).toEqual([])
    expect(veinDots([{ fromId: 1, toId: 2, a: { x: 5, y: 5 }, b: { x: 5, y: 5 } }], 1)).toEqual([])
    const many = Array.from({ length: 100 }, (_, i) => thread(i, i + 1, i * 300)).flat()
    expect(veinDots(many, 1).length).toBeLessThanOrEqual(VEIN_MAX)
  })
  it('es determinista', () => {
    const segs = thread(1, 2, 0)
    expect(veinDots(segs, 1.234)).toEqual(veinDots(segs, 1.234))
  })
})

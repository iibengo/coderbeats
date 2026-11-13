import { describe, expect, it } from 'vitest'
import {
  approachBlend,
  quadAt,
  threadControl,
  threadPairs,
  backToFront,
  depthAlpha,
  depthParallax,
  depthScale,
  boundsCenter,
  clampCam,
  mixCam,
  panBy,
  cellAtPoint,
  colonyCam,
  colonyMinZoom,
  COLONY_ENTER,
  COLONY_MIN_CAP,
  crowdAlpha,
  fitZoom,
  inColony,
  settleZoom,
} from '../../app/lib/aro/colony'

const free = { x0: 8, y0: 52, x1: 382, y1: 700 } // móvil en vertical: 374 × 648
const demo = [0, 1, 2, 3].map((i) => ({ x: i * 3, y: Math.sin(i * 1.3) * 1.2 }))

describe('colonia: modo y ajuste', () => {
  it('colonia solo con varias células y por debajo del umbral', () => {
    expect(inColony(0.39, 4)).toBe(true)
    expect(inColony(0.4, 4)).toBe(false)
    expect(inColony(0.45, 4)).toBe(false)
    expect(inColony(0.2, 1)).toBe(false)
  })

  it('el mínimo ajusta todas las células en el rectángulo libre', () => {
    const z = fitZoom(demo, free)
    const R = z * (374 / 2)
    const w = (9 + 2) * R // ancho del conjunto: 9 radios entre centros + 2
    expect(w).toBeLessThanOrEqual(374 * 0.9 + 1e-6)
    expect(w).toBeCloseTo(374 * 0.9, 3)
    expect(colonyMinZoom(demo, free)).toBe(z)
  })

  it('con pocas células cercanas, el mínimo no pasa del tope; con muchas, baja', () => {
    expect(colonyMinZoom([{ x: 0, y: 0 }, { x: 1.5, y: 0 }], free)).toBe(COLONY_MIN_CAP)
    const many = Array.from({ length: 16 }, (_, i) => ({ x: i * 3, y: 0 }))
    expect(colonyMinZoom(many, free)).toBeLessThan(0.1)
    expect(colonyMinZoom(many, free)).toBeGreaterThanOrEqual(0.03)
  })

  it('al soltar entre 0,5 y el umbral vuelve a cerca; por debajo se queda en la colonia', () => {
    expect(settleZoom(0.45, 0.5)).toBe(0.5)
    expect(settleZoom(0.41, 0.5)).toBe(0.5)
    expect(settleZoom(0.39, 0.5)).toBe(0.39)
    expect(settleZoom(0.8, 0.5)).toBe(0.8)
  })
})

describe('colonia: cámara y aparición', () => {
  it('las demás células se funden entre 0,46 y 0,34', () => {
    expect(crowdAlpha(0.5)).toBe(0)
    expect(crowdAlpha(0.46)).toBe(0)
    expect(crowdAlpha(0.34)).toBe(1)
    expect(crowdAlpha(0.2)).toBe(1)
    expect(crowdAlpha(0.4)).toBeGreaterThan(0)
    expect(crowdAlpha(0.4)).toBeLessThan(1)
  })

  it('la cámara sigue a la que suena y, con todo ajustado, está en el centro del conjunto', () => {
    const follow = { x: 6, y: 0 }
    const center = boundsCenter(demo)
    expect(center.x).toBe(4.5)
    expect(colonyCam(follow, center, 0.45, 0.2)).toEqual(follow)
    expect(colonyCam(follow, center, COLONY_ENTER, 0.2)).toEqual(follow)
    expect(colonyCam(follow, center, 0.2, 0.2)).toEqual(center)
    const mid = colonyCam(follow, center, 0.3, 0.2)
    expect(mid.x).toBeLessThan(6)
    expect(mid.x).toBeGreaterThan(4.5)
  })
})

describe('colonia: tocar una célula', () => {
  const discs = [
    { id: 1, x: 100, y: 300, r: 30 },
    { id: 2, x: 190, y: 300, r: 30 },
    { id: 3, x: 300, y: 300, r: 4 },
  ]
  it('elige la célula bajo el dedo; fuera de todas, ninguna', () => {
    expect(cellAtPoint(110, 310, discs)).toBe(1)
    expect(cellAtPoint(195, 295, discs)).toBe(2)
    expect(cellAtPoint(145, 150, discs)).toBeNull()
  })
  it('las muy pequeñas se pueden tocar igual (radio mínimo de 22 px)', () => {
    expect(cellAtPoint(300 + 18, 300, discs)).toBe(3)
    expect(cellAtPoint(300 + 30, 300, discs)).toBeNull()
  })
  it('si dos se pisan, la más cercana al dedo', () => {
    const close = [{ id: 1, x: 100, y: 100, r: 40 }, { id: 2, x: 130, y: 100, r: 40 }]
    expect(cellAtPoint(122, 100, close)).toBe(2)
  })
})

describe('colonia: mover el mapa', () => {
  it('el mapa va con el dedo: arrastrar a la derecha lleva la cámara a la izquierda', () => {
    expect(panBy({ x: 4, y: 1 }, 60, -30, 30)).toEqual({ x: 2, y: 2 })
    expect(panBy({ x: 0, y: 0 }, 10, 10, 0).x).toBeCloseTo(-10) // radio mínimo 1: nunca divide por cero
  })

  it('la cámara no sale del conjunto más 3 radios', () => {
    const pts = [{ x: 0, y: 0 }, { x: 9, y: 2 }]
    expect(clampCam({ x: 40, y: -40 }, pts)).toEqual({ x: 12, y: -3 })
    expect(clampCam({ x: -40, y: 40 }, pts)).toEqual({ x: -3, y: 5 })
    expect(clampCam({ x: 4, y: 1 }, pts)).toEqual({ x: 4, y: 1 })
  })

  it('la mezcla va de la cámara automática a la del dedo, sin saltos', () => {
    expect(mixCam({ x: 0, y: 0 }, { x: 10, y: 4 }, 0)).toEqual({ x: 0, y: 0 })
    expect(mixCam({ x: 0, y: 0 }, { x: 10, y: 4 }, 0.5)).toEqual({ x: 5, y: 2 })
    expect(mixCam({ x: 0, y: 0 }, { x: 10, y: 4 }, 1)).toEqual({ x: 10, y: 4 })
    expect(mixCam({ x: 1, y: 1 }, null, 1)).toEqual({ x: 1, y: 1 })
    expect(approachBlend(0, 1, 0.15)).toBeGreaterThan(0.5)
    expect(approachBlend(0, 1, 0.15)).toBeLessThan(0.7)
    expect(approachBlend(0, 1, 1, true)).toBe(1)
    expect(approachBlend(0.9995, 1, 0.016)).toBe(1)
  })
})

describe('colonia: profundidad', () => {
  it('cerca no cambia nada; en la colonia el fondo llega al 70 %, más tenue y con menos parallax', () => {
    expect([depthScale(1, 0), depthAlpha(1, 0), depthParallax(1, 0)]).toEqual([1, 1, 1])
    expect(depthScale(0, 1)).toBe(1)
    expect(depthScale(1, 1)).toBeCloseTo(0.7)
    expect(depthAlpha(1, 1)).toBeCloseTo(0.65)
    expect(depthParallax(1, 1)).toBeCloseTo(0.65)
    expect(depthScale(0.5, 1)).toBeCloseTo(0.85)
    expect(depthScale(0.5, 0.5)).toBeCloseTo(0.925)
    expect(depthScale(3, 1)).toBeCloseTo(0.7) // la profundidad no pasa de 1
  })

  it('se dibuja del fondo al frente', () => {
    const order = backToFront([{ id: 1, depth: 0 }, { id: 2, depth: 0.6 }, { id: 3, depth: 0.1 }, { id: 4, depth: 0.6 }])
    expect(order.map((c) => c.id)).toEqual([2, 4, 3, 1])
  })

  it('al tocar dos células solapadas se elige la de delante, aunque la de atrás esté más cerca del dedo', () => {
    const discs = [
      { id: 1, x: 100, y: 100, r: 40, depth: 0.6 },
      { id: 2, x: 130, y: 100, r: 40, depth: 0.1 },
    ]
    expect(cellAtPoint(105, 100, discs)).toBe(2)
    expect(cellAtPoint(70, 100, discs)).toBe(1) // solo la de atrás llega hasta ahí
    // a igual profundidad, la más cercana
    expect(cellAtPoint(105, 100, discs.map((d) => ({ ...d, depth: 0 })))).toBe(1)
  })
})

describe('colonia: hilos de orden', () => {
  it('los hilos unen las células consecutivas en el orden en que suenan', () => {
    expect(threadPairs([4, 1, 3, 2], () => true)).toEqual([[4, 1], [1, 3], [3, 2]])
    expect(threadPairs([1], () => true)).toEqual([])
    expect(threadPairs([1, 2, 3], (id) => id !== 2)).toEqual([])
  })

  it('la curva sale de una punta y llega a la otra, y el control se desplaza en perpendicular', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 0 }
    expect(threadControl(a, b, 0)).toEqual({ x: 50, y: 0 })
    const c = threadControl(a, b, 10)
    expect(c.x).toBeCloseTo(50)
    expect(Math.abs(c.y)).toBeCloseTo(10)
    expect(quadAt(a, c, b, 0)).toEqual(a)
    expect(quadAt(a, c, b, 1)).toEqual(b)
    expect(quadAt(a, { x: 50, y: 0 }, b, 0.5)).toEqual({ x: 50, y: 0 })
    expect(threadControl(a, a, 5)).toEqual({ x: 0, y: 0 }) // sin longitud no hay perpendicular, pero tampoco NaN
  })
})

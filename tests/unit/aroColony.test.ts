import { describe, expect, it } from 'vitest'
import {
  boundsCenter,
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

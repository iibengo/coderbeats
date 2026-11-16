import { describe, expect, it } from 'vitest'
import { deadzone, drumLoop, euclid, even, hitsFromTurn, hitTestRings, polygonPath, pressedEdges, toggleStep, wheelSteps } from '../../app/lib/lab'

describe('laboratorio', () => {
  it('euclid reparte parejo y en enteros', () => {
    expect(euclid(4)).toEqual([0, 4, 8, 12])
    expect(euclid(0)).toEqual([])
    expect(euclid(16)).toHaveLength(16)
    expect(euclid(3).every(Number.isInteger)).toBe(true)
    expect(euclid(5)).toEqual([0, 3, 6, 9, 12])
  })
  it('even da distancias iguales (3 contra 4)', () => {
    expect(even(3)).toEqual([0, 5.333, 10.667])
    expect(even(4)).toEqual([0, 4, 8, 12])
    expect(wheelSteps(3, false)).toEqual(euclid(3))
  })
  it('toggleStep pone y quita', () => {
    const a = toggleStep([], 4)
    expect(a.map((h) => h.pos)).toEqual([4])
    expect(toggleStep(a, 4)).toEqual([])
    expect(toggleStep(a, 2).map((h) => h.pos)).toEqual([2, 4])
  })
  it('drumLoop es un loop de un compás', () => {
    const l = drumLoop(3, 'bd', [0, 8])
    expect([l.id, l.bars, l.hits.length, l.muted]).toEqual([3, 1, 2, false])
  })
  it('polígono: vacío, línea y cierre', () => {
    expect(polygonPath([], 10, 0, 0)).toBe('')
    expect(polygonPath([0, 8], 10, 0, 0)).not.toMatch(/Z/)
    expect(polygonPath([0, 4, 8], 10, 0, 0)).toMatch(/Z$/)
  })
  it('hitTestRings halla anillo y paso', () => {
    expect(hitTestRings(0, -50, 0, 0, [30, 50, 70], 10)).toEqual({ ring: 1, step: 0 })
    expect(hitTestRings(70, 0, 0, 0, [30, 50, 70], 10)).toEqual({ ring: 2, step: 4 })
    expect(hitTestRings(0, 0, 0, 0, [30, 50, 70], 10)).toBeNull()
  })
  it('hitsFromTurn y límites', () => {
    expect(hitsFromTurn(0)).toBe(0)
    expect(hitsFromTurn(Math.PI / 4 * 3)).toBe(3)
    expect(hitsFromTurn(100)).toBe(16)
    expect(hitsFromTurn(-5)).toBe(0)
  })
  it('mando: flancos y zona muerta', () => {
    expect(pressedEdges([false, true], [true, true])).toEqual([0])
    expect(deadzone(0.1)).toBe(0)
    expect(deadzone(1)).toBe(1)
    expect(deadzone(-1)).toBe(-1)
  })
})

import { fontPx, MIN_TEXT_REAL } from '../../app/lib/lab'
describe('texto del lienzo: nunca menos de 11 px reales', () => {
  it('a la escala de un iPhone (≈ 0,53) 17 px de lienzo se suben', () => {
    expect(fontPx(17, 0.53) * 0.53).toBeGreaterThanOrEqual(MIN_TEXT_REAL - 0.3)
    expect(fontPx(22, 0.53) * 0.53).toBeGreaterThanOrEqual(MIN_TEXT_REAL)
  })
  it('a una escala grande se respeta el tamaño pedido', () => {
    expect(fontPx(22, 1)).toBe(22)
  })
  it('para cualquier escala razonable y base ≥ 20 nunca baja de 11', () => {
    for (let sc = 0.3; sc <= 1.2; sc += 0.05) for (const base of [20, 21, 22, 24, 26]) expect(fontPx(base, sc) * sc).toBeGreaterThanOrEqual(MIN_TEXT_REAL - 0.5)
  })
})

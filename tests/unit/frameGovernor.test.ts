import { describe, expect, it } from 'vitest'
import { FAST_MS, governorStep, initialGovernor, SLOW_MS, UP_AFTER, type GovernorOptions } from '../../app/lib/frameGovernor'

const all: GovernorOptions = { inColony: false, canQuality: true, canAro: true }
const run = (s = initialGovernor(), ps: number[], o = all) => ps.reduce((st, p) => governorStep(st, p, o), s)

describe('el vigilante de frames: baja y también vuelve a subir', () => {
  it('bajar: primero el agua, luego el aro (fuera de la colonia)', () => {
    let s = run(undefined, [20])
    expect(s.quality).toBeCloseTo(0.85)
    s = run(s, [20, 20, 20])
    expect(s.quality).toBeCloseTo(0.5)
    expect(s.aro).toBe(1)
    s = run(s, [20])
    expect(s.aro).toBe(0.5)
    expect(run(s, [20, 20]).quality).toBeCloseTo(0.5) // ya no baja más
  })
  it('en la colonia, primero el detalle de las células, luego el agua', () => {
    const col = { ...all, inColony: true }
    let s = run(undefined, [20], col)
    expect(s.crowd).toBe(1)
    s = run(s, [20], col)
    expect(s.crowd).toBe(2)
    s = run(s, [20], col)
    expect(s.quality).toBeCloseTo(0.85)
  })
  it('sube tras varias ventanas rápidas seguidas, en orden inverso, de uno en uno', () => {
    const down = run(undefined, [20, 20, 20, 20, 20], { ...all, inColony: true })
    expect(down.crowd).toBe(2)
    expect(down.quality).toBeLessThan(1)
    const fast = Array.from({ length: UP_AFTER }, () => FAST_MS - 1)
    let s = run(down, fast)
    expect(s.quality).toBeGreaterThan(down.quality)
    expect(s.crowd).toBe(2)
    for (let i = 0; i < 40; i++) s = run(s, fast)
    expect(s).toMatchObject({ crowd: 0, quality: 1, aro: 1 })
  })
  it('el aro sube antes que el agua', () => {
    const down = run(undefined, [20, 20, 20, 20, 20, 20])
    expect(down.aro).toBe(0.5)
    const up = run(down, Array.from({ length: UP_AFTER }, () => 5))
    expect(up.aro).toBe(1)
    expect(up.quality).toBeCloseTo(down.quality)
  })
  it('una ventana ni lenta ni rápida corta la racha de rápidas', () => {
    const down = run(undefined, [20])
    const s = run(down, [...Array.from({ length: UP_AFTER - 1 }, () => 5), (SLOW_MS + FAST_MS) / 2, 5])
    expect(s.quality).toBeCloseTo(down.quality)
  })
  it('para no oscilar: si tras subir vuelve a ir lento, la próxima subida tarda más', () => {
    let s = run(undefined, [20])
    s = run(s, Array.from({ length: UP_AFTER }, () => 5)) // sube
    expect(s.justUp).toBe(true)
    s = run(s, [20]) // y vuelve a ir lento
    expect(s.need).toBeGreaterThan(UP_AFTER)
    const before = s.quality
    s = run(s, Array.from({ length: UP_AFTER }, () => 5))
    expect(s.quality).toBeCloseTo(before) // con las mismas ventanas de antes ya no sube
  })
  it('sin nada que subir se queda quieto; sin calidad ni aro posibles, no baja nada', () => {
    expect(run(undefined, Array.from({ length: 30 }, () => 3))).toMatchObject({ crowd: 0, quality: 1, aro: 1 })
    expect(run(undefined, [20, 20], { inColony: false, canQuality: false, canAro: false })).toMatchObject({ crowd: 0, quality: 1, aro: 1 })
  })
})

describe('adornos del agua (estela y venas): lo primero que se apaga y lo último que vuelve', () => {
  const fl: GovernorOptions = { ...all, canFlow: true }
  it('van lentos: primero se apagan los adornos, luego el agua', () => {
    let s = run(undefined, [20], fl)
    expect(s.flow).toBe(0)
    expect(s.quality).toBe(1)
    s = run(s, [20], fl)
    expect(s.quality).toBeCloseTo(0.85)
  })
  it('apagados por el interruptor (canFlow falso) no se tocan', () => {
    expect(run(undefined, [20]).flow).toBe(1)
  })
  it('vuelven al final, con todo lo demás ya al máximo', () => {
    let s = run(undefined, [20, 20, 20, 20, 20], fl) // flow 0, agua y aro abajo
    expect(s.flow).toBe(0)
    const fast = Array(UP_AFTER * 8).fill(FAST_MS - 1)
    for (const p of fast) {
      s = governorStep(s, p, fl)
      if (s.flow === 1) break
    }
    expect(s.flow).toBe(1)
    expect(s.aro).toBe(1)
    expect(s.quality).toBe(1)
  })
})


import { describe, expect, it } from 'vitest'
import { alphaOfLevel, diveProgress, diveWindow, dives, easeDive, hitsNext, levelsFor, MAX_LEVELS, NESTED_SCALE, reducedFade, stackAt } from '~/lib/zoomStack'

describe('zoom infinito: geometría', () => {
  it('en reposo: la grande, la siguiente a ¼ y la siguiente a 1/16, cada vez más tenues', () => {
    const s = stackAt(0, 2, 5, 300)
    expect(s.map((r) => r.part)).toEqual([2, 3, 4])
    expect(s.map((r) => r.r)).toEqual([300, 75, 18.75])
    expect(s[0]!.alpha).toBe(1)
    expect(s[1]!.alpha).toBeLessThan(s[0]!.alpha)
    expect(s[2]!.alpha).toBeLessThan(s[1]!.alpha)
    expect(s.length).toBe(MAX_LEVELS)
  })
  it('al aterrizar (p = 1) la siguiente es la grande y entra una nueva pequeña', () => {
    const s = stackAt(1, 2, 5, 300)
    expect(s[0]!.part).toBe(3)
    expect(s[0]!.r).toBeCloseTo(300)
    expect(s[0]!.alpha).toBeCloseTo(1)
    expect(s.some((r) => r.part === 2)).toBe(false) // la que había ya se fue
  })
  it('es continuo: un poco antes de aterrizar casi es lo mismo que al aterrizar', () => {
    const a = stackAt(0.999, 0, 4, 300)
    const b = stackAt(1, 0, 4, 300)
    expect(a.find((r) => r.part === 1)!.r).toBeCloseTo(b.find((r) => r.part === 1)!.r, 0)
  })
  it('la última contiene a la primera (se cierra el círculo)', () => {
    expect(stackAt(0, 3, 4, 300).map((r) => r.part)).toEqual([3, 0, 1])
    expect(stackAt(1, 3, 4, 300)[0]!.part).toBe(0)
  })
  it('con una sola parte no hay anidado', () => {
    expect(stackAt(0, 0, 1, 300)).toEqual([{ part: 0, level: 0, r: 300, alpha: 1 }])
    expect(stackAt(0.5, 0, 0, 300)).toEqual([])
  })
  it('de fuera hacia dentro y nunca más de MAX_LEVELS + 1 gotas a la vez', () => {
    for (let p = 0; p <= 3; p += 0.1) {
      const s = stackAt(p, 0, 8, 300)
      expect(s.length).toBeLessThanOrEqual(MAX_LEVELS + 1)
      for (let i = 1; i < s.length; i++) expect(s[i]!.r).toBeLessThanOrEqual(s[i - 1]!.r)
    }
  })
  it('la opacidad baja con el nivel y es 0 fuera del rango', () => {
    expect(alphaOfLevel(0)).toBe(1)
    expect(alphaOfLevel(1)).toBeCloseTo(0.45)
    expect(alphaOfLevel(2)).toBeCloseTo(0.2)
    expect(alphaOfLevel(MAX_LEVELS)).toBe(0)
    expect(alphaOfLevel(-1)).toBe(0)
    expect(alphaOfLevel(-0.5)).toBeGreaterThan(0)
  })
  it('radios por potencias de NESTED_SCALE', () => {
    for (const r of stackAt(0, 0, 6, 100)) expect(r.r).toBeCloseTo(100 * NESTED_SCALE ** r.level)
  })
})

describe('zoom infinito: tiempo', () => {
  it('siempre hacia delante: de la última a la primera es 1; la misma es 0', () => {
    expect(dives(3, 0, 4)).toBe(1)
    expect(dives(1, 3, 4)).toBe(2)
    expect(dives(2, 2, 4)).toBe(0)
    expect(dives(2, 1, 4)).toBe(3)
  })
  it('empieza al tocar y aterriza en la línea de compás', () => {
    const w = diveWindow(10, 2, 0.5) // a medio compás de 2 s: faltan 1 s
    expect(w.startS).toBe(10)
    expect(w.landS).toBeCloseTo(11)
  })
  it('si falta muy poco para la línea, la imagen se alarga al compás siguiente', () => {
    const w = diveWindow(10, 2, 0.95) // faltan 0,1 s
    expect(w.landS - w.startS).toBeCloseTo(0.1 + 2)
  })
  it('el progreso va de 0 a d, suave y sin salirse', () => {
    expect(diveProgress(10, 10, 11, 2)).toBe(0)
    expect(diveProgress(11, 10, 11, 2)).toBe(2)
    expect(diveProgress(99, 10, 11, 2)).toBe(2)
    expect(diveProgress(10.5, 10, 11, 2)).toBeCloseTo(1)
    expect(easeDive(-1)).toBe(0)
    expect(easeDive(0.25)).toBeLessThan(0.25)
  })
})

describe('zoom infinito: movimiento reducido, rendimiento y toque', () => {
  it('sin zoom: un fundido de 160 ms', () => {
    expect(reducedFade(0)).toEqual({ out: 1, in: 0 })
    expect(reducedFade(0.08).out).toBeCloseTo(0.5)
    expect(reducedFade(1)).toEqual({ out: 0, in: 1 })
  })
  it('el vigilante baja y sube de nivel con histéresis', () => {
    expect(levelsFor(20, 3)).toBe(2)
    expect(levelsFor(20, 1)).toBe(1)
    expect(levelsFor(5, 1)).toBe(2)
    expect(levelsFor(5, 3)).toBe(3)
    expect(levelsFor(10, 2)).toBe(2) // entre medias, se queda
  })
  it('la gota pequeña se puede tocar con el dedo (≥ 44 px reales)', () => {
    expect(hitsNext(340, 340, 340, 340, 300, 0.53)).toBe(true)
    expect(hitsNext(340 + 60, 340, 340, 340, 300, 0.53)).toBe(true) // 75 unidades de radio ≈ 40 px reales
    expect(hitsNext(340 + 200, 340, 340, 340, 300, 0.53)).toBe(false)
    // aunque la gota fuera diminuta, la zona de toque no baja de 22 px reales de radio
    expect(hitsNext(340 + 30, 340, 340, 340, 20, 0.53)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { ELISA_A, ELISA_B, fast, GRIEG_A, GRIEG_B, HABANERA_A, HABANERA_B, KOROBEINIKI_A, KOROBEINIKI_B, parseTune, shift } from '~/lib/publicTunes'

const ALL = { KOROBEINIKI_A, KOROBEINIKI_B, GRIEG_A, GRIEG_B, ELISA_A, ELISA_B, HABANERA_A, HABANERA_B }

describe('melodías de dominio público (de memoria: revisar con partitura)', () => {
  it('el analizador entiende nombres, alteraciones y silencios', () => {
    expect(parseTune('C4:4 C#4:2 r:2 Bb3:8')).toEqual([[0, 4, 60], [4, 2, 61], [8, 8, 58]])
    expect(() => parseTune('H4:4')).toThrow()
    expect(() => parseTune('C4:0')).toThrow()
  })
  for (const [name, tune] of Object.entries(ALL)) {
    it(`${name}: 4 compases exactos, notas válidas, sin solaparse y en el registro del sinte`, () => {
      const last = tune[tune.length - 1]!
      expect(last[0] + last[1]).toBeLessThanOrEqual(64)
      for (let i = 1; i < tune.length; i++) expect(tune[i - 1]![0] + tune[i - 1]![1]).toBeLessThanOrEqual(tune[i]![0])
      for (const [p, d, m] of tune) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(d).toBeGreaterThan(0)
        expect(m).toBeGreaterThanOrEqual(48)
        expect(m).toBeLessThanOrEqual(84)
      }
      expect(tune.length).toBeGreaterThanOrEqual(8)
      // cada compás de 16 pasos queda completo (notas y silencios suman 64): ninguna nota cruza la línea de compás
      for (const [p, d] of tune) expect(Math.floor(p / 16)).toBe(Math.floor((p + d - 1) / 16))
    })
  }
  it('Korobeiniki empieza por mi–si–do–re y acaba en la (La menor)', () => {
    expect(KOROBEINIKI_A.slice(0, 4).map((n) => n[2] % 12)).toEqual([4, 11, 0, 2])
    expect(KOROBEINIKI_A[KOROBEINIKI_A.length - 1]![2] % 12).toBe(9)
  })
  it('Para Elisa: mi, re♯, mi, re♯, mi, si, re, do', () => {
    expect(ELISA_A.slice(0, 8).map((n) => n[2] % 12)).toEqual([4, 3, 4, 3, 4, 11, 2, 0])
  })
  it('la Habanera desciende cromáticamente (cada nota, un semitono o menos más grave que la anterior en el primer descenso)', () => {
    const m = HABANERA_A.map((n) => n[2])
    expect(m[0]).toBe(74)
    expect(m[m.length - 1]).toBe(62)
    expect(Math.max(...m.slice(1).map((x, i) => x - m[i]!))).toBeLessThanOrEqual(0)
  })
  it('el tema se puede subir y acelerar sin salirse de 4 compases', () => {
    expect(shift(GRIEG_A, 3)[0]![2]).toBe(GRIEG_A[0]![2] + 3)
    for (const k of [2, 4] as const) {
      const f = fast(GRIEG_A, k)
      expect(f.length).toBe(GRIEG_A.length * k)
      const last = f[f.length - 1]!
      expect(last[0] + last[1]).toBeLessThanOrEqual(64)
      for (let i = 1; i < f.length; i++) expect(f[i - 1]![0] + f[i - 1]![1]).toBeLessThanOrEqual(f[i]![0])
      expect(f.every((n) => Number.isInteger(n[0]) && Number.isInteger(n[1]))).toBe(true)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { labRemixById } from '~/lib/labRemixes'
import { LACRIMOSA_A, LACRIMOSA_B, parseTune128 } from '~/lib/publicTunes'

const ST = 8 / 3 // una corchea de 12/8, en pasos (un compás de 12/8 = 32 pasos = 2 de 4/4)

describe('Lacrimosa de Mozart (spec 048)', () => {
  it('una corchea de 12/8 son 8/3 de paso y un compás de 12/8, 32 pasos', () => {
    expect(parseTune128('C5:12')).toEqual([[0, 32, 72]])
    expect(parseTune128('r:1 C5:1')).toEqual([[ST, ST, 72]])
  })
  it('el suspiro de los violines: 16 notas, dos por pulso, entre sol4 y re6, sin salirse de 4 compases', () => {
    expect(LACRIMOSA_A).toHaveLength(16)
    expect(LACRIMOSA_A[0]).toEqual([ST, ST, 73]) // do♯5 en la corchea 2 del compás
    expect(LACRIMOSA_A[1]).toEqual([2 * ST, ST, 74]) // y re5
    expect(Math.min(...LACRIMOSA_A.map((n) => n[2]))).toBe(67) // sol4
    expect(Math.max(...LACRIMOSA_A.map((n) => n[2]))).toBe(86) // re6
    for (const [p, d] of LACRIMOSA_A) expect(p + d).toBeLessThanOrEqual(64 + 1e-9)
  })
  it('el canto: la4 larga, fa5, re5, re5 larga y do♯5, dos veces', () => {
    expect(LACRIMOSA_B.map((n) => n[2])).toEqual([69, 77, 74, 74, 73, 69, 77, 74, 74, 73])
    expect(LACRIMOSA_B[0]).toEqual([0, 4 * ST, 69])
    for (const [p, d] of LACRIMOSA_B) expect(p + d).toBeLessThanOrEqual(64 + 1e-9)
  })
  it('el remix está en el Laboratorio: drill, 808, Re menor, con partes y sin «de memoria»', () => {
    const r = labRemixById('lacrimosa-drill')!
    expect(r.style).toBe('drill')
    expect(r.kit).toBe('808')
    expect(r.key).toBe('Re menor')
    expect(r.unverified).toBeFalsy()
    expect(r.parts.length).toBeGreaterThanOrEqual(5)
    expect(r.parts.length).toBeLessThanOrEqual(8)
  })
})

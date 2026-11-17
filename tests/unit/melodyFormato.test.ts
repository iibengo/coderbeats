import { describe, expect, it } from 'vitest'
import { gridOf, melodyMini } from '../../app/lib/melody'

const h = (pos: number, dur: number, midi: number) => ({ pos, dur, midi, strength: 0.8 })
const weights = (mini: string) => [...mini.matchAll(/@(\d+)|[a-g~][b]?\d?(?![\d@])/g)].length

describe('formato de melodía (spec 028): lo de siempre no cambia', () => {
  it('pasos enteros: el mismo código de siempre', () => {
    expect(melodyMini([h(0, 4, 60), h(6, 2, 62)], 1, 0)).toBe('c4@4 ~@2 d4@2 ~@8')
    expect(melodyMini([h(0, 16, 60)], 1, 0)).toBe('c4@16')
  })
  it('cuartos de paso: el mismo código de siempre', () => {
    expect(melodyMini([h(0, 2, 60), h(2.5, 1.5, 62)], 1, 0)).toBe('c4@8 ~@2 d4@6 ~@48')
    expect(gridOf([h(0, 2, 60), h(2.5, 1.5, 62)])).toBe(4)
    expect(gridOf([h(0, 4, 60)])).toBe(1)
  })
  it('un loop de varios compases con compases iguales se sigue colapsando', () => {
    expect(melodyMini([h(0, 4, 60), h(16, 4, 60)], 2, 0)).toBe('c4@4 ~@12')
  })
})

describe('tresillos (spec 028 §3)', () => {
  const tres = [h(0, 16 / 3, 60), h(16 / 3, 16 / 3, 62), h(32 / 3, 16 / 3, 64)]
  it('tres notas por compás: rejilla de doceavos y el compás suma 192', () => {
    expect(gridOf(tres)).toBe(12)
    expect(melodyMini(tres, 1, 0)).toBe('c4@64 d4@64 e4@64')
  })
  it('un tresillo de corcheas dentro de una negra (4 pasos en 3 notas)', () => {
    const m = melodyMini([h(0, 4 / 3, 60), h(4 / 3, 4 / 3, 62), h(8 / 3, 4 / 3, 64)], 1, 0)
    expect(m).toBe('c4@16 d4@16 e4@16 ~@144')
  })
  it('mezclado con notas normales sigue cuadrando (todo en doceavos)', () => {
    const m = melodyMini([h(0, 4, 60), h(4, 4 / 3, 62), h(16 / 3, 4 / 3, 64), h(20 / 3, 4 / 3, 65)], 1, 0)
    expect(m).toBe('c4@48 d4@16 e4@16 f4@16 ~@96')
    const total = [...m.matchAll(/@(\d+)/g)].reduce((n, x) => n + Number(x[1]), 0)
    expect(total).toBe(192)
  })
})

describe('varias notas a la vez (spec 028 §4)', () => {
  it('un acorde: las notas del mismo paso suenan juntas', () => {
    expect(melodyMini([h(0, 8, 60), h(0, 8, 64), h(0, 8, 67), h(8, 8, 65)], 1, 0)).toBe('[c4,e4,g4]@8 f4@8')
  })
  it('el acorde dura lo que su nota más larga y no pisa lo siguiente', () => {
    expect(melodyMini([h(0, 12, 60), h(0, 4, 64), h(8, 8, 67)], 1, 0)).toBe('[c4,e4]@8 g4@8')
  })
  it('una nota repetida en el mismo paso no se duplica', () => {
    expect(melodyMini([h(0, 4, 60), h(0, 4, 60)], 1, 0)).toBe('c4@4 ~@12')
  })
  it('acordes con tresillos a la vez', () => {
    expect(melodyMini([h(0, 16 / 3, 60), h(0, 16 / 3, 64), h(16 / 3, 16 / 3, 62)], 1, 0)).toBe('[c4,e4]@64 d4@64 ~@64')
  })
})

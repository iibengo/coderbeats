import { describe, expect, it } from 'vitest'
import { arrivals, endedWithGap, loopSeconds, LOOKAHEAD, schedule, spiralPoint, visible } from '../../app/lib/spiral'

const h = (pos: number, dur: number, midi = 60) => ({ pos, dur, midi, strength: 0.8 })

describe('modo espiral (spec 015 §14)', () => {
  it('el calendario: a 120 bpm un paso son 0,125 s; el final no pisa al siguiente', () => {
    const s = schedule([h(0, 4), h(4, 8), h(20, 4)], 120)
    expect(s[0]).toMatchObject({ start: 0, end: 0.5 })
    expect(s[1]!.start).toBeCloseTo(0.5)
    expect(s[2]!.start).toBeCloseTo(2.5)
    expect(s[1]!.end).toBeCloseTo(1.5)
    expect(schedule([h(0, 8), h(2, 4)], 120)[0]!.end).toBeCloseTo(0.25) // dur 8 pasos recortada por la siguiente
    expect(loopSeconds(120)).toBeCloseTo(8)
    expect(schedule([h(0, 1)], NaN)[0]!.end).toBeGreaterThan(0)
  })
  it('las llegadas: cada nota llega una sola vez al avanzar el reloj por tramos', () => {
    const s = schedule([h(0, 2), h(4, 2), h(8, 2), h(12, 2)], 120)
    let t = -0.01
    const got: number[] = []
    for (let k = 0; k < 400; k++) {
      const next = t + 0.0173
      for (const n of arrivals(s, t, next)) got.push(n.i)
      t = next
    }
    expect(got).toEqual([0, 1, 2, 3])
  })
  it('lo visible: solo lo que llega en los próximos 4 s', () => {
    const s = schedule([h(0, 2), h(16, 2), h(60, 2)], 120) // llegan a 0, 2 y 7,5 s
    expect(visible(s, 0).map((n) => n.i)).toEqual([0, 1])
    expect(visible(s, 3.6).map((n) => n.i)).toEqual([2])
    expect(visible(s, -2).map((n) => n.i)).toEqual([0, 1])
  })
  it('se suelta la nota solo cuando hay hueco hasta la siguiente', () => {
    const s = schedule([h(0, 2), h(2, 2), h(8, 2)], 120) // la 0 acaba donde empieza la 1 (sin hueco); la 1 acaba y la 2 llega 0,5 s después
    expect(endedWithGap(s, 0.2, 0.3)).toBeNull()
    expect(endedWithGap(s, 0.45, 0.55)?.i).toBe(1)
    expect(endedWithGap(s, 1.1, 1.3)?.i).toBe(2)
  })
  it('la espiral: la que llega ya está en el centro, y cuanto más tarde llega, más lejos (con tope)', () => {
    const c = { x: 100, y: 100 }
    expect(spiralPoint(c, 0, 200)).toEqual({ x: 100, y: 100 })
    const d = (tau: number) => Math.hypot(spiralPoint(c, tau, 200).x - 100, spiralPoint(c, tau, 200).y - 100)
    expect(d(1)).toBeGreaterThan(0)
    expect(d(2)).toBeGreaterThan(d(1))
    expect(d(LOOKAHEAD)).toBeCloseTo(200)
    expect(d(LOOKAHEAD * 3)).toBeCloseTo(200)
    expect(spiralPoint(c, -1, 200)).toEqual({ x: 100, y: 100 })
  })
})

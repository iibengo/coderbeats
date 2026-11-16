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

import { interpretedHits, octaveZone, shiftToList } from '../../app/lib/spiral'

describe('la interpretación: octava por la altura del dedo (spec 016 §9.1)', () => {
  it('arriba +1, medio 0, abajo −1, con histéresis en el borde', () => {
    expect(octaveZone(0.1)).toBe(1)
    expect(octaveZone(0.5)).toBe(0)
    expect(octaveZone(0.9)).toBe(-1)
    expect(octaveZone(NaN)).toBe(0)
    // justo en el borde de arriba (1/3): quien venía de arriba se queda, quien venía del medio no sube
    expect(octaveZone(0.35, 1)).toBe(1)
    expect(octaveZone(0.35, 0)).toBe(0)
    expect(octaveZone(0.65, -1)).toBe(-1)
    expect(octaveZone(0.65, 0)).toBe(0)
  })
  it('la nota desplazada es siempre una nota del sinte; si no cabe, baja a la octava que sí', () => {
    const list = [60, 62, 64, 72, 74] // sin 76 ni 48
    expect(shiftToList(60, 1, list)).toBe(72)
    expect(shiftToList(64, 1, list)).toBe(64) // 76 no existe: se queda
    expect(shiftToList(72, -1, list)).toBe(60)
    expect(shiftToList(62, -1, list)).toBe(62)
    expect(shiftToList(62, 0, list)).toBe(62)
    expect(shiftToList(61, 1, list)).toBe(61) // fuera de lista: se devuelve tal cual, sin colgarse
  })
  it('lo grabado son las notas que sonaron, en las posiciones del tema', () => {
    const hits = [{ pos: 0, dur: 4, midi: 60, strength: 0.8 }, { pos: 4, dur: 4, midi: 62, strength: 0.8 }, { pos: 8, dur: 4, midi: 64, strength: 0.8 }]
    const out = interpretedHits(hits, new Map([[0, 72], [2, 64]]))
    expect(out.map((h) => [h.pos, h.midi])).toEqual([[0, 72], [8, 64]])
  })
})

import { arrivalsLooped, noteEndAbs, phaseBarOf, schedule as sch, syncStart, visibleLooped } from '../../app/lib/spiral'

describe('sincronía con el compás del motor (spec 016 §9.3)', () => {
  // un reloj de mentira: compases de 2 s desde t = 10,3
  const clockAt = (now: number) => ({ bar: Math.ceil((now - 10.3) / 2) + 5, at: (b: number) => 10.3 + (b - 5) * 2, now })
  it('el tema empieza en una línea de compás, al menos 1,2 s por delante', () => {
    for (let now = 10.3; now < 20; now += 0.137) {
      const c = clockAt(now)
      const s = syncStart(c, 1.2)
      expect(s.start).toBeGreaterThanOrEqual(now + 1.2 - 1e-9)
      expect(s.start).toBeLessThan(now + 1.2 + 2 + 1e-9) // el primero que cumple, no uno de sobra
      expect(Math.abs((s.start - 10.3) / 2 - Math.round((s.start - 10.3) / 2))).toBeLessThan(1e-9) // cae justo en una línea
      expect(c.at(s.bar)).toBe(s.start)
    }
  })
  it('la fase del loop es la del compás de salida (así suena donde se tocó)', () => {
    expect(phaseBarOf(8)).toBe(0)
    expect(phaseBarOf(9)).toBe(1)
    expect(phaseBarOf(11)).toBe(3)
    expect(phaseBarOf(-1)).toBe(3)
    // la nota pos 0 de la vuelta que empezó en el compás 9 cae en los compases globales ≡ 9 (mod 4) = fase 1
    const phase = phaseBarOf(9)
    for (const g of [9, 13, 17]) expect(((g - phase) % 4 + 4) % 4).toBe(0)
  })
  it('las llegadas con vueltas: cada nota una vez por vuelta, en su instante exacto, sin saltos al cruzar la vuelta', () => {
    const s = sch([h(0, 2), h(16, 2), h(60, 2)], 120) // llegan a 0, 2 y 7,5 s; vuelta de 8 s
    const L = 8
    const got: number[] = []
    let t = -0.01
    for (let k = 0; k < 1400; k++) {
      const next = t + 0.0173
      for (const a of arrivalsLooped(s, L, t, next)) got.push(+(a.abs).toFixed(3))
      t = next
    }
    expect(got.slice(0, 7)).toEqual([0, 2, 7.5, 8, 10, 15.5, 16])
    expect(new Set(got).size).toBe(got.length)
  })
  it('el final de cada nota y si hay hueco, también con la primera de la vuelta siguiente', () => {
    const s = sch([h(0, 4), h(4, 4), h(8, 2)], 120) // 0–0,5, 0,5–1, 1–1,25; vuelta de 8 s
    expect(noteEndAbs(s, 8, s[0]!, 0)).toEqual([0.5, false])
    expect(noteEndAbs(s, 8, s[2]!, 0)[1]).toBe(true) // hasta 8 s hay hueco
    expect(noteEndAbs(s, 8, s[2]!, 0)[0]).toBeCloseTo(1.25)
  })
  it('lo visible con vueltas: cerca del final de la vuelta ya se ven las primeras de la siguiente', () => {
    const s = sch([h(0, 2), h(16, 2)], 120) // 0 y 2 s; vuelta de 8 s
    expect(visibleLooped(s, 8, 6.5).map((n) => [n.i, +n.tau.toFixed(2)])).toEqual([[0, 1.5], [1, 3.5]])
    expect(visibleLooped(s, 8, -2).map((n) => n.i)).toEqual([0, 1])
  })
})

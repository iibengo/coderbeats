import { describe, expect, it } from 'vitest'
import {
  activeAt,
  addHit,
  clearLoop,
  emptyLoop,
  hasHitsInBar2,
  hitTotal,
  place,
  setBars,
  settle,
  stepsOf,
  undoLayer,
  type Loop,
  type LoopTiming,
} from '../../app/lib/looper'
import type { Instrument } from '../../app/lib/types'

const STEP = 60 / 90 / 4
const timing: LoopTiming = { anchor: 10, stepSeconds: STEP, quantizeEvery: 1, totalSteps: 16 }
const LOOP = 16 * STEP

const add = (loop: Loop, t: number, instrument: Instrument, strength = 1, tm = timing) =>
  addHit(loop, { placement: place(t, tm), instrument, strength, confidence: 1 })

describe('place', () => {
  it('vuelta y paso con el ancla', () => {
    expect(place(10 + 4 * STEP + 0.01, timing)).toMatchObject({ lap: 0, quantizedLap: 0, step: 4 })
    expect(place(10 + 2 * LOOP + 7 * STEP, timing)).toMatchObject({ lap: 2, quantizedLap: 2, step: 7 })
  })

  it('offsetMs es la desviación respecto a la rejilla', () => {
    expect(place(10 + 4 * STEP - 0.02, timing).offsetMs).toBeCloseTo(-20, 6)
  })

  it('un golpe adelantado al 1 se redondea al paso 0 de la vuelta siguiente', () => {
    expect(place(10 + LOOP - 0.03, timing)).toMatchObject({ lap: 0, quantizedLap: 1, step: 0 })
  })

  it('en la cuenta atrás: adelantado al 1 cuenta, antes no', () => {
    expect(place(10 - 0.03, timing)).toMatchObject({ lap: -1, quantizedLap: 0, step: 0 })
    expect(place(10 - 4 * STEP, timing).quantizedLap).toBe(-1)
  })

  it('dnb: cuantiza a corcheas (solo pasos pares)', () => {
    const dnb: LoopTiming = { anchor: 0, stepSeconds: 60 / 174 / 4, quantizeEvery: 2, totalSteps: 16 }
    const s = 60 / 174 / 4
    expect(place(3 * s + 0.001, dnb).step).toBe(4)
    expect(place(2.9 * s, dnb).step).toBe(2)
    expect(place(15.2 * s, dnb)).toMatchObject({ step: 0, quantizedLap: 1 })
  })
})

describe('addHit', () => {
  it('el golpe suena desde la vuelta siguiente', () => {
    const { loop, result } = add(emptyLoop(), 10 + LOOP + 4 * STEP, 'sd')
    expect(result).toBe('added')
    expect(activeAt(loop, 4, 1)).toEqual([])
    expect(activeAt(loop, 4, 2)).toEqual(['sd'])
  })

  it('adelantado al 1 empieza a sonar una vuelta más tarde', () => {
    const { loop } = add(emptyLoop(), 10 + LOOP - 0.02, 'bd')
    expect(loop.layers[0]!.lap).toBe(0)
    expect(activeAt(loop, 0, 1)).toEqual([])
    expect(activeAt(loop, 0, 2)).toEqual(['bd'])
  })

  it('cuenta atrás: fuera de rango salvo el redondeo al paso 0', () => {
    expect(add(emptyLoop(), 10 - 4 * STEP, 'bd').result).toBe('out-of-range')
    const { loop, result } = add(emptyLoop(), 10 - 0.02, 'bd')
    expect(result).toBe('added')
    expect(loop.layers[0]!.lap).toBe(0)
  })

  it('el mismo instrumento en el mismo paso es duplicado (en cualquier capa)', () => {
    const a = add(emptyLoop(), 10 + 4 * STEP, 'sd').loop
    expect(add(a, 10 + LOOP + 4 * STEP, 'sd').result).toBe('duplicate')
  })

  it('misma vuelta y paso, otro instrumento: gana el más fuerte', () => {
    const a = add(emptyLoop(), 10 + 4 * STEP - 0.01, 'hh', 0.3).loop
    const b = add(a, 10 + 4 * STEP + 0.01, 'sd', 0.8)
    expect(b.result).toBe('replaced')
    expect(stepsOf(b.loop)[4]).toEqual(['sd'])
    expect(add(b.loop, 10 + 4 * STEP, 'bd', 0.1).result).toBe('weaker')
  })

  it('distintas vueltas apilan instrumentos en el mismo paso (polifonía)', () => {
    let loop = add(emptyLoop(), 10 + 0, 'bd').loop
    loop = add(loop, 10 + LOOP + 0.005, 'hh').loop
    expect(stepsOf(loop)[0]).toEqual(['bd', 'hh'])
    expect(loop.layers).toHaveLength(2)
  })

  it('cada vuelta es una capa', () => {
    let loop = emptyLoop()
    loop = add(loop, 10 + 0, 'bd').loop
    loop = add(loop, 10 + 8 * STEP, 'bd').loop
    loop = add(loop, 10 + LOOP + 4 * STEP, 'sd').loop
    expect(loop.layers.map((l) => [l.lap, l.hits.length])).toEqual([
      [0, 2],
      [1, 1],
    ])
  })
})

describe('capas y compases', () => {
  const base = () => {
    let loop = add(emptyLoop(), 10 + 0, 'bd').loop
    loop = add(loop, 10 + LOOP + 4 * STEP, 'sd').loop
    return add(loop, 10 + 2 * LOOP + 2 * STEP, 'hh').loop
  }

  it('deshacer capa quita exactamente la última', () => {
    const loop = undoLayer(base())
    expect(hitTotal(loop)).toBe(2)
    expect(stepsOf(loop)[2]).toEqual([])
    expect(hitTotal(undoLayer(undoLayer(undoLayer(loop))))).toBe(0)
  })

  it('borrar todo', () => {
    expect(clearLoop(base()).layers).toEqual([])
  })

  it('1 → 2 compases duplica y 2 → 1 recorta', () => {
    const two = setBars(base(), 2)
    expect(two.bars).toBe(2)
    expect(stepsOf(two).map((s) => s.join())).toEqual([...stepsOf(base()), ...stepsOf(base())].map((s) => s.join()))
    expect(hasHitsInBar2(two)).toBe(true)
    const one = setBars(two, 1)
    expect(stepsOf(one)).toEqual(stepsOf(base()))
    expect(hasHitsInBar2(one)).toBe(false)
  })
})

describe('settle', () => {
  it('al rearrancar, todo lo grabado suena desde la vuelta 0', () => {
    const { loop } = add(emptyLoop(), 10 + 3 * LOOP + 4 * STEP, 'sd')
    expect(activeAt(loop, 4, 0)).toEqual([])
    expect(activeAt(settle(loop), 4, 0)).toEqual(['sd'])
  })
})

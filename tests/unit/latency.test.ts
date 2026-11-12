import { describe, expect, it } from 'vitest'
import { measureLatency } from '../../app/lib/latency'

const clicks = [1, 1.667, 2.333, 3]

describe('measureLatency', () => {
  it('mediana de los retrasos de 4 palmadas', () => {
    const r = measureLatency(clicks, [1.1, 1.777, 2.413, 3.12])
    expect(r.valid).toBe(true)
    expect(r.matched).toBe(4)
    expect(r.latencyMs).toBeCloseTo(105, 6)
    expect(r.meanMs).toBeCloseTo(102.5, 6)
    expect(r.spreadMs).toBeCloseTo(40, 6)
  })

  it('válida con 3 emparejadas, inválida con 2', () => {
    expect(measureLatency(clicks, [1.1, 1.767, 2.433]).valid).toBe(true)
    const r = measureLatency(clicks, [1.1, 1.767])
    expect(r).toMatchObject({ valid: false, reason: 'too-few', matched: 2 })
  })

  it('inválida si la dispersión supera 60 ms', () => {
    expect(measureLatency(clicks, [1.05, 1.767, 2.433, 3.2])).toMatchObject({ valid: false, reason: 'too-spread' })
  })

  it('ignora onsets fuera de la ventana [-50, +400] ms', () => {
    const r = measureLatency([1], [0.9, 1.5])
    expect(r.matched).toBe(0)
    expect(measureLatency([1], [0.96]).matched).toBe(1)
  })

  it('cada onset se empareja una sola vez', () => {
    expect(measureLatency([1, 1.05], [1.1]).matched).toBe(1)
  })
})

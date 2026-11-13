import { describe, expect, it } from 'vitest'
import { measureLatency, usableLatencyMs } from '../../app/lib/latency'

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

describe('una latencia imposible (≤ 0) no se acepta', () => {
  it('palmadas dadas antes del clic: sale negativa y se rechaza con su motivo', () => {
    // el caso del registro: −38 ms (se siguió la pantalla en vez del oído, con cascos Bluetooth)
    const r = measureLatency(clicks, [0.962, 1.629, 2.295, 2.962])
    expect(r.latencyMs).toBeCloseTo(-38, 3)
    expect(r).toMatchObject({ valid: false, reason: 'negative', matched: 4 })
  })

  it('cero también se rechaza; un retraso pequeño pero positivo, no', () => {
    expect(measureLatency(clicks, clicks)).toMatchObject({ valid: false, reason: 'negative' })
    expect(measureLatency(clicks, clicks.map((c) => c + 0.02))).toMatchObject({ valid: true })
  })

  it('con pocas palmadas o muy dispersas, el motivo sigue siendo ese (no el signo)', () => {
    expect(measureLatency(clicks, [0.97, 1.65])).toMatchObject({ valid: false, reason: 'too-few' })
    expect(measureLatency(clicks, [0.96, 1.767, 2.433, 3.2])).toMatchObject({ valid: false, reason: 'too-spread' })
  })

  it('una calibración guardada ≤ 0 (de antes) no se usa, pero no se toca', () => {
    expect(usableLatencyMs(-38)).toBe(0)
    expect(usableLatencyMs(0)).toBe(0)
    expect(usableLatencyMs(NaN)).toBe(0)
    expect(usableLatencyMs(null)).toBe(0)
    expect(usableLatencyMs(undefined)).toBe(0)
    expect(usableLatencyMs(230)).toBe(230)
  })
})

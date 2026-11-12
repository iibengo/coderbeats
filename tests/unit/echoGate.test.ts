import { describe, expect, it } from 'vitest'
import { analyzeEchoTest, EchoGate } from '../../app/lib/echoGate'

describe('EchoGate', () => {
  const gate = () => {
    const g = new EchoGate({ roundTrip: 0.03, echoLevel: 0.02 })
    g.addOutput(1)
    g.addOutput(2)
    return g
  }

  it('descarta onsets en la llegada esperada del eco (±25 ms)', () => {
    const g = gate()
    expect(g.isEcho(1.03, 0.02)).toBe(true)
    expect(g.isEcho(1.05, 0.02)).toBe(true)
    expect(g.isEcho(2.01, 0.03)).toBe(true)
  })

  it('acepta onsets lejos de cualquier eco', () => {
    expect(gate().isEcho(1.5, 0.02)).toBe(false)
    expect(gate().isEcho(1.06, 0.02)).toBe(false)
  })

  it('acepta un golpe simultáneo más de 10 dB por encima del eco', () => {
    expect(gate().isEcho(1.03, 0.02 * 10 ** (11 / 20))).toBe(false)
    expect(gate().isEcho(1.03, 0.02 * 10 ** (9 / 20))).toBe(true)
  })

  it('prune olvida los eventos antiguos', () => {
    const g = gate()
    g.prune(5)
    expect(g.isEcho(2.03, 0.02)).toBe(false)
  })
})

describe('analyzeEchoTest', () => {
  const clicks = [1, 1.4, 1.8]

  it('detecta fuga y mide la ida y vuelta (mediana) y el nivel', () => {
    const r = analyzeEchoTest(clicks, [
      { time: 1.031, strength: 0.02 },
      { time: 1.429, strength: 0.03 },
      { time: 1.83, strength: 0.025 },
    ])
    expect(r.bleed).toBe(true)
    expect(r.matched).toBe(3)
    expect(r.roundTrip).toBeCloseTo(0.03, 6)
    expect(r.echoLevel).toBe(0.025)
  })

  it('sin onsets cerca de los clics → sin fuga', () => {
    expect(analyzeEchoTest(clicks, [{ time: 2.5, strength: 0.1 }])).toMatchObject({ bleed: false, matched: 0 })
  })

  it('retrasos inconsistentes (ruido casual) no son eco', () => {
    const r = analyzeEchoTest(clicks, [
      { time: 1.2, strength: 0.05 },
      { time: 1.45, strength: 0.05 },
      { time: 1.9, strength: 0.05 },
    ])
    expect(r.bleed).toBe(false)
  })

  it('basta con 2 de 3 clics para considerar fuga', () => {
    expect(analyzeEchoTest(clicks, [{ time: 1.03, strength: 0.02 }, { time: 1.43, strength: 0.02 }]).bleed).toBe(true)
  })
})

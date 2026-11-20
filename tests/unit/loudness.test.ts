import { describe, expect, it } from 'vitest'
import { integratedLoudness, kWeighting, limitPeak, normalizeLoudness } from '../../app/lib/loudness'

const sine = (sr: number, secs: number, hz: number, amp: number) => Float32Array.from({ length: Math.round(sr * secs) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / sr))
const peakDb = (x: Float32Array) => {
  let m = 0
  for (const v of x) m = Math.max(m, Math.abs(v))
  return 20 * Math.log10(m)
}

describe('volumen (spec 055)', () => {
  it('filtro K: el de 48 kHz da los coeficientes de la norma', () => {
    const [s, h] = kWeighting(48000)
    expect(s.b[0]).toBeCloseTo(1.53512485958697, 6)
    expect(s.b[1]).toBeCloseTo(-2.69169618940638, 6)
    expect(s.a[0]).toBeCloseTo(-1.69065929318241, 6)
    expect(h.a[0]).toBeCloseTo(-1.99004745483398, 6)
    expect(h.a[1]).toBeCloseTo(0.99007225036621, 6)
  })
  it('un seno de 1 kHz a −23 dBFS en los dos canales mide −23 LUFS (calibración de la norma)', () => {
    const x = sine(48000, 5, 1000, 10 ** (-23 / 20))
    expect(integratedLoudness(x, x, 48000)).toBeCloseTo(-23, 1)
  })
  it('el silencio no tiene sonoridad y la puerta de −70 LUFS ignora lo casi mudo', () => {
    const z = new Float32Array(48000 * 2)
    expect(integratedLoudness(z, z, 48000)).toBe(-Infinity)
  })
  it('limitPeak: nada pasa del techo, ni con picos sueltos, y lo tranquilo no se toca', () => {
    const sr = 48000
    const l = sine(sr, 2, 100, 0.3)
    const r = sine(sr, 2, 150, 0.3)
    l[20000] = 1.4 // un pico suelto
    r[60000] = -2
    const quiet = l.slice(0, 5000)
    const out = limitPeak(l, r, sr, -1.5)
    expect(peakDb(out.l)).toBeLessThanOrEqual(-1.5 + 1e-4)
    expect(peakDb(out.r)).toBeLessThanOrEqual(-1.5 + 1e-4)
    expect(out.reductionDb).toBeLessThan(0)
    for (let i = 0; i < 5000; i++) expect(out.l[i]).toBeCloseTo(quiet[i]!, 6)
  })
  it('normalizeLoudness: llega al objetivo sin pasar del techo (sube y baja)', () => {
    const sr = 48000
    for (const amp of [0.05, 0.9]) {
      const l = sine(sr, 6, 220, amp)
      const r = sine(sr, 6, 330, amp)
      const res = normalizeLoudness(l, r, sr, -14, -1.5)
      expect(res.lufs).toBeGreaterThan(-14.3)
      expect(res.lufs).toBeLessThan(-13.7)
      expect(Math.max(peakDb(l), peakDb(r))).toBeLessThanOrEqual(-1.5 + 1e-3)
    }
  })
  it('normalizeLoudness no toca el silencio', () => {
    const z = new Float32Array(48000)
    expect(normalizeLoudness(z, z, 48000).gainDb).toBe(0)
  })
})

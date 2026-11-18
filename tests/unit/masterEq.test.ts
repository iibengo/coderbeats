import { describe, expect, it } from 'vitest'
import { EQ_TECHNO } from '../../app/lib/masterChain'

const SR = 48000
/** respuesta (dB) de un biquad del cuaderno de RBJ (el que implementa Web Audio) a la frecuencia f */
function biquadDb(type: 'highpass' | 'peaking', f0: number, q: number, gainDb: number, f: number): number {
  const w0 = (2 * Math.PI * f0) / SR
  const A = 10 ** (gainDb / 40)
  const alpha = Math.sin(w0) / (2 * q)
  const cos = Math.cos(w0)
  let b = [0, 0, 0]
  let a = [0, 0, 0]
  if (type === 'highpass') {
    b = [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
    a = [1 + alpha, -2 * cos, 1 - alpha]
  } else {
    b = [1 + alpha * A, -2 * cos, 1 - alpha * A]
    a = [1 + alpha / A, -2 * cos, 1 - alpha / A]
  }
  const w = (2 * Math.PI * f) / SR
  const mag = (c: number[]) => Math.hypot(c[0]! + c[1]! * Math.cos(-w) + c[2]! * Math.cos(-2 * w), c[1]! * Math.sin(-w) + c[2]! * Math.sin(-2 * w))
  return 20 * Math.log10(mag(b) / mag(a))
}
const eq = (f: number) => biquadDb('highpass', EQ_TECHNO.highpassHz, EQ_TECHNO.highpassQ, 0, f) + biquadDb('peaking', EQ_TECHNO.peakHz, EQ_TECHNO.peakQ, EQ_TECHNO.peakDb, f)

describe('el EQ de la salida (spec 047)', () => {
  it('corta por debajo de 30 Hz: a 20 Hz baja más de 4 dB y a 10 Hz más de 12; a 30 Hz, −3 dB (la esquina)', () => {
    expect(eq(20)).toBeLessThan(-4)
    expect(eq(10)).toBeLessThan(-12)
    expect(biquadDb('highpass', 30, EQ_TECHNO.highpassQ, 0, 30)).toBeCloseTo(-3, 0)
  })
  it('no toca el bombo ni el cuerpo: a 50 Hz y a 100 Hz la diferencia es menor de 1 dB, y a 1 kHz casi nada', () => {
    expect(Math.abs(eq(50))).toBeLessThan(1)
    expect(Math.abs(eq(100))).toBeLessThan(0.3)
    expect(Math.abs(eq(500))).toBeLessThan(0.7)
  })
  it('realza de 2 a 5 kHz (el brillo): al menos +1,5 dB en todo el tramo y el máximo (+2,5 dB) hacia 3,2 kHz', () => {
    for (const f of [2000, 2500, 3200, 4000, 5000]) expect(eq(f), `${f} Hz`).toBeGreaterThan(1.5)
    expect(eq(3200)).toBeCloseTo(EQ_TECHNO.peakDb, 0)
    expect(eq(3200)).toBeLessThan(EQ_TECHNO.peakDb + 0.3)
  })
  it('suave: nunca más de +2,6 dB ni ruido por arriba (a 10 kHz, menos de +1 dB)', () => {
    for (let f = 40; f < 20000; f *= 1.2) expect(eq(f)).toBeLessThan(2.6)
    expect(eq(10000)).toBeLessThan(1)
  })
})

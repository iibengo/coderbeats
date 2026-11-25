import { describe, expect, it } from 'vitest'
import { STING_AT, STING_SECONDS, renderSting } from '../../app/lib/devilSting'

const rms = (x: Float32Array, sr: number, from: number, to: number): number => {
  const a = Math.round(from * sr)
  const b = Math.min(x.length, Math.round(to * sr))
  let s = 0
  for (let i = a; i < b; i++) s += x[i]! * x[i]!
  return Math.sqrt(s / Math.max(1, b - a))
}
const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0)

describe('el sonido del diablillo (spec 061, paso 7)', () => {
  it('dura lo que dice, con los dos canales, sin NaN y con el pico en −3 dBFS', () => {
    for (const sr of [44100, 48000]) {
      const { l, r } = renderSting(sr)
      expect(l.length).toBe(Math.round(STING_SECONDS * sr))
      expect(r.length).toBe(l.length)
      expect(l.every(Number.isFinite) && r.every(Number.isFinite)).toBe(true)
      expect(Math.max(peak(l), peak(r))).toBeCloseTo(10 ** (-3 / 20), 3)
    }
  })

  it('es siempre el mismo (sin azar suelto) y es estéreo de verdad', () => {
    const a = renderSting(44100)
    const b = renderSting(44100)
    expect(Array.from(a.l.slice(0, 5000))).toEqual(Array.from(b.l.slice(0, 5000)))
    expect(Array.from(a.r.slice(20000, 25000))).toEqual(Array.from(b.r.slice(20000, 25000)))
    let diff = 0
    for (let i = 20000; i < 60000; i++) diff += Math.abs(a.l[i]! - a.r[i]!)
    expect(diff).toBeGreaterThan(1) // la derecha no es una copia de la izquierda
  })

  it('cada cosa en su sitio: barrido, golpe, la risa en dos sílabas y una cola que se apaga', () => {
    const sr = 44100
    const { l } = renderSting(sr)
    const sweep = rms(l, sr, 0.25, 0.41)
    const kick = rms(l, sr, STING_AT.kick, STING_AT.kick + 0.1)
    const laugh1 = rms(l, sr, STING_AT.laugh1, STING_AT.laugh1 + 0.1)
    const gap = rms(l, sr, STING_AT.laugh1 + 0.11, STING_AT.laugh2)
    const laugh2 = rms(l, sr, STING_AT.laugh2, STING_AT.laugh2 + 0.11)
    const tail = rms(l, sr, 1.9, 2.3)
    expect(rms(l, sr, 0, 0.05)).toBeLessThan(sweep) // el barrido sube desde casi nada
    expect(kick).toBeGreaterThan(laugh1) // el golpe manda
    expect(laugh1).toBeGreaterThan(tail * 4) // la risa se oye claramente
    expect(laugh2).toBeGreaterThan(tail * 4)
    expect(gap).toBeLessThan(laugh1) // dos sílabas, con un respiro entre ellas
    expect(tail).toBeLessThan(laugh1 / 4) // y la cola se apaga
    expect(Math.abs(l[l.length - 1]!)).toBeLessThan(1e-3) // acaba en silencio, sin chasquido
  })

  it('la risa va por debajo del golpe: unos 5 dB, como en la mezcla que eligió Ion', () => {
    const sr = 44100
    const { l } = renderSting(sr)
    const pk = (from: number, to: number) => peak(l.slice(Math.round(from * sr), Math.round(to * sr)))
    const db = (v: number) => 20 * Math.log10(v)
    const diff = db(pk(STING_AT.kick, STING_AT.kick + 0.2)) - db(pk(STING_AT.laugh1, STING_AT.laugh1 + 0.12))
    expect(diff).toBeGreaterThan(2)
    expect(diff).toBeLessThan(9)
  })
})

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIMITER_TRUE } from '../../app/lib/masterChain'

type Lim = { n: number; process(l: number, r: number, out: number[]): number }
const mod: { exports: { BrickwallLimiter?: new (sr: number, o: typeof LIMITER_TRUE) => Lim } } = { exports: {} }
new Function('module', readFileSync('public/worklets/master-limiter.js', 'utf8'))(mod)
const Limiter = mod.exports.BrickwallLimiter!
const SR = 48000
const CEIL = 10 ** (LIMITER_TRUE.ceilingDb / 20)
const run = (x: number[], y: number[] = x) => {
  const lim = new Limiter(SR, LIMITER_TRUE)
  const out = [0, 0]
  const L: number[] = []
  const R: number[] = []
  x.forEach((v, i) => {
    lim.process(v, y[i]!, out)
    L.push(out[0]!)
    R.push(out[1]!)
  })
  return { L, R, n: lim.n }
}
const sine = (amp: number, secs: number, hz = 220) => Array.from({ length: Math.round(SR * secs) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / SR))

describe('el limitador de pico de la salida (spec 047)', () => {
  it('el techo es −1 dBFS y la mirada hacia delante es corta (1,5 ms)', () => {
    expect(LIMITER_TRUE.ceilingDb).toBe(-1)
    expect(LIMITER_TRUE.lookaheadMs).toBeLessThanOrEqual(2)
  })
  it('por debajo del techo no toca nada: sale la misma señal, retrasada n muestras, exacta', () => {
    const x = sine(0.5, 0.3)
    const { L, n } = run(x)
    for (let i = n; i < x.length; i++) expect(L[i]).toBeCloseTo(x[i - n]!, 6)
  })
  it('ningún pico pasa del techo, ni con una señal 12 dB por encima, ni con un golpe suelto', () => {
    const loud = run(sine(4, 0.5, 110))
    expect(Math.max(...loud.L.map(Math.abs))).toBeLessThanOrEqual(CEIL + 1e-6)
    const click = new Array(SR / 2).fill(0)
    for (const k of [1000, 5000, 20000]) click[k] = 3 // golpes de +9,5 dB
    const c = run(click)
    expect(Math.max(...c.L.map(Math.abs))).toBeLessThanOrEqual(CEIL + 1e-6)
    expect(Math.max(...c.L.map(Math.abs))).toBeGreaterThan(CEIL * 0.7) // y no se traga el golpe: sale casi al techo
  })
  it('estéreo enlazado: un pico en un canal baja los dos por igual (no mueve la imagen)', () => {
    const x = new Array(SR / 4).fill(0.3)
    const y = new Array(SR / 4).fill(0.3)
    x[5000] = 2
    const { L, R } = run(x, y)
    const i = L.findIndex((v) => Math.abs(v) > 0.3 + 1e-9)
    // alrededor del golpe, la relación entre canales se mantiene (misma ganancia)
    for (let k = 4900; k < 5100; k++) if (Math.abs(R[k]!) > 1e-9) expect(L[k]! / R[k]!).toBeCloseTo(x[k - 72 < 0 ? 0 : k - 72]! / y[k - 72 < 0 ? 0 : k - 72]!, 3)
    expect(i).toBeGreaterThanOrEqual(0)
  })
  it('la ganancia vuelve despacio (80 ms): tras un pico, la señal normal tarda en recuperar el nivel, y lo recupera', () => {
    const x = sine(0.5, 1)
    for (let i = 3000; i < 3040; i++) x[i] = 3 * Math.sign(x[i]!)
    const { L, n } = run(x)
    const level = (a: number, b: number) => Math.max(...L.slice(a, b).map(Math.abs))
    expect(level(3500, 3500 + 480)).toBeLessThan(0.5 * 0.98) // justo después, todavía baja
    expect(level(SR - 2000, SR - 1000)).toBeGreaterThan(0.5 * 0.99) // al final del segundo, recuperado
    expect(n).toBe(Math.round((LIMITER_TRUE.lookaheadMs / 1000) * SR))
  })
})

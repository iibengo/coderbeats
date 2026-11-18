import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { GLUE_TECHNO, GLUE_WARM, SATURATION, glueOptions, saturate, saturationCurve, type GlueOptions } from '../../app/lib/masterChain'

type Glue = { gain(l: number, r: number): number; target(db: number): number; grDb: number; set(o: GlueOptions): void }
// el worklet es JS plano (no se importa): se evalúa el archivo tal cual, con un `module` falso, sin los globales del worklet
const mod: { exports: { GlueCompressor?: new (sr: number, o: GlueOptions) => Glue } } = { exports: {} }
new Function('module', readFileSync('public/worklets/master-glue.js', 'utf8'))(mod)
const GlueCompressor = mod.exports.GlueCompressor!
const SR = 44100
const db = (g: number) => 20 * Math.log10(g)

describe('el saturador (spec 010, §7)', () => {
  it('ganancia 1 con señal pequeña: no sube ni baja lo que no es fuerte', () => {
    for (const x of [0.001, 0.01, 0.05]) expect(saturate(x) / x).toBeCloseTo(1, 1)
    expect(saturate(0)).toBeCloseTo(0, 10)
  })
  it('acotado, monótono y suave: los picos se redondean, no se cortan', () => {
    const c = saturationCurve(513)
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThan(c[i - 1]!)
    expect(Math.max(...c.map(Math.abs))).toBeLessThan(1.2)
    expect(saturate(1)).toBeLessThan(1) // el pico se baja
    expect(saturate(0.5) / 0.5).toBeGreaterThan(saturate(1) / 1) // y cuanto más fuerte, más se baja
  })
  it('un pelín de asimetría (armónicos pares: el calor): no es simétrica', () => {
    expect(SATURATION.bias).toBeGreaterThan(0)
    expect(Math.abs(saturate(0.8) + saturate(-0.8))).toBeGreaterThan(1e-3)
    expect(Math.abs(saturate(0.8) + saturate(-0.8))).toBeLessThan(0.08)
  })
})

describe('el compresor de pegamento (spec 010, §7): suave y sin latencia', () => {
  it('por debajo del umbral no toca nada (solo el makeup)', () => {
    const g = new GlueCompressor(SR, GLUE_WARM)
    for (let i = 0; i < SR; i++) g.gain(0.02 * Math.sin(i / 7), 0.02 * Math.sin(i / 7)) // ≈ −37 dB
    expect(g.grDb).toBeCloseTo(0, 1)
  })
  it('sin latencia: es de alimentación hacia delante, devuelve la ganancia de la muestra actual (no hay lookahead)', () => {
    const g = new GlueCompressor(SR, GLUE_WARM)
    expect(typeof g.gain(0.5, 0.5)).toBe('number')
    // la ganancia de la primera muestra ya existe y es ≈ la de reposo (el compresor no mira hacia delante)
    expect(db(g.gain(0, 0))).toBeCloseTo(GLUE_WARM.makeupDb, 0)
  })
  it('con una mezcla fuerte (≈ −12 dB RMS) baja entre 1 y 3 dB; una muy fuerte (−6 dB RMS), unos 4', () => {
    const g = new GlueCompressor(SR, GLUE_WARM)
    let min = 0
    for (let i = 0; i < SR * 2; i++) {
      const x = 0.35 * Math.sin((2 * Math.PI * 220 * i) / SR) // RMS ≈ −12 dB
      g.gain(x, x)
      min = Math.min(min, g.grDb)
    }
    expect(min).toBeLessThan(-1)
    expect(min).toBeGreaterThan(-3)
    const hot = new GlueCompressor(SR, GLUE_WARM)
    for (let i = 0; i < SR * 2; i++) hot.gain(0.7 * Math.sin((2 * Math.PI * 220 * i) / SR), 0.7 * Math.sin((2 * Math.PI * 220 * i) / SR))
    expect(hot.grDb).toBeGreaterThan(-5)
  })
  it('NO bombea con el bombo: un bombo a 128 bpm sobre una cama fuerte mueve la ganancia menos de 1,5 dB', () => {
    const beat = Math.round((60 / 128) * SR)
    const g = new GlueCompressor(SR, GLUE_WARM)
    // cama (acordes y bajo, ya con el sidechain del bombo, bajando un poco en cada golpe) + golpe de bombo cada tiempo
    let lo = 0
    let hi = -99
    for (let i = 0; i < beat * 24; i++) {
      const t = i % beat
      const duck = 1 - 0.6 * Math.exp(-t / (0.12 * SR)) // el sidechain: la cama baja en el golpe y vuelve
      const bed = 0.32 * duck * Math.sin((2 * Math.PI * 110 * i) / SR)
      const kick = t < 0.2 * SR ? 0.85 * Math.exp(-t / (0.06 * SR)) * Math.sin((2 * Math.PI * (55 + 120 * Math.exp(-t / (0.02 * SR))) * i) / SR) : 0
      const x = bed + kick
      g.gain(x, x)
      if (i > beat * 8) {
        lo = Math.min(lo, g.grDb)
        hi = Math.max(hi, g.grDb)
      }
    }
    expect(hi - lo).toBeLessThan(1.5) // la ganancia casi no se mueve de un golpe a otro
    expect(lo).toBeGreaterThan(-3) // y nunca baja más de 3 dB
  })
  it('la rodilla es blanda y continua: la reducción crece sin saltos y nunca es positiva', () => {
    const g = new GlueCompressor(SR, GLUE_WARM)
    let prev = 0
    for (let l = -40; l <= 0; l += 0.5) {
      const t = g.target(l)
      expect(t).toBeLessThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(prev + 1e-9) // más fuerte → más reducción
      expect(Math.abs(t - prev)).toBeLessThan(0.8) // sin saltos
      prev = t
    }
  })
  it('los ajustes son los que se dicen: suaves, y la suelta más corta que un tiempo a 128 bpm', () => {
    expect(GLUE_WARM.ratio).toBeLessThanOrEqual(2)
    expect(GLUE_WARM.release).toBeLessThan(60 / 128)
    expect(GLUE_WARM.attack).toBeGreaterThanOrEqual(0.02)
  })
})

describe('el compresor «techno» de la salida (spec 042)', () => {
  const loud = (g: Glue, amp: number) => {
    for (let i = 0; i < SR * 2; i++) g.gain(amp * Math.sin(i / 7), amp * Math.sin(i / 7))
    return g.grDb
  }
  it('apagado, los ajustes son exactamente los de siempre (el mismo objeto)', () => {
    expect(glueOptions(false)).toBe(GLUE_WARM)
    expect(glueOptions(true)).toBe(GLUE_TECHNO)
    expect(GLUE_WARM).toEqual({ thresholdDb: -16, ratio: 1.8, kneeDb: 12, attack: 0.03, release: 0.12, rmsMs: 40, makeupDb: 1 })
  })
  it('suave: ratio 3, umbral alto, mismo ataque lento y suelta corta; no toca lo flojo', () => {
    expect(GLUE_TECHNO.ratio).toBe(3)
    expect(GLUE_TECHNO.thresholdDb).toBe(GLUE_WARM.thresholdDb)
    expect(GLUE_TECHNO.attack).toBe(GLUE_WARM.attack)
    expect(GLUE_TECHNO.release).toBe(GLUE_WARM.release)
    expect(loud(new GlueCompressor(SR, GLUE_TECHNO), 0.02)).toBeCloseTo(0, 1) // ≈ −37 dB
  })
  it('comprime más que el de siempre en una mezcla fuerte, y no demasiado (como mucho ~7 dB con una señal casi a tope)', () => {
    const warm = loud(new GlueCompressor(SR, GLUE_WARM), 0.7)
    const techno = loud(new GlueCompressor(SR, GLUE_TECHNO), 0.7)
    expect(techno).toBeLessThan(warm) // más reducción (más negativa)
    expect(techno).toBeGreaterThan(-8)
  })
  it('cambiar de ajustes en marcha da lo mismo que empezar con ellos, y sin saltos', () => {
    const g = new GlueCompressor(SR, GLUE_WARM)
    loud(g, 0.5)
    g.set(GLUE_TECHNO)
    const a = loud(g, 0.5)
    const b = loud(new GlueCompressor(SR, GLUE_TECHNO), 0.5)
    expect(a).toBeCloseTo(b, 1)
    g.set(GLUE_WARM)
    expect(Math.abs(g.gain(0.1, 0.1) - g.gain(0.1, 0.1))).toBeLessThan(0.01) // sin salto en la ganancia
  })
  it('sigue sin latencia (alimentación hacia delante)', () => {
    const g = new GlueCompressor(SR, GLUE_TECHNO)
    expect(typeof g.gain(0.5, 0.5)).toBe('number')
  })
})

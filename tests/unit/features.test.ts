import { describe, expect, it } from 'vitest'
import { extractFeatures, toVector } from '../../app/lib/features'
import { distance } from '../../app/lib/classifier'
import { place, silence, sound, type SynthSound } from '../helpers/synth'

const SR = 48000
function featuresOf(kind: SynthSound, gain = 0.8, seed = 1, noise = true) {
  const buf = noise ? silence(0.5, SR) : new Float32Array(0.5 * SR)
  place(buf, sound(kind, SR, gain, seed), 0.1, SR)
  return extractFeatures(buf, SR, 0.1 * SR)
}

describe('extractFeatures', () => {
  it('centroide: ts > pff > bum', () => {
    const [bum, pff, ts] = (['bum', 'pff', 'ts'] as const).map((k) => featuresOf(k).centroid)
    expect(ts).toBeGreaterThan(pff!)
    expect(pff).toBeGreaterThan(bum!)
  })

  it('la banda < 150 Hz domina en bum y la > 4 kHz en ts', () => {
    const bum = featuresOf('bum').bands
    const ts = featuresOf('ts').bands
    expect(bum[0]).toBeGreaterThan(0.5)
    expect(ts[3]).toBeGreaterThan(0.5)
    expect(bum.reduce((a, b) => a + b)).toBeCloseTo(1, 5)
  })

  it('vector de 19 dimensiones sin NaN, también en silencio', () => {
    for (const f of [featuresOf('pff'), extractFeatures(new Float32Array(4096), SR, 0)]) {
      const v = toVector(f)
      expect(v).toHaveLength(19)
      expect(v.every(Number.isFinite)).toBe(true)
    }
  })

  it('el volumen no cambia el vector (sin ruido de fondo)', () => {
    const loud = toVector(featuresOf('pff', 0.8, 1, false))
    const soft = toVector(featuresOf('pff', 0.2, 1, false))
    expect(distance(loud, soft)).toBeLessThan(1e-3)
  })

  it('una ventana al final del buffer no falla', () => {
    const buf = silence(0.1, SR)
    expect(() => extractFeatures(buf, SR, buf.length - 10)).not.toThrow()
  })
})

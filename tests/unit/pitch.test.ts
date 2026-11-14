import { describe, expect, it } from 'vitest'
import { Fft } from '../../app/lib/fft'
import { hzToMidi, medianTrack, midiToHz, trackPitch, YinEstimator } from '../../app/lib/pitch'
import { prng, sound } from '../helpers/synth'
import { octaveGlitch, voice } from '../helpers/voice'

const SR = 48000
const voicedMidi = (t: ReturnType<typeof trackPitch>, from = 0, to = Infinity) =>
  [...t.midi].filter((m, i) => t.prob[i]! >= 0.6 && t.times[i]! >= from && t.times[i]! <= to && !Number.isNaN(m))

describe('fft', () => {
  it('la inversa devuelve la señal y una senoide cae en su bin', () => {
    const f = new Fft(64)
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * 5 * i) / 64))
    const im = new Float64Array(64)
    const orig = Float64Array.from(re)
    f.transform(re, im)
    const mag = Array.from(re, (r, i) => Math.hypot(r, im[i]!))
    expect(mag.indexOf(Math.max(...mag.slice(0, 32)))).toBe(5)
    f.transform(re, im, true)
    for (let i = 0; i < 64; i++) expect(re[i]! / 64).toBeCloseTo(orig[i]!, 9)
  })
  it('rechaza tamaños que no son potencia de 2', () => expect(() => new Fft(100)).toThrow())
})

describe('YIN', () => {
  it('hz ↔ midi', () => {
    expect(hzToMidi(440)).toBeCloseTo(69, 9)
    expect(midiToHz(57)).toBeCloseTo(220, 6)
  })

  it('una senoide pura da su altura con precisión de centésimas de semitono', () => {
    for (const hz of [110, 220, 330, 523.25, 880]) {
      const x = Float32Array.from({ length: SR / 2 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / SR))
      const r = new YinEstimator(SR).estimate(x, 8000)
      expect(r.midi).toBeCloseTo(hzToMidi(hz), 1)
      expect(r.prob).toBeGreaterThan(0.9)
    }
  })

  it('voz sintética (armónicos y formantes) de C3 a A5: altura correcta y sin errores de octava', () => {
    for (const midi of [48, 55, 60, 67, 72, 81]) {
      const t = trackPitch(voice(SR, [{ midi, sec: 0.6 }]), SR)
      const v = voicedMidi(t, 0.1, 0.5)
      expect(v.length).toBeGreaterThan(10)
      for (const m of v) expect(Math.abs(m - midi)).toBeLessThan(0.3)
    }
  })

  it('el silencio y el ruido no tienen voz', () => {
    const rand = prng(3)
    const noise = Float32Array.from({ length: SR / 2 }, () => (rand() * 2 - 1) * 0.3)
    const t = trackPitch(noise, SR)
    expect(voicedMidi(t).length / t.midi.length).toBeLessThan(0.1)
    const z = trackPitch(new Float32Array(SR / 2), SR)
    expect([...z.prob].every((p) => p === 0)).toBe(true)
  })

  it('un "ts" y un "pff" (ruido) no tienen voz', () => {
    for (const kind of ['ts', 'pff'] as const) {
      const t = trackPitch(sound(kind, SR, 0.8), SR)
      expect(voicedMidi(t).length / Math.max(1, t.midi.length)).toBeLessThan(0.2)
    }
  })

  it('medianTrack quita un salto de octava de 3 frames sin mover los bordes', () => {
    const midi = new Float32Array(40).fill(60)
    const prob = new Float32Array(40).fill(0.95)
    for (let i = 18; i < 21; i++) midi[i] = 72
    for (let i = 30; i < 40; i++) midi[i] = 64 // cambio de nota real: se conserva
    const out = medianTrack(midi, prob, 7)
    for (let i = 0; i < 28; i++) expect(out[i]).toBe(60)
    expect(out[35]).toBe(64)
    // una nota sin voz no se toca
    prob[5] = 0.1
    midi[5] = 33
    expect(medianTrack(midi, prob, 7)[5]).toBe(33)
  })

  it('un fallo de octava de ~30 ms (3 frames reales) se arregla con la mediana de 7', () => {
    const x = octaveGlitch(SR, 60, 0.8, 0.4, 0.03)
    const bad = (t: ReturnType<typeof trackPitch>) => voicedMidi(t, 0.1, 0.7).filter((m) => Math.abs(m - 60) > 6).length
    expect(bad(trackPitch(x, SR, { median: 1 }))).toBeGreaterThan(0)
    expect(bad(trackPitch(x, SR))).toBe(0)
  })

  // Límite conocido: desde ~40 ms (5+ frames seguidos) la mediana de 7 ya no basta. Si el laboratorio muestra
  // fallos así en voz real, se sube la mediana o se pasa a pYIN (spec 002, §4.1).

  it('voz suave (−35 dBFS con ruido a −60) se sigue', () => {
    const t = trackPitch(voice(SR, [{ midi: 64, sec: 0.6 }], { peakDb: -35, noiseDb: -60 }), SR)
    const v = voicedMidi(t, 0.1, 0.5)
    expect(v.length).toBeGreaterThan(10)
    for (const m of v) expect(Math.abs(m - 64)).toBeLessThan(0.5)
  })

  it('el vibrato de ±40 cents oscila alrededor de la nota', () => {
    const t = trackPitch(voice(SR, [{ midi: 69, sec: 1.2, vibrato: 0.4 }]), SR)
    const v = voicedMidi(t, 0.1, 1.1)
    expect(v.reduce((a, b) => a + b, 0) / v.length).toBeCloseTo(69, 0)
    expect(Math.max(...v) - Math.min(...v)).toBeGreaterThan(0.4)
  })
})

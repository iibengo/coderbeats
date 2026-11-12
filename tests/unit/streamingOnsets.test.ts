import { describe, expect, it } from 'vitest'
import { detectOnsets } from '../../app/lib/onsets'
import { minGapForCell, StreamingOnsetDetector, type StreamOnset } from '../../app/lib/streamingOnsets'
import { place, prng, silence, sound, type SynthSound } from '../helpers/synth'

const SR = 48000

function take(): { buf: Float32Array; times: number[] } {
  const buf = silence(4, SR)
  const kinds: SynthSound[] = ['bum', 'ts', 'pff', 'ts', 'bum', 'bum', 'pff', 'ts', 'pff', 'bum']
  const times = kinds.map((_, i) => 0.2 + i * 0.37)
  kinds.forEach((k, i) => place(buf, sound(k, SR, 0.3 + (i % 3) * 0.25, i + 1), times[i]!, SR))
  return { buf, times }
}

function streamed(buf: Float32Array, seed: number, maxChunk: number): StreamOnset[] {
  const d = new StreamingOnsetDetector(SR)
  const rand = prng(seed)
  const out: StreamOnset[] = []
  for (let i = 0; i < buf.length; ) {
    const n = 1 + Math.floor(rand() * maxChunk)
    out.push(...d.push(buf.subarray(i, i + n)))
    i += n
  }
  return [...out, ...d.flush()]
}

describe('StreamingOnsetDetector', () => {
  it('da el mismo resultado que el offline con trozos de tamaño aleatorio', () => {
    const { buf } = take()
    const offline = detectOnsets(buf, SR)
    expect(offline).toHaveLength(10)
    for (const [seed, max] of [
      [1, 128],
      [2, 700],
      [3, 4096],
    ] as const) {
      const s = streamed(buf, seed, max)
      expect(s.map((o) => o.time)).toEqual(offline.map((o) => o.time))
      expect(s.map((o) => o.strength)).toEqual(offline.map((o) => o.strength))
    }
  })

  it('decide cada golpe ≤ 120 ms después de que ocurra', () => {
    const { buf, times } = take()
    const d = new StreamingOnsetDetector(SR)
    const block = 512
    const delays: number[] = []
    for (let i = 0; i < buf.length; i += block) {
      const now = Math.min(buf.length, i + block) / SR
      for (const o of d.push(buf.subarray(i, i + block))) {
        const truth = times.reduce((a, b) => (Math.abs(b - o.time) < Math.abs(a - o.time) ? b : a))
        delays.push(now - truth)
      }
    }
    expect(delays).toHaveLength(times.length)
    expect(Math.max(...delays)).toBeLessThanOrEqual(0.12)
  })

  it('slice devuelve el audio retenido por posición absoluta', () => {
    const d = new StreamingOnsetDetector(SR)
    const a = Float32Array.from({ length: 1000 }, (_, i) => i)
    d.push(a)
    expect(Array.from(d.slice(10, 3))).toEqual([10, 11, 12])
    expect(Array.from(d.slice(998, 4))).toEqual([998, 999, 0, 0])
  })

  it('funciona en un stream largo (descarta audio antiguo)', () => {
    const d = new StreamingOnsetDetector(SR)
    const out: StreamOnset[] = []
    for (let s = 0; s < 12; s++) {
      const buf = silence(1, SR, -60, s + 1)
      place(buf, sound('pff', SR, 0.6, s + 1), 0.3, SR)
      out.push(...d.push(buf))
    }
    out.push(...d.flush())
    expect(out.map((o) => Math.round(o.time * 10) / 10)).toEqual(Array.from({ length: 12 }, (_, s) => s + 0.3))
  })
})

describe('anti-doble disparo', () => {
  it('minGapForCell: clamp(0,6 × celda, 60, 120 ms)', () => {
    expect(minGapForCell(60 / 90 / 4)).toBeCloseTo(0.1, 6)
    expect(minGapForCell(60 / 124 / 4)).toBeCloseTo(0.0726, 3)
    expect(minGapForCell((60 / 174 / 4) * 2)).toBeCloseTo(0.1034, 3)
    expect(minGapForCell(1)).toBe(0.12)
    expect(minGapForCell(0.01)).toBe(0.06)
  })

  it('"bum" con explosiva separada → 1 onset con la separación de hip hop 90', () => {
    const buf = silence(1, SR)
    place(buf, sound('clap', SR, 0.3, 1).map((v, i) => (i < 0.01 * SR ? v : 0)), 0.2, SR)
    place(buf, sound('bum', SR, 0.8, 2), 0.27, SR)
    expect(detectOnsets(buf, SR)).toHaveLength(2)
    expect(detectOnsets(buf, SR, { minGap: minGapForCell(60 / 90 / 4) })).toHaveLength(1)
  })

  it('en house 124, dos golpes a 90 ms siguen siendo 2', () => {
    const buf = silence(1, SR)
    place(buf, sound('ts', SR, 0.6, 1), 0.2, SR)
    place(buf, sound('ts', SR, 0.6, 2), 0.29, SR)
    expect(detectOnsets(buf, SR, { minGap: minGapForCell(60 / 124 / 4) })).toHaveLength(2)
  })
})

describe('puerta relativa', () => {
  it('descarta un golpe 30 dB más flojo que los anteriores y acepta uno de -12 dB', () => {
    const buf = silence(3, SR)
    ;[0.2, 0.5, 0.8, 1.1].forEach((t, i) => place(buf, sound('pff', SR, 0.8, i + 1), t, SR))
    place(buf, sound('pff', SR, 0.8 * 10 ** (-30 / 20), 9), 1.5, SR)
    place(buf, sound('pff', SR, 0.8 * 10 ** (-12 / 20), 10), 1.9, SR)
    const times = detectOnsets(buf, SR).map((o) => Math.round(o.time * 10) / 10)
    expect(times).toEqual([0.2, 0.5, 0.8, 1.1, 1.9])
  })
})

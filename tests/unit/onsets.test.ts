import { describe, expect, it } from 'vitest'
import { detectOnsets } from '../../app/lib/onsets'
import { place, silence, sound, type SynthSound } from '../helpers/synth'

function track(sr: number, hits: [SynthSound, number, number?][], seconds = 3) {
  const buf = silence(seconds, sr)
  hits.forEach(([kind, at, gain], i) => place(buf, sound(kind, sr, gain ?? 0.8, i + 1), at, sr))
  return buf
}

describe('detectOnsets', () => {
  for (const sr of [44100, 48000]) {
    it(`detecta golpes en tiempos conocidos con error ≤ 5 ms a ${sr} Hz`, () => {
      const times = [0.3, 0.62, 0.95, 1.4, 1.75, 2.2]
      const kinds: SynthSound[] = ['bum', 'pff', 'ts', 'bum', 'ts', 'pff']
      const onsets = detectOnsets(track(sr, times.map((t, i) => [kinds[i]!, t])), sr)
      expect(onsets).toHaveLength(times.length)
      onsets.forEach((o, i) => expect(Math.abs(o.time - times[i]!) * 1000).toBeLessThanOrEqual(5))
    })
  }

  it('no detecta nada en silencio con ruido de fondo', () => {
    expect(detectOnsets(silence(3, 48000), 48000)).toEqual([])
  })

  it('respeta la separación mínima de 60 ms', () => {
    const onsets = detectOnsets(track(48000, [['ts', 0.5], ['ts', 0.53]]), 48000)
    expect(onsets).toHaveLength(1)
  })

  it('detecta golpes suaves (-30 dBFS)', () => {
    const soft = 10 ** (-30 / 20)
    const onsets = detectOnsets(track(48000, [['pff', 0.5, soft], ['bum', 1.2, soft]]), 48000)
    expect(onsets.map((o) => Math.round(o.time * 10) / 10)).toEqual([0.5, 1.2])
  })

  it('la fuerza crece con el volumen', () => {
    const [a, b] = detectOnsets(track(48000, [['bum', 0.5, 0.2], ['bum', 1.2, 0.8]]), 48000)
    expect(b!.strength).toBeGreaterThan(a!.strength * 2)
  })
})

/** Voz sintética para probar la altura y las notas: pulsos glotales con armónicos, 3 formantes, vibrato y glissando. */
import { prng } from './synth'

export interface VoiceSegment {
  /** nota MIDI, o [de, a] para un glissando dentro del segmento */
  midi: number | [number, number]
  sec: number
  /** profundidad del vibrato en semitonos (±) a 5,5 Hz */
  vibrato?: number
}

export interface VoiceOptions {
  /** pico en dBFS del tramo más fuerte */
  peakDb?: number
  /** ruido blanco en dBFS */
  noiseDb?: number
  seed?: number
}

const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)

/** Una voz: los segmentos suenan seguidos; `null` es un silencio de `sec` segundos. */
export function voice(sr: number, segs: (VoiceSegment | { silence: number })[], o: VoiceOptions = {}): Float32Array {
  const rand = prng(o.seed ?? 7)
  const total = segs.reduce((s, g) => s + ('silence' in g ? g.silence : g.sec), 0)
  const out = new Float32Array(Math.round(total * sr))
  let pos = 0
  let phase = 0
  for (const g of segs) {
    if ('silence' in g) {
      pos += Math.round(g.silence * sr)
      continue
    }
    const len = Math.round(g.sec * sr)
    const [m0, m1] = Array.isArray(g.midi) ? g.midi : [g.midi, g.midi]
    for (let i = 0; i < len && pos + i < out.length; i++) {
      const t = i / sr
      const glide = len > 1 ? i / (len - 1) : 0
      let m = m0 + (m1 - m0) * glide
      if (g.vibrato) m += g.vibrato * Math.sin(2 * Math.PI * 5.5 * t)
      const f0 = hz(m)
      phase += (2 * Math.PI * f0) / sr
      // armónicos con caída 1/k y tres formantes de una vocal "a"
      let v = 0
      for (let k = 1; k <= 20 && k * f0 < sr / 2 - 500; k++) {
        const f = k * f0
        const form = [700, 1200, 2600].reduce((s, c) => s + Math.exp(-(((f - c) / 300) ** 2)), 0)
        v += ((1 / k) * (0.3 + form)) * Math.sin(k * phase)
      }
      // ataque y salida suaves de 10 ms
      const env = Math.min(1, t / 0.01, (len / sr - t) / 0.01)
      out[pos + i] = v * Math.max(0, env)
    }
    pos += len
  }
  let peak = 0
  for (const v of out) peak = Math.max(peak, Math.abs(v))
  const gain = peak > 0 ? 10 ** ((o.peakDb ?? -6) / 20) / peak : 1
  const noise = 10 ** ((o.noiseDb ?? -90) / 20)
  for (let i = 0; i < out.length; i++) out[i] = out[i]! * gain + (rand() * 2 - 1) * noise
  return out
}

/** Inyecta un salto de octava de `frames` muestras de longitud: duplica la frecuencia en un tramo. */
export const octaveGlitch = (sr: number, midi: number, sec: number, at: number, glitchSec: number): Float32Array => {
  const a = voice(sr, [{ midi, sec }])
  const b = voice(sr, [{ midi: midi + 12, sec }])
  const from = Math.round(at * sr)
  const to = from + Math.round(glitchSec * sr)
  const out = Float32Array.from(a)
  for (let i = from; i < to && i < out.length; i++) out[i] = b[i]!
  return out
}

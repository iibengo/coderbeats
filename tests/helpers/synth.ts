/** Generador de audio sintético determinista para los tests. */

export function prng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type SynthSound = 'bum' | 'pff' | 'ts' | 'clap'

/** Filtro de un polo, paso bajo (`alpha` en 0..1). */
function lowpass(x: Float32Array, alpha: number): Float32Array {
  const y = new Float32Array(x.length)
  let p = 0
  for (let i = 0; i < x.length; i++) p = y[i] = p + alpha * (x[i]! - p)
  return y
}

const highpass = (x: Float32Array, alpha: number): Float32Array => {
  const lp = lowpass(x, alpha)
  return x.map((v, i) => v - lp[i]!)
}

const alphaFor = (hz: number, sr: number) => 1 - Math.exp((-2 * Math.PI * hz) / sr)

/** Un golpe sintético de `seconds` de duración y amplitud de pico ~`gain`. */
export function sound(kind: SynthSound, sr: number, gain = 0.8, seed = 1): Float32Array {
  const rand = prng(seed)
  const len = Math.round(sr * 0.25)
  const noise = Float32Array.from({ length: len }, () => rand() * 2 - 1)
  let out: Float32Array
  let tau: number
  switch (kind) {
    case 'bum': {
      tau = 0.08
      out = new Float32Array(len)
      let phase = 0
      for (let i = 0; i < len; i++) {
        const t = i / sr
        phase += (2 * Math.PI * (45 + 15 * Math.exp(-t / 0.03))) / sr
        out[i] = Math.sin(phase)
      }
      break
    }
    case 'pff':
      tau = 0.04
      out = lowpass(highpass(noise, alphaFor(1000, sr)), alphaFor(4000, sr))
      break
    case 'ts':
      tau = 0.025
      out = highpass(highpass(noise, alphaFor(6000, sr)), alphaFor(6000, sr))
      break
    case 'clap':
      tau = 0.03
      out = noise
      break
  }
  let peak = 0
  for (let i = 0; i < len; i++) {
    const fadeOut = Math.min(1, (len - i) / (0.02 * sr))
    const env = Math.min(1, i / (0.001 * sr)) * Math.exp(-i / sr / tau) * fadeOut
    out[i] = out[i]! * env
    peak = Math.max(peak, Math.abs(out[i]!))
  }
  return out.map((v) => (v / (peak || 1)) * gain)
}

/** Buffer de `seconds` con ruido de fondo a `noiseDb` dBFS. */
export function silence(seconds: number, sr: number, noiseDb = -60, seed = 7): Float32Array {
  const rand = prng(seed)
  const a = 10 ** (noiseDb / 20) * Math.sqrt(3)
  return Float32Array.from({ length: Math.round(seconds * sr) }, () => (rand() * 2 - 1) * a)
}

/** Mezcla `src` en `dst` a partir del tiempo `at` (s). */
export function place(dst: Float32Array, src: Float32Array, at: number, sr: number): void {
  const start = Math.round(at * sr)
  for (let i = 0; i < src.length && start + i < dst.length; i++) dst[start + i] = dst[start + i]! + src[i]!
}

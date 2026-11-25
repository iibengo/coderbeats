/**
 * El sonido del diablillo de coderbeats (spec 061, paso 7): un barrido que sube (el neón que se enciende), un golpe grave cuando se cierra el contorno y una risita rápida «ji-ji»
 * con una cola corta. Se **sintetiza** (osciladores, un filtro de estado variable y voz de formantes): no lleva ninguna muestra ni grabación, así que no hay derechos de por medio.
 * Es la versión D1 que eligió Ion (2026-11-25): la de la vocal «i», aguda y traviesa. Puro y sin DOM: devuelve las muestras de los dos canales para la frecuencia que se pida.
 */

/** lo que dura, en s */
export const STING_SECONDS = 2.4
/** cuándo entra cada cosa (s desde el principio) */
export const STING_AT = { zap: 0, kick: 0.42, laugh1: 0.66, laugh2: 0.82 } as const
const PEAK = 10 ** (-3 / 20)

/** un generador de números repetible (la misma risa siempre) */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Formant = readonly [fc: number, bw: number, gain: number]
/** la vocal «i»: F1 baja, F2 alta */
const VOWEL_I: readonly Formant[] = [[300, 60, 1.0], [2300, 110, 0.7], [3100, 160, 0.35]]

export function renderSting(sr: number): { l: Float32Array; r: Float32Array } {
  const rand = mulberry32(7)
  const N = Math.round(STING_SECONDS * sr)
  const mono = new Float32Array(N)
  const add = (src: Float32Array, at: number) => {
    const i0 = Math.round(at * sr)
    for (let i = 0; i < src.length && i0 + i < N; i++) mono[i0 + i]! += src[i]!
  }

  const kick = (dur: number, f0: number, f1: number, tau: number, decay: number, amp: number) => {
    const n = Math.round(dur * sr)
    const out = new Float32Array(n)
    let ph = 0
    for (let i = 0; i < n; i++) {
      const t = i / sr
      ph += (2 * Math.PI * (f1 + (f0 - f1) * Math.exp(-t / tau))) / sr
      out[i] = Math.sin(ph) * Math.exp(-t / decay) * Math.min(1, t / 0.002) * amp
    }
    return out
  }
  const click = (dur = 0.012, amp = 0.25) => {
    const n = Math.round(dur * sr)
    return Float32Array.from({ length: n }, (_, i) => (rand() * 2 - 1) * amp * (1 - i / n) ** 2)
  }
  const pad = (freq: number, dur: number, attack: number, decay: number, amp: number) => {
    const n = Math.round(dur * sr)
    const out = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = i / sr
      const a = Math.min(1, t / attack) * Math.exp(-t / decay)
      out[i] = (Math.sin(2 * Math.PI * freq * t) + 0.35 * Math.sin(2 * Math.PI * freq * 2.003 * t)) * a * amp
    }
    return out
  }
  // ruido filtrado (filtro de estado variable) cuyo corte sube: el neón que se enciende
  const zap = (dur: number, f0: number, f1: number, q: number, amp: number) => {
    const n = Math.round(dur * sr)
    const out = new Float32Array(n)
    let low = 0
    let band = 0
    for (let i = 0; i < n; i++) {
      const p = i / sr / dur
      const f = f0 * (f1 / f0) ** (p ** 1.4)
      const g = 2 * Math.sin(Math.PI * Math.min(0.45, f / sr))
      low += g * band // (este orden importa: con otro, el filtro se vuelve inestable)
      const high = rand() * 2 - 1 - low - q * band
      band += g * high
      out[i] = band * p ** 1.6 * (1 - p) ** 0.4 * 2.2 * amp
    }
    return out
  }
  // una formante de la voz: un filtro paso banda resonante (RBJ)
  const bandpass = (x: Float32Array, f0: number, bw: number) => {
    const w0 = (2 * Math.PI * f0) / sr
    const alpha = Math.sin(w0) / (2 * (f0 / bw))
    const a0 = 1 + alpha
    const a1 = -2 * Math.cos(w0)
    const a2 = 1 - alpha
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0
    const out = new Float32Array(x.length)
    for (let i = 0; i < x.length; i++) {
      const s = x[i]!
      const y = (alpha * s - alpha * x2 - a1 * y1 - a2 * y2) / a0
      x2 = x1; x1 = s; y2 = y1; y1 = y
      out[i] = y
    }
    return out
  }
  // una sílaba de la risa: onda en diente de sierra con temblor fino, filtrada por las formantes de la vocal, con el soplo de la «j» al principio
  const syllable = (f0: number, glide: number, formants: readonly Formant[], dur: number, amp: number) => {
    const n = Math.round(dur * sr)
    const src = new Float32Array(n)
    let ph = 0
    for (let i = 0; i < n; i++) {
      const t = i / sr
      const f = f0 * (1 + (glide * t) / dur) * (1 + 0.012 * Math.sin(2 * Math.PI * 31 * t))
      ph += (2 * Math.PI * f) / sr
      let v = 0
      for (let k = 1, K = Math.max(1, Math.floor(4500 / f)); k <= K; k++) v += Math.sin(k * ph) / k
      src[i] = v * Math.min(1, t / 0.008) * Math.exp(-t / 0.055)
    }
    const out = new Float32Array(n)
    for (const [fc, bw, g] of formants) {
      const y = bandpass(src, fc, bw)
      for (let i = 0; i < n; i++) out[i]! += g * y[i]!
    }
    const nb = Math.round(0.022 * sr)
    const breath = bandpass(Float32Array.from({ length: nb }, (_, i) => (rand() * 2 - 1) * (1 - i / nb) ** 2), 3600, 2500)
    for (let i = 0; i < nb; i++) out[i]! += breath[i]! * 0.12 * 3
    let pk = 0
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(out[i]!))
    for (let i = 0; i < n; i++) out[i]! = (out[i]! / (pk || 1)) * amp
    return out
  }

  add(zap(0.42, 250, 7000, 0.12, 0.5), STING_AT.zap)
  add(click(), STING_AT.kick)
  add(kick(0.55, 120, 41, 0.04, 0.17, 0.9), STING_AT.kick)
  add(pad(110, 1.8, 0.3, 0.7, 0.07), STING_AT.kick)
  add(syllable(540, 0.1, VOWEL_I, 0.11, 0.55), STING_AT.laugh1)
  add(syllable(620, 0.12, VOWEL_I, 0.12, 0.55 * 1.05), STING_AT.laugh2)

  // una cola corta y ancha: cuatro peines de retardos distintos en cada canal
  const comb = (x: Float32Array, delays: readonly number[], fb = 0.78) => {
    const out = new Float32Array(x.length)
    for (const d of delays) {
      const len = Math.round(d * sr)
      const buf = new Float32Array(len)
      let idx = 0
      for (let i = 0; i < x.length; i++) {
        const v = buf[idx]!
        out[i]! += v / delays.length
        buf[idx] = x[i]! + v * fb
        idx = (idx + 1) % len
      }
    }
    return out
  }
  const wet = 0.24
  const cl = comb(mono, [0.0297, 0.0371, 0.0411, 0.0437])
  const cr = comb(mono, [0.0313, 0.0353, 0.0429, 0.0449])
  const l = new Float32Array(N)
  const r = new Float32Array(N)
  const haas = Math.round(0.007 * sr) // la derecha, 7 ms más tarde
  for (let i = 0; i < N; i++) {
    l[i] = mono[i]! + wet * cl[i]!
    const j = i - haas
    r[i] = j >= 0 ? mono[j]! + wet * cr[j]! : 0
  }
  let peak = 0
  for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(l[i]!), Math.abs(r[i]!))
  const k = PEAK / (peak || 1)
  const fade = Math.round(0.08 * sr)
  for (let i = 0; i < N; i++) {
    const f = i >= N - fade ? (N - 1 - i) / fade : 1
    l[i]! = l[i]! * k * f
    r[i]! = r[i]! * k * f
  }
  return { l, r }
}

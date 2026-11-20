/**
 * Volumen de una pista (spec 055), parte pura: **sonoridad integrada en LUFS** (ITU-R BS.1770-4: filtro «K», bloques de 400 ms con salto de 100 ms y las dos puertas de −70 LUFS y −10 LU), un limitador de pico
 * **sin pasarse nunca del techo** (se mira hacia delante, offline) y la normalización a un objetivo (Spotify: ≈ −14 LUFS). Estéreo. Se comprueba con `ffmpeg -af ebur128` (misma cifra, ±0,1 LU).
 */

interface Biquad {
  b: [number, number, number]
  a: [number, number]
}

/** Los dos filtros del filtro «K» para una frecuencia de muestreo dada (fórmulas analíticas de la norma). */
export function kWeighting(sr: number): [Biquad, Biquad] {
  const f1 = 1681.974450955533
  const g = 3.999843853973347
  const q1 = 0.7071752369554196
  let k = Math.tan((Math.PI * f1) / sr)
  const vh = 10 ** (g / 20)
  const vb = vh ** 0.4996667741545416
  let a0 = 1 + k / q1 + k * k
  const shelf: Biquad = {
    b: [(vh + (vb * k) / q1 + k * k) / a0, (2 * (k * k - vh)) / a0, (vh - (vb * k) / q1 + k * k) / a0],
    a: [(2 * (k * k - 1)) / a0, (1 - k / q1 + k * k) / a0],
  }
  const f2 = 38.13547087602444
  const q2 = 0.5003270373238773
  k = Math.tan((Math.PI * f2) / sr)
  a0 = 1 + k / q2 + k * k
  const high: Biquad = { b: [1, -2, 1], a: [(2 * (k * k - 1)) / a0, (1 - k / q2 + k * k) / a0] }
  return [shelf, high]
}

/** Pasa `x` por los dos biquads en cascada (forma directa II traspuesta). */
function filterK(x: Float32Array, sr: number): Float64Array {
  const out = new Float64Array(x.length)
  const [s, h] = kWeighting(sr)
  let s1 = 0, s2 = 0, h1 = 0, h2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!
    const y = s.b[0] * v + s1
    s1 = s.b[1] * v - s.a[0] * y + s2
    s2 = s.b[2] * v - s.a[1] * y
    const z = h.b[0] * y + h1
    h1 = h.b[1] * y - h.a[0] * z + h2
    h2 = h.b[2] * y - h.a[1] * z
    out[i] = z
  }
  return out
}

/** Sonoridad integrada (LUFS) de una pista estéreo; `-Infinity` si no hay nada por encima de la puerta absoluta. */
export function integratedLoudness(l: Float32Array, r: Float32Array, sr: number): number {
  const n = Math.min(l.length, r.length)
  const fl = filterK(l, sr)
  const fr = filterK(r, sr)
  const block = Math.round(0.4 * sr)
  const hop = Math.round(0.1 * sr)
  // suma acumulada de cuadrados para sacar cada bloque en O(1)
  const cl = new Float64Array(n + 1)
  const cr = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    cl[i + 1] = cl[i]! + fl[i]! * fl[i]!
    cr[i + 1] = cr[i]! + fr[i]! * fr[i]!
  }
  const z: number[] = []
  for (let s = 0; s + block <= n; s += hop) z.push((cl[s + block]! - cl[s]! + cr[s + block]! - cr[s]!) / block)
  const lk = (p: number) => -0.691 + 10 * Math.log10(p)
  const abs = z.filter((p) => p > 0 && lk(p) > -70)
  if (!abs.length) return -Infinity
  const rel = lk(abs.reduce((a, b) => a + b, 0) / abs.length) - 10
  const kept = abs.filter((p) => lk(p) > rel)
  if (!kept.length) return -Infinity
  return lk(kept.reduce((a, b) => a + b, 0) / kept.length)
}

/**
 * Limitador de pico **offline**: ningún fotograma pasa de `ceilingDb`. La ganancia que hace falta en cada fotograma se mira `lookaheadMs` hacia delante (mínimo móvil) y se suaviza con una media de esa
 * longitud (así la reducción llega antes del pico y nunca queda por encima de lo necesario), con una suelta lenta de `releaseMs` (solo puede bajar más la ganancia, nunca subirla). Modifica y devuelve los mismos arreglos.
 */
export function limitPeak(l: Float32Array, r: Float32Array, sr: number, ceilingDb = -1.5, lookaheadMs = 5, releaseMs = 80): { l: Float32Array; r: Float32Array; reductionDb: number } {
  const n = Math.min(l.length, r.length)
  const c = 10 ** (ceilingDb / 20)
  const N = Math.max(1, Math.round((lookaheadMs / 1000) * sr))
  const need = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(l[i]!), Math.abs(r[i]!))
    need[i] = p > c ? c / p : 1
  }
  // mínimo móvil de need[i..i+N-1] (deque monótona)
  const gmin = new Float32Array(n)
  const dq = new Int32Array(n)
  let head = 0
  let tail = 0
  for (let i = n - 1; i >= 0; i--) {
    while (tail > head && need[dq[tail - 1]!]! >= need[i]!) tail--
    dq[tail++] = i
    while (dq[head]! > i + N - 1) head++
    gmin[i] = need[dq[head]!]!
  }
  // media de N muestras hacia atrás: g[j] ≤ need[j]
  const rel = 1 - Math.exp(-1 / ((releaseMs / 1000) * sr))
  let sum = 0
  let prev = 1
  let worst = 1
  for (let i = 0; i < n; i++) {
    sum += gmin[i]!
    if (i >= N) sum -= gmin[i - N]!
    const g = Math.min(1, sum / Math.min(N, i + 1) + 0)
    // suelta lenta: la ganancia solo sube poco a poco
    const gr = Math.min(g, prev + (1 - prev) * rel)
    prev = gr
    if (gr < worst) worst = gr
    l[i] = l[i]! * gr
    r[i] = r[i]! * gr
  }
  return { l, r, reductionDb: 20 * Math.log10(worst) }
}

/**
 * Lleva la pista a `targetLufs` (sube o baja la ganancia) sin pasar de `ceilingDb` de pico: aplica la ganancia, limita y vuelve a medir (el limitador se come un poco de volumen), hasta 4 vueltas.
 * Modifica los arreglos. Devuelve la sonoridad final y la ganancia aplicada. Si la pista es silencio, no hace nada.
 */
export function normalizeLoudness(l: Float32Array, r: Float32Array, sr: number, targetLufs = -14, ceilingDb = -1.5): { lufs: number; gainDb: number; reductionDb: number } {
  const before = integratedLoudness(l, r, sr)
  if (!Number.isFinite(before)) return { lufs: before, gainDb: 0, reductionDb: 0 }
  const src = [l.slice(), r.slice()] as const
  let gain = targetLufs - before
  let out = { lufs: before, gainDb: 0, reductionDb: 0 }
  for (let i = 0; i < 4; i++) {
    const k = 10 ** (gain / 20)
    for (let j = 0; j < l.length; j++) {
      l[j] = src[0][j]! * k
      r[j] = src[1][j]! * k
    }
    const lim = limitPeak(l, r, sr, ceilingDb)
    const now = integratedLoudness(l, r, sr)
    out = { lufs: now, gainDb: gain, reductionDb: lim.reductionDb }
    if (Math.abs(now - targetLufs) < 0.05) break
    gain += targetLufs - now
  }
  return out
}

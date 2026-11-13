export interface LatencyResult {
  latencyMs: number
  meanMs: number
  spreadMs: number
  matched: number
  valid: boolean
  /** 'negative': salió ≤ 0 ms, imposible (el sonido no llega antes de salir): se dieron las palmadas antes del clic que se oye */
  reason?: 'too-few' | 'too-spread' | 'negative'
}

export const LATENCY_WINDOW_MS: readonly [number, number] = [-50, 400]
export const MIN_MATCHED = 3
export const MAX_SPREAD_MS = 60

/**
 * Latencia de ida y vuelta (salida + entrada) que se puede usar: la guardada si es positiva; si no (una
 * calibración antigua que salió negativa, o rota), 0 = sin calibrar. Nunca se borra lo guardado.
 */
export const usableLatencyMs = (ms: number | null | undefined): number => (typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : 0)

/**
 * Empareja cada clic con el onset más cercano dentro de la ventana [-50, +400] ms
 * (cada onset se usa una sola vez) y devuelve la mediana del retraso.
 */
export function measureLatency(clickTimes: number[], onsetTimes: number[]): LatencyResult {
  const used = new Set<number>()
  const delays: number[] = []
  for (const click of clickTimes) {
    let best = -1
    let bestAbs = Infinity
    onsetTimes.forEach((t, i) => {
      if (used.has(i)) return
      const d = (t - click) * 1000
      if (d < LATENCY_WINDOW_MS[0] || d > LATENCY_WINDOW_MS[1]) return
      if (Math.abs(d) < bestAbs) {
        bestAbs = Math.abs(d)
        best = i
      }
    })
    if (best >= 0) {
      used.add(best)
      delays.push((onsetTimes[best]! - click) * 1000)
    }
  }

  const sorted = [...delays].sort((a, b) => a - b)
  const n = sorted.length
  const median = n === 0 ? 0 : n % 2 ? sorted[n >> 1]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
  const mean = n === 0 ? 0 : delays.reduce((a, b) => a + b, 0) / n
  const spread = n === 0 ? 0 : sorted[n - 1]! - sorted[0]!

  const result: LatencyResult = { latencyMs: median, meanMs: mean, spreadMs: spread, matched: n, valid: true }
  if (n < MIN_MATCHED) return { ...result, valid: false, reason: 'too-few' }
  if (spread > MAX_SPREAD_MS) return { ...result, valid: false, reason: 'too-spread' }
  // un retraso ≤ 0 es imposible: las palmadas se dieron antes del clic que se oye (p. ej. siguiendo la pantalla con Bluetooth)
  if (median <= 0) return { ...result, valid: false, reason: 'negative' }
  return result
}

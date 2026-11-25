/**
 * La energía del audio por bandas, para animar las barras de la tarjeta (spec 061, paso 4). Puro: recibe lo que da un `AnalyserNode` (`getByteFrequencyData`) y devuelve valores de
 * 0 a 1, ya suavizados (sube deprisa, baja despacio, para que no tiemble).
 */

/** los límites de las bandas, en Hz, repartidos en escala logarítmica entre `lo` y `hi` */
export function bandEdges(count: number, lo = 40, hi = 12000): number[] {
  const n = Math.max(1, Math.floor(count))
  return Array.from({ length: n + 1 }, (_, i) => lo * (hi / lo) ** (i / n))
}

/** La energía media de cada banda (0..1). `bytes` es el espectro de un `AnalyserNode` (0..255 por casilla). Con una curva de raíz para que lo flojo también se vea. */
export function bandLevels(bytes: ArrayLike<number>, sampleRate: number, fftSize: number, edges: readonly number[]): number[] {
  const binHz = sampleRate / fftSize
  const out: number[] = []
  for (let b = 0; b + 1 < edges.length; b++) {
    const from = Math.max(1, Math.floor(edges[b]! / binHz))
    const to = Math.min(bytes.length - 1, Math.max(from, Math.ceil(edges[b + 1]! / binHz) - 1))
    let sum = 0
    for (let i = from; i <= to; i++) sum += bytes[i] ?? 0
    const mean = to >= from ? sum / (to - from + 1) / 255 : 0
    out.push(Math.sqrt(Math.max(0, Math.min(1, mean))))
  }
  return out
}

/** Suaviza de un fotograma al siguiente: sube con `attack` (rápido) y baja con `release` (lento). */
export function smoothLevels(prev: readonly number[] | undefined, next: readonly number[], attack = 0.55, release = 0.12): number[] {
  return next.map((v, i) => {
    const p = prev?.[i] ?? 0
    const k = v > p ? attack : release
    return p + (v - p) * k
  })
}

const BLOCKS = '▁▂▃▄▅▆▇'

/** Una fila de barras en texto (▁▂▃▄▅▆▇), una por valor. */
export const asciiRow = (levels: readonly number[]): string => levels.map((v) => BLOCKS[Math.max(0, Math.min(BLOCKS.length - 1, Math.round(v * (BLOCKS.length - 1))))]).join('')

/** La fila quieta, para cuando no suena nada o hay movimiento reducido. */
export const quietRow = (n: number): string => '▁'.repeat(Math.max(0, n))

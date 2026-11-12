/**
 * Kernel de la simulación de ondas (el mismo que usa el shader WebGL2), en CPU para tests
 * y para el respaldo. Campo de alturas con ping-pong:
 *   next[i] = (vecinos(cur) / 2 − prev[i]) · damping
 */
export function waveStep(prev: Float32Array, cur: Float32Array, w: number, h: number, damping: number): Float32Array {
  const next = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const n = cur[i - 1]! + cur[i + 1]! + cur[i - w]! + cur[i + w]!
      next[i] = (n / 2 - prev[i]!) * damping
    }
  return next
}

/** Gota: perturbación gaussiana en (cx, cy). */
export function drop(field: Float32Array, w: number, h: number, cx: number, cy: number, radius: number, amount: number) {
  const r = Math.ceil(radius * 2)
  for (let y = Math.max(1, cy - r); y <= Math.min(h - 2, cy + r); y++)
    for (let x = Math.max(1, cx - r); x <= Math.min(w - 2, cx + r); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2
      field[y * w + x] = field[y * w + x]! + amount * Math.exp(-d2 / (radius * radius))
    }
}

export const energy = (f: Float32Array): number => f.reduce((a, v) => a + v * v, 0)

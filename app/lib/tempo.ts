/**
 * Tempo fácil (spec 005, §6, fase 3.4). Puro.
 * Cuatro toques (o cuatro bombos con la boca) fijan el tempo de la canción: la media de los 3
 * intervalos, redondeada a un BPM entero, dentro de ±25 % del tempo del estilo.
 */

/** toques que hacen falta y tiempo sin tocar tras el cual se cancela (ms) */
export const TEMPO_TAPS = 4
export const TEMPO_TIMEOUT_MS = 3000
/** hasta cuánto se aparta del tempo del estilo (fracción) */
export const TEMPO_RANGE = 0.25
/** mantener el BPM este tiempo vuelve al tempo del estilo (ms) */
export const TEMPO_RESET_MS = 600

/** Deja un BPM dentro de ±25 % del tempo del estilo. */
export function clampTempo(bpm: number, styleBpm: number): number {
  const lo = Math.round(styleBpm * (1 - TEMPO_RANGE))
  const hi = Math.round(styleBpm * (1 + TEMPO_RANGE))
  return Math.min(hi, Math.max(lo, Math.round(bpm)))
}

/**
 * BPM de los cuatro últimos toques (ms), o null si faltan o no van en orden. La media de los tres
 * intervalos, redondeada y dentro de ±25 % del tempo del estilo.
 */
export function tempoFromTaps(times: readonly number[], styleBpm: number): number | null {
  if (times.length < TEMPO_TAPS) return null
  const last = times.slice(-TEMPO_TAPS)
  const gaps = last.slice(1).map((t, i) => t - last[i]!)
  if (gaps.some((g) => !(g > 0))) return null
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return clampTempo(60000 / mean, styleBpm)
}

/** Tempo efectivo de la canción: el suyo, o el del estilo si no tiene. */
export const effectiveBpm = (songBpm: number | null | undefined, styleBpm: number): number => songBpm ?? styleBpm

/** ¿Es un BPM guardado razonable? (para validar lo que se lee del almacenamiento) */
export const isValidBpm = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 20 && v <= 400

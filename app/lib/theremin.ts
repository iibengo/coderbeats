/**
 * El sintetizador de dedo (spec 015 §12), partes puras: de la altura del dedo a una nota de la escala **con histéresis**, el filtro por el lado,
 * la estela de luz y la curva de Lissajous que sale de la melodía.
 */
import type { MelodyHit } from './melody'

/** Fracción de franja que hay que pasar para cambiar de nota (evita el temblor en el borde). */
export const HYSTERESIS = 0.2

/**
 * El índice de la nota (0 = la más grave) de la altura `fy` (0 arriba … 1 abajo) entre `n` notas. Si el dedo sigue cerca de la nota `prev`
 * (a menos de `HYSTERESIS` de su franja), se queda en ella.
 */
export function noteIndexAt(fy: number, n: number, prev: number | null = null): number {
  if (n <= 0) return 0
  const f = Number.isFinite(fy) ? Math.min(1, Math.max(0, fy)) : 1
  const pos = (1 - f) * n // 0 … n, en franjas
  const raw = Math.min(n - 1, Math.floor(pos))
  if (prev !== null && prev >= 0 && prev < n && raw !== prev) {
    // dentro de la franja de `prev` más un margen
    if (pos > prev - HYSTERESIS && pos < prev + 1 + HYSTERESIS) return prev
  }
  return raw
}

/** Frecuencia (Hz) de una nota MIDI. */
export const midiToHz = (m: number): number => 440 * 2 ** ((m - 69) / 12)

export interface LightPoint {
  x: number
  y: number
  t: number
  /** 0 grave … 1 aguda (para el color) */
  h: number
}
export const LIGHT_LIFE = 1.4
export const LIGHT_MAX = 64

/** Añade un punto a la curva de luz (los viejos y los que pasan del tope se quitan). Devuelve la misma lista. */
export function lightPush(pts: LightPoint[], p: LightPoint): LightPoint[] {
  if (Number.isFinite(p.x) && Number.isFinite(p.y)) pts.push(p)
  return lightPrune(pts, p.t)
}
export function lightPrune(pts: LightPoint[], now: number): LightPoint[] {
  let drop = 0
  while (drop < pts.length && now - pts[drop]!.t > LIGHT_LIFE) drop++
  if (drop) pts.splice(0, drop)
  if (pts.length > LIGHT_MAX) pts.splice(0, pts.length - LIGHT_MAX)
  return pts
}
export const lightAlpha = (p: LightPoint, now: number): number => Math.max(0, 1 - (now - p.t) / LIGHT_LIFE)

export interface LissajousParams {
  a: number
  b: number
  phase: number
}
export const DEFAULT_LISSAJOUS: LissajousParams = { a: 3, b: 2, phase: Math.PI / 2 }

/** Los parámetros de la curva a partir de la melodía (determinista); sin notas, la de por defecto. */
export function lissajousOf(hits: readonly MelodyHit[]): LissajousParams {
  if (!hits.length) return DEFAULT_LISSAJOUS
  const distinct = new Set(hits.map((h) => h.midi)).size
  const first = hits[0]!.midi
  return { a: Math.min(5, Math.max(1, distinct)), b: 2 + (hits.length % 4), phase: ((first % 12) / 12) * Math.PI }
}

/** `n` puntos de la curva en el cuadrado −1…1. */
export function lissajousPoints(p: LissajousParams, n = 96): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    out.push({ x: Math.sin(p.a * t + p.phase), y: Math.sin(p.b * t) })
  }
  return out
}

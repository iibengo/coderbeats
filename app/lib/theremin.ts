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
  const a = Math.min(5, Math.max(1, distinct))
  let b = 2 + (hits.length % 4)
  if (b === a) b += 1 // a = b dibujaría una elipse sosa
  return { a, b, phase: ((first % 12) / 12) * Math.PI }
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

// ── La curva viva (spec 015 §13): geometría y deformaciones puras; el dibujo está en ThereminOverlay ───────────────────────────────────────────────────────────
export interface P2 {
  x: number
  y: number
}

/** Los radios de la curva en pantalla: casi todo el ancho y el alto, para que cubra las notas de arriba y abajo. */
export const curveRadii = (w: number, h: number) => ({ rx: w * 0.4, ry: h * 0.44 })

/** El punto `t` (0…2π) de la curva en pantalla; `phase` la hace girar (solo mueve la x: la altura de cada punto no cambia). */
export function curvePoint(p: LissajousParams, t: number, w: number, h: number, phase: number, scale = 1): P2 {
  const { rx, ry } = curveRadii(w, h)
  return { x: w / 2 + Math.sin(p.a * t + p.phase + phase) * rx * scale, y: h / 2 - Math.sin(p.b * t) * ry * scale }
}

export interface Deform {
  /** 0…1: cuánto se deforma por la nota que acaba de sonar (cae a 0) */
  wobble: number
  /** de qué depende la forma de la deformación (el índice de la nota) */
  k: number
  time: number
  /** el dedo, si está en la pantalla, y cuánto tira de la curva (0…1) */
  finger: P2 | null
  pull: number
}

/** Lo que se desplaza un punto por la deformación de la nota y por el dedo que tira de él. Sin deformación y sin dedo, (0, 0). */
export function deformOffset(pt: P2, t: number, w: number, d: Deform): P2 {
  let dx = 0
  let dy = 0
  if (d.wobble > 0.001) {
    const { rx, ry } = curveRadii(w, 1000)
    const k = 2 + (d.k % 5)
    dx += d.wobble * 0.09 * rx * Math.sin(k * t + d.time * 7)
    dy += d.wobble * 0.05 * ry * Math.cos((k + 1) * t - d.time * 5)
  }
  if (d.finger && d.pull > 0.001) {
    const ex = d.finger.x - (pt.x + dx)
    const ey = d.finger.y - (pt.y + dy)
    const dist = Math.hypot(ex, ey)
    const f = d.pull * 0.5 * Math.exp(-((dist / 170) ** 2))
    dx += ex * f
    dy += ey * f
  }
  return { x: dx, y: dy }
}

/** El punto (0…2π) de la curva más cercano a `pt`; donde nace la onda de color. */
export function nearestParam(p: LissajousParams, pt: P2, w: number, h: number, phase: number, steps = 96): number {
  let best = 0
  let bd = Infinity
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const c = curvePoint(p, t, w, h, phase)
    const d = (c.x - pt.x) ** 2 + (c.y - pt.y) ** 2
    if (d < bd) {
      bd = d
      best = t
    }
  }
  return best
}

/** Distancia angular más corta entre dos parámetros de la curva (0…π). */
export const paramDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return d > Math.PI ? Math.PI * 2 - d : d
}

/** Cuánto brilla el punto `t` de la curva por una onda nacida en `t0` hace `age` s: un pulso que se abre por los dos lados y se apaga (0…1). */
export function waveGlow(t: number, t0: number, age: number, speed = 4.2, width = 0.55, life = 0.9): number {
  if (age < 0 || age > life) return 0
  const front = speed * age
  const d = paramDist(t, t0)
  const off = Math.abs(d - front)
  return off >= width ? 0 : (1 - off / width) * (1 - age / life)
}

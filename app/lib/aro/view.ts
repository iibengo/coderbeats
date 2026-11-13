/**
 * Cómo se mira el aro (spec 003, E3.5 y E3.6): inclinación al soltar y parallax con el
 * giroscopio. Puro. "Se toca en 2D, se mira en 3D": mientras tocas, de frente.
 *
 * La vista es una transformación sencilla alrededor del centro de la gota:
 *   pantalla = centro + (dx, dy·sy) + (ox, oy)
 * con sy = 1 de frente y < 1 inclinado (un disco que se aleja, sin 3D real) y (ox, oy) el
 * desplazamiento del parallax.
 */

export interface AroView {
  /** aplastado vertical: 1 = de frente; TILT = inclinado */
  sy: number
  /** desplazamiento del parallax (px) */
  ox: number
  oy: number
}

export const FRONT: AroView = { sy: 1, ox: 0, oy: 0 }

/** aplastado vertical inclinado (≈ 45°) */
export const TILT = 0.72
/** segundos sin tocar antes de inclinarse */
export const TILT_AFTER_S = 4
/** constantes de tiempo: se inclina despacio y vuelve de frente rápido (~0,3 s) */
export const TILT_IN_TAU = 0.8
export const TILT_OUT_TAU = 0.1
/** desplazamiento máximo del parallax (px) y px por grado de giro */
export const PARALLAX_MAX = 12
export const PARALLAX_PX_PER_DEG = 0.6
/** el reposo del parallax sigue despacio a cómo sujetas el móvil (s) */
export const PARALLAX_BASE_TAU = 3

/** Aplastado al que tiende la vista. */
export function tiltTarget(sinceTouchS: number, touching: boolean, reduced: boolean): number {
  if (reduced || touching || sinceTouchS < TILT_AFTER_S) return 1
  return TILT
}

/** Acerca `sy` a su objetivo: despacio al inclinarse, rápido al volver de frente. */
export function approachTilt(sy: number, target: number, dt: number): number {
  const tau = target < sy ? TILT_IN_TAU : TILT_OUT_TAU
  const next = sy + (target - sy) * (1 - Math.exp(-dt / tau))
  return Math.abs(next - target) < 1e-3 ? target : next
}

/** De pantalla a la posición de frente (para tocar con el aro inclinado o desplazado). */
export function toFront(px: number, py: number, v: AroView, cx: number, cy: number): [number, number] {
  return [px - v.ox, cy + (py - v.oy - cy) / v.sy]
}

/** De la posición de frente a pantalla. */
export function toScreen(x: number, y: number, v: AroView, cx: number, cy: number): [number, number] {
  return [x + v.ox, cy + (y - cy) * v.sy + v.oy]
}

export interface Tilt {
  /** inclinación adelante-atrás (grados) */
  beta: number
  /** inclinación a los lados (grados) */
  gamma: number
}

/** El reposo sigue despacio a la lectura (así el parallax se centra en cómo sujetas el móvil). */
export function followBase(base: Tilt | null, reading: Tilt, dt: number): Tilt {
  if (!base) return { ...reading }
  const k = 1 - Math.exp(-dt / PARALLAX_BASE_TAU)
  return { beta: base.beta + (reading.beta - base.beta) * k, gamma: base.gamma + (reading.gamma - base.gamma) * k }
}

/** Desplazamiento del parallax respecto al reposo, limitado a ±12 px. */
export function parallaxOffset(reading: Tilt, base: Tilt): { ox: number; oy: number } {
  const c = (v: number) => Math.max(-PARALLAX_MAX, Math.min(PARALLAX_MAX, v * PARALLAX_PX_PER_DEG))
  return { ox: c(reading.gamma - base.gamma), oy: c(reading.beta - base.beta) }
}

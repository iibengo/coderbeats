/**
 * Geometría de la gota (spec 003, §1 y E1.8). Puro y sin DOM.
 *
 * Coordenadas de un punto del aro: `th` (ángulo; −π/2 = arriba = el 1 del compás) y `u`
 * (0 = borde del centro, 1 = borde exterior). El radio exterior es una gota imperfecta (suma de
 * senos lentos) mezclada con la pared del rectángulo libre mediante un mínimo suave, así se
 * aplasta contra los lados con una curva suave y nunca los cruza.
 */

export const TAU = Math.PI * 2

export interface Rect {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface DropGeo {
  /** centro (px CSS) */
  cx: number
  cy: number
  /** radio de la gota sin paredes (px) */
  R: number
  /** radio del hueco central (px) */
  core: number
  /** rectángulo libre: la gota no lo cruza nunca */
  free: Rect
}

/** amplitud de la respiración del borde exterior (fracción de R) */
export const BREATH = 0.035
/** ondulación de los bordes interiores (px) */
export const INNER_WOBBLE = 2.2
/** suavidad del aplastado contra la pared (px) */
export const WALL_SOFT = 16
/** separación mínima entre la gota y la pared (px) */
export const WALL_GAP = 4

/** Ruido lento y periódico en el ángulo, aproximadamente en −1.4..1.4. */
export function noise(th: number, seed: number, t: number): number {
  return (
    Math.sin(th * 3 + t * 0.7 + seed) * 0.5 +
    Math.sin(th * 5 - t * 0.5 + seed * 2) * 0.3 +
    Math.sin(th * 2 + t * 0.3 + seed * 3) * 0.6
  )
}

/** Mínimo suave: ≤ min(a, b) y se le acerca cuando a y b están lejos. */
export function smin(a: number, b: number, k: number): number {
  const m = Math.min(a, b)
  // forma estable (sin desbordar exp con valores grandes)
  return m - k * Math.log(Math.exp(-(a - m) / k) + Math.exp(-(b - m) / k))
}

/** Distancia del centro a la pared del rectángulo libre en la dirección `th`. */
export function wallDistance(th: number, g: Pick<DropGeo, 'cx' | 'cy' | 'free'>): number {
  const c = Math.cos(th)
  const s = Math.sin(th)
  const { x0, y0, x1, y1 } = g.free
  const dx = c > 1e-9 ? (x1 - g.cx) / c : c < -1e-9 ? (x0 - g.cx) / c : Infinity
  const dy = s > 1e-9 ? (y1 - g.cy) / s : s < -1e-9 ? (y0 - g.cy) / s : Infinity
  return Math.max(0, Math.min(dx, dy) - WALL_GAP)
}

/**
 * Radio exterior de la gota en `th` en el instante `t` (s). `breath` = 0 la deja quieta.
 * `extra` (px) empuja el borde hacia fuera (latido del bombo) antes de la pared: nunca la cruza.
 */
export function outerRadius(th: number, g: DropGeo, t: number, breath = BREATH, extra = 0): number {
  const r = g.R * (1 + breath * noise(th, 0, t)) + extra
  const wall = Math.max(g.core + 8, wallDistance(th, g))
  return Math.max(g.core + 8, smin(r, wall, WALL_SOFT))
}

/**
 * Radio de un punto (th, u) conocido el radio exterior en ese ángulo. Los bordes interiores
 * ondulan un poco (ninguna línea es un círculo perfecto); `wobble` = 0 los deja lisos.
 */
export function radiusAt(th: number, u: number, ro: number, core: number, t: number, wobble = INNER_WOBBLE): number {
  const w = u > 0 && u < 1 ? wobble * noise(th, u * 7, t) : 0
  return core + (ro - core) * u + w
}

/** Punto en pantalla de (th, u). */
export function pointAt(th: number, u: number, g: DropGeo, t: number, breath = BREATH, wobble = INNER_WOBBLE): [number, number] {
  const r = radiusAt(th, u, outerRadius(th, g, t, breath), g.core, t, wobble)
  return [g.cx + Math.cos(th) * r, g.cy + Math.sin(th) * r]
}

/** Inverso aproximado de `pointAt` (sin la ondulación interior): (px, py) → (th, u). */
export function locate(px: number, py: number, g: DropGeo, t: number, breath = BREATH): { th: number; u: number } {
  const dx = px - g.cx
  const dy = py - g.cy
  const th = Math.atan2(dy, dx)
  const ro = outerRadius(th, g, t, breath)
  return { th, u: (Math.hypot(dx, dy) - g.core) / (ro - g.core) }
}

/** Ángulo de un paso (0..16) de un compás: el paso 0 arriba, sentido horario. */
export const stepAngle = (step: number): number => (step / 16) * TAU - Math.PI / 2

/** Paso (0..16) de un ángulo. */
export function angleStep(th: number): number {
  const a = (((th + Math.PI / 2) % TAU) + TAU) % TAU
  return (a / TAU) * 16
}

/** Empujón del borde: un golpe en la superficie del agua en el ángulo `th`. */
export interface Bump {
  th: number
  /** amplitud actual (px) */
  a: number
}

/** Cuánto empujan los golpes el borde en `th` (campana estrecha alrededor de cada golpe). */
export function bumpAt(th: number, bumps: readonly Bump[]): number {
  let s = 0
  for (const b of bumps) {
    const d = ((th - b.th + Math.PI * 3) % TAU) - Math.PI
    s += b.a * Math.exp(-d * d * 6)
  }
  return s
}

/** Amplitud de un empujón a los `p` (0..1) de su vida: sube y se apaga. */
export const bumpEnvelope = (p: number): number => (p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI) * (1 - p))

/** hueco antes del inicio de una nota que dura todo el compás, en pasos (E3.1) */
export const FULL_BAR_GAP = 0.6

/**
 * Arco de una nota con duración (E3.1): ángulos de inicio y fin en su franja. Una nota que dura
 * todo el compás (o más) deja un pequeño hueco antes de su inicio, para que se vea dónde empieza.
 */
export function noteArc(step: number, dur: number): { a0: number; a1: number } {
  const len = Math.max(0.25, Math.min(dur, 16 - FULL_BAR_GAP))
  return { a0: stepAngle(step), a1: stepAngle(step + len) }
}

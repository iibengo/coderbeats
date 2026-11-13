/**
 * La colonia: zoom alejado donde se ven todas las células (spec 005, §7). Puro y sin DOM.
 *
 * El zoom es el mismo número de siempre (`zoom × mitad del lado corto` = radio de la gota). Por
 * debajo del mínimo de la gota (0,5) sigue bajando hasta que caben todas las células: cerca y
 * colonia son dos tramos del mismo gesto. Cada célula se coloca en su `at` (radios de gota), así que
 * al bajar el zoom se acercan solas.
 */
import type { Rect } from './shape'

/** por debajo de este zoom, los gestos son los de la colonia (el tramo entre 0,5 y 0,4 sigue siendo "cerca") */
export const COLONY_ENTER = 0.4
/** el resto de células empieza a verse aquí y se ve entera en `COLONY_FULL` */
export const COLONY_FADE_FROM = 0.46
export const COLONY_FULL = 0.34
/** el zoom mínimo de la colonia como mucho (con pocas células): se ven pequeñas pero se ven */
export const COLONY_MIN_CAP = 0.3
export const COLONY_MIN_FLOOR = 0.03
/** la célula más pequeña que se puede tocar (radio, px) */
export const MIN_TAP_R = 22
/** fracción del rectángulo libre que ocupa el conjunto al ajustarlo */
export const FIT_FILL = 0.9

export interface Point {
  x: number
  y: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (k: number) => k * k * (3 - 2 * k)
const halfShort = (r: Rect) => Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2

/** ¿Gestos de colonia? Solo con varias células y por debajo del umbral. */
export const inColony = (zoom: number, cells: number): boolean => cells > 1 && zoom < COLONY_ENTER

/** Centro del rectángulo que envuelve las posiciones. */
export function boundsCenter(points: readonly Point[]): Point {
  if (!points.length) return { x: 0, y: 0 }
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

/** Zoom con el que el conjunto entero (más el radio de cada gota) cabe en el rectángulo libre. */
export function fitZoom(points: readonly Point[], free: Rect): number {
  if (points.length < 2) return COLONY_MIN_CAP
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const w = Math.max(...xs) - Math.min(...xs) + 2
  const h = Math.max(...ys) - Math.min(...ys) + 2
  const R = Math.min(((free.x1 - free.x0) * FIT_FILL) / w, ((free.y1 - free.y0) * FIT_FILL) / h)
  return R / halfShort(free)
}

/** Zoom mínimo de la colonia: el que ajusta todas las células, sin pasar de `COLONY_MIN_CAP`. */
export const colonyMinZoom = (points: readonly Point[], free: Rect): number =>
  Math.max(COLONY_MIN_FLOOR, Math.min(COLONY_MIN_CAP, fitZoom(points, free)))

/** Al soltar: entre el mínimo de la gota y el umbral de la colonia se vuelve a cerca, como siempre. */
export const settleZoom = (z: number, nearMin: number): number => (z < nearMin && z >= COLONY_ENTER ? nearMin : z)

/** 0 = cerca, 1 = colonia entera: cuánto se ven las demás células (según el zoom que se dibuja). */
export const crowdAlpha = (zoom: number): number => smooth(clamp01((COLONY_FADE_FROM - zoom) / (COLONY_FADE_FROM - COLONY_FULL)))

/**
 * Cámara en la colonia: sobre la célula que suena de cerca y sobre el centro del conjunto
 * cuando está todo ajustado. `depth` = 0 cerca … 1 con el zoom mínimo.
 */
export function colonyCam(follow: Point, center: Point, zoom: number, minZoom: number): Point {
  const k = smooth(clamp01((COLONY_ENTER - zoom) / Math.max(1e-6, COLONY_ENTER - minZoom)))
  return { x: follow.x + (center.x - follow.x) * k, y: follow.y + (center.y - follow.y) * k }
}

export interface Disc {
  id: number
  x: number
  y: number
  r: number
  /** profundidad 0..1 (0 = delante); sin ella, 0 */
  depth?: number
}

/**
 * Célula bajo un toque: entre las que lo contienen (radio de al menos `minR`), la de más delante
 * y, a igual profundidad, la más cercana al dedo (§7.2: solo se mira, al tocar se elige la de delante).
 */
export function cellAtPoint(px: number, py: number, discs: readonly Disc[], minR = MIN_TAP_R): number | null {
  let best: number | null = null
  let bd = Infinity
  let bz = Infinity
  for (const d of discs) {
    const dist = Math.hypot(px - d.x, py - d.y)
    if (dist > Math.max(d.r, minR)) continue
    const z = d.depth ?? 0
    if (z < bz || (z === bz && dist < bd)) {
      bz = z
      bd = dist
      best = d.id
    }
  }
  return best
}

// ── profundidad (§7.2) ───────────────────────────────────────────────────────────
/** las del fondo llegan al 70 % de tamaño, se ven un 35 % más tenues y se mueven un 35 % menos al mover el mapa */
export const DEPTH_SCALE = 0.3
export const DEPTH_FADE = 0.35
export const DEPTH_PARALLAX = 0.35

/**
 * Tamaño, opacidad y desplazamiento relativos de una célula a profundidad `depth` (0 = delante,
 * 1 = fondo). `k` (0..1) es cuánto se ve la colonia: cerca, todo vale 1 y nada cambia.
 */
export const depthScale = (depth: number, k: number): number => 1 - DEPTH_SCALE * clamp01(depth) * k
export const depthAlpha = (depth: number, k: number): number => 1 - DEPTH_FADE * clamp01(depth) * k
export const depthParallax = (depth: number, k: number): number => 1 - DEPTH_PARALLAX * clamp01(depth) * k

/** Orden de dibujo: del fondo al frente (las de delante tapan a las de atrás). */
export const backToFront = <T extends { id: number; depth: number }>(cells: readonly T[]): T[] =>
  [...cells].sort((a, b) => b.depth - a.depth || a.id - b.id)

/** hasta dónde se puede llevar el mapa fuera del conjunto de células (radios de gota) */
export const PAN_MARGIN = 3

/** Mueve la cámara lo que se ha arrastrado el dedo (px): el mapa va con el dedo, así que la cámara va al revés. `r` = radio de la gota (px). */
export const panBy = (cam: Point, dxPx: number, dyPx: number, r: number): Point => ({
  x: cam.x - dxPx / Math.max(1, r),
  y: cam.y - dyPx / Math.max(1, r),
})

/** La cámara no sale del conjunto de células más `margin` radios: el mapa nunca se pierde. */
export function clampCam(cam: Point, points: readonly Point[], margin = PAN_MARGIN): Point {
  if (!points.length) return cam
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const c = (v: number, lo: number, hi: number) => Math.min(hi + margin, Math.max(lo - margin, v))
  return { x: c(cam.x, Math.min(...xs), Math.max(...xs)), y: c(cam.y, Math.min(...ys), Math.max(...ys)) }
}

/** Mezcla de la cámara automática (0) con la del dedo (1): se acerca a su objetivo, o salta. */
export function approachBlend(v: number, target: number, dt: number, instant = false, tau = 0.15): number {
  if (instant) return target
  const next = v + (target - v) * (1 - Math.exp(-dt / tau))
  return Math.abs(next - target) < 1e-3 ? target : next
}

/** Cámara mostrada: entre la automática y la que lleva el dedo según `blend`. */
export const mixCam = (auto: Point, manual: Point | null, blend: number): Point =>
  manual && blend > 0 ? { x: auto.x + (manual.x - auto.x) * blend, y: auto.y + (manual.y - auto.y) * blend } : auto

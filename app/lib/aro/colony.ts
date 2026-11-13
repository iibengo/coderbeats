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

/** ¿Gestos de colonia? Por debajo del umbral y con alguna célula (con una sola también: desde ahí se crea la segunda). */
export const inColony = (zoom: number, cells: number): boolean => cells >= 1 && zoom < COLONY_ENTER

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

// ── hilos de orden (§7.2) ────────────────────────────────────────────────────────
/** Punto de control de un hilo curvado: el medio del tramo, desplazado `bend` px en perpendicular. */
export function threadControl(a: Point, b: Point, bend: number): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  return { x: (a.x + b.x) / 2 - (dy / len) * bend, y: (a.y + b.y) / 2 + (dx / len) * bend }
}

/** Punto de una curva cuadrática de `a` a `b` con control `c`, en `u` (0..1). */
export function quadAt(a: Point, c: Point, b: Point, u: number): Point {
  const v = 1 - u
  return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y }
}

/** Pares de células consecutivas en el orden en que suenan (los hilos). Solo los ids que existen. */
export function threadPairs(order: readonly number[], exists: (id: number) => boolean): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < order.length; i++) if (exists(order[i]!) && exists(order[i + 1]!)) out.push([order[i]!, order[i + 1]!])
  return out
}

// ── mover células y doble toque (§7.1) ───────────────────────────────────────────
/** Dónde cae en pantalla un punto del mapa: `center` = centro de la gota sin mover, `r` = su radio, `pf` = parallax de su profundidad. */
export const mapToScreen = (p: Point, center: Point, r: number, cam: Point, pf = 1): Point => ({
  x: center.x + (p.x - cam.x) * r * pf,
  y: center.y + (p.y - cam.y) * r * pf,
})

/** Lo contrario: qué punto del mapa hay bajo un punto de la pantalla. */
export const screenToMap = (s: Point, center: Point, r: number, cam: Point, pf = 1): Point => ({
  x: cam.x + (s.x - center.x) / Math.max(1e-6, r * pf),
  y: cam.y + (s.y - center.y) / Math.max(1e-6, r * pf),
})

/** Mantiene un punto de la pantalla dentro de un rectángulo: la célula arrastrada no sale de la zona libre. */
export const clampToRect = (p: Point, r: Rect): Point => ({
  x: Math.min(r.x1, Math.max(r.x0, p.x)),
  y: Math.min(r.y1, Math.max(r.y0, p.y)),
})

/** el segundo toque de un doble toque: sobre la misma célula y a menos de este tiempo del anterior (ms) */
export const DOUBLE_TAP_MS = 300

export function isDoubleTap(prev: { id: number; t: number } | null, id: number, now: number, windowMs = DOUBLE_TAP_MS): boolean {
  return !!prev && prev.id === id && now - prev.t >= 0 && now - prev.t < windowMs
}

// ── pulso del agua en la colonia ─────────────────────────────────────────────────
/** el pulso más pequeño que se dibuja, como fracción del de una gota de cerca */
export const PULSE_MIN_SCALE = 0.15

/** Escala del pulso del agua de un tiempo: el radio de la célula que suena respecto al de una gota de cerca (1 = como siempre). */
export const pulseScale = (r: number, nearR: number): number => Math.min(1, Math.max(PULSE_MIN_SCALE, r / Math.max(1, nearR)))

// ── cuánto falta para cambiar de célula (§7.2) ───────────────────────────────────
/** Progreso de la célula que suena, 0..1, de su compás de inicio a su final; null en bucle (sin final). */
export function cellProgress(pos: number, start: number, end: number): number | null {
  if (!Number.isFinite(end)) return null
  return clamp01((pos - start) / Math.max(1, end - start))
}

/** Vuelta en la que va (0..turns−1), para los puntitos; en bucle sigue girando por sus vueltas. */
export function turnIndex(pos: number, start: number, turns: number): number {
  const k = Math.floor(pos - start)
  return ((k % turns) + turns) % turns
}

/** Cuánto se ha llenado el hilo hacia la siguiente: 0 hasta la última vuelta y de 0 a 1 a lo largo de ella; undefined en bucle. */
export function lastTurnFill(pos: number, end: number): number | undefined {
  if (!Number.isFinite(end) || pos < end - 1) return undefined
  return clamp01(pos - (end - 1))
}

// ── asa y número de cada célula (§7.1) ───────────────────────────────────────────
/** el asa solo se dibuja y se coge con una célula de al menos este radio (px) */
export const HANDLE_MIN_R = 14
/** radio de la zona del asa y del número (px) */
export const HANDLE_HIT = 18
export const LABEL_HIT = 14
/** a cuántos radios del centro está el asa: justo fuera del anillo de la que suena */
export const HANDLE_DIST = 1.14

/** Punto del asa: en el borde de la célula, hacia la siguiente en el orden (la última, hacia la derecha). */
export function handlePoint(center: Point, r: number, toward: Point | null): Point {
  const dx = toward ? toward.x - center.x : 1
  const dy = toward ? toward.y - center.y : 0
  const l = Math.hypot(dx, dy) || 1
  return { x: center.x + (dx / l) * r * HANDLE_DIST, y: center.y + (dy / l) * r * HANDLE_DIST }
}

export interface Spot {
  id: number
  x: number
  y: number
}

/** Elemento (asa o número) más cercano a un punto, dentro de su zona, o null. */
export function spotAt(px: number, py: number, spots: readonly Spot[], hit: number): number | null {
  let best: number | null = null
  let bd = hit
  for (const s of spots) {
    const d = Math.hypot(px - s.x, py - s.y)
    if (d <= bd) {
      bd = d
      best = s.id
    }
  }
  return best
}

// ── tocar un hilo para cortarlo (enmienda 1, §15.4) ──────────────────────────────
/** a cuántos px del hilo cuenta como tocarlo */
export const THREAD_HIT = 12

/** Distancia de un punto al segmento a–b (px). */
export function segmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export interface ThreadSeg {
  fromId: number
  toId: number
  a: Point
  b: Point
}

/**
 * Hilo bajo un punto: el más cercano a menos de `hit` px, o null. Devuelve el hilo entero; cortarlo deja
 * suelta la célula a la que llevaba (`toId`).
 */
export function threadAt(px: number, py: number, threads: readonly ThreadSeg[], hit = THREAD_HIT): ThreadSeg | null {
  let best: ThreadSeg | null = null
  let bd = hit
  for (const t of threads) {
    const d = segmentDistance({ x: px, y: py }, t.a, t.b)
    if (d <= bd) {
      bd = d
      best = t
    }
  }
  return best
}

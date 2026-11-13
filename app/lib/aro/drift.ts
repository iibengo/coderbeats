/**
 * Física sutil al mover células en la colonia (spec 005, §7.1). Puro y sin DOM.
 *
 * Todo es visual: cada célula tiene un desplazamiento respecto a su sitio (`at`, que no cambia) y un
 * muelle lo lleva a cero. Solo la célula que se mueve guarda su posición final.
 * - Arrastrando: las unidas por hilo se dejan llevar un poco (hilo elástico) y las cercanas se apartan.
 * - Al soltar: la célula movida sigue deslizándose con inercia y se frena sola; las demás vuelven a su
 *   sitio con un pequeño vaivén.
 * - Con movimiento reducido, sin física.
 * Las unidades son las del mapa (radios de gota).
 */
import type { Point } from './colony'

/** fracción del desplazamiento de la célula arrastrada que se llevan sus vecinas de hilo, y lo máximo que se mueven */
export const PULL = 0.12
export const PULL_MAX = 1
/** distancia entre centros por debajo de la cual se apartan las no unidas (dos gotas se tocan a 2), y cuánto empujan */
export const REPEL_DIST = 2.4
export const REPEL_GAIN = 0.5
/** lo máximo que se puede desplazar una célula por la física */
export const OFFSET_MAX = 1.2
/** muelles (rigidez, amortiguación): al arrastrar, firme; al soltar, con un pequeño vaivén (ζ ≈ 0,5) */
export const DRAG_SPRING = { k: 70, c: 10 } as const
export const REST_SPRING = { k: 45, c: 6.7 } as const
/** inercia al soltar: constante de tiempo de la frenada (s) y lo máximo que se desliza (radios) */
export const GLIDE_TAU = 0.35
export const GLIDE_MAX = 2.5
/** la velocidad al soltar se mide en estos últimos ms; si el dedo llevaba parado este tiempo, no hay inercia */
export const VEL_WINDOW_MS = 100
export const VEL_STALE_MS = 90

const ZERO: Point = { x: 0, y: 0 }

const clampLen = (p: Point, max: number): Point => {
  const l = Math.hypot(p.x, p.y)
  return l > max ? { x: (p.x * max) / l, y: (p.y * max) / l } : p
}

export interface Sample {
  t: number
  x: number
  y: number
}

/** Velocidad (radios/s) del dedo al soltar, de las últimas muestras; 0 si estaba parado. Limitada para que el deslizamiento no pase de `GLIDE_MAX`. */
export function releaseVelocity(trail: readonly Sample[], now: number): Point {
  const recent = trail.filter((s) => now - s.t <= VEL_WINDOW_MS)
  if (recent.length < 2) return ZERO
  const a = recent[0]!
  const b = recent[recent.length - 1]!
  if (now - b.t > VEL_STALE_MS) return ZERO
  const dt = (b.t - a.t) / 1000
  if (dt < 0.016) return ZERO
  return clampLen({ x: (b.x - a.x) / dt, y: (b.y - a.y) / dt }, GLIDE_MAX / GLIDE_TAU)
}

/** Dónde se para una célula que sale con velocidad `v` desde `pos`: la frenada exponencial recorre v·τ. */
export const glideEnd = (pos: Point, v: Point): Point => ({ x: pos.x + v.x * GLIDE_TAU, y: pos.y + v.y * GLIDE_TAU })

export interface DriftCell {
  id: number
  at: { x: number; y: number }
}

/**
 * Hacia dónde tira cada célula mientras se arrastra otra (desplazamientos objetivo, en radios):
 * las unidas por hilo (`linked`) se llevan una fracción de lo que se ha movido la arrastrada, y las
 * demás se apartan si la arrastrada se les acerca demasiado.
 */
export function driftTargets(
  cells: readonly DriftCell[],
  drag: { id: number; x: number; y: number; from: Point },
  linked: readonly number[],
): Map<number, Point> {
  const out = new Map<number, Point>()
  const pull = clampLen({ x: (drag.x - drag.from.x) * PULL, y: (drag.y - drag.from.y) * PULL }, PULL_MAX)
  for (const c of cells) {
    if (c.id === drag.id) continue
    let x = linked.includes(c.id) ? pull.x : 0
    let y = linked.includes(c.id) ? pull.y : 0
    const dx = c.at.x - drag.x
    const dy = c.at.y - drag.y
    const d = Math.hypot(dx, dy)
    if (d < REPEL_DIST) {
      // si están justo encima, se apartan hacia la derecha
      const [ux, uy] = d < 1e-6 ? [1, 0] : [dx / d, dy / d]
      x += ux * (REPEL_DIST - d) * REPEL_GAIN
      y += uy * (REPEL_DIST - d) * REPEL_GAIN
    }
    const t = clampLen({ x, y }, OFFSET_MAX)
    if (t.x || t.y) out.set(c.id, t)
  }
  return out
}

/** Una célula con física: desplazamiento y velocidad; `glide` = sale con inercia (se frena sola) en vez de ir a un muelle. */
export interface Body {
  x: number
  y: number
  vx: number
  vy: number
  glide: boolean
}

const SUBSTEP = 1 / 120

/** Avanza un cuerpo `dt` segundos: con inercia, frena exponencialmente; si no, un muelle hacia `target`. */
export function stepBody(b: Body, target: Point, dt: number, spring: { k: number; c: number } = REST_SPRING): void {
  const n = Math.max(1, Math.ceil(dt / SUBSTEP))
  const h = dt / n
  for (let i = 0; i < n; i++) {
    if (b.glide) {
      b.x += b.vx * h
      b.y += b.vy * h
      const decay = Math.exp(-h / GLIDE_TAU)
      b.vx *= decay
      b.vy *= decay
      // casi parada: lo que quede lo termina el muelle
      if (Math.hypot(b.vx, b.vy) < 0.01) b.glide = false
    } else {
      b.vx += (-spring.k * (b.x - target.x) - spring.c * b.vx) * h
      b.vy += (-spring.k * (b.y - target.y) - spring.c * b.vy) * h
      b.x += b.vx * h
      b.y += b.vy * h
    }
  }
}

const atRest = (b: Body, t: Point): boolean =>
  !b.glide && Math.abs(b.x - t.x) < 1e-3 && Math.abs(b.y - t.y) < 1e-3 && Math.abs(b.vx) < 1e-3 && Math.abs(b.vy) < 1e-3

/** La física de todas las células: desplazamientos que se llevan a cero con muelles. */
export class Drift {
  private bodies = new Map<number, Body>()

  /** desplazamiento actual de una célula (radios); cero si no se mueve */
  offset(id: number): Point {
    const b = this.bodies.get(id)
    return b ? b : ZERO
  }

  /** ¿hay algo moviéndose? (para no gastar tiempo en reposo) */
  get active(): boolean {
    return this.bodies.size > 0
  }

  clear(): void {
    this.bodies.clear()
  }

  /** La célula movida sigue deslizándose: parte `off0` por detrás de su sitio final y con velocidad `v`. */
  glide(id: number, off0: Point, v: Point): void {
    this.bodies.set(id, { x: off0.x, y: off0.y, vx: v.x, vy: v.y, glide: true })
  }

  /**
   * Un paso. `drag` = la célula que se arrastra ahora (o null); `linked` = las que van unidas a ella
   * por hilo. Con movimiento reducido no hay física.
   */
  step(dt: number, cells: readonly DriftCell[], drag: { id: number; x: number; y: number; from: Point } | null, linked: readonly number[], reduced: boolean): void {
    if (reduced) return this.clear()
    if (!this.bodies.size && !drag) return
    const targets = drag ? driftTargets(cells, drag, linked) : new Map<number, Point>()
    const spring = drag ? DRAG_SPRING : REST_SPRING
    if (drag) this.bodies.delete(drag.id)
    const ids = new Set(cells.map((c) => c.id))
    for (const c of cells) {
      if (drag && c.id === drag.id) continue
      const t = targets.get(c.id) ?? ZERO
      let b = this.bodies.get(c.id)
      if (!b) {
        if (!t.x && !t.y) continue
        b = { x: 0, y: 0, vx: 0, vy: 0, glide: false }
        this.bodies.set(c.id, b)
      }
      stepBody(b, t, Math.min(dt, 0.05), spring)
      if (atRest(b, t) && !t.x && !t.y) this.bodies.delete(c.id)
    }
    for (const id of [...this.bodies.keys()]) if (!ids.has(id)) this.bodies.delete(id)
  }
}

/** Las células unidas por hilo a `id` en el orden (la anterior y la siguiente; sin hilo del final a la intro). */
export function linkedIds(order: readonly number[], id: number): number[] {
  const i = order.indexOf(id)
  if (i < 0) return []
  return [order[i - 1], order[i + 1]].filter((v): v is number => v !== undefined)
}

/**
 * Zoom y colocación de la gota (spec 003, §1, fase 4). Puro y sin DOM.
 *
 * La gota vive en el rectángulo libre (la ventana menos las zonas de los controles y las zonas
 * seguras, E1.8), centrada en él. Su radio es `zoom × base`, con `base` = la mitad del lado corto
 * del rectángulo: con zoom 1 toca los lados cortos y, al crecer, se aplasta contra ellos (en
 * vertical, contra los lados; en horizontal o escritorio, arriba y abajo).
 *
 * El pellizco es un gesto continuo: más allá de los límites el zoom sigue moviéndose con
 * resistencia y al soltar vuelve. Así, más adelante, alejar más allá de una célula podrá llevar a
 * la colonia de células (idea de la hoja de ruta) sin cambiar el gesto.
 */
import type { DropGeo, Rect } from './shape'

export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ZoomLimits {
  min: number
  max: number
  /** zoom inicial para esta forma de ventana */
  initial: number
}

/** Rectángulo libre: la ventana menos las zonas reservadas. */
export function freeRect(w: number, h: number, inset: Insets): Rect {
  return { x0: inset.left, y0: inset.top, x1: Math.max(inset.left + 1, w - inset.right), y1: Math.max(inset.top + 1, h - inset.bottom) }
}

const halfShort = (r: Rect) => Math.min(r.x1 - r.x0, r.y1 - r.y0) / 2
const halfLong = (r: Rect) => Math.max(r.x1 - r.x0, r.y1 - r.y0) / 2

/**
 * Límites del zoom para un rectángulo libre.
 * - mínimo: la gota a la mitad del lado corto (siempre se ven todas las franjas);
 * - máximo: llega al lado largo (en vertical, se aplasta contra los lados y sigue redonda arriba
 *   y abajo hasta tocarlos);
 * - inicial: en vertical, casi tocando los lados; en horizontal o escritorio, pegada arriba y abajo.
 */
export function zoomLimits(free: Rect, compact = false): ZoomLimits {
  const ratio = halfLong(free) / halfShort(free)
  // móvil en horizontal (E2.1): sigue siendo una gota, como mucho algo más ancha que alta
  if (compact) return { min: 0.5, max: Math.min(Math.max(1.05, ratio), COMPACT_MAX), initial: 1 }
  const max = Math.max(1.2, ratio)
  const portrait = free.y1 - free.y0 > free.x1 - free.x0
  return { min: 0.5, max, initial: portrait ? 0.95 : Math.min(max, 1.12) }
}

/** zoom máximo en el móvil en horizontal (E2.1) */
export const COMPACT_MAX = 1.25

/**
 * Móvil en horizontal (E2.1): pantalla táctil, más ancha que alta y de menos de 500 px de alto.
 * El escritorio (aunque su ventana sea baja) y el vertical no cuentan.
 */
export const isCompact = (w: number, h: number, coarse: boolean): boolean => coarse && w > h && h < 500

/**
 * Ángulos del contorno según cuánto se estira la gota (E2.1): 120 sin estirar, hasta 240.
 * `stretch` = radio / mitad del lado corto del rectángulo libre.
 */
export const contourPoints = (stretch: number, base = 120): number =>
  Math.round(Math.min(base * 2, base * Math.max(1, stretch)))

/** Cuánto se estira una gota: radio / mitad del lado corto de su rectángulo libre. */
export const stretchOf = (g: DropGeo): number => g.R / halfShort(g.free)

/** Resistencia más allá de los límites: sigue al dedo cada vez menos, sin tope duro. */
export function rubber(z: number, l: Pick<ZoomLimits, 'min' | 'max'>): number {
  const k = 0.35
  if (z > l.max) return l.max * (1 + k * Math.log(z / l.max))
  if (z < l.min) return l.min / (1 + k * Math.log(l.min / z))
  return z
}

/** Zoom durante un pellizco: proporcional a la distancia entre los dedos (con resistencia). */
export const pinchZoom = (z0: number, d0: number, d: number, l: ZoomLimits): number =>
  rubber(z0 * (Math.max(1, d) / Math.max(1, d0)), l)

/** Zoom con la rueda (o el pellizco del trackpad, que llega como rueda con ctrl). Con tope duro. */
export function wheelZoom(z: number, deltaY: number, ctrl: boolean, l: ZoomLimits): number {
  const next = z * Math.exp(-deltaY * (ctrl ? 0.01 : 0.0015))
  return Math.min(l.max, Math.max(l.min, next))
}

export const clampZoom = (z: number, l: ZoomLimits): number => Math.min(l.max, Math.max(l.min, z))

/** Geometría de la gota para una ventana, sus zonas reservadas y un zoom. */
export function dropLayout(w: number, h: number, inset: Insets, zoom: number): DropGeo {
  const free = freeRect(w, h, inset)
  const R = zoom * halfShort(free)
  return {
    cx: (free.x0 + free.x1) / 2,
    cy: (free.y0 + free.y1) / 2,
    R,
    core: Math.max(16, Math.min(28, R * 0.16)),
    free,
  }
}

/** Acerca una geometría a otra (giro del móvil o cambio de ventana sin saltos). `k` en 0..1. */
export function lerpGeo(a: DropGeo, b: DropGeo, k: number): DropGeo {
  const m = (x: number, y: number) => x + (y - x) * k
  return {
    cx: m(a.cx, b.cx),
    cy: m(a.cy, b.cy),
    R: m(a.R, b.R),
    core: m(a.core, b.core),
    free: { x0: m(a.free.x0, b.free.x0), y0: m(a.free.y0, b.free.y0), x1: m(a.free.x1, b.free.x1), y1: m(a.free.y1, b.free.y1) },
  }
}

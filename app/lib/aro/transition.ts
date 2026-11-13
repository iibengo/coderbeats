/**
 * Transición de agua entre células (spec 005, §5.1 y §5.2). Puro y sin DOM.
 *
 * Todo va atado al reloj: `pos` es el compás global que se oye, con decimales (compás + fase), y
 * "L" la línea de compás donde cambia la célula. Las posiciones son las del mapa (`Cell.at`, en
 * radios de gota).
 *
 *   L − 2 tiempos … L   la célula se estira y crece un puente hacia la siguiente; un brillo lo recorre
 *   L − 1 tiempo … L + 1 tiempo   la cámara se desliza (curva suave, sin rebote); en L va por la mitad
 *   L … L + 1 tiempo    la anterior se apaga y el puente se retrae
 */
import { noise } from './shape'

export interface Spot {
  id: number
  x: number
  y: number
}

/** Lo que se ve ahora: la célula que suena, de qué compás a cuál, la siguiente y la anterior. */
export interface CellPlan {
  cur: Spot
  /** compás global en el que empezó la célula que suena */
  start: number
  /** L: compás global en el que entra la siguiente */
  end: number
  next: Spot
  /** la que sonaba antes (null al arrancar) */
  prev: Spot | null
}

export interface Bridge {
  fromId: number
  toId: number
  /** tramo visible del puente, 0 = borde de la que sale, 1 = borde de la que entra */
  t0: number
  t1: number
  /** dónde va el brillo (0..1), o null */
  glow: number | null
}

export interface Transition {
  /** posición de la cámara en el mapa */
  cam: { x: number; y: number }
  /** la otra gota que se dibuja (la que entra, tenue, o la que se apaga), o null */
  ghost: { id: number; alpha: number } | null
  bridge: Bridge | null
  /** estiramiento de la gota que suena hacia la otra, 0..1 */
  pull: number
}

/** duración del puente antes de L y del deslizamiento a cada lado de L (compases: 2 tiempos y 1 tiempo) */
export const BRIDGE_BARS = 0.5
export const SLIDE_BARS = 0.25
/** el puente mide como mucho esto (radios); más lejos, solo viaja la cámara */
export const BRIDGE_MAX = 3
/** opacidad de la célula que va a entrar, antes de L */
export const NEXT_ALPHA = 0.4

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const smooth = (k: number) => k * k * (3 - 2 * k)
const easeOut = (k: number) => 1 - (1 - k) ** 3
const lerp = (a: Spot, b: Spot, k: number) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k })

/** Hueco entre dos gotas (radios): la distancia entre centros menos los dos radios. */
export const gapBetween = (a: Spot, b: Spot): number => Math.hypot(b.x - a.x, b.y - a.y) - 2

/**
 * Qué se ve en `pos`. Con movimiento reducido no hay estiramiento, puente ni deslizamiento: la
 * cámara corta en L (el fundido de opacidad lo pone quien dibuja).
 */
export function transitionAt(pos: number, plan: CellPlan, reduced = false): Transition {
  const still: Transition = { cam: { x: plan.cur.x, y: plan.cur.y }, ghost: null, bridge: null, pull: 0 }
  if (reduced || plan.next.id === plan.cur.id) return still

  // hacia la siguiente
  if (pos >= plan.end - BRIDGE_BARS) {
    const g = clamp01((pos - (plan.end - BRIDGE_BARS)) / BRIDGE_BARS)
    const k = clamp01((pos - (plan.end - SLIDE_BARS)) / (2 * SLIDE_BARS))
    const near = gapBetween(plan.cur, plan.next) <= BRIDGE_MAX
    return {
      cam: lerp(plan.cur, plan.next, smooth(k)),
      ghost: { id: plan.next.id, alpha: NEXT_ALPHA * easeOut(g) },
      bridge: near ? { fromId: plan.cur.id, toId: plan.next.id, t0: 0, t1: easeOut(g), glow: g } : null,
      pull: near ? easeOut(g) : 0,
    }
  }

  // recién llegada: la cámara termina de deslizarse y la anterior se apaga
  if (plan.prev && plan.prev.id !== plan.cur.id && pos < plan.start + SLIDE_BARS) {
    const h = clamp01((pos - plan.start) / SLIDE_BARS)
    const near = gapBetween(plan.prev, plan.cur) <= BRIDGE_MAX
    return {
      cam: lerp(plan.prev, plan.cur, smooth(0.5 + h / 2)),
      ghost: { id: plan.prev.id, alpha: 1 - h },
      bridge: near && h < 1 ? { fromId: plan.prev.id, toId: plan.cur.id, t0: smooth(h), t1: 1, glow: null } : null,
      pull: 0,
    }
  }
  return still
}

/** ancho del puente junto a las gotas (fracción del radio) y en su parte más fina */
export const BRIDGE_WIDE = 0.2
export const BRIDGE_THIN = 0.3

/**
 * Semiancho del puente en `s` (0..1 a lo largo), en fracción del radio: ancho junto a las gotas y
 * fino en el centro, con el mismo ruido que hace respirar a la gota, y redondeado en el extremo
 * que avanza o se retrae.
 */
export function bridgeHalfWidth(s: number, t0: number, t1: number, t: number): number {
  const mid = (2 * s - 1) ** 2
  const base = BRIDGE_WIDE * (BRIDGE_THIN + (1 - BRIDGE_THIN) * mid)
  const tip = t1 < 1 ? Math.sqrt(clamp01((t1 - s) / 0.12)) : 1
  const tail = t0 > 0 ? Math.sqrt(clamp01((s - t0) / 0.12)) : 1
  return Math.max(0, base * (1 + 0.12 * noise(s * 5, 4, t))) * tip * tail
}

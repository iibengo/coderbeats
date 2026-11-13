/**
 * Franjas del aro (spec 003, §2 y E1.3): una por voz, concéntricas, de dentro a fuera.
 * Cada franja tiene un peso (0 = oculta, 1 = visible); al aparecer o desaparecer el peso se anima
 * y las demás le hacen sitio con suavidad.
 */
import type { Voice } from '../palette'

export const BAND_ORDER: readonly Voice[] = ['bd', 'bass', 'sd', 'mel', 'hh']

export type Weights = Record<Voice, number>
export interface Band {
  /** límite interior y exterior, en u (0..1) */
  a: number
  b: number
}
export type Layout = Record<Voice, Band>

/** constante de tiempo de la transición de una franja (s) */
export const BAND_TAU = 0.2

export const allWeights = (v: number): Weights => ({ bd: v, bass: v, sd: v, mel: v, hh: v })

/** Acerca los pesos a su objetivo (exponencial, independiente de los fps). `instant` salta. */
export function stepWeights(w: Weights, target: Weights, dt: number, instant = false): Weights {
  const k = instant ? 1 : 1 - Math.exp(-dt / BAND_TAU)
  const out = { ...w }
  for (const v of BAND_ORDER) {
    const next = w[v] + (target[v] - w[v]) * k
    out[v] = Math.abs(next - target[v]) < 1e-3 ? target[v] : next
  }
  return out
}

/** Reparte 0..1 entre las franjas en proporción a su peso. */
export function bandLayout(w: Weights): Layout {
  const total = BAND_ORDER.reduce((s, v) => s + w[v], 0) || 1
  let acc = 0
  const out = {} as Layout
  for (const v of BAND_ORDER) {
    const a = acc
    acc += w[v] / total
    out[v] = { a, b: acc }
  }
  return out
}

/** Franja visible (peso > 0,5) que contiene `u`, o null. */
export function bandAt(u: number, layout: Layout, w: Weights): Voice | null {
  for (const v of BAND_ORDER) if (w[v] > 0.5 && u >= layout[v].a && u < layout[v].b) return v
  return null
}

/** u del centro de una franja (donde se dibujan los golpes de batería y el bajo). */
export const bandMid = (v: Voice, layout: Layout): number => (layout[v].a + layout[v].b) / 2

import { STYLE_MUSIC, templateSteps } from './styles'
import type { Instrument, StyleId } from './types'

export const ASSIST_SIGMA = 0.35

/**
 * Cuantización con criterio de estilo. `pos` en semicorcheas (decimal) dentro del loop.
 * Candidatos: múltiplos de `quantizeEvery` a ≤ 1 paso de `pos` (nunca mueve más de 1 paso).
 * Puntuación: log(prior) − d² / (2σ²), con σ = 0,35 × quantizeEvery.
 */
export function assistQuantize(
  pos: number,
  instrument: Instrument,
  style: StyleId,
  quantizeEvery: 1 | 2,
  totalSteps: number,
): number {
  const prior = STYLE_MUSIC[style].priors[instrument]
  const sigma = ASSIST_SIGMA * quantizeEvery
  const lo = Math.ceil((pos - 1) / quantizeEvery) * quantizeEvery
  let best = Math.round(pos / quantizeEvery) * quantizeEvery
  let bestScore = -Infinity
  for (let c = lo; c <= pos + 1; c += quantizeEvery) {
    const d = c - pos
    const p = prior[(((c % 16) + 16) % 16)] ?? 0.1
    const score = Math.log(p + 1e-6) - (d * d) / (2 * sigma * sigma)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return ((best % totalSteps) + totalSteps) % totalSteps
}

/**
 * Rejilla de la ayuda en un carril (spec 003, E5.1): la del estilo (`styleGrid`: 1 = semicorcheas, 2 =
 * corcheas), salvo que el loop del carril ya tenga golpes fuera de ella (pasos impares, de la demo o de
 * mover golpes con el dedo): entonces se permite la resolución de semicorcheas en ese carril.
 */
export function laneGrid(styleGrid: 1 | 2, hits: readonly { pos: number }[]): 1 | 2 {
  if (styleGrid === 1) return 1
  return hits.some((h) => Math.abs(h.pos / styleGrid - Math.round(h.pos / styleGrid)) > 0.02) ? 1 : styleGrid
}

/** Plantilla del estilo para un golpe suelto: posiciones de 1 compás. */
export function templateFor(instrument: Instrument, style: StyleId): number[] {
  return templateSteps(STYLE_MUSIC[style].templates[instrument])
}

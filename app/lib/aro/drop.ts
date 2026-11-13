/**
 * Qué pasa al soltar un golpe (spec 003, E1.4 y E2.2). Puro.
 */
import type { Voice } from '../palette'

/** Fuera de la gota a partir de esta distancia al borde exterior (px): se borra. */
export const DELETE_OUTSIDE_PX = 16

export type DropAction = { kind: 'delete' } | { kind: 'bounce' } | { kind: 'move'; to: Voice }

const isDrum = (v: Voice | null): boolean => v === 'bd' || v === 'sd' || v === 'hh'

/**
 * @param from voz del golpe arrastrado
 * @param u    posición radial donde se suelta (< 0 = centro, > 1 = fuera)
 * @param outPx distancia al borde exterior (px; > 0 = fuera de la gota)
 * @param band franja visible bajo el punto, o null
 */
export function dropAction(from: Voice, u: number, outPx: number, band: Voice | null): DropAction {
  // el bajo solo se mueve en el tiempo y dentro de su franja: no se borra
  if (from === 'bass') return band === 'bass' ? { kind: 'move', to: 'bass' } : { kind: 'bounce' }
  // al centro o fuera de la gota (lejos del borde): se borra
  if (u < 0 || outPx > DELETE_OUTSIDE_PX) return { kind: 'delete' }
  // justo en el borde de fuera: a la franja de fuera (platillo)
  const to = u >= 1 ? 'hh' : band
  if (!isDrum(from) || !isDrum(to)) return { kind: 'bounce' }
  return { kind: 'move', to: to! }
}

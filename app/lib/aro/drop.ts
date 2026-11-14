/**
 * Qué pasa al soltar un golpe (spec 003, E1.4 y E2.2). Puro.
 * Solo se borra en el centro; fuera de la gota va a la franja de fuera (platillo).
 */
import type { Voice } from '../palette'

export type DropAction = { kind: 'delete' } | { kind: 'bounce' } | { kind: 'move'; to: Voice }

const isDrum = (v: Voice | null): boolean => v === 'bd' || v === 'sd' || v === 'hh'

/**
 * @param from voz del golpe arrastrado
 * @param u    posición radial donde se suelta (< 0 = centro, > 1 = fuera)
 * @param band franja visible bajo el punto, o null
 */
export function dropAction(from: Voice, u: number, band: Voice | null): DropAction {
  // el bajo solo se ve (E1.4): no se coge; si llegara aquí, vuelve a su sitio
  if (from === 'bass') return { kind: 'bounce' }
  // al centro: se borra
  if (u < 0) return { kind: 'delete' }
  // la melodía solo se mueve dentro de su franja (momento y altura); en otra, vuelve (spec 002, F2)
  if (from === 'mel') return band === 'mel' ? { kind: 'move', to: 'mel' } : { kind: 'bounce' }
  // fuera de la gota: con el imán a la franja más cercana, la de fuera (platillo)
  const to = u >= 1 ? 'hh' : band
  if (!isDrum(from) || !isDrum(to)) return { kind: 'bounce' }
  return { kind: 'move', to: to! }
}

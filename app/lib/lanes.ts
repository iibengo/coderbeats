/**
 * Carriles que graban (spec 003, E4.1–E4.3). Puro.
 * Cada carril de batería es un interruptor: solo graban los encendidos. Por defecto, todos.
 */
import { INSTRUMENTS } from './constants'
import type { Instrument } from './types'

export type Lanes = ReadonlySet<Instrument>

export const allLanes = (): Set<Instrument> => new Set(INSTRUMENTS)

/** Enciende o apaga un carril. Se pueden apagar todos (el beatbox deja de grabar). */
export function toggleLane(lanes: Lanes, inst: Instrument): Set<Instrument> {
  const next = new Set(lanes)
  if (next.has(inst)) next.delete(inst)
  else next.add(inst)
  return next
}

/** Todos encendidos (lo normal): no se marca nada en el aro. */
export const allArmed = (lanes: Lanes): boolean => INSTRUMENTS.every((i) => lanes.has(i))

/** Margen de voto con el que se considera que el clasificador duda entre dos instrumentos (E4.2). */
export const LANE_DOUBT_MARGIN = 0.25

export type LaneDecision =
  | { kind: 'take'; instrument: Instrument; confidence: number }
  | { kind: 'ignore'; instrument: Instrument; confidence: number }

/**
 * Qué hacer con un golpe ya clasificado entre todos los instrumentos (E4.2):
 * - gana uno encendido: entra;
 * - gana uno apagado con claridad: se ignora (no se reasigna a otro carril);
 * - si duda entre el apagado que gana y uno encendido (diferencia de voto ≤ margen): va al encendido.
 */
export function decideLane(
  winner: Instrument,
  scores: Partial<Record<Instrument, number>>,
  lanes: Lanes,
  margin = LANE_DOUBT_MARGIN,
): LaneDecision {
  const top = scores[winner] ?? 0
  if (lanes.has(winner)) return { kind: 'take', instrument: winner, confidence: top }
  let alt: Instrument | null = null
  for (const inst of INSTRUMENTS)
    if (lanes.has(inst) && (scores[inst] ?? 0) > 0 && (alt === null || (scores[inst] ?? 0) > (scores[alt] ?? 0))) alt = inst
  if (alt && top - (scores[alt] ?? 0) <= margin) return { kind: 'take', instrument: alt, confidence: scores[alt] ?? 0 }
  return { kind: 'ignore', instrument: winner, confidence: top }
}

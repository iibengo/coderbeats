import type { Instrument } from '~/lib/types'

/** Punto de un golpe de loop en el anillo. */
export interface RingDot {
  key: string
  loopId: number
  /** paso dentro del compás, 0..16 (decimal sin ayuda) */
  step: number
  instrument: Instrument
  muted: boolean
}

/** Radio de cada aro (fracción del radio exterior): bombo dentro, caja en medio, platillo fuera. */
export const LANE: Record<Instrument, number> = { bd: 0.62, sd: 0.81, hh: 1 }

/** Distancia circular entre dos pasos de un compás de 16. */
export const stepDistance = (a: number, b: number): number => {
  const d = (((a - b) % 16) + 16) % 16
  return Math.min(d, 16 - d)
}

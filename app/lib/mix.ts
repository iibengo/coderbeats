import type { FreeLoop } from './freeLoops'
import type { Instrument } from './types'

/** Balance fijo por instrumento, en dB. */
export const INSTRUMENT_BALANCE_DB: Record<Instrument, number> = { bd: 0, sd: -1, hh: -6 }
/** El fondo va por debajo de la batería. */
export const BACKGROUND_DB = -4

export const dbToGain = (db: number): number => 10 ** (db / 20)

/** Reparto por número de loops activos: 1/√n. */
export const shareGain = (activeCount: number): number => (activeCount <= 1 ? 1 : 1 / Math.sqrt(activeCount))

/** Ganancia de cada loop (los silenciados, 0). */
export function loopGains(loops: Pick<FreeLoop, 'id' | 'instrument' | 'muted'>[]): Map<number, number> {
  const active = loops.filter((l) => !l.muted).length
  const share = shareGain(active)
  return new Map(loops.map((l) => [l.id, l.muted ? 0 : share * dbToGain(INSTRUMENT_BALANCE_DB[l.instrument])]))
}

/** Redondeo estable para el código (2 decimales). */
export const fmtGain = (g: number): string => (Math.round(g * 100) / 100).toString()

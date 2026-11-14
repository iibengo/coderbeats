import type { FreeLoop, LoopInstrument } from './freeLoops'

/** Balance fijo por instrumento, en dB. La melodía va algo por debajo de la batería (se afina de oído). */
export const INSTRUMENT_BALANCE_DB: Record<LoopInstrument, number> = { bd: 0, sd: -1, hh: -6, mel: -3 }

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

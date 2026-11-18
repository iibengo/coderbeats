import type { FreeLoop, LoopInstrument } from './freeLoops'
import { FX_SYNTHS } from './melodyEdit'
import { isPercSynth } from './percSamples'

/** Balance fijo por instrumento, en dB. La melodía va algo por debajo de la batería (se afina de oído). */
export const INSTRUMENT_BALANCE_DB: Record<LoopInstrument, number> = { bd: 0, sd: -1, hh: -6, mel: -3, voz: -2 }

export const dbToGain = (db: number): number => 10 ** (db / 20)

/** Reparto por número de loops activos: 1/√n. */
export const shareGain = (activeCount: number): number => (activeCount <= 1 ? 1 : 1 / Math.sqrt(activeCount))

/**
 * ¿Es un adorno (spec 040)? Un golpe puntual y no una capa: los sintes riser, crash, boom, impacto y downlifter, o un loop marcado con `adorno: true`
 * (el redoble de caja, que es `sd` y no se distingue por el sinte).
 */
export const isAdorno = (l: Partial<Pick<FreeLoop, 'synth' | 'adorno'>>): boolean => l.adorno === true || FX_SYNTHS.includes(l.synth ?? '')

/**
 * Ganancia de cada loop (los silenciados, 0). Los adornos **no cuentan en el reparto** (añadir un riser o un redoble no baja el bombo) y no se recalculan: suenan a su
 * fuerza (ganancia 1). Sin adornos, es el reparto de siempre.
 */
export function loopGains(loops: (Pick<FreeLoop, 'id' | 'instrument' | 'muted'> & Partial<Pick<FreeLoop, 'synth' | 'adorno'>>)[]): Map<number, number> {
  // la percusión del minimal (spec 045) tampoco cuenta en el reparto (son golpes sueltos y quedaban casi inaudibles con 1/√n), pero lleva el reparto de los demás y el balance de la melodía
  const active = loops.filter((l) => !l.muted && !isAdorno(l) && !isPercSynth(l.synth)).length
  const share = shareGain(active)
  return new Map(loops.map((l) => [l.id, l.muted ? 0 : isAdorno(l) ? 1 : share * dbToGain(INSTRUMENT_BALANCE_DB[l.instrument])]))
}

/** Redondeo estable para el código (2 decimales). */
export const fmtGain = (g: number): string => (Math.round(g * 100) / 100).toString()

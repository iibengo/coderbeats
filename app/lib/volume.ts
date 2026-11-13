/**
 * Volumen de un golpe relativo a tu calibración (spec 003, E4.0). Puro.
 * 1 = como la mediana de tus golpes de calibración de ese instrumento; 0,3 = un 30 %.
 * Sirve para distinguir en el diagnóstico la confusión (volumen normal, instrumento equivocado)
 * del ruido (golpes mucho más flojos que los tuyos).
 */
import type { CalibrationSample, Instrument } from './types'

export type VolumeRefs = Partial<Record<Instrument | 'all', number>>

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b)
  if (!s.length) return 0
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

/** Volumen de referencia (mediana del rms) por instrumento y de todos juntos. */
export function volumeRefs(samples: CalibrationSample[]): VolumeRefs {
  const out: VolumeRefs = {}
  const all = samples.map((s) => s.features.rms).filter((r) => r > 0)
  if (all.length) out.all = median(all)
  for (const inst of ['bd', 'sd', 'hh'] as const) {
    const r = samples.filter((s) => s.instrument === inst).map((s) => s.features.rms).filter((x) => x > 0)
    if (r.length) out[inst] = median(r)
  }
  return out
}

/** Volumen de un golpe (rms) relativo a la referencia de su instrumento (o de todos). null sin calibración. */
export function relativeVolume(rms: number, instrument: Instrument | 'unknown', refs: VolumeRefs): number | null {
  const ref = (instrument !== 'unknown' ? refs[instrument] : undefined) ?? refs.all
  return ref ? rms / ref : null
}

/**
 * Umbral de volumen (E4.5, activado en la enmienda 5): un golpe por debajo de esta fracción del
 * volumen de tus golpes de calibración se descarta como ruido y sale en el registro como "flojo".
 */
export const MIN_HIT_VOLUME = 0.3

/** ¿Es un golpe demasiado flojo para contar? Sin calibración (`null`) no se descarta nada. */
export const isTooQuiet = (vol: number | null | undefined, min = MIN_HIT_VOLUME): boolean => typeof vol === 'number' && vol < min

/** Texto corto para el diagnóstico: "vol 0,42". */
export const fmtVolume = (v: number | null | undefined): string =>
  v === null || v === undefined ? '' : ` · vol ${v.toFixed(2).replace('.', ',')}`

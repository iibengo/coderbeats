import { KITS, STYLES } from './constants'

const BG_MODES = ['manual', 'progressive', 'full', 'off']
const unit = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

/**
 * ¿Son unos ajustes guardados con la forma exacta? Lo que se lee de localStorage no es de fiar: kit y estilo
 * deben ser claves propias (no `toString`…), y los efectos números de 0 a 1. Si algo no cuadra, se ignoran
 * los ajustes enteros (sin borrarlos) y vuelven los de fábrica.
 */
export function isStoredPrefs(x: unknown): boolean {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  const fx = p.fx as Record<string, unknown> | null
  return (
    p.version === 1 &&
    typeof p.kit === 'string' &&
    Object.hasOwn(KITS, p.kit) &&
    typeof p.style === 'string' &&
    Object.hasOwn(STYLES, p.style) &&
    typeof p.assist === 'boolean' &&
    typeof p.metronome === 'boolean' &&
    BG_MODES.includes(p.bgMode as string) &&
    (p.phraseMode === 'silence' || p.phraseMode === 'bar') &&
    typeof p.repeatMode === 'string' &&
    [1, 2, 4].includes(p.phraseCloseBeats as number) &&
    [1, 2, 4].includes(p.maxPhraseBars as number) &&
    !!fx &&
    typeof fx === 'object' &&
    unit(fx.filter) &&
    unit(fx.space) &&
    unit(fx.warmth)
  )
}

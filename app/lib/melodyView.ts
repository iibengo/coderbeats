/**
 * La melodía en el aro y en el órgano (spec 002, F2): qué altura cae en qué sitio. Puro.
 * Vertical: del grave (dentro / abajo) al agudo (fuera / arriba), en el registro del sinte; solo cuentan las notas de
 * la escala del estilo cuando se edita con ayuda.
 */
import { REGISTER, type MelodySynth } from './melody'
import { snapToScale } from './melodyAssist'
import { STYLE_MUSIC } from './styles'
import type { StyleId } from './types'

export type MelRange = readonly [number, number]

/** Registro (MIDI, cerrado) en el que se dibuja y se edita la melodía de un sinte. */
export const rangeOf = (synth: MelodySynth): MelRange => REGISTER[synth]

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const mod = (a: number, n: number) => ((a % n) + n) % n

/** Posición vertical 0..1 de una altura en su registro (0 = la más grave; 1 = la más aguda). Cada semitono ocupa lo mismo. */
export const midiToFrac = (midi: number, range: MelRange): number => clamp01((midi - range[0] + 0.5) / (range[1] - range[0] + 1))

/** La altura (decimal) que corresponde a una posición vertical 0..1. */
export const fracToMidi = (frac: number, range: MelRange): number => range[0] + clamp01(frac) * (range[1] - range[0] + 1) - 0.5

/** Las notas de la escala del estilo dentro del registro, de grave a aguda. */
export function scaleNotes(style: StyleId, range: MelRange): number[] {
  const scale = STYLE_MUSIC[style].scale
  const out: number[] = []
  for (let m = range[0]; m <= range[1]; m++) if (scale.includes(mod(m, 12))) out.push(m)
  return out
}

/** La nota de la escala más cercana a `midi`. */
export const nearestScaleNote = (midi: number, style: StyleId): number => snapToScale(midi, STYLE_MUSIC[style].scale, [], null)

/** ¿Encaja `midi` en la escala (a menos de `tol` semitonos de un grado)? y cuál es ese grado. */
export function fitToScale(midi: number, style: StyleId, tol = 0.3): { fit: boolean; note: number } {
  const note = nearestScaleNote(midi, style)
  return { fit: Math.abs(midi - note) <= tol, note }
}

/** Fila (0 = la más grave) de la escala que corresponde a una altura: la más cercana. */
export function rowOf(midi: number, rows: readonly number[]): number {
  let best = 0
  for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i]! - midi) < Math.abs(rows[best]! - midi)) best = i
  return best
}

/** ¿Es la tónica de la escala (para resaltarla en el órgano)? La primera nota de la escala del estilo. */
export const isTonic = (midi: number, style: StyleId): boolean => mod(midi, 12) === STYLE_MUSIC[style].scale[0]

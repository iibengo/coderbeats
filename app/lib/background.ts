import type { StyleId } from './types'

export type BackgroundMode = 'progressive' | 'full' | 'off'
export type Part = 'bass' | 'chords'
export type Parts = Record<Part, boolean>

export const NO_PARTS: Parts = { bass: false, chords: false }

/** Orbit (bus) de cada parte del fondo. El sidechain del bombo empuja los dos. */
export const PART_ORBIT: Record<Part, number> = { bass: 2, chords: 3 }

/** Partes que deberían sonar según los loops activos (no silenciados) y el modo. */
export function targetParts(activeLoops: number, mode: BackgroundMode): Parts {
  if (mode === 'off') return { ...NO_PARTS }
  if (mode === 'full') return { bass: true, chords: true }
  return { bass: activeLoops >= 2, chords: activeLoops >= 3 }
}

/** Compases que dura la entrada o la salida (~2–3 s en todos los estilos). */
export const rampBars = (style: StyleId): 1 | 2 => (style === 'dnb' ? 2 : 1)

export interface Transition {
  part: Part
  dir: 'in' | 'out'
  /** compás global en el que empieza */
  bar: number
  /** compases que dura */
  bars: number
}

/**
 * Plan de transiciones desde el estado actual hasta el objetivo, empezando en `fromBar`.
 * Entran en orden bajo → acordes y salen en orden inverso (acordes → bajo). Si cambian
 * las dos a la vez, la segunda empieza cuando termina la primera.
 */
export function planTransitions(current: Parts, target: Parts, fromBar: number, style: StyleId): Transition[] {
  const bars = rampBars(style)
  const out: Transition[] = []
  let bar = fromBar
  for (const part of ['chords', 'bass'] as const)
    if (current[part] && !target[part]) {
      out.push({ part, dir: 'out', bar, bars })
      bar += bars
    }
  for (const part of ['bass', 'chords'] as const)
    if (!current[part] && target[part]) {
      out.push({ part, dir: 'in', bar, bars })
      bar += bars
    }
  return out
}

export const anyPart = (p: Parts): boolean => p.bass || p.chords

/**
 * «La forma de tu ritmo» (spec 016 §15): los golpes de cada instrumento unidos con líneas finas forman una figura por carril. Parte pura: qué puntos van en cada figura y en qué orden.
 */
import type { Voice } from '../palette'

export interface ShapeDot {
  voice: Voice
  step: number
  muted: boolean
  loopId: number
}

/** Los instrumentos que dibujan figura (la batería): el bajo y la melodía ya tienen sus arcos. */
export const SHAPE_VOICES: readonly Voice[] = ['bd', 'sd', 'hh']

/**
 * Los pasos de cada figura, **ordenados** (la figura da la vuelta al aro en el sentido de la aguja) y sin repetir. Una figura necesita al menos 2 golpes; los silenciados no cuentan
 * (una capa apagada no forma parte de la forma que suena).
 */
export function shapeSteps(dots: readonly ShapeDot[]): Partial<Record<Voice, number[]>> {
  const out: Partial<Record<Voice, number[]>> = {}
  for (const v of SHAPE_VOICES) {
    const steps = [...new Set(dots.filter((d) => d.voice === v && !d.muted && d.loopId >= 0 && Number.isFinite(d.step)).map((d) => d.step))].sort((a, b) => a - b)
    if (steps.length >= 2) out[v] = steps
  }
  return out
}

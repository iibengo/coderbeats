/**
 * La guía de los dos primeros minutos de la portada (spec 016 §4): una sola frase cada vez, tenue. Una máquina **pura**: según lo que ya ha hecho la persona dice cuál toca.
 * Nunca bloquea: si hace otra cosa, el paso se da por cumplido.
 *
 *   estilo (las tarjetas) → voz → dedo → guardar → hecho   (la voz va primero: spec 016 §2b)
 */
export type PortadaStep = 'estilo' | 'voz' | 'dedo' | 'guardar' | 'hecho'

export interface PortadaFacts {
  picked: boolean
  /** ha puesto el dedo en el agua alguna vez (o ya hay una melodía grabada) */
  fingered: boolean
  /** hay ritmo (algún loop de batería con golpes) */
  rhythm: boolean
  /** ya se ha visto la frase de guardar el tiempo suficiente, o se ha abierto el vídeo/menú */
  finished: boolean
}

export function portadaStep(f: PortadaFacts): PortadaStep {
  if (f.finished) return 'hecho'
  if (!f.picked) return 'estilo'
  if (!f.rhythm) return 'voz'
  if (!f.fingered) return 'dedo'
  return 'guardar'
}

export const PORTADA_LINE: Record<PortadaStep, string> = {
  estilo: 'Elige cómo suena',
  voz: 'Haz bum · pff · ts',
  dedo: 'Ahora pon el dedo en el agua y muévelo',
  guardar: 'Se guarda solo. Compártelo con 🎬 Mi reel',
  hecho: '',
}
/** cuánto se enseña «guardar» antes de dar la guía por acabada (ms) */
export const GUARDAR_MS = 7000

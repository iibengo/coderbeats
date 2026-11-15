/**
 * El primer minuto guiado de Jugar (spec 011, §12.2). Una máquina de pasos **pura**: dado lo que pasa (compás, loops, golpes oídos),
 * dice en qué paso va. Solo es texto: no toca la canción. Nunca bloquea: si la persona hace otra cosa, el paso se da por cumplido.
 *
 *   wait → listen («Escucha») → play («Haz bum · pff · ts») → appear («En la siguiente vuelta aparecen tus golpes») → sing → done
 */
export type GuideStep = 'wait' | 'listen' | 'play' | 'appear' | 'sing' | 'done'

export interface GuideState {
  step: GuideStep
  /** compás (global) en el que se entró en el paso */
  sinceBar: number
  /** en `appear`: compás en el que se vio por primera vez el loop de batería (se espera uno más para que se aprecie) */
  mark?: number
}

export interface GuideFacts {
  /** compás global actual (entero) */
  bar: number
  playing: boolean
  /** loops de batería de la célula que se ve */
  drumLoops: number
  /** loops de melodía de la célula que se ve */
  melLoops: number
  /** golpes que el micro ha oído desde que empezó la guía */
  heard: number
}

export const GUIDE_START: GuideState = { step: 'wait', sinceBar: 0 }
export const GUIDE_DONE: GuideState = { step: 'done', sinceBar: 0 }

/** La frase de cada paso (una sola a la vez, pequeña). `voice`: la melodía con la voz está activada; `suggest`: hay una melodía sugerida a la vista (spec 012). */
export function guideLine(step: GuideStep, voice: boolean, suggest = false): string {
  switch (step) {
    case 'listen':
      return 'Escucha'
    case 'play':
      return 'Haz bum · pff · ts'
    case 'appear':
      return 'En la siguiente vuelta aparecen tus golpes'
    case 'sing':
      if (suggest) return voice ? 'Canta «na», o toca la melodía sugerida' : 'Toca la melodía sugerida'
      return voice ? 'Ahora canta «na»' : 'Toca la franja de la melodía'
    default:
      return ''
  }
}

/**
 * El paso siguiente a un estado, según lo que pasa. Devuelve **el mismo objeto** si no cambia nada (para no repintar).
 * - `wait`: espera a que suene; si ya hay loops (una canción hecha, una demo) **no hay guía**: pasa a `done`.
 * - `listen`: un compás de escucha (o antes, si ya hay golpes).
 * - `play`: hasta que se oiga un golpe o haya un loop de batería.
 * - `appear`: un compás después de que se vea el loop de batería (o antes, si ya hay melodía).
 * - `sing`: hasta que haya melodía o pasen 2 compases (no se espera nada).
 */
export function advanceGuide(s: GuideState, f: GuideFacts): GuideState {
  if (s.step === 'done') return s
  let step = s.step as GuideStep
  let since = s.sinceBar
  let mark = s.mark
  const go = (n: GuideStep) => {
    step = n
    since = f.bar
    mark = undefined
  }
  for (let i = 0; i < 6; i++) {
    const before: GuideStep = step
    if (step === 'wait') {
      if (!f.playing) break
      go(f.drumLoops + f.melLoops > 0 ? 'done' : 'listen')
    } else if (step === 'listen') {
      if (f.bar - since >= 1 || f.drumLoops + f.melLoops > 0) go('play')
    } else if (step === 'play') {
      if (f.drumLoops > 0 || f.heard > 0 || f.melLoops > 0) go('appear')
    } else if (step === 'appear') {
      if (f.drumLoops > 0 && mark === undefined) mark = f.bar
      if ((mark !== undefined && f.bar - mark >= 1) || f.melLoops > 0) go('sing')
    } else if (step === 'sing') {
      if (f.melLoops > 0 || f.bar - since >= 2) go('done')
    }
    if (step === before || (step as GuideStep) === 'done') break
  }
  if (step === s.step && since === s.sinceBar && mark === s.mark) return s
  return mark === undefined ? { step, sinceBar: since } : { step, sinceBar: since, mark }
}

/** ¿Se muestra una frase en este paso? */
export const guideVisible = (s: GuideState): boolean => s.step !== 'wait' && s.step !== 'done'

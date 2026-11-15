/**
 * Tutorial jugando (spec 001 §14.1), pasos 2 y 3 y las pistas en su momento. El paso 1 («Dale a Play y haz bum») ya es la guía del primer minuto (spec 011 §12.2): el
 * tutorial empieza cuando esa guía acaba y hay un loop. Puro: se enseña con una mano fantasma (el motor del dedo de 009) y avanza **al hacerlo**, no al leer.
 */
export type TutorialStep = 'drag' | 'delete' | 'done'
export type Hint = 'lane' | 'zoom'

export interface TutorialState {
  step: TutorialStep
  /** golpes de batería y su firma (posiciones) cuando empezó el paso */
  baseCount: number
  baseSig: string
  /** pistas ya mostradas (una sola vez, por dispositivo) */
  seen: Hint[]
}

export interface TutorialFacts {
  /** la guía del primer minuto ya acabó, suena y hay al menos un loop */
  ready: boolean
  /** golpes de batería (no melodía) en lo que se ve, y su firma */
  hits: number
  sig: string
  loops: number
  cells: number
}

export const TUTORIAL_START: TutorialState = { step: 'drag', baseCount: -1, baseSig: '', seen: [] }
export const TUTORIAL_DONE: TutorialState = { step: 'done', baseCount: 0, baseSig: '', seen: ['lane', 'zoom'] }

export const TUTORIAL_TEXT: Record<Exclude<TutorialStep, 'done'>, { big: string; count: string }> = {
  drag: { big: 'Arrastra un golpe', count: '2/3' },
  delete: { big: 'Llévalo al centro para borrarlo', count: '3/3' },
}
export const HINT_TEXT: Record<Hint, string> = {
  lane: 'Mantén un carril para grabar solo ahí',
  zoom: 'Aleja con dos dedos para ver tu canción',
}

/** Avanza el paso según lo que hace la persona: mover un golpe (misma cantidad, otras posiciones) y luego quitar uno (menos golpes). */
export function advanceTutorial(s: TutorialState, f: TutorialFacts): TutorialState {
  if (s.step === 'done' || !f.ready || f.hits < 1) return s
  // al empezar un paso se anota cómo estaba todo
  if (s.baseCount < 0) return { ...s, baseCount: f.hits, baseSig: f.sig }
  // si se graban o añaden golpes mientras tanto, la referencia se pone al día (mover = misma cantidad, otras posiciones)
  if (s.step === 'drag' && f.hits !== s.baseCount) return { ...s, baseCount: f.hits, baseSig: f.sig }
  if (s.step === 'delete' && f.hits > s.baseCount) return { ...s, baseCount: f.hits, baseSig: f.sig }
  if (s.step === 'drag' && f.hits === s.baseCount && f.sig !== s.baseSig) return { ...s, step: 'delete', baseCount: f.hits, baseSig: f.sig }
  if (s.step === 'delete' && f.hits < s.baseCount) return { ...s, step: 'done' }
  return s
}

/** La pista que toca ahora (si hay), una sola vez: con varios loops, la del carril; con dos células, la de alejar. Solo con el tutorial de pasos terminado. */
export function hintFor(s: TutorialState, f: TutorialFacts): Hint | null {
  if (s.step !== 'done' || !f.ready) return null
  if (f.loops >= 2 && !s.seen.includes('lane')) return 'lane'
  if (f.cells >= 2 && !s.seen.includes('zoom')) return 'zoom'
  return null
}

export const markSeen = (s: TutorialState, h: Hint): TutorialState => (s.seen.includes(h) ? s : { ...s, seen: [...s.seen, h] })

export const isTutorialState = (x: unknown): x is TutorialState => {
  if (!x || typeof x !== 'object') return false
  const t = x as Partial<TutorialState>
  return (t.step === 'drag' || t.step === 'delete' || t.step === 'done') && Number.isInteger(t.baseCount) && typeof t.baseSig === 'string' && Array.isArray(t.seen) && t.seen.every((h) => h === 'lane' || h === 'zoom')
}

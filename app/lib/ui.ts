/**
 * La preferencia de interfaz (spec 016): portada simple o Estudio, y la opción de sincronía de la melodía. Va en **su propia clave** (no toca los ajustes ni las canciones guardadas):
 * sin ella, la portada. Lo que se lee de localStorage no es de fiar: solo vale con la forma exacta.
 */
export type UiMode = 'simple' | 'estudio'

export interface UiPrefs {
  version: 1
  ui: UiMode
  /** «Melodía en el compás» (spec 016 §9.3): la espiral programa las notas en la línea de compás del motor; por defecto encendida */
  syncMelody: boolean
}

export const UI_KEY = 'coderbeats:ui:v1'
export const DEFAULT_UI: UiPrefs = { version: 1, ui: 'simple', syncMelody: true }

export function isUiPrefs(x: unknown): x is UiPrefs {
  if (!x || typeof x !== 'object') return false
  const p = x as Record<string, unknown>
  return p.version === 1 && (p.ui === 'simple' || p.ui === 'estudio') && typeof p.syncMelody === 'boolean'
}

/** ¿La portada pide primero elegir estilo? Solo con la canción vacía y sin música sonando (si ya hay algo, se sigue por donde iba). */
export function needsPick(o: { loops: number; cells: number; playing: boolean }): boolean {
  return !o.playing && o.loops === 0 && o.cells <= 1
}

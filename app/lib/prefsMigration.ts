import type { RepeatMode } from './freeLoops'

/**
 * Modo de repetición al cargar las prefs guardadas.
 * - 'accumulate' (antes de §16.19) pasa a 'complete'.
 * - §16.21: "completa" es el valor por defecto; quien tenga "sustituye" guardado de antes (era el
 *   valor por defecto) pasa a "completa" una sola vez. Las prefs guardadas desde entonces llevan
 *   `completeDefault`, y un "sustituye" elegido después se respeta.
 */
export function migrateRepeatMode(saved: string | undefined, completeDefault: boolean | undefined): RepeatMode {
  if (saved === 'accumulate') return 'complete'
  if (saved === 'replace') return completeDefault ? 'replace' : 'complete'
  return 'complete'
}

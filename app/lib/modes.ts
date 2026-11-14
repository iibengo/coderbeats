/**
 * Los modos (spec 011): dos vistas de la misma canción. **No son datos de la canción**: no se guardan con ella, solo en las
 * preferencias del dispositivo. Puro.
 */
export type Mode = 'jugar' | 'componer'

export const MODES: readonly { id: Mode; label: string }[] = [
  { id: 'jugar', label: 'Jugar' },
  { id: 'componer', label: 'Componer' },
]

/** El modo por defecto, también para quien ya usaba la colonia (spec 011, §8). */
export const DEFAULT_MODE: Mode = 'jugar'

export const isMode = (x: unknown): x is Mode => x === 'jugar' || x === 'componer'

/** El modo de un valor guardado, o el de por defecto si no se entiende (nunca tira). */
export const modeFromSaved = (x: unknown): Mode => (isMode(x) ? x : DEFAULT_MODE)

/** El aviso de la primera vez que se pasa a cada modo con el pellizco o el selector (spec 011, §4.2). */
export const MODE_HINT: Record<Mode, string> = {
  jugar: 'Jugar: la gota de la canción, para tocar y cantar',
  componer: 'Componer: el mapa de tu canción, para ordenar sus partes',
}

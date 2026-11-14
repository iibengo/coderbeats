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

/** Un tramo de la tira de células (spec 011, §3.6): una célula de la canción, con lo que dura y si es la que se ve. */
export interface StripCell {
  id: number
  name: string
  turns: number
  current: boolean
}

/**
 * La tira de células de Jugar: **solo las células de la canción, en su orden** (los grupos en paralelo no salen) y solo si hay más de una.
 * `viewId` es la célula que se ve (la que suena, o la que se está editando).
 */
export function cellStrip(song: { cells: readonly { id: number; name?: string; turns: number }[]; order: readonly number[] }, viewId: number): StripCell[] {
  if (song.order.length < 2) return []
  return song.order.flatMap((id, i) => {
    const c = song.cells.find((x) => x.id === id)
    return c ? [{ id, name: c.name?.trim() || `parte ${i + 1}`, turns: Math.max(1, c.turns), current: id === viewId }] : []
  })
}

/**
 * Mis canciones fuera del navegador (spec 027): exportar una canción o todas a `.json` e importar desde un archivo, un texto pegado o un enlace.
 * **Solo datos, nunca código**: todo se lee como texto, se parsea con `JSON.parse` y cada canción pasa por el mismo validador que lo guardado y los enlaces (`isSavedSong`).
 * Lo inválido se descarta y se cuenta (nunca se «arregla»). Importar solo **añade**: no reescribe ni borra lo que ya hay. Nada de esto toca la red.
 */
import { addSong, type Library, type SavedSong, type SongSnapshot, type Entry } from './library'
import { decodeShare, savedFromShareObject, shareObject } from './shareLink'

export const BACKUP_FORMAT = 'coderbeats-copia'
/** topes: texto de un archivo, canciones en una copia */
export const MAX_FILE_CHARS = 20_000_000
export const MAX_SONGS = 500

/** el texto de un archivo de una canción */
export const songJson = (snap: SongSnapshot, name: string): string => JSON.stringify(shareObject(snap, name))

/** el texto de la copia de seguridad de varias canciones (solo las que se pueden abrir) */
export function backupJson(entries: readonly Entry[]): string {
  const canciones = entries.filter((e) => e.saved).slice(0, MAX_SONGS).map((e) => shareObject(e.saved!, e.saved!.name))
  return JSON.stringify({ formato: BACKUP_FORMAT, version: 1, canciones })
}

/** un nombre de archivo seguro a partir del nombre de la canción */
export const fileNameOf = (name: string, ext = 'json'): string => `${(name.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 40) || 'cancion')}.${ext}`

export type ImportResult = { ok: true; songs: SavedSong[]; rejected: number } | { ok: false; error: 'empty' | 'big' | 'format' | 'none' }

/** Lo que dice un texto importado: una canción, una copia de seguridad o un enlace. Nunca lanza. */
export async function parseImport(text: string, now = new Date(), newId?: () => string): Promise<ImportResult> {
  if (typeof text !== 'string') return { ok: false, error: 'format' }
  const t = text.replace(/^﻿/, '').trim()
  if (!t) return { ok: false, error: 'empty' }
  if (t.length > MAX_FILE_CHARS) return { ok: false, error: 'big' }
  // un enlace (o solo su parte `#c=…`)
  const link = /#c=([A-Za-z0-9_-]+)/.exec(t) ?? (/^c=([A-Za-z0-9_-]+)$/.exec(t) as RegExpExecArray | null)
  if (link && !t.startsWith('{')) {
    const s = await decodeShare(link[1]!, now, newId)
    return s ? { ok: true, songs: [s], rejected: 0 } : { ok: false, error: 'none' }
  }
  let o: unknown
  try {
    o = JSON.parse(t)
  } catch {
    return { ok: false, error: 'format' }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'format' }
  const d = o as Record<string, unknown>
  if (Object.hasOwn(d, 'formato')) {
    if (d.formato !== BACKUP_FORMAT || d.version !== 1 || !Array.isArray(d.canciones)) return { ok: false, error: 'format' }
    const list = d.canciones.slice(0, MAX_SONGS)
    const songs = list.flatMap((x) => {
      const s = savedFromShareObject(x, now, newId)
      return s ? [s] : []
    })
    return songs.length ? { ok: true, songs, rejected: d.canciones.length - songs.length } : { ok: false, error: 'none' }
  }
  const one = savedFromShareObject(d, now, newId)
  return one ? { ok: true, songs: [one], rejected: 0 } : { ok: false, error: 'none' }
}

const keyOf = (s: SavedSong): string => `${s.name}|${s.style}|${s.kit}|${JSON.stringify(s.song)}`

/** Añade las canciones importadas a la biblioteca: **solo añade**; las que ya están (mismo nombre y mismo contenido) se omiten; ids nuevos si chocan. */
export function mergeImported(lib: Library, songs: readonly SavedSong[]): { lib: Library; added: number; skipped: number } {
  const have = new Set(lib.entries.flatMap((e) => (e.saved ? [keyOf(e.saved)] : [])))
  const ids = new Set(lib.entries.map((e) => e.id))
  let next = lib
  let added = 0
  for (const s of songs) {
    if (have.has(keyOf(s))) continue
    let id = s.id
    while (ids.has(id)) id = `c-${Math.random().toString(36).slice(2, 10)}`
    ids.add(id)
    have.add(keyOf(s))
    next = addSong(next, { ...s, id })
    added++
  }
  return { lib: next, added, skipped: songs.length - added }
}

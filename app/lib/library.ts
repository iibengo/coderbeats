/**
 * Mis canciones (spec 006). Puro y sin DOM: nombres, validación, lectura y escritura seguras de la lista y
 * sus operaciones. La parte del navegador (localStorage) está en `composables/useLibrary.ts`.
 *
 * Datos seguros (§5): leer nunca borra, una entrada que esta versión no entiende se conserva tal cual, y
 * una canción guardada que no vale se ve como "no se puede abrir" pero tampoco se borra sola.
 */
import type { BackgroundMode } from './background'
import { isSong, normalizeSong, songBars, storableSong, withValidBpm, type Song } from './cells'
import { KITS, STYLES } from './constants'
import type { SongFx } from './song'
import type { KitId, StyleId } from './types'

export const LIBRARY_KEY = 'coderbeats:library:v1'
/** copia del texto roto, antes de escribir encima */
export const LIBRARY_BROKEN_KEY = 'coderbeats:library:v1:roto'
/** la canción guardada de la que viene lo de ahora (para "guardar cambios" y el aviso al abrir) */
export const LIBRARY_CURRENT_KEY = 'coderbeats:library:current'
export const NAME_MAX = 60
/** cuánto se puede deshacer un borrado (ms) */
export const UNDO_MS = 8000

/** Lo que es de la canción (spec 006, §3): el modelo de la 005 más estilo, kit, fondo y efectos. */
export interface SongSnapshot {
  style: StyleId
  kit: KitId
  bgMode: BackgroundMode
  fx: SongFx
  song: Song
}

export interface SavedSong extends SongSnapshot {
  id: string
  name: string
  /** de la última vez que se guardó (ISO) */
  savedAt: string
}

/** Una entrada de la lista: la canción si vale, y siempre el original para no perderlo. */
export interface Entry {
  id: string
  name: string
  savedAt: string
  /** null = no se puede abrir (se ve en la lista y se puede borrar) */
  saved: SavedSong | null
  raw: unknown
}

export interface Library {
  entries: Entry[]
  /** entradas que esta versión no entiende: no se ven, pero se conservan al escribir */
  unknown: unknown[]
  /** el texto guardado no se pudo leer: la lista se ve vacía y no se reescribe sin guardar antes una copia */
  broken: boolean
}

export const emptyLibrary = (): Library => ({ entries: [], unknown: [], broken: false })

// ── nombres ──────────────────────────────────────────────────────────────────────
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const pad = (n: number) => String(n).padStart(2, '0')

/** Nombre automático: estilo + fecha y hora, p. ej. "Drum and bass · 14 nov, 21:30" (hora del dispositivo). */
export function autoName(style: StyleId, date: Date): string {
  return `${STYLES[style].label} · ${date.getDate()} ${MONTHS[date.getMonth()]}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Nombre limpio: sin espacios de más, hasta 60 caracteres; vacío → `fallback`. */
export function cleanName(text: string, fallback: string): string {
  const t = text.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim()
  return t || fallback
}

/** Id único de una canción guardada. */
export const newId = (now: number, rand: () => number = Math.random): string =>
  `s${now.toString(36)}${Math.floor(rand() * 36 ** 4).toString(36).padStart(4, '0')}`

// ── validación ───────────────────────────────────────────────────────────────────
const BG_MODES: readonly BackgroundMode[] = ['manual', 'progressive', 'full', 'off']
const isUnit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1

const isEnvelope = (x: unknown): x is { id: string; name: string; savedAt: string } => {
  const o = x as Record<string, unknown> | null
  return !!o && typeof o === 'object' && typeof o.id === 'string' && !!o.id && typeof o.name === 'string' && typeof o.savedAt === 'string'
}

/** ¿Es una canción guardada que se puede abrir? Estilo y kit conocidos, efectos entre 0 y 1 y una canción válida. */
export function isSavedSong(x: unknown): x is SavedSong {
  if (!isEnvelope(x)) return false
  const o = x as unknown as Record<string, unknown>
  const fx = o.fx as Record<string, unknown> | null
  return (
    typeof o.style === 'string' &&
    Object.hasOwn(STYLES, o.style) &&
    typeof o.kit === 'string' &&
    Object.hasOwn(KITS, o.kit) &&
    BG_MODES.includes(o.bgMode as BackgroundMode) &&
    !!fx &&
    typeof fx === 'object' &&
    isUnit(fx.filter) &&
    isUnit(fx.space) &&
    isUnit(fx.warmth) &&
    isSong(o.song)
  )
}

// ── lectura y escritura ──────────────────────────────────────────────────────────
/**
 * Lee el texto guardado. Nunca tira nada: un texto roto da una lista vacía con `broken`, y lo que no se
 * entiende va a `unknown`. Una canción con un tempo roto se abre con el del estilo (`withValidBpm`).
 */
export function parseLibrary(text: string | null | undefined): Library {
  if (!text) return emptyLibrary()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { entries: [], unknown: [], broken: true }
  }
  const d = data as { version?: unknown; songs?: unknown } | null
  if (!d || typeof d !== 'object' || d.version !== 1 || !Array.isArray(d.songs)) return { entries: [], unknown: [], broken: true }
  const lib = emptyLibrary()
  const seen = new Set<string>()
  for (const item of d.songs) {
    if (!isEnvelope(item) || seen.has(item.id)) {
      lib.unknown.push(item)
      continue
    }
    seen.add(item.id)
    const saved = isSavedSong(item) ? { ...item, song: normalizeSong(withValidBpm(item.song)) } : null
    lib.entries.push({ id: item.id, name: item.name, savedAt: item.savedAt, saved, raw: saved ?? item })
  }
  return lib
}

/** El texto que se guarda: las entradas (la canción, o el original si no vale) y las que no se entienden. */
export function serializeLibrary(lib: Library): string {
  return JSON.stringify({ version: 1, songs: [...lib.entries.map((e) => e.raw), ...lib.unknown] })
}

// ── guardar ──────────────────────────────────────────────────────────────────────
/** La canción de ahora lista para guardar: sin versiones previas ni nacimientos (`storableSong`). */
export const storableSnapshot = (s: SongSnapshot): SongSnapshot => ({
  style: s.style,
  kit: s.kit,
  bgMode: s.bgMode,
  fx: { filter: s.fx.filter, space: s.fx.space, warmth: s.fx.warmth },
  song: storableSong(s.song),
})

export function makeSaved(snap: SongSnapshot, id: string, name: string, now: Date): SavedSong {
  return { id, name: cleanName(name, autoName(snap.style, now)), savedAt: now.toISOString(), ...storableSnapshot(snap) }
}

const entryOf = (saved: SavedSong): Entry => ({ id: saved.id, name: saved.name, savedAt: saved.savedAt, saved, raw: saved })

/** Más reciente primero (las de la misma fecha, como estaban). */
export const sortedEntries = (lib: Library): Entry[] => [...lib.entries].sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0))

export const addSong = (lib: Library, saved: SavedSong): Library => ({ ...lib, entries: [...lib.entries, entryOf(saved)] })

/** "Guardar cambios": sustituye la entrada (con su misma posición); si ya no está, la añade. */
export function replaceSong(lib: Library, saved: SavedSong): Library {
  const i = lib.entries.findIndex((e) => e.id === saved.id)
  if (i < 0) return addSong(lib, saved)
  const entries = [...lib.entries]
  entries[i] = entryOf(saved)
  return { ...lib, entries }
}

/** Renombrar: solo las que se pueden abrir (una rota no se toca). Nombre vacío → no cambia. */
export function renameSong(lib: Library, id: string, name: string): Library {
  const e = lib.entries.find((x) => x.id === id)
  if (!e?.saved) return lib
  const clean = cleanName(name, '')
  if (!clean || clean === e.name) return lib
  return replaceSong(lib, { ...e.saved, name: clean })
}

/** Borrar: devuelve la lista sin ella y lo que se quitó con su sitio, para poder deshacer. */
export function removeSong(lib: Library, id: string): { lib: Library; removed: Entry | null; index: number } {
  const index = lib.entries.findIndex((e) => e.id === id)
  if (index < 0) return { lib, removed: null, index: -1 }
  return { lib: { ...lib, entries: lib.entries.filter((e) => e.id !== id) }, removed: lib.entries[index]!, index }
}

/** Deshacer un borrado: la entrada vuelve a su sitio (o al final si la lista es más corta). */
export function restoreEntry(lib: Library, entry: Entry, index: number): Library {
  if (lib.entries.some((e) => e.id === entry.id)) return lib
  const entries = [...lib.entries]
  entries.splice(Math.min(Math.max(0, index), entries.length), 0, entry)
  return { ...lib, entries }
}

// ── lo que se enseña ─────────────────────────────────────────────────────────────
/** Resumen de la fila: "Drum and bass · 4 células + 2 grupos · 18 compases · 174 bpm" (los grupos en paralelo, §16). */
export function summaryText(s: SavedSong): string {
  const inOrder = s.song.order.length
  const groups = s.song.groups?.length ?? 0
  const bpm = s.song.bpm ?? STYLES[s.style].bpm
  const extra = groups > 0 ? ` + ${groups} ${groups === 1 ? 'grupo' : 'grupos'}` : ''
  const cells = `${inOrder} ${inOrder === 1 ? 'célula' : 'células'}${extra}`
  return `${STYLES[s.style].label} · ${cells} · ${songBars(s.song)} compases · ${Math.round(bpm)} bpm`
}

/** Fecha de la fila: "14 nov, 21:30". */
export function dateText(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ── ¿está guardado lo de ahora? ──────────────────────────────────────────────────
/** ¿Está vacía la canción? Una sola célula, sin loops ni partes del fondo. */
export const isEmptySong = (song: Song): boolean => song.cells.length === 1 && song.cells.every((c) => !c.loops.length && !c.parts.bass && !c.parts.chords)

const keyOf = (s: SongSnapshot): string => JSON.stringify(storableSnapshot(s))

/**
 * ¿Lo de ahora no está guardado? Sí, si no está vacío y es distinto de la última versión guardada o
 * abierta (`reference`; sin ella, no hay nada con lo que compararlo).
 */
export function isUnsaved(current: SongSnapshot, reference: SongSnapshot | null): boolean {
  if (isEmptySong(current.song)) return false
  return !reference || keyOf(current) !== keyOf(reference)
}

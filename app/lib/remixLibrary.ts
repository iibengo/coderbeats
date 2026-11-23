/**
 * La biblioteca de Remixes del Laboratorio (spec 051): buscar, filtrar por estilo, la carátula de cada remix y su duración. Puro y sin DOM.
 */
import { STYLES } from './constants'
import type { Timeline } from './timeline'
import { LANES } from './timeline'
import type { StyleId } from './types'

/** Sin acentos ni mayúsculas ni espacios de más: «Sinfonía» y «sinfonia» son lo mismo, y «n.º» y «n.o» también. */
export const normalizeText = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º/g, 'o') // «n.º 40»: el ordinal no es un acento y no se descompone
    .replace(/ª/g, 'a')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export interface Searchable {
  title: string
  composer?: string
  key?: string
  style: StyleId
}

/** El texto en el que se busca: título, compositor, tonalidad y el nombre del estilo (el que ve la persona, no el id). */
const haystack = (r: Searchable): string => normalizeText(`${r.title} ${r.composer ?? ''} ${r.key ?? ''} ${STYLES[r.style]?.label ?? r.style}`)

/** ¿Coincide con la búsqueda? Todas las palabras tienen que estar (en cualquier orden); una búsqueda vacía coincide con todo. */
export function matchesQuery(r: Searchable, query: string): boolean {
  const words = normalizeText(query).split(' ').filter(Boolean)
  if (!words.length) return true
  const h = haystack(r)
  return words.every((w) => h.includes(w))
}

/**
 * La clave de filtro de un estilo: el nombre que ve la persona, normalizado. Varios estilos internos se llaman igual (`techno` y `techno2` son «Techno»; `house` y `house2`, «House»): para la persona son uno,
 * así que un chip «Techno» los trae a todos.
 */
export const styleKey = (s: StyleId): string => normalizeText(STYLES[s]?.label ?? s)

/** Los remixes que pasan la búsqueda y el filtro de estilo (`'todos'` = cualquiera; si no, una clave de `styleKey`), en su orden. */
export function filterRemixes<T extends Searchable>(list: readonly T[], query: string, key: string = 'todos'): T[] {
  return list.filter((r) => (key === 'todos' || styleKey(r.style) === key) && matchesQuery(r, query))
}

export interface StyleChip {
  key: string
  label: string
}
/** Los chips de filtro: los estilos que hay en la lista, **sin repetir nombre**, en el orden en que aparecen. */
export function styleChips(list: readonly Pick<Searchable, 'style'>[]): StyleChip[] {
  const out: StyleChip[] = []
  for (const r of list) {
    const key = styleKey(r.style)
    if (!out.some((c) => c.key === key)) out.push({ key, label: STYLES[r.style]?.label ?? r.style })
  }
  return out
}

/** El nombre de un estilo para la persona («Drill», «Hip hop 90»). */
export const styleLabel = (s: StyleId): string => STYLES[s]?.label ?? s

/**
 * La carátula de un remix: cinco alturas (0..1), una por voz en el orden de la paleta (`LANES`: bombo, bajo, caja, platillo, melodía), según **cuántos golpes** tiene cada voz en su línea de tiempo, **con raíz cuadrada** para que una voz escasa (la caja del techno, un golpe por compás frente a ocho del charles) no se quede en un punto.
 * La más cargada llega al tope; ninguna baja de `COVER_FLOOR` (una voz que existe siempre se ve). Sin golpes, todas al mínimo.
 */
export const COVER_FLOOR = 0.2
export function coverBars(tl: Pick<Timeline, 'lanes'>): number[] {
  const counts = LANES.map((v) => tl.lanes[v].t.length)
  const max = Math.max(0, ...counts)
  return counts.map((n) => (n <= 0 ? COVER_FLOOR : max > 0 ? Math.max(COVER_FLOOR, Math.sqrt(n / max)) : COVER_FLOOR))
}

/** «1:59» */
export function fmtDuration(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Anterior y siguiente (spec 052): el remix que viene `dir` pasos desde `currentId` en la lista, dando la vuelta por los extremos. Con un solo remix (o ninguno) no hay otro: `null`.
 * Si el actual no está en la lista, el siguiente es el primero y el anterior, el último.
 */
export function neighborId(list: readonly { id: string }[], currentId: string | null, dir: 1 | -1): string | null {
  if (list.length < 2) return null
  const i = list.findIndex((r) => r.id === currentId)
  if (i < 0) return (dir === 1 ? list[0] : list[list.length - 1])!.id
  return list[(i + dir + list.length) % list.length]!.id
}

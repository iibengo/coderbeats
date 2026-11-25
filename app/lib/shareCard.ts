/**
 * Enlace de la tarjeta de una canción (spec 061): `/s#r=<id>` (un remix de la app, enlace corto) o `/s#c=<datos>` (una canción propia, los mismos datos que `#c=` de `shareLink.ts`),
 * con una **firma opcional** `&f=<texto>`. Todo va en el fragmento: no llega a ningún servidor. **Solo datos, nunca código**: lo recibido se valida con exactitud (id con forma de id,
 * datos por `decodeShare`, firma limpia de caracteres de control y de dirección) y un enlace roto o hostil da `null`. Puro y sin DOM.
 */
import { STYLES } from './constants'
import type { Song } from './cells'
import { labRemixById } from './labRemixes'
import { cleanName } from './library'
import { decodeShare, MAX_LINK_CHARS } from './shareLink'
import type { KitId, StyleId } from './types'

/** como mucho 24 caracteres de firma (cabe en la tarjeta y en un enlace corto) */
export const MAX_BY = 24
const ID_RE = /^[a-z0-9][a-z0-9-]{0,47}$/
const HASH_RE = /^#(r|c)=([A-Za-z0-9_-]+)(?:&f=([^&#]{0,300}))?$/
/** control, formato (cero ancho, cambios de dirección) y separadores raros: no se pintan nunca; se cambian por un espacio */
const isHidden = (c: number): boolean =>
  c <= 0x1f || (c >= 0x7f && c <= 0x9f) || c === 0xad || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || c === 0xfeff
const stripHidden = (t: string): string => Array.from(t, (ch) => (isHidden(ch.codePointAt(0)!) ? ' ' : ch)).join('')

export type CardRef = { kind: 'r'; id: string; by?: string } | { kind: 'c'; payload: string; by?: string }

/** La firma limpia (o `undefined` si queda vacía: la tarjeta no muestra autor). Cuenta caracteres Unicode enteros, no mitades de emoji. */
export function cleanBy(text: unknown): string | undefined {
  if (typeof text !== 'string') return undefined
  const t = Array.from(cleanName(stripHidden(text), '')).slice(0, MAX_BY).join('').trim()
  return t || undefined
}

/** El fragmento (`#r=…` o `#c=…`, con `&f=` si hay firma). */
export function cardHash(ref: CardRef): string {
  const by = cleanBy(ref.by)
  const key = ref.kind === 'r' ? `#r=${ref.id}` : `#c=${ref.payload}`
  return by ? `${key}&f=${encodeURIComponent(by)}` : key
}

/** La dirección de la tarjeta: `<origen>/s#…`. */
export const cardUrl = (origin: string, ref: CardRef): string => `${origin.replace(/\/+$/, '')}/s${cardHash(ref)}`

/** Lo que dice un fragmento, o `null` si no es un enlace de tarjeta válido (forma, tamaño o id). */
export function parseCardHash(hash: string): CardRef | null {
  if (typeof hash !== 'string' || hash.length > MAX_LINK_CHARS + 400) return null
  const m = HASH_RE.exec(hash)
  if (!m) return null
  let by: string | undefined
  if (m[3] !== undefined) {
    try {
      by = cleanBy(decodeURIComponent(m[3]))
    } catch {
      return null
    }
  }
  if (m[1] === 'r') return ID_RE.test(m[2]!) ? { kind: 'r', id: m[2]!, ...(by ? { by } : {}) } : null
  return m[2]!.length > MAX_LINK_CHARS ? null : { kind: 'c', payload: m[2]!, ...(by ? { by } : {}) }
}

/** Todo lo que necesita pintar y tocar la página de la tarjeta. */
export interface CardData {
  title: string
  /** la firma de quien comparte; sin ella, la tarjeta no muestra autor */
  by?: string
  /** de quién es la melodía original (solo los remixes de la app) */
  composer?: string
  style: StyleId
  kit: KitId
  bpm: number
  song: Song
  /** el id del remix de la app, si lo es */
  remixId?: string
}

/** Del enlace a la canción: un remix de la app por su id, o una propia por sus datos. `null` si el id no existe o los datos no valen. */
export async function resolveCard(ref: CardRef): Promise<CardData | null> {
  const by = cleanBy(ref.by)
  if (ref.kind === 'r') {
    const r = labRemixById(ref.id)
    if (!r) return null
    return { title: r.title, ...(by ? { by } : {}), composer: r.composer, style: r.style, kit: r.kit, bpm: r.song.bpm ?? STYLES[r.style].bpm, song: r.song, remixId: r.id }
  }
  const saved = await decodeShare(ref.payload)
  if (!saved) return null
  return { title: saved.name, ...(by ? { by } : {}), style: saved.style, kit: saved.kit, bpm: saved.song.bpm ?? STYLES[saved.style].bpm, song: saved.song }
}

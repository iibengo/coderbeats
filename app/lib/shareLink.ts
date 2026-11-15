/**
 * Compartir una canción por enlace (spec 006 «después»): **solo datos, nunca código**. La canción va en el fragmento de la URL (`#c=…`, que el navegador no manda a ningún
 * servidor), comprimida si se puede, y al abrir un enlace se **valida con la misma exactitud que lo leído del almacenamiento** (`isSavedSong`: estilo, kit y fondo conocidos,
 * efectos entre 0 y 1, canción con la forma exacta, `isSong`). Nunca se evalúa nada de lo recibido; el nombre pasa por `cleanName`. Un enlace roto o hostil da `null`.
 */
import { STYLES } from './constants'
import { autoName, cleanName, isSavedSong, storableSnapshot, type SavedSong, type SongSnapshot } from './library'

const PREFIX_Z = 'z'
const PREFIX_J = 'j'
/** tope del texto del enlace y de lo descomprimido (una canción grande, la Sinfonía 40, ronda 100 KB) */
export const MAX_LINK_CHARS = 700_000
export const MAX_JSON_BYTES = 4 * 1024 * 1024

const toB64Url = (b: Uint8Array): string => {
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}
const fromB64Url = (t: string): Uint8Array | null => {
  if (!/^[A-Za-z0-9_-]*$/.test(t)) return null
  try {
    const s = atob(t.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (t.length % 4)) % 4))
    return Uint8Array.from(s, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

const hasStreams = typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, max = Infinity): Promise<Uint8Array | null> {
  const w = stream.writable.getWriter()
  void w.write(bytes as unknown as BufferSource).then(() => w.close()).catch(() => {})
  const r = stream.readable.getReader()
  const parts: Uint8Array[] = []
  let n = 0
  for (;;) {
    const { done, value } = await r.read().catch(() => ({ done: true, value: undefined }) as { done: boolean; value?: Uint8Array })
    if (done) break
    n += value!.length
    if (n > max) {
      await r.cancel().catch(() => {})
      return null
    }
    parts.push(value!)
  }
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/** El texto del enlace (lo que va tras `#c=`) para una canción. */
export async function encodeShare(snap: SongSnapshot, name: string): Promise<string> {
  const s = storableSnapshot(snap)
  const json = JSON.stringify({ v: 1, n: name, s: s.style, k: s.kit, b: s.bgMode, f: s.fx, g: s.song })
  const bytes = new TextEncoder().encode(json)
  if (hasStreams) {
    const z = await pipe(bytes, new CompressionStream('deflate-raw'))
    if (z) return PREFIX_Z + toB64Url(z)
  }
  return PREFIX_J + toB64Url(bytes)
}

/** Lo que dice un texto de enlace: una canción lista para abrir, o `null` si no es válida (rota, demasiado grande, hostil). */
export async function decodeShare(text: string, now = new Date(), newId = () => `c-${Math.random().toString(36).slice(2, 10)}`): Promise<SavedSong | null> {
  if (typeof text !== 'string' || text.length < 2 || text.length > MAX_LINK_CHARS) return null
  const raw = fromB64Url(text.slice(1))
  if (!raw) return null
  let bytes: Uint8Array | null = raw
  if (text[0] === PREFIX_Z) bytes = hasStreams ? await pipe(raw, new DecompressionStream('deflate-raw'), MAX_JSON_BYTES) : null
  else if (text[0] !== PREFIX_J) return null
  if (!bytes || bytes.length > MAX_JSON_BYTES) return null
  let o: unknown
  try {
    o = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    return null
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null
  const d = o as Record<string, unknown>
  if (d.v !== 1) return null
  // se arma el sobre de una guardada y pasa por el mismo guard que lo leído del almacenamiento
  const style = d.s
  const saved = {
    id: newId(),
    name: cleanName(typeof d.n === 'string' ? d.n : '', typeof style === 'string' && Object.hasOwn(STYLES, style) ? autoName(style as never, now) : 'Compartida'),
    savedAt: now.toISOString(),
    style, kit: d.k, bgMode: d.b, fx: d.f, song: d.g,
  }
  return isSavedSong(saved) ? saved : null
}

/** El texto del enlace si la dirección lleva `#c=…`, o `null`. */
export function payloadFromHash(hash: string): string | null {
  const m = /^#c=([A-Za-z0-9_-]+)$/.exec(hash)
  return m ? m[1]! : null
}

export const shareUrl = (base: string, payload: string): string => `${base.split('#')[0]}#c=${payload}`

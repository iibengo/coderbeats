/**
 * Exportar audio a MP3 (spec 054), partes puras: pegar los bloques capturados, recortar el silencio de antes de que empiece la música y el final exacto con un fundido corto,
 * pasar a enteros de 16 bits, codificar a MP3 (`@breezystack/lamejs`, LGPL-3.0; se carga solo al exportar) y el nombre del archivo.
 */

/** Por debajo de esto (≈ −80 dBFS) un bloque se considera silencio: la música todavía no ha empezado. */
export const SILENCE = 1e-4

/** Los bloques, uno detrás de otro. */
export function joinChunks(chunks: readonly Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

/** El primer fotograma con sonido (los dos canales), o -1 si todo es silencio. */
export function firstSound(l: Float32Array, r: Float32Array, threshold = SILENCE): number {
  const n = Math.min(l.length, r.length)
  for (let i = 0; i < n; i++) if (Math.abs(l[i]!) > threshold || Math.abs(r[i]!) > threshold) return i
  return -1
}

/** De `from`, exactamente `frames` fotogramas (o los que haya), con un fundido de salida de `fadeFrames` al final para que no haya un chasquido. Copia. */
export function sliceWithFade(x: Float32Array, from: number, frames: number, fadeFrames: number): Float32Array {
  const out = x.slice(from, from + frames)
  const f = Math.min(fadeFrames, out.length)
  for (let i = 0; i < f; i++) out[out.length - 1 - i] = out[out.length - 1 - i]! * (i / f)
  return out
}

/** Float −1..1 → entero de 16 bits (se recorta lo que pase de ±1). */
export function toInt16(x: Float32Array, from = 0, to = x.length): Int16Array {
  const out = new Int16Array(to - from)
  for (let i = from; i < to; i++) {
    const v = Math.max(-1, Math.min(1, x[i]!))
    out[i - from] = v < 0 ? v * 0x8000 : v * 0x7fff
  }
  return out
}

export const MP3_KBPS = 320
const FRAME = 1152

/**
 * Codifica a MP3 estéreo. Cede el hilo de vez en cuando para que la pantalla no se quede congelada, y avisa del avance (0..1).
 * Devuelve los trozos del archivo (se juntan con `new Blob(parts)`).
 */
export async function encodeMp3(l: Float32Array, r: Float32Array, sampleRate: number, kbps = MP3_KBPS, onProgress?: (p: number) => void): Promise<Uint8Array[]> {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const enc = new Mp3Encoder(2, sampleRate, kbps)
  const n = Math.min(l.length, r.length)
  const parts: Uint8Array[] = []
  let last = performance.now()
  for (let i = 0; i < n; i += FRAME) {
    const end = Math.min(n, i + FRAME)
    const buf = enc.encodeBuffer(toInt16(l, i, end), toInt16(r, i, end))
    if (buf.length) parts.push(buf)
    if (performance.now() - last > 40) {
      onProgress?.(i / n)
      await new Promise<void>((res) => setTimeout(res))
      last = performance.now()
    }
  }
  const tail = enc.flush()
  if (tail.length) parts.push(tail)
  onProgress?.(1)
  return parts
}

/** «korobeiniki-coderbeats-20261120-1730.mp3»: el título sin acentos ni símbolos. */
export function mp3FileName(title: string, now: Date): string {
  const p = (x: number) => String(x).padStart(2, '0')
  const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cancion'
  return `${slug}-coderbeats-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.mp3`
}

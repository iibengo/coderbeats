/**
 * Exportar vídeo (spec 013), partes puras: formatos, elección del tipo de archivo, encuadre del lienzo de salida, tamaño estimado, tope y nombre.
 */
export type VideoFormat = 'vertical' | 'cuadrado'
export type VideoSize = 720 | 1080

export const FORMAT_LABEL: Record<VideoFormat, string> = { vertical: 'Vertical 9:16 (reels)', cuadrado: 'Cuadrado 1:1' }

/** Ancho y alto de salida: `size` es el lado corto. */
export function outputSize(f: VideoFormat, size: VideoSize): { w: number; h: number } {
  return f === 'cuadrado' ? { w: size, h: size } : { w: size, h: Math.round((size * 16) / 9 / 2) * 2 }
}

/** Orden de preferencia de los tipos (spec 013 §4): Safari solo da mp4; Chrome, webm (y mp4 reciente). */
export const MIME_ORDER = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
] as const

/** El primer tipo que el navegador sabe grabar, o `null` (no se ofrece el botón). */
export function pickMime(isSupported: (t: string) => boolean): { mime: string; ext: 'mp4' | 'webm' } | null {
  for (const m of MIME_ORDER) if (isSupported(m)) return { mime: m, ext: m.startsWith('video/mp4') ? 'mp4' : 'webm' }
  return null
}

/** Cómo se coloca el origen (la ventana) en el lienzo de salida: «cubrir», centrado (se recorta lo que sobra). */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number } {
  const k = Math.max(dstW / srcW, dstH / srcH)
  const sw = dstW / k
  const sh = dstH / k
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh }
}

export const VIDEO_BPS = { 720: 4_000_000, 1080: 8_000_000 } as const
export const AUDIO_BPS = 128_000
/** Tope de duración por defecto: 3 min (≈ 100 MB a 1080). */
export const MAX_SECONDS = 180

/** Bytes aproximados de una grabación de `seconds` a ese tamaño. */
export const estimateBytes = (seconds: number, size: VideoSize): number => Math.round(((VIDEO_BPS[size] + AUDIO_BPS) / 8) * seconds)

export const formatMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`

/** Segundos de `bars` compases a `bpm` (4 tiempos), acotados al tope. */
export const secondsFor = (bars: number, bpm: number): number => Math.min(MAX_SECONDS, (bars * 4 * 60) / bpm)

export function fileName(style: string, now: Date, ext: string): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const slug = style.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cancion'
  return `coderbeats-${slug}-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.${ext}`
}

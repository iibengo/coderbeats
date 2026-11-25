/**
 * Navegadores internos de las redes (Instagram, Facebook, TikTok) y iPhone/iPad, por el user agent (spec 062). Puro y sin DOM.
 * El navegador interno de iOS suele dejar la web sin audio (modo silencio, o sin permiso para el contexto de audio): se avisa con discreción de que se abra en el navegador.
 */
export type InAppKind = 'instagram' | 'facebook' | 'tiktok'

/** Qué red es, o `null` si es un navegador normal. */
export function detectInApp(ua: string): InAppKind | null {
  if (typeof ua !== 'string') return null
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB|FBIOS|FB4A/.test(ua)) return 'facebook'
  if (/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)) return 'tiktok'
  return null
}

/** iPhone, iPad o iPod (el iPad moderno se presenta como Mac, pero con pantalla táctil). */
export const isIos = (ua: string, maxTouchPoints = 0): boolean => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)

/** Un WAV mudo y minúsculo (8 kHz, 8 bits, mono) como dirección `data:`, para el truco del modo silencio de iOS. */
export function silentWavDataUri(seconds = 0.5): string {
  const rate = 8000
  const n = Math.max(1, Math.round(rate * seconds))
  const b = new Uint8Array(44 + n)
  const w32 = (o: number, v: number) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = (v >> 24) & 255 }
  const w16 = (o: number, v: number) => { b[o] = v & 255; b[o + 1] = (v >> 8) & 255 }
  const tag = (o: number, t: string) => { for (let i = 0; i < 4; i++) b[o + i] = t.charCodeAt(i) }
  tag(0, 'RIFF'); w32(4, 36 + n); tag(8, 'WAVE'); tag(12, 'fmt '); w32(16, 16); w16(20, 1); w16(22, 1); w32(24, rate); w32(28, rate); w16(32, 1); w16(34, 8); tag(36, 'data'); w32(40, n)
  b.fill(128, 44) // 8 bits sin signo: 128 es el silencio
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!)
  return `data:audio/wav;base64,${btoa(s)}`
}

/**
 * Paleta única de la app (spec 003, E1.2). Todo lo que pinta un instrumento sale de aquí:
 * las bolas, el aro, el agua y Tailwind.
 */
export const INK = '#0B0B0F'

export type Voice = 'bd' | 'bass' | 'sd' | 'mel' | 'hh'

export const VOICE_HEX: Record<Voice, string> = {
  bd: '#F496BC',
  bass: '#BE5A82',
  sd: '#B9A6F2',
  mel: '#FFFFFF',
  hh: '#8ECFF2',
}

/** '#RRGGBB' → [r, g, b] en 0..255 */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** "r,g,b" para componer `rgba(${…},a)` sin parsear en cada frame */
export const VOICE_RGB_CSS: Record<Voice, string> = Object.fromEntries(
  Object.entries(VOICE_HEX).map(([k, v]) => [k, hexToRgb(v).join(',')]),
) as Record<Voice, string>

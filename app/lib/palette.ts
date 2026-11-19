/**
 * Paleta única de la app (spec 003, E1.2). Todo lo que pinta un instrumento sale de aquí:
 * las bolas, el aro, el agua y Tailwind.
 */
export const INK = '#0B0B0F'
/** El acento rosa (specs/DISENO.md): lo seleccionado, el botón principal, lo que se quiere destacar. Es el mismo tono que la caja: el contexto lo distingue. */
export const ACCENT = '#F496BC'

export type Voice = 'bd' | 'bass' | 'sd' | 'mel' | 'hh'

/** Un instrumento, un color, **igual en el Estudio y en el Laboratorio** (specs/DISENO.md): bombo ámbar, caja rosa, platillo azul, bajo lila, melodía verde agua. */
export const VOICE_HEX: Record<Voice, string> = {
  bd: '#F5C97A',
  bass: '#B7A6F2',
  sd: '#F496BC',
  mel: '#7FD6C2',
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

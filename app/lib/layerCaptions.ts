/**
 * Los rótulos de capa de Previsualizar (spec 016 §15): «1 · Bombo: el pulso», «4 · Ghost notes: golpes suaves de caja justo antes». Pura.
 * Las frases **salen de cada estilo** (escritas a mano para los 5) y se completan con lo que se **genera de los datos** de la canción (el patrón de los golpes, las ghost notes).
 */
import type { StyleId } from './types'

export type LayerKind = 'bd' | 'sd' | 'hh' | 'bass' | 'chords' | 'mel' | 'ghost'

export interface LayerInfo {
  name: string
  line: string
}

const GHOST: LayerInfo = { name: 'Ghost notes', line: 'golpes suaves de caja justo antes' }

/** Una frase corta por capa y estilo. */
export const STYLE_LAYERS: Record<StyleId, Record<LayerKind, LayerInfo>> = {
  hiphop90: {
    bd: { name: 'Bombo', line: 'el peso del boom bap' },
    sd: { name: 'Caja', line: 'el golpe seco en 2 y 4' },
    hh: { name: 'Platillo', line: 'el hilo de corcheas' },
    bass: { name: 'Bajo', line: 'la nota grave que sostiene' },
    chords: { name: 'Acordes', line: 'el color, suave y con aire' },
    mel: { name: 'Melodía', line: 'lo que se queda en la cabeza' },
    ghost: GHOST,
  },
  house: {
    bd: { name: 'Bombo', line: 'cuatro al suelo, uno por tiempo' },
    sd: { name: 'Caja', line: 'palmas que marcan 2 y 4' },
    hh: { name: 'Platillo', line: 'el contratiempo que hace bailar' },
    bass: { name: 'Bajo', line: 'bota entre los bombos' },
    chords: { name: 'Acordes', line: 'stabs cortos que se repiten' },
    mel: { name: 'Melodía', line: 'el riff que lleva la pista' },
    ghost: GHOST,
  },
  dnb: {
    bd: { name: 'Bombo', line: 'pocos golpes, muy secos' },
    sd: { name: 'Caja', line: 'el golpe fuerte que parte el compás' },
    hh: { name: 'Platillo', line: 'corcheas rapidísimas' },
    bass: { name: 'Bajo', line: 'el sub que hace temblar' },
    chords: { name: 'Acordes', line: 'un colchón oscuro de fondo' },
    mel: { name: 'Melodía', line: 'la línea que flota sobre el ritmo' },
    ghost: GHOST,
  },
  reggaeton: {
    bd: { name: 'Bombo', line: 'el latido, uno en cada tiempo' },
    sd: { name: 'Caja', line: 'el dembow: tres y tres, y vuelta' },
    hh: { name: 'Platillo', line: 'el contratiempo que da aire' },
    bass: { name: 'Bajo', line: 'el 808 grave que hace temblar' },
    chords: { name: 'Acordes', line: 'stabs cortos entre los golpes' },
    mel: { name: 'Melodía', line: 'el estribillo que se pega' },
    ghost: GHOST,
  },
  dembow: {
    bd: { name: 'Bombo', line: 'el latido, cuatro seguidos' },
    sd: { name: 'Caja', line: 'el tresillo que define el dembow' },
    hh: { name: 'Platillo', line: 'el relleno que llena los huecos' },
    bass: { name: 'Bajo', line: 'grave y corto, sigue al bombo' },
    chords: { name: 'Acordes', line: 'el acorde que se repite' },
    mel: { name: 'Melodía', line: 'el canto que baila encima' },
    ghost: GHOST,
  },
  house2: {
    bd: { name: 'Bombo', line: 'cuatro al suelo, con peso' },
    sd: { name: 'Caja', line: 'palmas en 2 y 4' },
    hh: { name: 'Platillo', line: 'el abierto a contratiempo' },
    bass: { name: 'Bajo', line: 'sincopado, entre los bombos' },
    chords: { name: 'Acordes', line: 'stabs de piano alegres' },
    mel: { name: 'Melodía', line: 'el riff que lleva la pista' },
    ghost: GHOST,
  },
  techno2: {
    bd: { name: 'Bombo', line: 'constante y seco' },
    sd: { name: 'Caja', line: 'un solo golpe que corta el compás' },
    hh: { name: 'Platillo', line: 'percusión que hipnotiza' },
    bass: { name: 'Bajo', line: 'rueda en semicorcheas' },
    chords: { name: 'Acordes', line: 'una nota oscura que respira' },
    mel: { name: 'Melodía', line: 'el gancho que sobrevuela' },
    ghost: GHOST,
  },
  techno: {
    bd: { name: 'Bombo', line: 'cuatro al suelo, hipnótico' },
    sd: { name: 'Caja', line: 'el clap que entra de golpe' },
    hh: { name: 'Platillo', line: 'semicorcheas que empujan' },
    bass: { name: 'Bajo', line: 'la nota que vuelve sin parar' },
    chords: { name: 'Acordes', line: 'la tensión que sube' },
    mel: { name: 'Melodía', line: 'el gancho que sobrevuela' },
    ghost: GHOST,
  },
}

const range = (n: number, by: number, from = 0) => Array.from({ length: n }, (_, i) => from + i * by)
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Lo que se dice de un instrumento **mirando sus golpes** (pasos 0..15 de un compás): el patrón conocido, o cuántos hay. `null` si no hay datos que contar.
 */
export function describeDrums(kind: 'bd' | 'sd' | 'hh', steps: readonly number[]): string | null {
  const s = [...new Set(steps)].filter((p) => Number.isFinite(p)).sort((a, b) => a - b)
  if (!s.length) return null
  if (same(s, range(4, 4))) return kind === 'hh' ? 'uno por tiempo' : 'uno en cada tiempo'
  if (same(s, [0, 8])) return 'en el 1 y el 3'
  if (same(s, [4, 12])) return 'en el 2 y el 4 (el backbeat)'
  if (same(s, range(16, 1))) return 'semicorcheas, sin parar'
  if (same(s, range(8, 2))) return 'corcheas, una cada dos pasos'
  if (same(s, range(8, 2, 1)) || same(s, range(4, 4, 2))) return 'en los contratiempos'
  if (s.length >= 2 && s.every((p) => p % 2 === 1)) return 'entre los tiempos'
  return `${s.length} ${s.length === 1 ? 'golpe' : 'golpes'} por compás`
}

/** ¿Hay ghost notes? Golpes suaves (≤ 0,5) justo antes (hasta 2 pasos) de uno fuerte (≥ 0,7). */
export function hasGhostNotes(hits: readonly { pos: number; strength?: number }[]): boolean {
  const h = [...hits].sort((a, b) => a.pos - b.pos)
  return h.some((x, i) => (x.strength ?? 1) <= 0.5 && h.slice(i + 1).some((y) => y.pos - x.pos > 0 && y.pos - x.pos <= 2 && (y.strength ?? 1) >= 0.7))
}

/** El rótulo de una capa que entra: «n · Nombre: frase del estilo · lo que dicen los datos». */
export function layerCaption(n: number, kind: LayerKind, style: StyleId, steps?: readonly number[]): string {
  const info = STYLE_LAYERS[style]?.[kind] ?? STYLE_LAYERS.hiphop90[kind]
  const data = steps && (kind === 'bd' || kind === 'sd' || kind === 'hh') ? describeDrums(kind, steps) : null
  return `${n} · ${info.name}: ${info.line}${data ? ` · ${data}` : ''}`
}

/**
 * Laboratorio de instrumentos (probar formas de tocar sin micro): funciones puras compartidas por las pantallas.
 * Un compás = 16 pasos; un loop de una instrumento lleva golpes con `pos` en pasos (puede ser decimal: el motor lo toca con un pequeño desplazamiento).
 */
import type { FreeLoop, LoopHit } from './freeLoops'
import { VOICE_HEX } from './palette'
import type { Instrument } from './types'

/** Ningún texto del lienzo baja de 11 px **reales** (specs/DISENO.md): el lienzo de 680 se ve a ~360 px en un iPhone (escala ≈ 0,53). */
export const MIN_TEXT_REAL = 11
/** El tamaño de letra en unidades del lienzo para que, a la escala real (`scale` = ancho en pantalla / 680), nunca quede por debajo de 11 px. */
export const fontPx = (px: number, scale: number): number => Math.round(Math.max(px, MIN_TEXT_REAL / Math.max(0.1, scale)))

/** lado del escenario cuadrado del Laboratorio (unidades de dibujo) */
export const LAB_W = 680
export const STEPS = 16
export const LAB_INSTRUMENTS: readonly Instrument[] = ['bd', 'sd', 'hh']

const round3 = (x: number) => Math.round(x * 1000) / 1000
const TAU = Math.PI * 2

/** `k` golpes repartidos lo más parejo posible en `n` pasos enteros (reparto euclídeo). */
export function euclid(k: number, n = STEPS): number[] {
  const m = Math.max(0, Math.min(n, Math.round(k)))
  const out: number[] = []
  for (let i = 0; i < m; i++) out.push(Math.floor((i * n) / m))
  return out
}

/** `k` golpes exactamente a la misma distancia (posiciones decimales): así 3 contra 4 es un polirritmo de verdad. */
export function even(k: number, n = STEPS): number[] {
  const m = Math.max(0, Math.min(n, Math.round(k)))
  return Array.from({ length: m }, (_, i) => round3((i * n) / m))
}

export const wheelSteps = (k: number, exact: boolean, n = STEPS): number[] => (exact ? even(k, n) : euclid(k, n))

export const hitsOf = (steps: number[], strength = 0.8): LoopHit[] => steps.map((pos) => ({ pos, strength }))

/** Pone o quita el golpe del paso `step` (entero). */
export function toggleStep(hits: LoopHit[], step: number): LoopHit[] {
  const at = hits.findIndex((h) => Math.round(h.pos) % STEPS === step)
  if (at >= 0) return hits.filter((_, i) => i !== at)
  return [...hits, { pos: step, strength: 0.8 }].sort((a, b) => a.pos - b.pos)
}

export const stepsOf = (hits: LoopHit[]): number[] => hits.map((h) => h.pos)

export function drumLoop(id: number, instrument: Instrument, steps: number[], muted = false, bornAt = 0): FreeLoop {
  return { id, instrument, bars: 1, phaseBar: 0, hits: hitsOf(steps), muted, bornAt, fromTemplate: false }
}

/** ángulo de un paso: el paso 0 arriba, en el sentido de las agujas del reloj */
export const angleOfStep = (step: number, n = STEPS): number => (step / n) * TAU - Math.PI / 2

/** punto de un paso en un anillo de radio `r` */
export function pointOfStep(step: number, r: number, cx: number, cy: number, n = STEPS): [number, number] {
  const a = angleOfStep(step, n)
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]
}

/** el polígono que une los golpes de un anillo (con 1 golpe, un punto; con 2, una línea) */
export function polygonPath(steps: number[], r: number, cx: number, cy: number, n = STEPS): string {
  const pts = [...steps].sort((a, b) => a - b).map((s) => pointOfStep(s, r, cx, cy, n))
  if (!pts.length) return ''
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + (pts.length > 2 ? ' Z' : '')
}

/** Qué anillo y qué paso hay bajo un punto (anillos de radio `radii`, de dentro afuera); null si cae lejos de todos. */
export function hitTestRings(x: number, y: number, cx: number, cy: number, radii: number[], tolerance: number, n = STEPS): { ring: number; step: number } | null {
  const dx = x - cx
  const dy = y - cy
  const d = Math.hypot(dx, dy)
  let ring = -1
  let best = Infinity
  radii.forEach((r, i) => {
    const gap = Math.abs(d - r)
    if (gap < best) {
      best = gap
      ring = i
    }
  })
  if (ring < 0 || best > tolerance) return null
  const a = Math.atan2(dy, dx) + Math.PI / 2
  const step = Math.round((((a % TAU) + TAU) % TAU) / TAU * n) % n
  return { ring, step }
}

/** Una rueda girada: de la vuelta acumulada (en radianes) a cuántos golpes (0..16) */
export function hitsFromTurn(turn: number, per = Math.PI / 4): number {
  return Math.max(0, Math.min(STEPS, Math.round(turn / per)))
}

/** Las capas del tipo Incredibox: lo que se enciende o apaga. */
export type LayerKind = 'bd' | 'sd' | 'hh' | 'bass' | 'chords' | 'mel'
export const LAYERS: readonly { id: LayerKind; label: string }[] = [
  { id: 'bd', label: 'bombo' },
  { id: 'sd', label: 'caja' },
  { id: 'hh', label: 'platillo' },
  { id: 'bass', label: 'bajo' },
  { id: 'chords', label: 'acordes' },
  { id: 'mel', label: 'melodía' },
]

/** Flancos de los botones de un mando: los que acaban de pulsarse. */
export function pressedEdges(prev: readonly boolean[], cur: readonly boolean[]): number[] {
  const out: number[] = []
  cur.forEach((on, i) => on && !prev[i] && out.push(i))
  return out
}

/** Zona muerta de un eje de palanca (−1..1) */
export const deadzone = (v: number, z = 0.15): number => (Math.abs(v) < z ? 0 : (v - Math.sign(v) * z) / (1 - z))

/** El color ámbar del bombo del prototipo; el resto sale de la paleta (`VOICE_HEX`). */
export const AMBER = VOICE_HEX.bd

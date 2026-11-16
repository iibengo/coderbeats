/**
 * El modo espiral del sintetizador (spec 015 §14): al revés que tocar notas, **las notas vienen al dedo** por una espiral y suenan al llegar; el dedo solo se mueve (sin levantar)
 * y da el brillo. Partes puras: el calendario de notas en segundos, qué notas llegan en cada fotograma y dónde está cada nota en la espiral.
 */
import type { MelodyHit } from './melody'
import type { P2 } from './theremin'

/** Lo que tarda en llegar al dedo la primera nota al empezar a tocar (s): da tiempo a ver la espiral. */
export const LEAD_IN = 2
/** Cuántos segundos por delante se ven las notas en la espiral. */
export const LOOKAHEAD = 4

export interface Timed {
  i: number
  start: number
  end: number
  midi: number
}

/** El calendario del tema en segundos (a `bpm`; un paso = una semicorchea). El final de cada nota nunca pasa del inicio de la siguiente. */
export function schedule(hits: readonly MelodyHit[], bpm: number): Timed[] {
  const step = 60 / Math.max(30, Math.min(300, Number.isFinite(bpm) ? bpm : 90)) / 4
  const sorted = [...hits].sort((a, b) => a.pos - b.pos)
  return sorted.map((h, i) => {
    const next = sorted[i + 1]
    const end = Math.min((h.pos + h.dur) * step, next ? next.pos * step : Infinity)
    return { i, start: h.pos * step, end, midi: h.midi }
  })
}

/** La duración de una vuelta del tema (s): 4 compases de 16 pasos. */
export const loopSeconds = (bpm: number): number => 64 * (60 / Math.max(30, Math.min(300, Number.isFinite(bpm) ? bpm : 90)) / 4)

/** Las notas cuyo inicio cae en `(from, to]` (llegan al dedo en este fotograma). `from` y `to` en segundos desde el principio del tema. */
export function arrivals(sched: readonly Timed[], from: number, to: number): Timed[] {
  return sched.filter((n) => n.start > from && n.start <= to)
}

/** Las notas que se ven en la espiral en el instante `tc`: las que llegan en los próximos `LOOKAHEAD` s (y la que acaba de llegar, un instante). */
export function visible(sched: readonly Timed[], tc: number, look = LOOKAHEAD): (Timed & { tau: number })[] {
  return sched.filter((n) => n.start - tc <= look && n.start - tc > -0.2).map((n) => ({ ...n, tau: n.start - tc }))
}

/** ¿Hay que soltar la nota que suena en `tc` (acabó y la siguiente no empieza ya)? Devuelve la nota que acaba de terminar con hueco, si la hay. */
export function endedWithGap(sched: readonly Timed[], from: number, to: number, gap = 0.04): Timed | null {
  for (const n of sched) {
    if (n.end > from && n.end <= to) {
      const next = sched[n.i + 1]
      if (!next || next.start - n.end > gap) return n
    }
  }
  return null
}

export const SPIRAL_TURN = 1.7 // radianes por segundo de espera: cuánto se enrosca

/** La posición de una nota que llegará dentro de `tau` s, en la espiral centrada en `c`: más lejos cuanto más tarde llega, y enroscada. Con `tau` = 0, en el centro. */
export function spiralPoint(c: P2, tau: number, rMax: number, spin = 0): P2 {
  const t = Math.max(0, tau)
  const r = rMax * Math.min(1, t / LOOKAHEAD) ** 0.85
  const a = spin + t * SPIRAL_TURN
  return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }
}

// ── La interpretación (spec 016 §9.1): el dedo pone la octava del tema ───────────────────────────────────────────────────────────────────────────────────────────
/** La octava que pide la altura del dedo (`fy` 0 = arriba): arriba +1, en medio 0, abajo −1; con un margen para no bailar en el borde. */
export function octaveZone(fy: number, prev: -1 | 0 | 1 = 0): -1 | 0 | 1 {
  const f = Number.isFinite(fy) ? Math.min(1, Math.max(0, fy)) : 0.5
  const m = 0.04
  const hi = prev === 1 ? 1 / 3 + m : 1 / 3 - m
  const lo = prev === -1 ? 2 / 3 - m : 2 / 3 + m
  return f < hi ? 1 : f > lo ? -1 : 0
}

/** La nota `midi` desplazada `shift` octavas, o la más cercana a eso que **esté en la lista de notas del sinte** (si no cabe una octava más, se queda en la anterior). */
export function shiftToList(midi: number, shift: number, list: readonly number[]): number {
  for (let s = shift; ; s += s > 0 ? -1 : 1) {
    const m = midi + 12 * s
    if (list.includes(m)) return m
    if (s === 0) return midi
  }
}

/** Lo que se graba: el tema, con las notas que de verdad sonaron (tu interpretación). Las que no se tocaron no entran. */
export function interpretedHits(hits: readonly MelodyHit[], played: ReadonlyMap<number, number>): MelodyHit[] {
  const sorted = [...hits].sort((a, b) => a.pos - b.pos)
  const out: MelodyHit[] = []
  sorted.forEach((h, i) => {
    const m = played.get(i)
    if (m !== undefined) out.push({ ...h, midi: m })
  })
  return out
}

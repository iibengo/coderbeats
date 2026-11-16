// Mis capas del Laboratorio (spec 018): lo que la persona hace en Círculo (batería) y en Piano/Coro (melodía), puro y sin DOM.
import type { LoopHit } from './freeLoops'
import type { Instrument } from './types'

export const MEL_STEPS = 64 // 4 compases de 16 semicorcheas
export const MAX_NOTE_DUR = 8

export interface MyDrums {
  bd: LoopHit[]
  sd: LoopHit[]
  hh: LoopHit[]
}
export interface MyLayers {
  drums: MyDrums | null
  melody: LoopHit[] | null
}
export const EMPTY_LAYERS: MyLayers = { drums: null, melody: null }

/** una nota tocada: semicorchea absoluta (compás × 16 + paso) y altura */
export interface Played {
  abs: number
  midi: number
}

/** Apunta una nota y se queda solo con las de los últimos 4 compases (una misma semicorchea: gana la última). */
export function recordNote(buf: readonly Played[], abs: number, midi: number): Played[] {
  return [...buf.filter((n) => n.abs > abs - MEL_STEPS && n.abs % MEL_STEPS !== abs % MEL_STEPS), { abs, midi }].sort((a, b) => a.abs - b.abs)
}

/** La semicorchea absoluta de un instante del reloj (compás y fase 0..1), a la más cercana. */
export const absStep = (bar: number, phase: number): number => Math.round((bar + phase) * 16)

/** Las notas tocadas, como loop de melodía de 4 compases: posición en el loop y duración hasta la siguiente (con vuelta), entre 1 y 8. */
export function melodyFrom(buf: readonly Played[]): LoopHit[] {
  const sorted = [...buf].map((n) => ({ pos: ((n.abs % MEL_STEPS) + MEL_STEPS) % MEL_STEPS, midi: n.midi })).sort((a, b) => a.pos - b.pos)
  return sorted.map((n, i) => {
    const next = sorted[(i + 1) % sorted.length]!
    const gap = sorted.length === 1 ? MAX_NOTE_DUR : (next.pos - n.pos + MEL_STEPS) % MEL_STEPS || MEL_STEPS
    return { pos: n.pos, strength: 0.8, midi: n.midi, dur: Math.max(1, Math.min(MAX_NOTE_DUR, gap)) }
  })
}

const isHit = (h: unknown): h is LoopHit => !!h && typeof h === 'object' && typeof (h as LoopHit).pos === 'number' && Number.isFinite((h as LoopHit).pos) && typeof (h as LoopHit).strength === 'number'
const isHits = (x: unknown): x is LoopHit[] => Array.isArray(x) && x.length <= 256 && x.every(isHit)
/** El guardado no es de fiar: solo pasa lo que tiene exactamente la forma. */
export function isMyLayers(x: unknown): x is MyLayers {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  const d = o.drums
  const dOk = d === null || (!!d && typeof d === 'object' && (['bd', 'sd', 'hh'] as Instrument[]).every((k) => isHits((d as Record<string, unknown>)[k])))
  const m = o.melody
  return dOk && (m === null || (isHits(m) && m.every((h) => typeof h.midi === 'number')))
}

export const hasDrums = (l: MyLayers): boolean => !!l.drums && (l.drums.bd.length + l.drums.sd.length + l.drums.hh.length) > 0
export const hasMelody = (l: MyLayers): boolean => !!l.melody && l.melody.length >= 2

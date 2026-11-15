/**
 * Teclado de agua (spec 015, fase 1), partes puras: de un punto del agua a una **nota de la escala del estilo** (y, en los tiempos fuertes, del acorde: nunca suena una nota mala),
 * el brillo según la altura del dedo, el espacio libre que queda fuera del aro (fase 0) y la conversión de lo tocado en un loop de melodía por paso.
 */
import { MIDI_MAX, MIDI_MIN, REGISTER, type MelodyHit, type MelodySynth } from './melody'
import { STYLE_MUSIC } from './styles'
import type { StyleId } from './types'

/** Las notas MIDI de la escala del estilo dentro del registro del sinte, de graves a agudas. */
export function scaleNotes(style: StyleId, synth: MelodySynth = STYLE_MUSIC[style].synth): number[] {
  const [lo, hi] = REGISTER[synth] ?? REGISTER.lead
  const pcs = new Set(STYLE_MUSIC[style].scale)
  const out: number[] = []
  for (let m = Math.max(MIDI_MIN, lo); m <= Math.min(MIDI_MAX, hi); m++) if (pcs.has(m % 12)) out.push(m)
  return out
}

/** La nota del acorde del compás `bar` más cercana a `midi` (si el estilo no trae acordes, la misma). */
export function nearestChordTone(style: StyleId, bar: number, midi: number, notes: readonly number[]): number {
  const tones = STYLE_MUSIC[style].chordTones
  const ch = tones[((bar % tones.length) + tones.length) % tones.length] ?? []
  const cands = notes.filter((n) => ch.includes(n % 12))
  if (!cands.length) return midi
  return cands.reduce((best, n) => (Math.abs(n - midi) < Math.abs(best - midi) ? n : best), cands[0]!)
}

/**
 * La nota del punto horizontal `fx` (0 izquierda … 1 derecha) de las `notes` de la escala. Con `strong` (tiempo fuerte) se pega al acorde del compás.
 */
export function noteAtX(fx: number, notes: readonly number[], style: StyleId, bar: number, strong: boolean): number {
  if (!notes.length) return 60
  const f = Math.min(1, Math.max(0, Number.isFinite(fx) ? fx : 0))
  const n = notes[Math.min(notes.length - 1, Math.floor(f * notes.length))]!
  return strong ? nearestChordTone(style, bar, n, notes) : n
}

/** Brillo (frecuencia del filtro, Hz) según la altura del dedo: `fy` 0 = arriba (brillante) … 1 = abajo (cálido). Escala exponencial entre 700 y 9000 Hz. */
export function brightnessAtY(fy: number): number {
  const f = 1 - Math.min(1, Math.max(0, Number.isFinite(fy) ? fy : 1))
  return Math.round(700 * (9000 / 700) ** f)
}

/** Tocar el agua en `t` (s) la nota `midi`. */
export interface KeyEvent {
  time: number
  midi: number
}

/**
 * De las notas tocadas a un loop de melodía de `bars` compases: cada nota a la semicorchea más cercana (en el compás, envuelve), una sola por paso (gana la última), la duración
 * hasta la siguiente nota (al menos 1 y como mucho 4 pasos; nunca pisa a la siguiente). Monofónica, como toda la melodía.
 */
export function keysToHits(events: readonly KeyEvent[], start: number, stepSec: number, bars: 1 | 2 | 4 = 4): MelodyHit[] {
  const total = bars * 16
  const byStep = new Map<number, number>()
  for (const e of [...events].sort((a, b) => a.time - b.time)) {
    const pos = (((Math.round((e.time - start) / stepSec) % total) + total) % total)
    byStep.set(pos, e.midi)
  }
  const steps = [...byStep.keys()].sort((a, b) => a - b)
  return steps.map((pos, i) => {
    const next = steps[i + 1] ?? total + steps[0]!
    return { pos, strength: 0.8, midi: byStep.get(pos)!, dur: Math.max(1, Math.min(4, next - pos)) }
  })
}

// ── fase 0: ¿cuánto agua libre queda fuera del aro en Jugar? ─────────────────────────────────────
export interface Space {
  /** lo que mide la pantalla y los márgenes de arriba y abajo ocupados por controles */
  w: number
  h: number
  top: number
  bottom: number
  /** el aro: centro y radio mayor */
  cx: number
  cy: number
  R: number
}

/** Rectángulos libres de agua (px): a los lados del aro y bajo/sobre él, sin los controles. Los menores de 56 px no cuentan (un dedo no cabe). */
export function freeWater(s: Space): { left: number; right: number; above: number; below: number; usable: boolean } {
  const MIN = 56
  const left = Math.max(0, s.cx - s.R)
  const right = Math.max(0, s.w - (s.cx + s.R))
  const above = Math.max(0, s.cy - s.R - s.top)
  const below = Math.max(0, s.h - s.bottom - (s.cy + s.R))
  const ok = (v: number) => v >= MIN
  return { left, right, above, below, usable: [left, right, above, below].some(ok) }
}

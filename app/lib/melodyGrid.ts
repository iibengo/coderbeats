/**
 * Editor de melodía tipo Song Maker (spec 020 §1): una cuadrícula de **corcheas** (8 por compás) por **notas de la escala del estilo**. Puro y sin DOM.
 * Monofónico (una nota por columna), la nota dura de la columna a la siguiente nota como mucho, y todo cabe en el loop (1, 2 o 4 compases).
 */
import type { MelodyHit } from './melody'
import type { StyleId } from './types'
import { STYLE_MUSIC } from './styles'
import { scaleNotes } from './waterKeys'

export const COLS_PER_BAR = 8
export const STEPS_PER_COL = 2
export const GRID_ROWS = 9
export const DEFAULT_DUR = STEPS_PER_COL

export const colsOf = (bars: number): number => bars * COLS_PER_BAR
export const colOfPos = (pos: number): number => Math.round(pos / STEPS_PER_COL)

/** Las filas visibles: `GRID_ROWS` notas de la escala del estilo, de la más grave (índice 0) a la más aguda, empezando en la nota `shift` de la escala. */
export function rowsFor(style: StyleId, shift: number): number[] {
  const all = scaleNotes(style)
  const s = Math.max(0, Math.min(Math.max(0, all.length - GRID_ROWS), shift))
  return all.slice(s, s + GRID_ROWS)
}
/** El desplazamiento máximo (para los botones ▲▼). */
export const maxShift = (style: StyleId): number => Math.max(0, scaleNotes(style).length - GRID_ROWS)
/** El desplazamiento que deja la mayoría de las notas a la vista (la mediana en el centro); sin notas, el centro de la escala. */
export function fitShift(style: StyleId, hits: readonly Pick<MelodyHit, 'midi'>[]): number {
  const all = scaleNotes(style)
  const idx = hits.length ? hits.map((h) => all.findIndex((m) => m >= h.midi)).filter((i) => i >= 0).sort((a, b) => a - b) : [Math.floor(all.length / 2)]
  const mid = idx[Math.floor(idx.length / 2)] ?? Math.floor(all.length / 2)
  return Math.max(0, Math.min(maxShift(style), mid - Math.floor(GRID_ROWS / 2)))
}

const byPos = (a: MelodyHit, b: MelodyHit) => a.pos - b.pos

/** Deja la melodía en forma: de menor a mayor, una nota por columna, cada duración hasta la siguiente nota (como mucho) y dentro del loop. */
export function normalize(hits: readonly MelodyHit[], bars: number): MelodyHit[] {
  const total = bars * 16
  const seen = new Set<number>()
  const sorted = [...hits].filter((h) => h.pos >= 0 && h.pos < total).sort(byPos).filter((h) => (seen.has(colOfPos(h.pos)) ? false : (seen.add(colOfPos(h.pos)), true)))
  return sorted.map((h, i) => {
    const next = sorted[i + 1]?.pos ?? total
    return { ...h, pos: colOfPos(h.pos) * STEPS_PER_COL, dur: Math.max(1, Math.min(h.dur, next - colOfPos(h.pos) * STEPS_PER_COL, total - colOfPos(h.pos) * STEPS_PER_COL)) }
  })
}

/** La nota que empieza en la columna `col`, si hay. */
export const noteAt = (hits: readonly MelodyHit[], col: number): MelodyHit | undefined => hits.find((h) => colOfPos(h.pos) === col)
/** La nota que suena en la columna `col` (empiece ahí o venga de antes). */
export const soundingAt = (hits: readonly MelodyHit[], col: number): MelodyHit | undefined =>
  [...hits].sort(byPos).filter((h) => colOfPos(h.pos) <= col && col * STEPS_PER_COL < h.pos + h.dur).pop()

/**
 * Tocar la casilla (`col`, `midi`): vacía → pone la nota (una corchea); con esa misma altura → la quita; con otra altura en la misma columna → cambia la altura.
 * Si la casilla estaba dentro de una nota larga, la larga se acorta hasta ahí.
 */
export function tapCell(hits: readonly MelodyHit[], col: number, midi: number, bars: number): MelodyHit[] {
  if (col < 0 || col >= colsOf(bars)) return [...hits]
  const here = noteAt(hits, col)
  if (here && here.midi === midi) return normalize(hits.filter((h) => h !== here), bars)
  if (here) return normalize(hits.map((h) => (h === here ? { ...h, midi } : h)), bars)
  return normalize([...hits, { pos: col * STEPS_PER_COL, dur: DEFAULT_DUR, midi, strength: 0.8 }], bars)
}

/** Estira (o encoge) la nota que empieza en `col` hasta que ocupe hasta la columna `toCol` (incluida), sin pasar de la siguiente nota. */
export function stretchNote(hits: readonly MelodyHit[], col: number, toCol: number, bars: number): MelodyHit[] {
  const n = noteAt(hits, col)
  if (!n) return [...hits]
  const cols = Math.max(1, toCol - col + 1)
  return normalize(hits.map((h) => (h === n ? { ...h, dur: cols * STEPS_PER_COL } : h)), bars)
}

/** El índice de fila (0 = la más grave de las visibles) de una altura, o −1 si no está en la ventana. */
export const rowOf = (rows: readonly number[], midi: number): number => rows.indexOf(midi)

// ── «↻ responder» (spec 020 §1.3): la frase de 2 compases pregunta; los 2 siguientes responden ──
/** Cuántos grados de la escala se mueven las notas del 4.º compás en cada variación (la secuencia es fija, sin azar). */
const ANSWER_SHIFTS: readonly (readonly number[])[] = [[-1], [1], [1, -1], [-2, 2]]
export const ANSWER_VARIANTS = ANSWER_SHIFTS.length

/**
 * La frase de los 2 primeros compases + su respuesta en los 2 siguientes (loop de 4): el mismo ritmo; el 3.er compás igual que la pregunta; las notas del 4.º se mueven
 * unos grados de la escala (según la variación `seed`) y **la última nota cae en la tónica** (cierra la frase). Todo en la escala del estilo. `null` si no hay notas en la frase.
 */
export function answerPhrase(hits: readonly MelodyHit[], style: StyleId, seed: number): MelodyHit[] | null {
  const phrase = normalize(hits.filter((h) => h.pos < 32), 2)
  if (!phrase.length) return null
  const scale = scaleNotes(style)
  const nearest = (m: number) => scale.reduce((best, x, i) => (Math.abs(x - m) < Math.abs(scale[best]! - m) ? i : best), 0)
  const shifts = ANSWER_SHIFTS[((seed % ANSWER_VARIANTS) + ANSWER_VARIANTS) % ANSWER_VARIANTS]!
  const tonic = STYLE_MUSIC[style].scale[0]!
  const answer = phrase.map((h, i): MelodyHit => {
    const second = h.pos >= 16
    const idx = nearest(h.midi) + (second ? shifts[i % shifts.length]! : 0)
    return { ...h, pos: h.pos + 32, midi: scale[Math.max(0, Math.min(scale.length - 1, idx))]! }
  })
  // la última nota, a la tónica más cercana de la escala
  const last = answer[answer.length - 1]!
  const tonics = scale.filter((m) => m % 12 === tonic)
  if (tonics.length) last.midi = tonics.reduce((b, m) => (Math.abs(m - last.midi) < Math.abs(b - last.midi) ? m : b), tonics[0]!)
  return normalize([...phrase, ...answer], 4)
}

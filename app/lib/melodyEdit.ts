/**
 * Edición de la melodía con el dedo (spec 002, F2): en el aro y en el órgano. Puro y sin DOM, como `loopEdit`.
 *
 * - Se edita el compás que se ve: `g` es el compás global congelado al empezar el gesto.
 * - Con ayuda: el inicio va a la semicorchea y la altura a la nota de la escala más cercana. Sin ella, a una rejilla
 *   fina (un cuarto de paso) y al semitono (spec 002, §5).
 * - Monofónica: dos notas no se pisan. Una nota nueva o movida que empieza dentro de otra no entra (el golpe vuelve a
 *   su sitio); si empieza en un hueco, se recorta contra la siguiente y contra la línea de compás.
 * - Un loop que se queda sin notas se borra. Nada de esto es un nacimiento: no cambia `bornAt` ni `prev`.
 */
import { loopBarAt, MAX_LOOPS, type FreeLoop, type LoopBars, type LoopsState } from './freeLoops'
import type { EditResult } from './loopEdit'
import { isMidi, type MelodyHit } from './melody'
import { FINE_GRID } from './melodyAssist'
import { nearestScaleNote } from './melodyView'
import type { StyleId } from './types'

export interface MelEditOptions {
  assist: boolean
  style: StyleId
  /** tamaño de la casilla en pasos con ayuda: 2 = corcheas (casillas grandes), 1 = semicorcheas, 4/3 = **tresillos de corchea** (spec 028 §3); por defecto 1 */
  unit?: number
  /** una nota puede cruzar la línea de compás (ligadura, spec 028 §2); sin esto se recorta al compás, como siempre */
  ties?: boolean
}

const mod = (a: number, n: number) => ((a % n) + n) % n
/** a doceavos de paso (exacto para enteros, cuartos y tercios: los tresillos) */
const round12 = (x: number) => Math.round(x * 12) / 12
const grid = (o: MelEditOptions) => (o.assist ? (o.unit ?? 1) : FINE_GRID)

/** El compás global `g` que hace sonar el compás `bar` del loop (0..bars−1): lo que piden las funciones de edición. */
export const gForBar = (loop: Pick<FreeLoop, 'phaseBar'> | undefined, bar: number): number => (loop?.phaseBar ?? 0) + bar

/** El loop de melodía de la célula (el más reciente). */
/** El bajo y los acordes propios de la canción (sintes `bass` y `keys`) no son «la melodía»: el Órgano y el aviso de melodías apiladas no los tocan. */
const isOwnAccompaniment = (l: FreeLoop): boolean => l.synth === 'bass' || l.synth === 'keys'
export const melLoopOf = (s: LoopsState): FreeLoop | undefined =>
  s.loops.filter((l) => l.instrument === 'mel' && !isOwnAccompaniment(l)).sort((a, b) => b.bornAt - a.bornAt || b.id - a.id)[0]

const hitsOf = (l: FreeLoop): MelodyHit[] => l.hits as MelodyHit[]
const replace = (s: LoopsState, loop: FreeLoop): LoopsState => ({ ...s, loops: s.loops.map((l) => (l.id === loop.id ? loop : l)) })

/** Paso (0..16) del compás donde cae algo soltado en `step`, en la rejilla de la edición. */
export function snapMelStep(step: number, o: MelEditOptions): number {
  const q = grid(o)
  const v = Math.round(mod(step, 16) / q) * q
  return v >= 16 - 1e-9 ? 0 : round12(v)
}

/** La altura entera a la que va una altura decimal: la nota de la escala más cercana (con ayuda) o el semitono. */
export function snapMelMidi(midi: number, o: MelEditOptions): number {
  const m = o.assist ? nearestScaleNote(midi, o.style) : Math.round(midi)
  return Math.min(96, Math.max(24, m))
}

/** ¿Empieza `pos` dentro de una nota (que no es `except`)? */
const insideAnother = (hits: readonly MelodyHit[], pos: number, except?: MelodyHit): boolean =>
  hits.some((h) => h !== except && h.pos <= pos + 1e-9 && pos < h.pos + h.dur - 1e-9)

/** La duración máxima de una nota que empieza en `pos`: hasta la siguiente, la línea de compás y el final del loop. */
function room(hits: readonly MelodyHit[], pos: number, total: number, except?: MelodyHit, ties = false): number {
  const next = hits.filter((h) => h !== except && h.pos > pos + 1e-9).sort((a, b) => a.pos - b.pos)[0]
  const barEnd = ties ? total : (Math.floor(pos / 16 + 1e-9) + 1) * 16
  return Math.min(next?.pos ?? Infinity, barEnd, total) - pos
}

/**
 * Pone una nota de `midi` en `step` del compás visible (tocar un hueco). Si no hay loop de melodía lo crea (1 compás;
 * salvo que ya haya 8 loops). Null si cae dentro de otra nota o no cabe.
 */
export function addMelNote(s: LoopsState, step: number, midi: number, g: number, o: MelEditOptions, dur = 2, strength = 0.8): EditResult {
  const own = melLoopOf(s)
  const at = snapMelStep(step, o)
  const note = snapMelMidi(midi, o)
  if (!isMidi(note)) return null
  if (own) {
    const pos = round12(loopBarAt(own, g) * 16 + at)
    const hits = hitsOf(own)
    if (insideAnother(hits, pos)) return null
    const d = Math.min(dur, room(hits, pos, own.bars * 16, undefined, o.ties))
    if (d < grid(o) - 1e-9) return null
    const next = [...hits, { pos, strength, midi: note, dur: d }].sort((a, b) => a.pos - b.pos)
    return { state: replace(s, { ...own, hits: next, fromTemplate: false }), hit: { loopId: own.id, pos } }
  }
  if (s.loops.length >= MAX_LOOPS) return null
  const d = Math.min(dur, 16 - at)
  if (d < grid(o) - 1e-9) return null
  const loop: FreeLoop = { id: s.nextId, instrument: 'mel', bars: 1, phaseBar: 0, hits: [{ pos: at, strength, midi: note, dur: d }], muted: false, bornAt: 0, fromTemplate: false }
  return { state: { loops: [...s.loops, loop], nextId: s.nextId + 1 }, hit: { loopId: loop.id, pos: at } }
}

/**
 * Mueve una nota (soltada en `step` del compás visible con la altura `midi`): cambia de momento y de altura. Null si
 * cae dentro de otra nota o no cabe (la nota vuelve a su sitio con rebote).
 */
export function moveMelNote(s: LoopsState, loopId: number, fromPos: number, step: number, midi: number, g: number, o: MelEditOptions): EditResult {
  const loop = s.loops.find((l) => l.id === loopId && l.instrument === 'mel')
  const hit = loop && hitsOf(loop).find((h) => Math.abs(h.pos - fromPos) < 1e-6)
  if (!loop || !hit) return null
  const pos = round12(loopBarAt(loop, g) * 16 + snapMelStep(step, o))
  const hits = hitsOf(loop)
  if (insideAnother(hits, pos, hit)) return null
  const d = Math.min(hit.dur, room(hits, pos, loop.bars * 16, hit, o.ties))
  if (d < grid(o) - 1e-9) return null
  const moved: MelodyHit = { ...hit, pos, midi: snapMelMidi(midi, o), dur: d }
  const next = [...hits.filter((h) => h !== hit), moved].sort((a, b) => a.pos - b.pos)
  return { state: replace(s, { ...loop, hits: next, fromTemplate: false }), hit: { loopId, pos } }
}

/** Cambia la duración de una nota (estirar o encoger su arco): a la rejilla, como mínimo una celda, hasta la siguiente nota y la línea de compás. */
export function resizeMelNote(s: LoopsState, loopId: number, pos: number, durSteps: number, o: MelEditOptions): EditResult {
  const loop = s.loops.find((l) => l.id === loopId && l.instrument === 'mel')
  const hit = loop && hitsOf(loop).find((h) => Math.abs(h.pos - pos) < 1e-6)
  if (!loop || !hit) return null
  const q = grid(o)
  const wanted = Math.max(q, Math.round(durSteps / q) * q)
  const d = Math.min(wanted, room(hitsOf(loop), hit.pos, loop.bars * 16, hit, o.ties))
  if (d < q - 1e-9) return null
  const next = hitsOf(loop).map((h) => (h === hit ? { ...h, dur: round12(d) } : h))
  return { state: replace(s, { ...loop, hits: next, fromTemplate: false }), hit: { loopId, pos: hit.pos } }
}

/**
 * Deshacer una edición de la melodía: deja el loop `id` como estaba antes (`before`), o lo quita si antes no existía.
 * Solo toca ese loop: lo que haya nacido mientras tanto (batería, otras capas) se queda.
 */
export function restoreMel(s: LoopsState, id: number, before: FreeLoop | null): LoopsState {
  const exists = s.loops.some((l) => l.id === id)
  if (!before) return exists ? { ...s, loops: s.loops.filter((l) => l.id !== id) } : s
  if (exists) return replace(s, before)
  return { loops: [...s.loops, before], nextId: Math.max(s.nextId, before.id + 1) }
}

/** Cambia la longitud del loop de melodía (1, 2 o 4 compases): al alargar repite lo que hay; al acortar, quita lo que queda fuera. */
export function setMelBars(s: LoopsState, loopId: number, bars: LoopBars): LoopsState {
  const loop = s.loops.find((l) => l.id === loopId && l.instrument === 'mel')
  if (!loop || loop.bars === bars) return s
  const hits: MelodyHit[] = []
  for (let k = 0; k < Math.max(1, bars / loop.bars); k++)
    for (const h of hitsOf(loop)) {
      const pos = h.pos + k * loop.bars * 16
      if (pos < bars * 16) hits.push({ ...h, pos, dur: Math.min(h.dur, bars * 16 - pos) })
    }
  if (!hits.length) return { ...s, loops: s.loops.filter((l) => l.id !== loopId) }
  return replace(s, { ...loop, bars, hits, fromTemplate: false })
}

// ── una sola melodía por parte (spec 020 §1.2) ──
export const FX_SYNTHS: readonly string[] = ['riser', 'crash', 'boom', 'impacto', 'downlifter']
/** ¿Es un efecto (subida, platillo, impacto…) y no una melodía? Esos loops de melodía no cuentan como «otra melodía». */
export const isFxLoop = (l: FreeLoop): boolean => FX_SYNTHS.includes(l.synth ?? '') || (l.synth === 'pad' && l.hits.length <= 4)
/** Las melodías que sobran: todas las de la célula menos la última (la que edita el Órgano); los efectos no cuentan. */
export function extraMelodies(s: LoopsState): FreeLoop[] {
  const main = melLoopOf(s)
  return s.loops.filter((l) => l.instrument === 'mel' && !isFxLoop(l) && !isOwnAccompaniment(l) && l.id !== main?.id)
}
/** Deja solo la melodía principal (quita las extra). */
export function dropExtraMelodies(s: LoopsState): LoopsState {
  const extra = new Set(extraMelodies(s).map((l) => l.id))
  return extra.size ? { ...s, loops: s.loops.filter((l) => !extra.has(l.id)) } : s
}

// ── acordes: varias notas que empiezan a la vez (spec 028 §4); solo en «Avanzado» ──
/** Pone una nota **a la vez que las que ya empiezan en ese paso** (un acorde): si ya hay una igual no hace nada, y si cae dentro de una nota que empezó antes no entra. */
export function addChordNote(s: LoopsState, step: number, midi: number, g: number, o: MelEditOptions, dur = 2, strength = 0.8): EditResult {
  const own = melLoopOf(s)
  const note = snapMelMidi(midi, o)
  if (!own || !isMidi(note)) return addMelNote(s, step, midi, g, o, dur, strength)
  const pos = round12(loopBarAt(own, g) * 16 + snapMelStep(step, o))
  const hits = hitsOf(own)
  if (hits.some((h) => Math.abs(h.pos - pos) < 1e-6 && h.midi === note)) return null
  // dentro de una nota que empezó antes (no a la vez): no entra
  if (hits.some((h) => h.pos < pos - 1e-9 && pos < h.pos + h.dur - 1e-9)) return null
  const same = hits.filter((h) => Math.abs(h.pos - pos) < 1e-6)
  const wanted = same.length ? same[0]!.dur : dur // el acorde dura lo que las notas que ya empiezan ahí
  const d = Math.min(wanted, room(hits, pos, own.bars * 16, undefined, o.ties))
  if (d < grid(o) - 1e-9) return null
  const next = [...hits, { pos, strength, midi: note, dur: d }].sort((a, b) => a.pos - b.pos || a.midi - b.midi)
  return { state: replace(s, { ...own, hits: next, fromTemplate: false }), hit: { loopId: own.id, pos } }
}

/** Quita **una** nota (la de esa altura que empieza en `pos`); las demás de su acorde se quedan. Un loop que se queda sin notas se borra, como siempre. */
export function removeChordNote(s: LoopsState, loopId: number, pos: number, midi: number): LoopsState {
  const loop = s.loops.find((l) => l.id === loopId && l.instrument === 'mel')
  if (!loop) return s
  const hits = hitsOf(loop).filter((h) => !(Math.abs(h.pos - pos) < 1e-6 && h.midi === midi))
  if (hits.length === loop.hits.length) return s
  return hits.length ? replace(s, { ...loop, hits, fromTemplate: false }) : { ...s, loops: s.loops.filter((l) => l.id !== loopId) }
}

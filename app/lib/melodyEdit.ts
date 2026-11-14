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
import { loopBarAt, MAX_LOOPS, type FreeLoop, type LoopsState } from './freeLoops'
import type { EditResult } from './loopEdit'
import { isMidi, type MelodyHit } from './melody'
import { FINE_GRID } from './melodyAssist'
import { nearestScaleNote } from './melodyView'
import type { StyleId } from './types'

export interface MelEditOptions {
  assist: boolean
  style: StyleId
}

const mod = (a: number, n: number) => ((a % n) + n) % n
const round2 = (x: number) => Math.round(x * 100) / 100
const grid = (o: MelEditOptions) => (o.assist ? 1 : FINE_GRID)

/** El compás global `g` que hace sonar el compás `bar` del loop (0..bars−1): lo que piden las funciones de edición. */
export const gForBar = (loop: Pick<FreeLoop, 'phaseBar'> | undefined, bar: number): number => (loop?.phaseBar ?? 0) + bar

/** El loop de melodía de la célula (el más reciente). */
export const melLoopOf = (s: LoopsState): FreeLoop | undefined =>
  s.loops.filter((l) => l.instrument === 'mel').sort((a, b) => b.bornAt - a.bornAt || b.id - a.id)[0]

const hitsOf = (l: FreeLoop): MelodyHit[] => l.hits as MelodyHit[]
const replace = (s: LoopsState, loop: FreeLoop): LoopsState => ({ ...s, loops: s.loops.map((l) => (l.id === loop.id ? loop : l)) })

/** Paso (0..16) del compás donde cae algo soltado en `step`, en la rejilla de la edición. */
export function snapMelStep(step: number, o: MelEditOptions): number {
  const q = grid(o)
  const v = Math.round(mod(step, 16) / q) * q
  return v >= 16 ? 0 : round2(v)
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
function room(hits: readonly MelodyHit[], pos: number, total: number, except?: MelodyHit): number {
  const next = hits.filter((h) => h !== except && h.pos > pos + 1e-9).sort((a, b) => a.pos - b.pos)[0]
  const barEnd = (Math.floor(pos / 16 + 1e-9) + 1) * 16
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
    const pos = round2(loopBarAt(own, g) * 16 + at)
    const hits = hitsOf(own)
    if (insideAnother(hits, pos)) return null
    const d = Math.min(dur, room(hits, pos, own.bars * 16))
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
  const pos = round2(loopBarAt(loop, g) * 16 + snapMelStep(step, o))
  const hits = hitsOf(loop)
  if (insideAnother(hits, pos, hit)) return null
  const d = Math.min(hit.dur, room(hits, pos, loop.bars * 16, hit))
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
  const d = Math.min(wanted, room(hitsOf(loop), hit.pos, loop.bars * 16, hit))
  if (d < q - 1e-9) return null
  const next = hitsOf(loop).map((h) => (h === hit ? { ...h, dur: round2(d) } : h))
  return { state: replace(s, { ...loop, hits: next, fromTemplate: false }), hit: { loopId, pos: hit.pos } }
}

/** Cambia la longitud del loop de melodía (1, 2 o 4 compases): al alargar repite lo que hay; al acortar, quita lo que queda fuera. */
export function setMelBars(s: LoopsState, loopId: number, bars: 1 | 2 | 4): LoopsState {
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

/**
 * Edición con el dedo en el aro (spec 003, §5 y E1.4). Puro y sin DOM.
 *
 * - Se edita el compás que se ve: `g` es el compás global congelado al empezar el gesto; en un loop
 *   de varios compases se toca su compás `loopBarAt(loop, g)`.
 * - Imán = ayuda: con ayuda, el paso se redondea a la rejilla del estilo; sin ella, queda decimal.
 * - Cambiar de franja solo entre baterías (bombo, caja, platillo).
 * - Un loop que se queda sin golpes se borra.
 * - Nada de esto es un nacimiento: no cambia `bornAt` ni `prev`.
 * - El bajo no se edita: solo se ve (E1.4, E3.8).
 */
import { loopBarAt, MAX_LOOPS, type FreeLoop, type LoopsState } from './freeLoops'
import type { Instrument } from './types'

export interface EditOptions {
  assist: boolean
  /** rejilla del estilo con ayuda: 1 = semicorcheas, 2 = corcheas */
  quantizeEvery: 1 | 2
}

/** Golpe editado: dónde ha quedado (para animar su llegada). */
export interface EditedHit {
  loopId: number
  pos: number
}

export type EditResult = { state: LoopsState; hit: EditedHit } | null

const mod = (a: number, n: number) => ((a % n) + n) % n
const round2 = (x: number) => Math.round(x * 100) / 100

/** Paso (0..16) del compás donde cae un golpe soltado en `step`. */
export function snapStep(step: number, o: EditOptions): number {
  const s = mod(step, 16)
  const q = o.assist ? o.quantizeEvery : 0
  const v = q ? Math.round(s / q) * q : round2(s)
  return v >= 16 ? 0 : v
}

const sameStep = (a: number, b: number, total: number) => {
  const d = mod(a - b, total)
  return Math.min(d, total - d) < 0.5
}

/** Loop de un instrumento (el más reciente, como en §16.19). */
export const loopOf = (s: LoopsState, inst: Instrument): FreeLoop | undefined =>
  s.loops.filter((l) => l.instrument === inst).sort((a, b) => b.bornAt - a.bornAt || b.id - a.id)[0]

/** Pone un golpe en `step` del compás visible de `loop`; quita el que hubiera en ese paso. */
function place(loop: FreeLoop, step: number, g: number, strength: number): { loop: FreeLoop; pos: number } {
  const total = loop.bars * 16
  const pos = round2(loopBarAt(loop, g) * 16 + step)
  const hits = loop.hits.filter((h) => !sameStep(h.pos, pos, total))
  hits.push({ pos, strength })
  hits.sort((a, b) => a.pos - b.pos)
  return { loop: { ...loop, hits, fromTemplate: false }, pos }
}

const replace = (s: LoopsState, loop: FreeLoop): LoopsState => ({ ...s, loops: s.loops.map((l) => (l.id === loop.id ? loop : l)) })

/** Quita un golpe; si el loop se queda vacío, se borra el loop. */
export function removeHit(s: LoopsState, loopId: number, pos: number): LoopsState {
  const loop = s.loops.find((l) => l.id === loopId)
  if (!loop) return s
  const hits = loop.hits.filter((h) => Math.abs(h.pos - pos) > 1e-6)
  if (hits.length === loop.hits.length) return s
  if (!hits.length) return { ...s, loops: s.loops.filter((l) => l.id !== loopId) }
  return replace(s, { ...loop, hits, fromTemplate: false })
}

/**
 * Crea un golpe de `inst` en `step` (tocar una franja vacía). Si el instrumento no tiene loop, lo
 * crea (1 compás), salvo que ya haya 8 loops. Si ya hay golpe en ese paso, no hace nada.
 */
export function addHit(s: LoopsState, inst: Instrument, step: number, g: number, o: EditOptions, strength = 0.8): EditResult {
  const at = snapStep(step, o)
  const own = loopOf(s, inst)
  if (own) {
    const pos = loopBarAt(own, g) * 16 + at
    if (own.hits.some((h) => sameStep(h.pos, pos, own.bars * 16))) return null
    const r = place(own, at, g, strength)
    return { state: replace(s, r.loop), hit: { loopId: own.id, pos: r.pos } }
  }
  if (s.loops.length >= MAX_LOOPS) return null
  const loop: FreeLoop = {
    id: s.nextId,
    instrument: inst,
    bars: 1,
    phaseBar: 0,
    hits: [{ pos: at, strength }],
    muted: false,
    bornAt: 0,
    fromTemplate: false,
  }
  return { state: { loops: [...s.loops, loop], nextId: s.nextId + 1 }, hit: { loopId: loop.id, pos: at } }
}

/**
 * Mueve un golpe (soltado en `step` de la franja de `toInst`). Mismo instrumento: cambia de paso.
 * Otro instrumento de batería: pasa a su loop (o a uno nuevo). Devuelve null si no se puede
 * (el golpe vuelve a su sitio).
 */
export function moveHit(
  s: LoopsState,
  loopId: number,
  fromPos: number,
  toInst: Instrument,
  step: number,
  g: number,
  o: EditOptions,
): EditResult {
  const loop = s.loops.find((l) => l.id === loopId)
  const hit = loop?.hits.find((h) => Math.abs(h.pos - fromPos) < 1e-6)
  if (!loop || !hit) return null
  const at = snapStep(step, o)
  if (toInst === loop.instrument) {
    const without = { ...loop, hits: loop.hits.filter((h) => h !== hit) }
    const r = place(without, at, g, hit.strength)
    return { state: replace(s, r.loop), hit: { loopId, pos: r.pos } }
  }
  const removed = removeHit(s, loopId, fromPos)
  const target = loopOf(removed, toInst)
  if (target) {
    const r = place(target, at, g, hit.strength)
    return { state: replace(removed, r.loop), hit: { loopId: target.id, pos: r.pos } }
  }
  return addHit(removed, toInst, at, g, { ...o, assist: false }, hit.strength)
}

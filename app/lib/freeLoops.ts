import { assistQuantize, templateFor } from './assist'
import type { ClosedPhrase, LoopLength } from './phrases'
import type { Instrument, StyleId } from './types'

export const MAX_LOOPS = 8
export const DEDUPE_OVERLAP = 0.8

export interface LoopHit {
  /** semicorcheas desde el inicio del loop; entero con ayuda, decimal sin ella */
  pos: number
  strength: number
}

export interface FreeLoop {
  id: number
  instrument: Instrument
  bars: LoopLength
  /** compás global en el que empieza; suena el compás (g - phaseBar) mod bars */
  phaseBar: number
  hits: LoopHit[]
  muted: boolean
  bornAt: number
  fromTemplate: boolean
}

export interface LoopsState {
  loops: FreeLoop[]
  nextId: number
}

export type LoopEvent =
  | { type: 'born'; loop: FreeLoop }
  | { type: 'reinforced'; id: number }
  | { type: 'removed'; id: number; reason: 'limit' | 'user' }

export interface BirthOptions {
  assist: boolean
  style: StyleId
  quantizeEvery: 1 | 2
  /** compás global en el que nace (el siguiente al cierre) */
  bornAt: number
}

export const emptyLoops = (): LoopsState => ({ loops: [], nextId: 1 })
const mod = (a: number, n: number) => ((a % n) + n) % n

/** Compás del loop que suena en el compás global `g`. */
export const loopBarAt = (loop: Pick<FreeLoop, 'bars' | 'phaseBar'>, g: number): number => mod(g - loop.phaseBar, loop.bars)

/** Candidatos (uno por instrumento) a partir de una frase cerrada. */
export function candidatesFromPhrase(phrase: ClosedPhrase, o: BirthOptions): Omit<FreeLoop, 'id'>[] {
  const total = phrase.bars * 16
  const byInst = new Map<Instrument, ClosedPhrase['hits']>()
  for (const h of phrase.hits) byInst.set(h.instrument, [...(byInst.get(h.instrument) ?? []), h])
  const out: Omit<FreeLoop, 'id'>[] = []
  for (const [instrument, hits] of byInst) {
    const base = { instrument, bars: phrase.bars, phaseBar: phrase.startBar, muted: false, bornAt: o.bornAt }
    if (o.assist && hits.length === 1) {
      const strength = hits[0]!.strength
      const steps = templateFor(instrument, o.style)
      const all = Array.from({ length: phrase.bars }, (_, b) => steps.map((s) => s + b * 16)).flat()
      out.push({ ...base, hits: all.map((pos) => ({ pos, strength })), fromTemplate: true })
      continue
    }
    const placed = new Map<number, LoopHit>()
    const exact: LoopHit[] = []
    for (const h of hits) {
      const rel = h.globalStep - phrase.startBar * 16
      if (o.assist) {
        const step = assistQuantize(rel, instrument, o.style, o.quantizeEvery, total)
        const prev = placed.get(step)
        if (!prev || h.strength > prev.strength) placed.set(step, { pos: step, strength: h.strength })
      } else exact.push({ pos: mod(rel, total), strength: h.strength })
    }
    const list = o.assist ? [...placed.values()] : exact
    out.push({ ...base, hits: list.sort((a, b) => a.pos - b.pos), fromTemplate: false })
  }
  return out
}

/** Pasos (en fase global, módulo la longitud) para comparar loops. */
function phasedSteps(l: Pick<FreeLoop, 'bars' | 'phaseBar' | 'hits'>): Set<number> {
  const total = l.bars * 16
  return new Set(l.hits.map((h) => mod(Math.round(h.pos) + l.phaseBar * 16, total)))
}

export function overlap(a: Pick<FreeLoop, 'bars' | 'phaseBar' | 'hits'>, b: Pick<FreeLoop, 'bars' | 'phaseBar' | 'hits'>): number {
  if (a.bars !== b.bars) return 0
  const A = phasedSteps(a)
  const B = phasedSteps(b)
  let common = 0
  for (const s of A) if (B.has(s)) common++
  return common / Math.max(A.size, B.size, 1)
}

/** Añade los loops de una frase: deduplica y respeta el máximo. */
export function addPhrase(state: LoopsState, phrase: ClosedPhrase, o: BirthOptions): { state: LoopsState; events: LoopEvent[] } {
  let loops = [...state.loops]
  let nextId = state.nextId
  const events: LoopEvent[] = []
  for (const c of candidatesFromPhrase(phrase, o)) {
    const twin = loops.find((l) => !l.muted && l.instrument === c.instrument && overlap(l, c) >= DEDUPE_OVERLAP)
    if (twin) {
      events.push({ type: 'reinforced', id: twin.id })
      continue
    }
    if (loops.length >= MAX_LOOPS) {
      const byAge = [...loops].sort((a, b) => a.bornAt - b.bornAt || a.id - b.id)
      const victim = byAge.find((l) => l.muted) ?? byAge[0]!
      loops = loops.filter((l) => l.id !== victim.id)
      events.push({ type: 'removed', id: victim.id, reason: 'limit' })
    }
    const loop: FreeLoop = { ...c, id: nextId++ }
    loops.push(loop)
    events.push({ type: 'born', loop })
  }
  return { state: { loops, nextId }, events }
}

export const toggleMute = (s: LoopsState, id: number): LoopsState => ({
  ...s,
  loops: s.loops.map((l) => (l.id === id ? { ...l, muted: !l.muted } : l)),
})

export const removeLoop = (s: LoopsState, id: number): LoopsState => ({ ...s, loops: s.loops.filter((l) => l.id !== id) })

export const clearLoops = (s: LoopsState): LoopsState => ({ ...s, loops: [] })

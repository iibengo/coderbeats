import { assistQuantize, templateFor } from './assist'
import type { ClosedPhrase, LoopLength } from './phrases'
import type { Instrument, StyleId } from './types'

export const MAX_LOOPS = 8

/**
 * Qué pasa al grabar un instrumento que ya tiene loop (§16.19). En los dos casos hay como mucho
 * una bola por instrumento.
 * - replace: la frase nueva sustituye al loop entero
 * - complete: los golpes nuevos se añaden al loop existente (overdub)
 */
export type RepeatMode = 'replace' | 'complete'

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
  /**
   * Versión anterior a la que sustituye (modo "sustituye", §16.15): sigue sonando hasta
   * el compás de nacimiento de la nueva (`bornAt`), sin hueco ni solape.
   */
  prev?: { hits: LoopHit[]; bars: LoopLength; phaseBar: number }
}

export interface LoopsState {
  loops: FreeLoop[]
  nextId: number
}

export type LoopEvent =
  | { type: 'born'; loop: FreeLoop }
  | { type: 'replaced'; loop: FreeLoop }
  | { type: 'completed'; loop: FreeLoop; added: number }
  | { type: 'removed'; id: number; reason: 'limit' | 'user' }

export interface BirthOptions {
  assist: boolean
  style: StyleId
  quantizeEvery: 1 | 2
  /** compás global en el que nace (el siguiente al cierre) */
  bornAt: number
  /** qué hacer si el instrumento ya tiene loop (por defecto, sustituir) */
  repeat?: RepeatMode
  /**
   * Enmienda de una frase ya nacida en `bornAt` (golpe tardío): los loops que nacieron de ella
   * se regeneran en su sitio (mismo id, misma versión previa), en cualquier modo.
   */
  amend?: boolean
}

export const emptyLoops = (): LoopsState => ({ loops: [], nextId: 1 })
const mod = (a: number, n: number) => ((a % n) + n) % n

/** Compás del loop que suena en el compás global `g`. */
export const loopBarAt = (loop: Pick<FreeLoop, 'bars' | 'phaseBar'>, g: number): number => mod(g - loop.phaseBar, loop.bars)

/** Candidatos (uno por instrumento) a partir de una frase cerrada. */
/**
 * Candidatos (uno por instrumento) a partir de una frase cerrada. Con `noTemplate`, un golpe
 * suelto de esos instrumentos se queda como golpe (para completar un loop, no para rellenarlo).
 */
export function candidatesFromPhrase(
  phrase: ClosedPhrase,
  o: BirthOptions,
  noTemplate: ReadonlySet<Instrument> = new Set(),
): Omit<FreeLoop, 'id'>[] {
  const total = phrase.bars * 16
  const byInst = new Map<Instrument, ClosedPhrase['hits']>()
  for (const h of phrase.hits) byInst.set(h.instrument, [...(byInst.get(h.instrument) ?? []), h])
  const out: Omit<FreeLoop, 'id'>[] = []
  for (const [instrument, hits] of byInst) {
    const base = { instrument, bars: phrase.bars, phaseBar: phrase.startBar, muted: false, bornAt: o.bornAt }
    if (o.assist && hits.length === 1 && !noTemplate.has(instrument)) {
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

const sameStep = (a: number, b: number, total: number) => {
  const d = mod(a - b, total)
  return Math.min(d, total - d) < 0.5
}

/**
 * Overdub (§16.19): añade los golpes de `add` (su fase y longitud) al loop `base`.
 * Si `add` es más largo, el loop se alarga repitiendo su patrón. No duplica pasos ya ocupados.
 * Devuelve el loop resultante y cuántos golpes nuevos entraron.
 */
export function mergeLoops(
  base: Pick<FreeLoop, 'bars' | 'phaseBar' | 'hits'>,
  add: Pick<FreeLoop, 'bars' | 'phaseBar' | 'hits'>,
): { bars: LoopLength; phaseBar: number; hits: LoopHit[]; added: number } {
  const bars = Math.max(base.bars, add.bars) as LoopLength
  const total = bars * 16
  // el patrón base, repetido hasta la nueva longitud (manteniendo su fase)
  const hits: LoopHit[] = []
  for (let k = 0; k < bars / base.bars; k++) for (const h of base.hits) hits.push({ ...h, pos: h.pos + k * base.bars * 16 })
  let added = 0
  for (const h of add.hits) {
    const raw = h.pos + (add.phaseBar - base.phaseBar) * 16
    const pos = raw >= 0 && raw < total ? raw : mod(raw, total) // sin ruido de coma flotante si no hace falta
    if (hits.some((x) => sameStep(x.pos, pos, total))) continue
    hits.push({ ...h, pos })
    added++
  }
  return { bars, phaseBar: base.phaseBar, hits: hits.sort((a, b) => a.pos - b.pos), added }
}

/** Añade los loops de una frase: sustituye o completa el loop de cada instrumento, o crea uno nuevo. */
export function addPhrase(state: LoopsState, phrase: ClosedPhrase, o: BirthOptions): { state: LoopsState; events: LoopEvent[] } {
  let loops = [...state.loops]
  let nextId = state.nextId
  const events: LoopEvent[] = []
  const repeat = o.repeat ?? 'replace'
  const newestOf = (inst: Instrument) =>
    loops.filter((l) => l.instrument === inst).sort((a, b) => b.bornAt - a.bornAt || b.id - a.id)[0]
  const noTemplate = new Set<Instrument>(
    repeat === 'complete' ? (['bd', 'sd', 'hh'] as Instrument[]).filter((i) => newestOf(i)) : [],
  )

  for (const c of candidatesFromPhrase(phrase, o, noTemplate)) {
    const own = o.amend ? loops.find((l) => l.instrument === c.instrument && l.bornAt === o.bornAt) : undefined
    const existing = own ?? newestOf(c.instrument)
    if (existing) {
      let loop: FreeLoop
      if (repeat === 'complete') {
        // en una enmienda, los golpes de la frase original ya están dentro: el merge no los duplica
        const m = mergeLoops(existing, c)
        // nada nuevo que añadir: el loop sigue tal cual (sin caída ni reevaluación)
        if (m.added === 0) continue
        const prev = own ? existing.prev : existing.muted ? undefined : { hits: existing.hits, bars: existing.bars, phaseBar: existing.phaseBar }
        loop = {
          ...existing,
          bars: m.bars,
          phaseBar: m.phaseBar,
          hits: m.hits,
          muted: false,
          bornAt: o.bornAt,
          fromTemplate: false,
          ...(prev ? { prev } : {}),
        }
        if (!prev) delete loop.prev
        events.push({ type: 'completed', loop, added: m.added })
      } else {
        const prev = own ? existing.prev : existing.muted ? undefined : { hits: existing.hits, bars: existing.bars, phaseBar: existing.phaseBar }
        loop = { ...c, id: existing.id, muted: own ? existing.muted : false, ...(prev ? { prev } : {}) }
        events.push({ type: 'replaced', loop })
      }
      loops = loops.map((l) => (l.id === existing.id ? loop : l))
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

/** Quita las versiones anteriores que ya no suenan (su sustituta nació en o antes de `bar`). */
export function prunePrev(s: LoopsState, bar: number): LoopsState {
  if (!s.loops.some((l) => l.prev && l.bornAt <= bar)) return s
  return {
    ...s,
    loops: s.loops.map((l) => {
      if (!l.prev || l.bornAt > bar) return l
      const { prev: _prev, ...rest } = l
      return rest
    }),
  }
}

import { assistQuantize, laneGrid } from './assist'
import { mergeMelody, type MelodyHit, type MelodySynth } from './melody'
import type { ClosedPhrase, LoopLength } from './phrases'
import type { Instrument, StyleId } from './types'

/** Lo que suena en un loop: batería o (spec 002) la melodía con la voz. */
export type LoopInstrument = Instrument | 'mel' | 'voz'

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
  /** solo melodía: altura MIDI entera (spec 002, §8.1) */
  midi?: number
  /** solo melodía: duración en semicorcheas */
  dur?: number
}

/** La referencia a un audio de voz: el audio vive en IndexedDB, aquí solo su identificador (patrón estricto, `voiceLoop.ts`). */
export interface VoiceRef {
  audio: string
  /** tempo al que se grabó (bpm) */
  bpm: number
  /** frecuencia de las muestras guardadas (Hz) */
  sampleRate: number
}

export interface FreeLoop {
  id: number
  instrument: LoopInstrument
  bars: LoopLength
  /** compás global en el que empieza; suena el compás (g - phaseBar) mod bars */
  phaseBar: number
  hits: LoopHit[]
  muted: boolean
  bornAt: number
  fromTemplate: boolean
  /** solo voz (spec 007 §7): el audio guardado (IndexedDB) y cómo se grabó; el loop no lleva golpes */
  voice?: VoiceRef
  /** solo melodía: sinte propio de este loop (la demo del dembow); sin él, el de la canción o el del estilo */
  synth?: MelodySynth
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
  /**
   * Carriles cuya rejilla de ayuda es la de semicorcheas porque su loop ya tiene golpes fuera de la del
   * estilo (spec 003, E5.1). Lo rellena `addPhrase`.
   */
  fineLanes?: ReadonlySet<Instrument>
  /** compás global en el que empezó la célula en la que se graba (spec 005); 0 = canción de una célula */
  cellStart?: number
  /** qué hacer si el instrumento ya tiene loop (por defecto, completar: §16.21) */
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

/**
 * Golpe candidato. Con ayuda, `alt` es el paso de la rejilla más cercano a donde lo hiciste (sin la
 * atracción del estilo) cuando la ayuda lo llevó a otro: se usa si su paso ya está ocupado (§16.21).
 */
export interface CandidateHit extends LoopHit {
  alt?: number
}

export type Candidate = Omit<FreeLoop, 'id' | 'hits'> & { hits: CandidateHit[] }

/** Quita los datos de trabajo de los golpes candidatos antes de guardarlos en un loop. */
const plainHits = (hits: CandidateHit[]): LoopHit[] => hits.map(({ alt: _alt, ...h }) => h)

/**
 * Candidatos (uno por instrumento) a partir de una frase cerrada. Un golpe suelto se queda como
 * golpe, sin plantilla (§16.21). Con ayuda, dos golpes que la ayuda llevaría al mismo paso no se
 * funden: el que ella movió va a su paso de la rejilla más cercano si está libre; si no, es el
 * mismo golpe repetido y queda el más fuerte.
 */
export function candidatesFromPhrase(phrase: ClosedPhrase, o: BirthOptions): Candidate[] {
  const total = phrase.bars * 16
  const byInst = new Map<Instrument, ClosedPhrase['hits']>()
  for (const h of phrase.hits) if (h.instrument !== 'mel') byInst.set(h.instrument, [...(byInst.get(h.instrument) ?? []), h])
  const out: Candidate[] = []
  for (const [instrument, hits] of byInst) {
    const base = { instrument, bars: phrase.bars, phaseBar: phrase.startBar - (o.cellStart ?? 0), muted: false, bornAt: o.bornAt }
    if (!o.assist) {
      const exact = hits.map((h) => ({ pos: mod(h.globalStep - phrase.startBar * 16, total), strength: h.strength }))
      out.push({ ...base, hits: exact.sort((a, b) => a.pos - b.pos), fromTemplate: false })
      continue
    }
    const q: 1 | 2 = o.fineLanes?.has(instrument) ? 1 : o.quantizeEvery
    const placed = new Map<number, CandidateHit>()
    const put = (pos: number, h: CandidateHit) => {
      const prev = placed.get(pos)
      if (!prev || h.strength > prev.strength) placed.set(pos, h)
    }
    const quantized = hits.map((h) => {
      const rel = h.globalStep - phrase.startBar * 16
      const step = assistQuantize(rel, instrument, o.style, q, total)
      const plain = mod(Math.round(rel / q) * q, total)
      return { step, plain, strength: h.strength }
    })
    // primero los golpes que la ayuda no movió; después los movidos, que no pisan a nadie
    for (const h of quantized) if (h.step === h.plain) put(h.step, { pos: h.step, strength: h.strength })
    for (const h of quantized) {
      if (h.step === h.plain) continue
      if (!placed.has(h.step)) placed.set(h.step, { pos: h.step, strength: h.strength, alt: h.plain })
      else if (!placed.has(h.plain)) placed.set(h.plain, { pos: h.plain, strength: h.strength })
      else put(h.plain, { pos: h.plain, strength: h.strength })
    }
    out.push({ ...base, hits: [...placed.values()].sort((a, b) => a.pos - b.pos), fromTemplate: false })
  }
  return out
}

const sameMelody = (a: MelodyHit[], b: MelodyHit[]) =>
  a.length === b.length && a.every((h, i) => Math.abs(h.pos - b[i]!.pos) < 1e-6 && h.midi === b[i]!.midi && Math.abs(h.dur - b[i]!.dur) < 1e-6)

const sameHits = (a: LoopHit[], b: LoopHit[]) => a.length === b.length && a.every((h, i) => Math.abs(h.pos - b[i]!.pos) < 1e-6)

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
  add: Pick<FreeLoop, 'bars' | 'phaseBar'> & { hits: CandidateHit[] },
): { bars: LoopLength; phaseBar: number; hits: LoopHit[]; added: number } {
  const bars = Math.max(base.bars, add.bars) as LoopLength
  const total = bars * 16
  // el patrón base, repetido hasta la nueva longitud (manteniendo su fase)
  const hits: LoopHit[] = []
  for (let k = 0; k < bars / base.bars; k++) for (const h of base.hits) hits.push({ ...h, pos: h.pos + k * base.bars * 16 })
  let added = 0
  const shift = (p: number) => {
    const raw = p + (add.phaseBar - base.phaseBar) * 16
    return raw >= 0 && raw < total ? raw : mod(raw, total) // sin ruido de coma flotante si no hace falta
  }
  const taken = (p: number) => hits.some((x) => sameStep(x.pos, p, total))
  for (const { alt, ...h } of add.hits) {
    let pos = shift(h.pos)
    // §16.21: si la ayuda lo llevó a un paso ocupado, va a su paso de la rejilla más cercano;
    // si ese también está ocupado, es el mismo golpe repetido
    if (taken(pos)) {
      if (alt === undefined) continue
      pos = shift(alt)
      if (taken(pos)) continue
    }
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
  const repeat = o.repeat ?? 'complete'
  const newestOf = (inst: LoopInstrument) =>
    loops.filter((l) => l.instrument === inst).sort((a, b) => b.bornAt - a.bornAt || b.id - a.id)[0]

  // la rejilla de la ayuda se adapta a cada carril (E5.1)
  const fineLanes = new Set<Instrument>()
  for (const inst of new Set(phrase.hits.map((h) => h.instrument).filter((i): i is Instrument => i !== 'mel'))) {
    const own = o.amend ? loops.find((l) => l.instrument === inst && l.bornAt === o.bornAt) : undefined
    const existing = own ?? newestOf(inst)
    if (existing && laneGrid(o.quantizeEvery, (own?.prev ? { ...own, ...own.prev } : existing).hits) === 1) fineLanes.add(inst)
  }
  for (const cand of candidatesFromPhrase(phrase, { ...o, fineLanes })) {
    const c = { ...cand, hits: plainHits(cand.hits) }
    const own = o.amend ? loops.find((l) => l.instrument === c.instrument && l.bornAt === o.bornAt) : undefined
    const existing = own ?? newestOf(c.instrument)
    if (existing) {
      let loop: FreeLoop
      if (repeat === 'complete') {
        // En una enmienda, los golpes de la frase original ya están dentro. Se rehace la fusión
        // desde la versión anterior al loop (así un golpe movido por la ayuda no se duplica en su
        // paso alternativo); si no la hay, se fusiona en el loop sin pasos alternativos.
        const base = own?.prev ? { ...own, ...own.prev } : existing
        const m = mergeLoops(base, own && !own.prev ? { ...cand, hits: plainHits(cand.hits) } : cand)
        // nada nuevo que añadir: el loop sigue tal cual (sin caída ni reevaluación)
        if (own ? sameHits(m.hits, own.hits) : m.added === 0) continue
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
  // la melodía de la frase (spec 002): un solo loop 'mel' por célula, que sustituye o completa como la batería
  if (phrase.melody?.length) {
    const cand = {
      instrument: 'mel' as const,
      bars: phrase.bars,
      phaseBar: phrase.startBar - (o.cellStart ?? 0),
      muted: false,
      bornAt: o.bornAt,
      fromTemplate: false,
      hits: phrase.melody,
    }
    const own = o.amend ? loops.find((l) => l.instrument === 'mel' && l.bornAt === o.bornAt) : undefined
    const existing = own ?? newestOf('mel')
    const asMel = (hits: LoopHit[]) => hits as MelodyHit[]
    if (existing) {
      let loop: FreeLoop | null = null
      if (repeat === 'complete') {
        const base = own?.prev ? { ...own, ...own.prev } : existing
        const m = mergeMelody({ ...base, hits: asMel(base.hits) }, cand)
        if (!(own ? sameMelody(m.hits, asMel(own.hits)) : m.added === 0)) {
          const prev = own ? existing.prev : existing.muted ? undefined : { hits: existing.hits, bars: existing.bars, phaseBar: existing.phaseBar }
          loop = { ...existing, bars: m.bars, phaseBar: m.phaseBar, hits: m.hits, muted: false, bornAt: o.bornAt, fromTemplate: false, ...(prev ? { prev } : {}) }
          if (!prev) delete loop.prev
          events.push({ type: 'completed', loop, added: m.added })
        }
      } else {
        const prev = own ? existing.prev : existing.muted ? undefined : { hits: existing.hits, bars: existing.bars, phaseBar: existing.phaseBar }
        loop = { ...cand, id: existing.id, muted: own ? existing.muted : false, ...(prev ? { prev } : {}) }
        events.push({ type: 'replaced', loop })
      }
      if (loop) {
        const done = loop
        loops = loops.map((l) => (l.id === existing.id ? done : l))
      }
    } else {
      if (loops.length >= MAX_LOOPS) {
        const byAge = [...loops].sort((a, b) => a.bornAt - b.bornAt || a.id - b.id)
        const victim = byAge.find((l) => l.muted) ?? byAge[0]!
        loops = loops.filter((l) => l.id !== victim.id)
        events.push({ type: 'removed', id: victim.id, reason: 'limit' })
      }
      const loop: FreeLoop = { ...cand, id: nextId++ }
      loops.push(loop)
      events.push({ type: 'born', loop })
    }
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

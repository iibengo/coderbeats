import type { MelodyHit } from './melody'
import type { Instrument } from './types'

export type LoopLength = 1 | 2 | 4

export interface PhraseHit {
  /** tiempo de contexto ya corregido de latencia */
  tCorr: number
  /** `'mel'`: una nota de la melodía con la voz (spec 002); solo cuenta como actividad de la frase */
  instrument: Instrument | 'mel'
  strength: number
  confidence: number
}

export interface PhraseTiming {
  /** tiempo de contexto del compás global 0 */
  anchor: number
  stepSeconds: number
}

export interface PhraseOptions {
  /** silencio (en tiempos) antes de una línea de compás que cierra la frase */
  closeBeats: 1 | 2 | 4
  maxBars: LoopLength
}

export interface ClosedPhrase {
  startBar: number
  /** compases que ocupó (endBar - startBar) */
  spanBars: number
  /** longitud del loop: span redondeado hacia arriba a 1, 2 o 4 (y ≤ maxBars) */
  bars: LoopLength
  hits: (PhraseHit & { globalStep: number })[]
  /** la melodía ya pasada por la ayuda, si la frase tiene (la rellena el motor al nacer; spec 002, §8) */
  melody?: MelodyHit[]
}

/**
 * Primera línea de compás en la que se cerraría la frase si no hubiera más golpes:
 * ⌈(último paso + tiempos de cierre × 4) / 16⌉, como mínimo inicio + 1 y como mucho inicio + máximo.
 */
export function expectedCloseBar(startBar: number, lastStep: number, o: PhraseOptions): number {
  const bySilence = Math.ceil((lastStep + o.closeBeats * 4) / 16)
  return Math.min(startBar + o.maxBars, Math.max(startBar + 1, bySilence))
}

export interface PhraseSnapshot {
  startBar: number
  hits: { instrument: Instrument | 'mel'; globalStep: number }[]
  closeBar: number
}

export const roundUpLength = (span: number, max: LoopLength): LoopLength => {
  const l: LoopLength = span <= 1 ? 1 : span <= 2 ? 2 : 4
  return Math.min(l, max) as LoopLength
}

/**
 * Agrupa golpes en frases por compases. Se le pasan golpes con `add` y, poco antes de cada
 * línea de compás B, se llama `decide(B)`: si tras el inicio de los últimos `closeBeats` tiempos
 * antes de B no hay golpes nuevos (o se llegó a `maxBars`), la frase se cierra y se devuelve.
 */
export interface AddResult {
  /** frase cerrada por pasar del máximo de compases */
  closed?: ClosedPhrase
  /**
   * La frase ya cerrada, enmendada con un golpe que llegó tarde: se decide ~0,3 s antes de la
   * línea de compás, y un golpe hecho en ese margen se detecta después (§16.15).
   */
  amended?: ClosedPhrase
}

export class PhraseTracker {
  private hits: (PhraseHit & { globalStep: number })[] = []
  private startBar: number | null = null
  /** última frase cerrada y la línea de compás en la que se cerró */
  private last: { phrase: ClosedPhrase; endBar: number } | null = null

  constructor(
    private timing: PhraseTiming,
    private opts: PhraseOptions,
  ) {}

  /** Paso global (decimal) de un tiempo. */
  globalStep(tCorr: number): number {
    return (tCorr - this.timing.anchor) / this.timing.stepSeconds
  }

  /** Compás al que pertenece un golpe: el de su semicorchea más cercana (adelantado al 1 → compás siguiente). */
  barOf(tCorr: number): number {
    return Math.floor(Math.round(this.globalStep(tCorr)) / 16)
  }

  get open(): boolean {
    return this.startBar !== null
  }

  /**
   * Añade un golpe. Si cae más allá de `maxBars` desde el inicio, cierra la frase actual.
   * Si pertenece a un compás de la última frase ya cerrada, la enmienda.
   */
  add(hit: PhraseHit): AddResult {
    const bar = this.barOf(hit.tCorr)
    const h = { ...hit, globalStep: this.globalStep(hit.tCorr) }
    if (this.startBar === null && this.last && bar >= this.last.phrase.startBar && bar < this.last.endBar) {
      const p = this.last.phrase
      const hits = [...p.hits, h]
      const lastBar = Math.floor(Math.max(...hits.map((x) => Math.round(x.globalStep))) / 16)
      const spanBars = lastBar - p.startBar + 1
      const amended = { ...p, hits, spanBars, bars: roundUpLength(spanBars, this.opts.maxBars) }
      this.last = { phrase: amended, endBar: this.last.endBar }
      return { amended }
    }
    const out: AddResult = {}
    if (this.startBar !== null && bar >= this.startBar + this.opts.maxBars) {
      const closed = this.close(this.startBar + this.opts.maxBars)
      if (closed) out.closed = closed
    }
    if (this.startBar === null) this.startBar = bar
    if (bar < this.startBar) return out // golpe de un compás anterior ya cerrado hace tiempo: se ignora
    this.hits.push(h)
    return out
  }

  /** Frase en curso (para la UI): inicio, golpes y compás en el que nacería. */
  snapshot(): PhraseSnapshot | null {
    if (this.startBar === null || !this.hits.length) return null
    const lastStep = Math.max(...this.hits.map((h) => Math.round(h.globalStep)))
    return {
      startBar: this.startBar,
      hits: this.hits.map((h) => ({ instrument: h.instrument, globalStep: h.globalStep })),
      closeBar: expectedCloseBar(this.startBar, lastStep, this.opts),
    }
  }

  /** Decide el cierre en la línea de compás `bar` con los golpes conocidos. */
  decide(bar: number): ClosedPhrase | null {
    if (this.startBar === null || bar <= this.startBar) return null
    if (bar - this.startBar >= this.opts.maxBars) return this.close(bar)
    const lastStep = Math.max(...this.hits.map((h) => Math.round(h.globalStep)))
    // cierra si el último golpe está en (o antes de) el inicio de los últimos `closeBeats` tiempos:
    // "bombo en 1 y 3" deja 2 tiempos sonando sin nada nuevo → cierra
    const silenceFrom = bar * 16 - this.opts.closeBeats * 4
    return lastStep <= silenceFrom ? this.close(bar) : null
  }

  private close(endBar: number): ClosedPhrase | null {
    const startBar = this.startBar
    this.startBar = null
    if (startBar === null) return null
    const inside = this.hits.filter((h) => Math.round(h.globalStep) < endBar * 16)
    this.hits = this.hits.filter((h) => Math.round(h.globalStep) >= endBar * 16)
    if (this.hits.length) this.startBar = endBar
    if (!inside.length) return null
    const lastBar = Math.floor(Math.max(...inside.map((h) => Math.round(h.globalStep))) / 16)
    const spanBars = lastBar - startBar + 1
    const phrase = { startBar, spanBars, bars: roundUpLength(spanBars, this.opts.maxBars), hits: inside }
    this.last = { phrase, endBar }
    return phrase
  }

  reset(timing?: PhraseTiming) {
    if (timing) this.timing = timing
    this.hits = []
    this.startBar = null
    this.last = null
  }
}

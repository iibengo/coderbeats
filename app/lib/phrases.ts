import type { Instrument } from './types'

export type LoopLength = 1 | 2 | 4

export interface PhraseHit {
  /** tiempo de contexto ya corregido de latencia */
  tCorr: number
  instrument: Instrument
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
export class PhraseTracker {
  private hits: (PhraseHit & { globalStep: number })[] = []
  private startBar: number | null = null

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

  /** Añade un golpe. Si cae más allá de `maxBars` desde el inicio, cierra la frase actual y la devuelve. */
  add(hit: PhraseHit): ClosedPhrase | null {
    const bar = this.barOf(hit.tCorr)
    let closed: ClosedPhrase | null = null
    if (this.startBar !== null && bar >= this.startBar + this.opts.maxBars) closed = this.close(this.startBar + this.opts.maxBars)
    if (this.startBar === null) this.startBar = bar
    if (bar < this.startBar) return closed // golpe de un compás ya cerrado: se ignora
    this.hits.push({ ...hit, globalStep: this.globalStep(hit.tCorr) })
    return closed
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
    return { startBar, spanBars, bars: roundUpLength(spanBars, this.opts.maxBars), hits: inside }
  }

  reset(timing?: PhraseTiming) {
    if (timing) this.timing = timing
    this.hits = []
    this.startBar = null
  }
}

import type { ClassifiedHit, Pattern, Step } from './types'

export interface QuantizeOptions {
  /** tiempo (s, en la misma escala que los onsets) del primer tiempo del compás 1 */
  t0: number
  /** latencia de ida y vuelta a restar, en segundos */
  latency: number
  /** duración de una semicorchea, en segundos */
  stepSeconds: number
  bars: number
}

export function emptyPattern(bars: number): Pattern {
  return {
    stepsPerBar: 16,
    bars,
    steps: new Array<Step>(bars * 16).fill(null),
    offsetsMs: new Array<number | null>(bars * 16).fill(null),
  }
}

export function quantize(hits: ClassifiedHit[], o: QuantizeOptions): Pattern {
  const pattern = emptyPattern(o.bars)
  const total = o.bars * 16
  const score = new Array<number>(total).fill(-Infinity)

  for (const hit of hits) {
    if (hit.instrument === 'unknown') continue
    const rel = hit.onset.time - o.latency - o.t0
    const step = Math.round(rel / o.stepSeconds)
    if (step < 0 || step >= total) continue
    const s = hit.onset.strength * hit.confidence
    if (s <= score[step]!) continue
    score[step] = s
    pattern.steps[step] = hit.instrument
    pattern.offsetsMs[step] = (rel - step * o.stepSeconds) * 1000
  }
  return pattern
}

export const hitCount = (p: Pattern): number => p.steps.filter((s) => s !== null).length

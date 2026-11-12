import type { Pattern, Step } from './types'

export interface StrudelOptions {
  bpm: number
  bank: string
}

const barTokens = (steps: Step[]): string => steps.map((s) => s ?? '~').join(' ')

/** Menor periodo (divisor del nº de compases) con el que se repiten los compases. */
function period(bars: string[]): number {
  for (let p = 1; p < bars.length; p++) {
    if (bars.length % p !== 0) continue
    if (bars.every((b, i) => b === bars[i % p])) return p
  }
  return bars.length
}

export function patternToMini(pattern: Pattern): string {
  const bars: string[] = []
  for (let b = 0; b < pattern.bars; b++)
    bars.push(barTokens(pattern.steps.slice(b * pattern.stepsPerBar, (b + 1) * pattern.stepsPerBar)))
  const unique = bars.slice(0, period(bars))
  if (unique.length === 1) return unique[0]!
  return `<${unique.map((b) => `[${b}]`).join(' ')}>`
}

export function generateStrudel(pattern: Pattern, o: StrudelOptions): string {
  return [`setcpm(${o.bpm}/4)`, `s("${patternToMini(pattern)}")`, `  .bank("${o.bank}")`].join('\n')
}

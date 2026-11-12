import type { Pattern } from './types'

/** Menor periodo (divisor del nº de compases) con el que se repiten los compases. */
function period(bars: string[]): number {
  for (let p = 1; p < bars.length; p++) {
    if (bars.length % p !== 0) continue
    if (bars.every((b, i) => b === bars[i % p])) return p
  }
  return bars.length
}

/** Tokens (16 por compás) → mini-notación, colapsando compases repetidos. */
export function tokensToMini(tokens: string[], stepsPerBar = 16): string {
  const bars: string[] = []
  for (let i = 0; i < tokens.length; i += stepsPerBar) bars.push(tokens.slice(i, i + stepsPerBar).join(' '))
  const unique = bars.slice(0, period(bars))
  if (unique.length === 1) return unique[0]!
  return `<${unique.map((b) => `[${b}]`).join(' ')}>`
}

export const patternToMini = (pattern: Pattern): string =>
  tokensToMini(pattern.steps.map((s) => s ?? '~'), pattern.stepsPerBar)

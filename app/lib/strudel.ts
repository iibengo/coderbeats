import { stepsOf, type Loop } from './looper'
import type { Instrument, Pattern } from './types'

export interface StrudelOptions {
  bpm: number
  bank: string
}

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

/** Instrumentos presentes en el loop, en orden bd, sd, hh. */
export function loopInstruments(loop: Loop): Instrument[] {
  const steps = stepsOf(loop)
  return (['bd', 'sd', 'hh'] as const).filter((i) => steps.some((s) => s.includes(i)))
}

/** Mini-notación de un instrumento del loop. */
export function instrumentMini(loop: Loop, inst: Instrument): string {
  return tokensToMini(stepsOf(loop).map((s) => (s.includes(inst) ? inst : '~')), loop.stepsPerBar)
}

/**
 * Código Strudel del loop: una línea por instrumento dentro de stack();
 * sin stack si solo hay uno; un compás de silencios si está vacío.
 */
export function loopToStrudel(loop: Loop, o: StrudelOptions): string {
  const head = `setcpm(${o.bpm}/4)`
  const insts = loopInstruments(loop)
  const bank = `.bank("${o.bank}")`
  if (insts.length === 0) return `${head}\ns("${Array(16).fill('~').join(' ')}")`
  if (insts.length === 1) return `${head}\ns("${instrumentMini(loop, insts[0]!)}")${bank}`
  const lines = insts.map((i) => `  s("${instrumentMini(loop, i)}"),`)
  return [head, 'stack(', ...lines, `)${bank}`].join('\n')
}

/**
 * Acierto de una secuencia de clases contra un patrón repetido («bum pff ts» una y otra vez), sin necesitar la etiqueta de cada golpe: se alinean con la **subsecuencia
 * común más larga**. Sirve para medir con las tomas del laboratorio, donde solo se sabe qué se intentó decir y no dónde cae cada golpe.
 *   - precisión = lo alineado / lo que dijo el modelo (penaliza golpes de más y errores)
 *   - cobertura = lo alineado / lo esperado (penaliza golpes que no vio)
 * Puro.
 */
export function lcsLength<T>(a: readonly T[], b: readonly T[]): number {
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1]! + 1 : Math.max(prev[j]!, cur[j - 1]!)
    prev = cur
  }
  return prev[b.length]!
}

export interface SequenceScore {
  precision: number
  coverage: number
  aligned: number
}

/** Puntúa lo `predicted` contra `expected` (la secuencia esperada completa, p. ej. el patrón repetido). */
export function sequenceScore<T>(predicted: readonly T[], expected: readonly T[]): SequenceScore {
  const aligned = lcsLength(predicted, expected)
  return { aligned, precision: predicted.length ? aligned / predicted.length : 0, coverage: expected.length ? aligned / expected.length : 0 }
}

/** El patrón «bum pff ts» repetido `n` veces, como clases. */
export const repeatPattern = <T>(pattern: readonly T[], n: number): T[] => Array.from({ length: n * pattern.length }, (_, i) => pattern[i % pattern.length]!)

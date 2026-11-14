/** Notas esperadas de una toma del laboratorio y su comparación con las detectadas (spec 002, §9). Puro. */
import type { Note } from './notes'

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

export interface Expected {
  midi: number
  /** semicorcheas desde el inicio de la toma (tras la cuenta atrás), si se escribió `@n` */
  step?: number
}

/** "A3 C4@4 bb3 F#2" → notas. Devuelve null si algo no se entiende. */
export function parseExpected(text: string): Expected[] | null {
  const out: Expected[] = []
  for (const tok of text.trim().split(/[\s,]+/).filter(Boolean)) {
    const m = /^([a-gA-G])([#b♯♭]?)(-?\d)(?:@(\d+(?:\.\d+)?))?$/.exec(tok)
    if (!m) return null
    const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0
    const midi = 12 * (Number(m[3]) + 1) + PC[m[1]!.toLowerCase()]! + acc
    out.push({ midi, ...(m[4] !== undefined ? { step: Number(m[4]) } : {}) })
  }
  return out
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const midiName = (m: number): string => `${NAMES[((Math.round(m) % 12) + 12) % 12]}${Math.floor(Math.round(m) / 12) - 1}`

export interface Match {
  expected: number
  detected: number
  /** misma clase de altura (do, re…), en cualquier octava */
  pitchClass: boolean
  /** misma nota exacta */
  exact: boolean
  /** error de inicio en semicorcheas, si había `@n` */
  startError?: number
}

export interface Score {
  matches: Match[]
  missed: number[]
  extra: number[]
  /** proporción de notas esperadas con la clase de altura correcta */
  pitchClassRate: number
  exactRate: number
  /** proporción con el inicio a ≤ 1 semicorchea (solo las que llevaban `@n`); null si ninguna */
  startRate: number | null
}

/**
 * Alinea en orden las notas esperadas con las detectadas (programación dinámica tipo Levenshtein: emparejar
 * con la misma clase de altura cuesta 0, con otra 1; saltarse una nota cuesta 1) y cuenta aciertos.
 * `stepSec` y `t0` (s) pasan los tiempos detectados a semicorcheas para comparar los inicios.
 */
export function scoreNotes(expected: Expected[], detected: Note[], stepSec = 0, t0 = 0): Score {
  const n = expected.length
  const m = detected.length
  const pc = (a: number, b: number) => (((Math.round(a) - Math.round(b)) % 12) + 12) % 12 === 0
  const cost = (i: number, j: number) => (pc(expected[i]!.midi, detected[j]!.midi) ? 0 : 1)
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 1; i <= n; i++) d[i]![0] = i
  for (let j = 1; j <= m; j++) d[0]![j] = j
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i]![j] = Math.min(d[i - 1]![j - 1]! + cost(i - 1, j - 1), d[i - 1]![j]! + 1, d[i]![j - 1]! + 1)
  const matches: Match[] = []
  const missed: number[] = []
  const extra: number[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + cost(i - 1, j - 1)) {
      const e = expected[i - 1]!
      const x = detected[j - 1]!
      const match: Match = {
        expected: i - 1,
        detected: j - 1,
        pitchClass: pc(e.midi, x.midi),
        exact: Math.round(x.midi) === e.midi,
      }
      if (e.step !== undefined && stepSec > 0) match.startError = Math.abs((x.start - t0) / stepSec - e.step)
      matches.push(match)
      i--
      j--
    } else if (i > 0 && d[i]![j] === d[i - 1]![j]! + 1) {
      missed.push(i - 1)
      i--
    } else {
      extra.push(j - 1)
      j--
    }
  }
  matches.reverse()
  missed.reverse()
  extra.reverse()
  const timed = matches.filter((x) => x.startError !== undefined)
  return {
    matches,
    missed,
    extra,
    pitchClassRate: n ? matches.filter((x) => x.pitchClass).length / n : 0,
    exactRate: n ? matches.filter((x) => x.exact).length / n : 0,
    startRate: timed.length ? timed.filter((x) => x.startError! <= 1).length / timed.length : null,
  }
}

import { describe, expect, it } from 'vitest'
import { emptyPattern } from '../../app/lib/quantize'
import { patternToMini, tokensToMini } from '../../app/lib/strudel'
import type { Pattern, Step } from '../../app/lib/types'

const bar = (s: string): Step[] => s.split(' ').map((t) => (t === '~' ? null : (t as Step)))
const A = 'bd ~ ~ ~ sd ~ ~ ~ bd ~ bd ~ sd ~ ~ ~'
const B = 'bd ~ ~ ~ sd ~ ~ hh bd ~ bd ~ sd ~ hh ~'
const C = 'bd ~ hh ~ sd ~ hh ~ bd ~ hh ~ sd ~ hh ~'
const EMPTY = Array(16).fill('~').join(' ')

function pattern(...bars: string[]): Pattern {
  const p = emptyPattern(bars.length)
  p.steps = bars.flatMap(bar)
  return p
}

describe('tokensToMini / patternToMini', () => {
  it('compases iguales → uno solo sin < >', () => {
    expect(patternToMini(pattern(A, A, A, A))).toBe(A)
  })
  it('A B A B → <[A] [B]>', () => {
    expect(patternToMini(pattern(A, B, A, B))).toBe(`<[${A}] [${B}]>`)
  })
  it('compases distintos → todos', () => {
    expect(patternToMini(pattern(A, B, C, A))).toBe(`<[${A}] [${B}] [${C}] [${A}]>`)
  })
  it('compás vacío → 16 silencios', () => {
    expect(tokensToMini(Array(32).fill('~'))).toBe(EMPTY)
  })
})

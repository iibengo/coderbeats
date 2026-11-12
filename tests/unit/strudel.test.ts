import { describe, expect, it } from 'vitest'
import { emptyPattern } from '../../app/lib/quantize'
import { generateStrudel, patternToMini } from '../../app/lib/strudel'
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

describe('patternToMini', () => {
  it('4 compases iguales → un solo compás sin < >', () => {
    expect(patternToMini(pattern(A, A, A, A))).toBe(A)
  })

  it('A B A B → <[A] [B]>', () => {
    expect(patternToMini(pattern(A, B, A, B))).toBe(`<[${A}] [${B}]>`)
  })

  it('4 compases distintos → los 4', () => {
    expect(patternToMini(pattern(A, B, C, A))).toBe(`<[${A}] [${B}] [${C}] [${A}]>`)
  })

  it('compás vacío → 16 silencios', () => {
    expect(patternToMini(emptyPattern(4))).toBe(EMPTY)
    expect(patternToMini(pattern(A, EMPTY, A, EMPTY))).toBe(`<[${A}] [${EMPTY}]>`)
  })
})

describe('generateStrudel', () => {
  it('ejemplo completo con setcpm y bank', () => {
    expect(generateStrudel(pattern(A, B, A, B), { bpm: 90, bank: 'RolandTR909' })).toBe(
      `setcpm(90/4)\ns("<[${A}] [${B}]>")\n  .bank("RolandTR909")`,
    )
  })

  it('setcpm según el tempo del estilo', () => {
    expect(generateStrudel(pattern(A), { bpm: 174, bank: 'AkaiMPC60' })).toMatch(/^setcpm\(174\/4\)/)
  })
})

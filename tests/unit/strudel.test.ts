import { describe, expect, it } from 'vitest'
import { addHit, emptyLoop, type Loop, type LoopBars } from '../../app/lib/looper'
import { emptyPattern } from '../../app/lib/quantize'
import { loopToStrudel, patternToMini, tokensToMini } from '../../app/lib/strudel'
import type { Instrument, Pattern, Step } from '../../app/lib/types'

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

/** Loop con los golpes dados como [paso, instrumento, vuelta]. */
function loopOf(bars: LoopBars, hits: [number, Instrument, number?][]): Loop {
  let loop = emptyLoop(bars)
  for (const [step, instrument, lap = 0] of hits)
    loop = addHit(loop, {
      placement: { lap, quantizedLap: lap, step, offsetMs: 0 },
      instrument,
      strength: 1,
      confidence: 1,
    }).loop
  return loop
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

describe('loopToStrudel', () => {
  const o = { bpm: 90, bank: 'RolandTR909' }

  it('una línea por instrumento dentro de stack()', () => {
    const loop = loopOf(1, [
      [0, 'bd'],
      [8, 'bd'],
      [10, 'bd'],
      [4, 'sd'],
      [12, 'sd'],
      ...[0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, 'hh', 1] as [number, Instrument, number]),
    ])
    expect(loopToStrudel(loop, o)).toBe(
      [
        'setcpm(90/4)',
        'stack(',
        '  s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~"),',
        '  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~"),',
        '  s("hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~"),',
        ').bank("RolandTR909")',
      ].join('\n'),
    )
  })

  it('un solo instrumento → sin stack', () => {
    expect(loopToStrudel(loopOf(1, [[0, 'bd']]), o)).toBe(
      'setcpm(90/4)\ns("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~").bank("RolandTR909")',
    )
  })

  it('loop vacío → un compás de silencios', () => {
    expect(loopToStrudel(emptyLoop(), o)).toBe(`setcpm(90/4)\ns("${EMPTY}")`)
  })

  it('2 compases: <[c1] [c2]> por línea, colapsado si son iguales', () => {
    const loop = loopOf(2, [
      [0, 'bd'],
      [16, 'bd'],
      [4, 'sd'],
      [22, 'sd'],
    ])
    const code = loopToStrudel(loop, { bpm: 174, bank: 'AkaiMPC60' })
    expect(code).toContain('setcpm(174/4)')
    expect(code).toContain('  s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~"),')
    expect(code).toContain('  s("<[~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~] [~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~]>"),')
    expect(code).toMatch(/\)\.bank\("AkaiMPC60"\)$/)
  })
})

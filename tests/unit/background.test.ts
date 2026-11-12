import { describe, expect, it } from 'vitest'
import { planTransitions, rampBars, targetParts } from '../../app/lib/background'

describe('targetParts', () => {
  it('progresivo: bajo con 2 loops activos, acordes con 3 o más', () => {
    expect([0, 1, 2, 3, 5].map((n) => targetParts(n, 'progressive'))).toEqual([
      { bass: false, chords: false },
      { bass: false, chords: false },
      { bass: true, chords: false },
      { bass: true, chords: true },
      { bass: true, chords: true },
    ])
  })
  it('manual: suena exactamente lo elegido, sin importar los loops', () => {
    expect(targetParts(0, 'manual', { bass: true, chords: false })).toEqual({ bass: true, chords: false })
    expect(targetParts(6, 'manual', { bass: false, chords: true })).toEqual({ bass: false, chords: true })
    expect(targetParts(6, 'manual')).toEqual({ bass: false, chords: false })
  })
  it('completo y sin fondo', () => {
    expect(targetParts(0, 'full')).toEqual({ bass: true, chords: true })
    expect(targetParts(8, 'off')).toEqual({ bass: false, chords: false })
  })
})

describe('planTransitions', () => {
  const off = { bass: false, chords: false }
  const bass = { bass: true, chords: false }
  const all = { bass: true, chords: true }

  it('entra el bajo en la línea de compás indicada', () => {
    expect(planTransitions(off, bass, 7, 'house')).toEqual([{ part: 'bass', dir: 'in', bar: 7, bars: 1 }])
  })

  it('entran las dos: bajo y después acordes (dnb: 2 compases cada una)', () => {
    expect(planTransitions(off, all, 4, 'dnb')).toEqual([
      { part: 'bass', dir: 'in', bar: 4, bars: 2 },
      { part: 'chords', dir: 'in', bar: 6, bars: 2 },
    ])
  })

  it('se retiran en orden inverso: acordes y después bajo', () => {
    expect(planTransitions(all, off, 10, 'hiphop90')).toEqual([
      { part: 'chords', dir: 'out', bar: 10, bars: 1 },
      { part: 'bass', dir: 'out', bar: 11, bars: 1 },
    ])
  })

  it('manual (sin escalonar): las dos entran en el mismo compás', () => {
    expect(planTransitions(off, all, 4, 'dnb', false)).toEqual([
      { part: 'bass', dir: 'in', bar: 4, bars: 2 },
      { part: 'chords', dir: 'in', bar: 4, bars: 2 },
    ])
  })

  it('sin cambios, sin transiciones', () => {
    expect(planTransitions(bass, bass, 3, 'dnb')).toEqual([])
  })

  it('rampBars por estilo', () => {
    expect([rampBars('hiphop90'), rampBars('house'), rampBars('dnb')]).toEqual([1, 1, 2])
  })
})

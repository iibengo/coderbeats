import { describe, expect, it } from 'vitest'
import { demoState } from '../../app/lib/demos'
import { DEMO_DEMBOW, outcomeOf } from '../../app/lib/pilotScripts'

describe('guion del piloto: demo de dembow (spec 009 §7)', () => {
  it('lo que construye es lo que declara', () => {
    expect(outcomeOf(DEMO_DEMBOW)).toEqual(DEMO_DEMBOW.final)
  })
  it('y es la célula Principal de la demo de dembow: mismos golpes por instrumento', () => {
    const demo = demoState('dembow', 1, 0)
    for (const l of demo.loops) {
      const steps = l.hits.map((h) => Math.round(h.pos)).sort((a, b) => a - b)
      expect(DEMO_DEMBOW.final.loops[l.instrument], l.instrument).toEqual(steps)
    }
    expect(Object.keys(DEMO_DEMBOW.final.loops).sort()).toEqual(demo.loops.map((l) => l.instrument).sort())
  })
  it('empieza dando a Play y los pasos de la boca llevan sílaba', () => {
    expect(DEMO_DEMBOW.steps.find((s) => s.do === 'tap')).toEqual({ do: 'tap', on: { t: 'play' } })
    for (const s of DEMO_DEMBOW.steps) if (s.do === 'mouth') expect(s.says.length).toBeGreaterThan(0)
  })
})

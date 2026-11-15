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

import { checkOutcome, correctLoops } from '../../app/lib/pilotScripts'

describe('el piloto es estricto: lo construido es idéntico a la demo', () => {
  const parts = { bass: true, chords: true }
  it('la demo cuadra con el guion', () => {
    expect(checkOutcome(demoState('dembow', 1, 0), parts, DEMO_DEMBOW.final).ok).toBe(true)
  })
  it('un golpe de más, movido, un loop de más o el fondo distinto no cuadran', () => {
    const base = demoState('dembow', 1, 0)
    const bd = base.loops.find((l) => l.instrument === 'bd')!
    expect(checkOutcome({ ...base, loops: base.loops.map((l) => (l === bd ? { ...l, hits: [...l.hits, { pos: 11, strength: 1 }] } : l)) }, parts, DEMO_DEMBOW.final).ok).toBe(false)
    expect(checkOutcome({ ...base, loops: base.loops.map((l) => (l === bd ? { ...l, hits: l.hits.map((h) => ({ ...h, pos: h.pos + 0.3 })) } : l)) }, parts, DEMO_DEMBOW.final).ok).toBe(false)
    expect(checkOutcome({ ...base, loops: [...base.loops, { ...bd, id: 9, instrument: 'mel' }] }, parts, DEMO_DEMBOW.final).ok).toBe(false)
    expect(checkOutcome(base, { bass: false, chords: true }, DEMO_DEMBOW.final).ok).toBe(false)
  })
  it('correctLoops deja siempre exactamente la demo, venga lo que venga', () => {
    const dirty = { loops: [{ ...demoState('dembow', 5, 3).loops[0]!, hits: [{ pos: 2.4, strength: 1 }] }, { ...demoState('dembow', 8, 3).loops[0]!, id: 8, instrument: 'mel' as const }], nextId: 9 }
    const fixed = correctLoops(dirty, DEMO_DEMBOW.final, 4)
    expect(checkOutcome(fixed, parts, DEMO_DEMBOW.final).ok).toBe(true)
    expect(new Set(fixed.loops.map((l) => l.id)).size).toBe(fixed.loops.length)
    expect(fixed.nextId).toBeGreaterThan(Math.max(...fixed.loops.map((l) => l.id)))
  })
})

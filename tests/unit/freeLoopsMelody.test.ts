import { describe, expect, it } from 'vitest'
import { addPhrase, candidatesFromPhrase, emptyLoops, MAX_LOOPS, type BirthOptions } from '../../app/lib/freeLoops'
import { mergeMelody, type MelodyHit } from '../../app/lib/melody'
import type { ClosedPhrase } from '../../app/lib/phrases'

const o = (x: Partial<BirthOptions> = {}): BirthOptions => ({ assist: true, style: 'hiphop90', quantizeEvery: 1, bornAt: 4, ...x })
const m = (pos: number, dur: number, midi: number): MelodyHit => ({ pos, dur, midi, strength: 0.5 })
const phrase = (o2: Partial<ClosedPhrase> & { melody?: MelodyHit[] }, hits: ClosedPhrase['hits'] = []): ClosedPhrase => ({
  startBar: 3, spanBars: 1, bars: 1, hits, ...o2,
})
const melHit = (step: number) => ({ tCorr: 0, instrument: 'mel' as const, strength: 0.5, confidence: 1, globalStep: step })
const bdHit = (step: number) => ({ tCorr: 0, instrument: 'bd' as const, strength: 0.5, confidence: 0.9, globalStep: step })

describe('loops de melodía a partir de una frase', () => {
  it('nace un loop mel con la fase de la frase y el nacimiento en la línea de compás', () => {
    const r = addPhrase(emptyLoops(), phrase({ melody: [m(0, 4, 57), m(8, 4, 60)] }, [melHit(48)]), o())
    expect(r.events.map((e) => e.type)).toEqual(['born'])
    expect(r.state.loops).toHaveLength(1)
    expect(r.state.loops[0]).toMatchObject({ instrument: 'mel', bars: 1, phaseBar: 3, bornAt: 4, muted: false, fromTemplate: false })
    expect(r.state.loops[0]!.hits.map((h) => [h.pos, h.dur, h.midi])).toEqual([[0, 4, 57], [8, 4, 60]])
  })

  it('con el inicio de la célula, la fase es relativa a ella', () => {
    const r = addPhrase(emptyLoops(), phrase({ startBar: 10, melody: [m(0, 2, 57)] }), o({ cellStart: 8 }))
    expect(r.state.loops[0]!.phaseBar).toBe(2)
  })

  it('los golpes de melodía no crean loops de batería, y la batería de la misma frase nace aparte', () => {
    const p = phrase({ melody: [m(0, 4, 57)] }, [melHit(48), bdHit(48), bdHit(56)])
    expect(candidatesFromPhrase(p, o()).map((c) => c.instrument)).toEqual(['bd'])
    const r = addPhrase(emptyLoops(), p, o())
    expect(r.state.loops.map((l) => l.instrument).sort()).toEqual(['bd', 'mel'])
  })

  it('sin notas, no hay loop de melodía (la frase solo de "na" sin resultado no crea nada)', () => {
    const r = addPhrase(emptyLoops(), phrase({ melody: [] }, [melHit(48)]), o())
    expect(r.state.loops).toEqual([])
    expect(r.events).toEqual([])
  })

  it('sustituye: la nueva reemplaza, con la versión anterior hasta el nacimiento', () => {
    const first = addPhrase(emptyLoops(), phrase({ melody: [m(0, 4, 57)] }), o({ bornAt: 2 })).state
    const r = addPhrase(first, phrase({ startBar: 5, melody: [m(4, 4, 64)] }), o({ bornAt: 6, repeat: 'replace' }))
    expect(r.events.map((e) => e.type)).toEqual(['replaced'])
    const l = r.state.loops[0]!
    expect(l.id).toBe(first.loops[0]!.id)
    expect(l.hits.map((h) => h.midi)).toEqual([64])
    expect(l.prev?.hits.map((h) => h.midi)).toEqual([57])
    expect(l.bornAt).toBe(6)
  })

  it('completa: solo entran notas en huecos libres, y si empieza dentro de una existente se descarta', () => {
    const first = addPhrase(emptyLoops(), phrase({ melody: [m(0, 4, 57), m(8, 4, 60)] }), o({ bornAt: 2 })).state
    const r = addPhrase(first, phrase({ melody: [m(2, 2, 71), m(5, 2, 64), m(12, 4, 67)] }), o({ bornAt: 6, repeat: 'complete' }))
    expect(r.events.map((e) => e.type)).toEqual(['completed'])
    const l = r.state.loops[0]!
    // 2 cae dentro de la nota de 0–4: se descarta; 5 y 12 son huecos libres
    expect(l.hits.map((h) => [h.pos, h.midi])).toEqual([[0, 57], [5, 64], [8, 60], [12, 67]])
    expect(l.prev?.hits).toHaveLength(2)
    expect((r.events[0] as { added: number }).added).toBe(2)
  })

  it('completa sin nada nuevo: el loop sigue igual y no hay evento', () => {
    const first = addPhrase(emptyLoops(), phrase({ melody: [m(0, 8, 57)] }), o({ bornAt: 2 })).state
    const r = addPhrase(first, phrase({ melody: [m(0, 2, 60), m(4, 2, 64)] }), o({ bornAt: 6, repeat: 'complete' }))
    expect(r.events).toEqual([])
    expect(r.state.loops[0]).toEqual(first.loops[0])
  })

  it('enmienda: se rehace en su sitio, con el mismo id y la misma versión previa', () => {
    const first = addPhrase(emptyLoops(), phrase({ melody: [m(0, 4, 57)] }), o({ bornAt: 2 })).state
    const born = addPhrase(first, phrase({ startBar: 5, melody: [m(0, 4, 60)] }), o({ bornAt: 6, repeat: 'replace' })).state
    const am = addPhrase(born, phrase({ startBar: 5, melody: [m(0, 4, 60), m(8, 4, 64)] }), o({ bornAt: 6, repeat: 'replace', amend: true }))
    expect(am.state.loops).toHaveLength(1)
    expect(am.state.loops[0]!.id).toBe(born.loops[0]!.id)
    expect(am.state.loops[0]!.hits.map((h) => h.midi)).toEqual([60, 64])
    expect(am.state.loops[0]!.prev?.hits.map((h) => h.midi)).toEqual([57])
  })

  it('en el límite de loops, se retira el más viejo (como la batería)', () => {
    const loops = Array.from({ length: MAX_LOOPS }, (_, i) => ({
      id: i + 1, instrument: (['bd', 'sd', 'hh'] as const)[i % 3]!, bars: 1 as const, phaseBar: 0, hits: [{ pos: 0, strength: 1 }], muted: false, bornAt: i, fromTemplate: false,
    }))
    const r = addPhrase({ loops, nextId: MAX_LOOPS + 1 }, phrase({ melody: [m(0, 4, 57)] }), o({ bornAt: 20 }))
    expect(r.events.map((e) => e.type)).toEqual(['removed', 'born'])
    expect(r.events[0]).toMatchObject({ type: 'removed', id: 1, reason: 'limit' })
    expect(r.state.loops).toHaveLength(MAX_LOOPS)
    expect(r.state.loops.some((l) => l.instrument === 'mel')).toBe(true)
  })
})

describe('mergeMelody', () => {
  const base = { bars: 1 as const, phaseBar: 0, hits: [m(0, 4, 57), m(8, 4, 60)] }
  it('un loop más largo repite el patrón base', () => {
    const r = mergeMelody(base, { bars: 2, phaseBar: 0, hits: [m(20, 4, 64)] })
    expect(r.bars).toBe(2)
    expect(r.hits.map((h) => h.pos)).toEqual([0, 8, 16, 20, 24])
    expect(r.hits.map((h) => h.midi)).toEqual([57, 60, 57, 64, 60])
  })
  it('la fase distinta desplaza la nueva', () => {
    const r = mergeMelody(base, { bars: 1, phaseBar: 1, hits: [m(5, 2, 64)] })
    expect(r.hits.map((h) => h.pos)).toEqual([0, 5, 8].map((x) => x).sort((a, b) => a - b))
  })
  it('una nota nueva se recorta contra la siguiente y contra la línea de compás', () => {
    expect(mergeMelody(base, { bars: 1, phaseBar: 0, hits: [m(5, 6, 64)] }).hits[1]).toMatchObject({ pos: 5, dur: 3 })
    expect(mergeMelody({ ...base, hits: [m(0, 2, 57)] }, { bars: 1, phaseBar: 0, hits: [m(14, 6, 64)] }).hits[1]).toMatchObject({ pos: 14, dur: 2 })
  })
  it('una nota cuyo hueco es demasiado corto no entra', () => {
    expect(mergeMelody({ ...base, hits: [m(0, 4, 57), m(4.1, 4, 60)] }, { bars: 1, phaseBar: 0, hits: [m(4, 1, 64)] }).added).toBe(0)
  })
})

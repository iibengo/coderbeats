import { describe, expect, it } from 'vitest'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { drumStepsOf, MIN_RHYTHM_HITS, sameSuggestion, suggestFor, type SuggestContext } from '../../app/lib/suggestion'

const loop = (id: number, instrument: FreeLoop['instrument'], pos: number[], o: Partial<FreeLoop> = {}): FreeLoop => ({
  id, instrument, bars: 1, phaseBar: 0, hits: pos.map((p) => ({ pos: p, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false, ...o,
})
const base = (o: Partial<SuggestContext> = {}): SuggestContext => ({
  enabled: true, jugar: true, multi: false, style: 'techno', bpm: 128, seeds: new Map(), dismissed: new Set(), voiceHold: false,
  loops: [loop(1, 'bd', [0, 4, 8, 12]), loop(2, 'sd', [4, 12])],
  ...o,
})

describe('cuándo se sugiere (spec 012, §3 y §3.4)', () => {
  it('con un ritmo hecho, la franja vacía, en Jugar y con «Sugerencias» encendido: propone una melodía', () => {
    const s = suggestFor(base())
    expect(s).not.toBeNull()
    expect(s!.hits.length).toBeGreaterThan(0)
    expect(s!.seed).toBe(0)
    expect(s!.style).toBe('techno')
  })
  it('apagado, no se propone nada', () => {
    expect(suggestFor(base({ enabled: false }))).toBeNull()
  })
  it('solo en Jugar y con una sola célula', () => {
    expect(suggestFor(base({ jugar: false }))).toBeNull()
    expect(suggestFor(base({ multi: true }))).toBeNull()
  })
  it('sin ritmo (o con muy pocos golpes) no hay nada que seguir', () => {
    expect(suggestFor(base({ loops: [] }))).toBeNull()
    expect(suggestFor(base({ loops: [loop(1, 'bd', [0, 8])] }))).toBeNull()
    expect(MIN_RHYTHM_HITS).toBe(4)
  })
  it('si la franja de la melodía ya tiene algo (cantado o a mano), no se sugiere', () => {
    expect(suggestFor(base({ loops: [...base().loops, loop(3, 'mel', [0])] }))).toBeNull()
  })
  it('si canta, manda su voz: no se sugiere mientras haya voz', () => {
    expect(suggestFor(base({ voiceHold: true }))).toBeNull()
  })
  it('los loops silenciados no cuentan como ritmo', () => {
    expect(suggestFor(base({ loops: [loop(1, 'bd', [0, 4, 8, 12], { muted: true }), loop(2, 'sd', [4, 12], { muted: true })] }))).toBeNull()
  })
  it('«otra» es la siguiente semilla del mismo ritmo (fija y reproducible); descartar una la deja de proponer', () => {
    const a = suggestFor(base())!
    const b = suggestFor(base({ seeds: new Map([[a.key, 1]]) }))!
    expect(b.key).toBe(a.key)
    expect(b.seed).toBe(1)
    expect(b.hits).not.toEqual(a.hits)
    expect(suggestFor(base({ seeds: new Map([[a.key, 1]]) }))!.hits).toEqual(b.hits) // reproducible
    expect(suggestFor(base({ dismissed: new Set([a.key]) }))).toBeNull()
  })
  it('sigue el estilo y el tempo: otro estilo, otra sugerencia; el sinte es el del estilo', () => {
    const t = suggestFor(base())!
    const h = suggestFor(base({ style: 'house', bpm: 124 }))!
    expect(h.key).not.toBe(t.key)
    expect(h.style).toBe('house')
  })
  it('los golpes de un loop corto se repiten a 4 compases y los de uno de 4 se quedan', () => {
    const d = drumStepsOf([loop(1, 'bd', [0, 8]), loop(2, 'sd', [4], { bars: 4 })])
    expect(d.bd).toEqual([0, 8, 16, 24, 32, 40, 48, 56])
    expect(d.sd).toEqual([4])
  })
  it('sameSuggestion: igual si es el mismo ritmo, semilla, tempo y estilo', () => {
    const a = suggestFor(base())!
    expect(sameSuggestion(a, suggestFor(base())!)).toBe(true)
    expect(sameSuggestion(a, suggestFor(base({ bpm: 120 }))!)).toBe(false)
    expect(sameSuggestion(null, null)).toBe(true)
    expect(sameSuggestion(a, null)).toBe(false)
  })
})

describe('la sugerida en el código del motor (spec 012, §3.3)', () => {
  it('suena suave (35 %), con el sinte pad, sin color de loop; no sale en el código mostrado ni sin sugerencia', async () => {
    const { songCode } = await import('../../app/lib/song')
    const { SUGGEST_GAIN } = await import('../../app/lib/suggestMelody')
    const s = suggestFor(base())!
    const st = {
      loops: [loop(1, 'bd', [0, 4, 8, 12])], style: 'techno' as const, kit: 'electro' as const, background: { mode: 'manual' as const, parts: { bass: false, chords: false } },
      metronome: false, fx: { filter: 1, space: 0, warmth: 0 }, suggestion: { hits: s.hits, synth: s.synth },
    }
    const engine = songCode(st, 'engine')
    expect(engine).toContain('// melodía sugerida (sin aceptar)')
    expect(engine).toContain(`.gain(${SUGGEST_GAIN}).color("sug")`)
    expect(engine).toContain('.s("supersaw")') // el pad
    expect(songCode(st, 'display')).not.toContain('sugerida')
    expect(songCode({ ...st, suggestion: undefined }, 'engine')).not.toContain('sugerida')
  })
})

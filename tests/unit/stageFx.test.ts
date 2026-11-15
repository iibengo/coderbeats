import { describe, expect, it } from 'vitest'
import { MIDI_MAX, MIDI_MIN } from '../../app/lib/melody'
import { FX_COLOR, FX_KINDS, FxLimiter, fxAt, fxToLoops, fxValue, fxVoice, rootMidi } from '../../app/lib/stageFx'
import { VOICE_HEX } from '../../app/lib/palette'
import type { StyleId } from '../../app/lib/types'

const STYLES: StyleId[] = ['hiphop90', 'house', 'dnb', 'dembow', 'techno']

describe('Escenario: golpes de efecto (spec 011 §13.1)', () => {
  it('las cuatro zonas: abajo bombo, centro boom, arriba crash, lados barrido', () => {
    expect(fxAt(200, 700, 400, 800)).toBe('bombo')
    expect(fxAt(200, 400, 400, 800)).toBe('boom')
    expect(fxAt(200, 100, 400, 800)).toBe('crash')
    expect(fxAt(10, 400, 400, 800)).toBe('barrido')
    expect(fxAt(395, 100, 400, 800)).toBe('barrido')
  })
  it('fuera de pantalla no hay golpe', () => {
    expect(fxAt(-1, 10, 400, 800)).toBeNull()
    expect(fxAt(10, 900, 400, 800)).toBeNull()
    expect(fxAt(10, 10, 0, 0)).toBeNull()
  })
  it('alrededor de un botón hay zona muerta', () => {
    const dead = [{ x: 150, y: 700, w: 100, h: 40 }]
    expect(fxAt(200, 720, 400, 800, dead)).toBeNull()
    expect(fxAt(200, 750, 400, 800, dead)).toBeNull() // dentro del margen
    expect(fxAt(200, 790, 400, 800, dead)).toBe('bombo')
  })
  it('los colores son los de la paleta: bombo rosa, boom lila, crash azul', () => {
    expect(FX_COLOR.bombo).toBe(VOICE_HEX.bd)
    expect(FX_COLOR.boom).toBe(VOICE_HEX.sd)
    expect(FX_COLOR.crash).toBe(VOICE_HEX.hh)
  })
  it('el bombo y el boom van a la raíz del estilo, una octava abajo, siempre en rango', () => {
    for (const s of STYLES) {
      const root = rootMidi(s)
      for (const k of ['bombo', 'boom'] as const) {
        const m = fxVoice(k, s).midi
        expect(m).toBe(Math.max(MIDI_MIN, root - 12))
        expect(m).toBeGreaterThanOrEqual(MIDI_MIN)
        expect(m).toBeLessThanOrEqual(MIDI_MAX)
      }
    }
    expect(rootMidi('techno')).toBe(36) // c2
    expect(rootMidi('dembow')).toBe(40) // e2
  })
  it('cada golpe da un valor para superdough con sonido y nota', () => {
    for (const k of FX_KINDS) {
      const v = fxValue(k, 'techno')
      expect(typeof v.s).toBe('string')
      expect(Number.isFinite(v.note as number)).toBe(true)
    }
  })
  it('tope por segundo: el séptimo toque en un segundo se descarta y luego vuelve a dejar', () => {
    const l = new FxLimiter(6, 1)
    const ok = Array.from({ length: 8 }, (_, i) => l.take(i * 0.1))
    expect(ok.filter(Boolean).length).toBe(6)
    expect(l.take(1.5)).toBe(true)
  })
  it('grabar: cuantiza a la semicorchea, un loop por tipo, sin repetir paso', () => {
    const step = 0.125
    const loops = fxToLoops(
      [{ kind: 'bombo', time: 0.01 }, { kind: 'bombo', time: 0.5 }, { kind: 'bombo', time: 0.51 }, { kind: 'crash', time: 2.0 }],
      'techno', 0, step, 4,
    )
    expect(loops.map((l) => l.synth)).toEqual(['impacto', 'crash'])
    expect(loops[0]!.hits.map((h) => h.pos)).toEqual([0, 4])
    expect(loops[1]!.hits[0]!.pos).toBe(16)
    for (const l of loops) for (const h of l.hits) expect(h.dur).toBeGreaterThan(0)
  })
  it('grabar: un toque que cae tras el fin del loop envuelve al principio', () => {
    const l = fxToLoops([{ kind: 'boom', time: 64 * 0.125 + 0.13 }], 'techno', 0, 0.125, 4)
    expect(l[0]!.hits[0]!.pos).toBe(1)
  })
  it('sin golpes no hay loops', () => {
    expect(fxToLoops([], 'techno', 0, 0.125)).toEqual([])
  })
})

describe('Escenario: la capa grabada suena como lo tocado', () => {
  it('un loop de melodía con el sinte boom o impacto da notas en la raíz con el sonido sbd', async () => {
    const { emptySong } = await import('../../app/lib/cells')
    const { songCode } = await import('../../app/lib/song')
    const { events } = await import('../helpers/strudelEval')
    const { WOW_PRELUDE } = await import('../../app/lib/wowPrelude')
    for (const synth of ['boom', 'impacto'] as const) {
      const s = emptySong()
      const [loop] = fxToLoops([{ kind: synth === 'boom' ? 'boom' : 'bombo', time: 0 }], 'techno', 0, 0.125, 4)
      const fl = { id: 1, instrument: 'mel' as const, bars: 4 as const, phaseBar: 0, hits: loop!.hits, synth, muted: false, bornAt: 0, fromTemplate: false }
      const code = songCode(
        { loops: [fl], style: 'techno', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 }
      },
        'display',
      )
      const ev = await events(`${WOW_PRELUDE}\n${code}`, 4)
      const hit = ev.find((e) => e.value.s === 'sbd')
      expect(hit, synth).toBeTruthy()
      expect(hit!.value.note).toBe(synth === 'boom' ? 'c1' : 'c1')
    }
  })
})

import { describe, expect, it } from 'vitest'
import { isFreeLoop } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { MELODY_SYNTHS, REGISTER, SYNTH_SOUND } from '../../app/lib/melody'
import { songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

const loop = (synth?: FreeLoop['synth']): FreeLoop => ({ id: 1, instrument: 'mel', bars: 1, phaseBar: 0, hits: [{ pos: 0, dur: 4, midi: 64, strength: 0.8 }, { pos: 8, dur: 4, midi: 67, strength: 0.8 }], muted: false, bornAt: 0, fromTemplate: false, ...(synth ? { synth } : {}) })
const state = (l: FreeLoop): SongState => ({ loops: [l], style: 'techno2', kit: 'electro', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0.5 } })

describe('la guitarra (spec 035): sinte opcional, sin samples', () => {
  it('existe como `guitar` (limpia) y `guitarDirty` (sucia), con su registro, y la app las acepta al leer lo guardado', () => {
    for (const s of ['guitar', 'guitarDirty'] as const) {
      expect(MELODY_SYNTHS).toContain(s)
      expect(REGISTER[s]).toEqual([48, 84])
      expect(isFreeLoop(loop(s))).toBe(true)
    }
    expect(isFreeLoop(loop('guitarra' as never))).toBe(false) // un nombre inventado sigue rechazándose
  })
  it('el `lead` no cambia: sin elegir sinte, suena exactamente como antes (square con lpf 1800 y delay)', () => {
    expect(SYNTH_SOUND.lead).toBe('.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)')
    const code = songCode(state(loop()), 'display')
    expect(code).toContain('.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)')
    expect(code).not.toContain('sawtooth')
  })
  it('en el código generado cambia el filtro, la saturación y el decaimiento respecto al lead (no solo la onda)', () => {
    const lead = SYNTH_SOUND.lead
    const g = SYNTH_SOUND.guitar
    const d = SYNTH_SOUND.guitarDirty
    for (const x of [g, d]) {
      expect(x).toContain('.s("sawtooth")') // otra onda
      expect(x).toMatch(/\.lpenv\(/) // el filtro se cierra tras el pulso (el lead lo tiene fijo)
      expect(x).toMatch(/\.distort\(/) // saturación (el lead no tiene); `distort` y no `shape`: la calidez global pone su `.shape` al final y lo pisaría
      expect(x).not.toContain('delay(') // sin el eco del lead
      expect(x).toMatch(/\.decay\(/)
    }
    expect(lead).not.toMatch(/lpenv|shape|distort/)
    const dist = (x: string) => Number(/distort\(([\d.]+)\)/.exec(x)![1])
    expect(dist(d)).toBeGreaterThan(dist(g) * 3) // la sucia satura bastante más
    expect(dist(g)).toBeGreaterThan(0)
  })
  it('suena en el motor de patrones: notas con sawtooth, nada de square, y las dos variantes difieren', async () => {
    const clean = await events(songCode(state(loop('guitar')), 'display'), 2)
    const dirty = await events(songCode(state(loop('guitarDirty')), 'display'), 2)
    expect(clean.length).toBeGreaterThan(0)
    expect(clean.every((e) => e.value.s === 'sawtooth')).toBe(true)
    expect(dirty.every((e) => e.value.s === 'sawtooth')).toBe(true)
    expect(clean.map((e) => e.value.note)).toEqual(dirty.map((e) => e.value.note))
    expect(Number(dirty[0]!.value.distort)).toBeGreaterThan(Number(clean[0]!.value.distort))
    expect(Number(clean[0]!.value.lpenv)).toBeGreaterThan(0) // el filtro que se cierra tras el pulso
  })
})

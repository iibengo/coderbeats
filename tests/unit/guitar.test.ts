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

import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { GUITAR_NOTES, GUITAR_SAMPLE, GUITAR_SAMPLES_URL, guitarMap } from '../../app/lib/guitarSamples'

describe('la guitarra grabada, guitarSample (spec 036)', () => {
  it('es otro sinte: guitar, guitarDirty y lead no cambian', () => {
    expect(MELODY_SYNTHS).toContain('guitarSample')
    expect(isFreeLoop(loop('guitarSample'))).toBe(true)
    expect(SYNTH_SOUND.lead).toBe('.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)')
    expect(SYNTH_SOUND.guitar).toContain('.s("sawtooth")')
    expect(SYNTH_SOUND.guitarDirty).toContain('distort(3)')
    expect(SYNTH_SOUND.guitarSample).toContain(`.s("${GUITAR_SAMPLE}")`)
  })
  it('7 notas, a no más de 5 semitonos una de otra (e3 a3 d4 g4 c5 f5 a5; el último salto es de 4)', () => {
    const midi = (n: string) => ({ c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 })[n[0] as 'c'] + (Number(n[1]) + 1) * 12
    const m = GUITAR_NOTES.map(midi)
    expect(m.length).toBe(7)
    expect(m.slice(1).map((x, i) => x - m[i]!)).toEqual([5, 5, 5, 5, 5, 4])
  })
  it('los 7 WAV existen, son ligeros, coinciden con el repositorio de kits y su SHA está en CREDITS.md', () => {
    const credits = readFileSync('public/samples/CREDITS.md', 'utf8')
    let total = 0
    const json = JSON.parse(readFileSync('kits/coderbeats-kits/strudel.json', 'utf8')) as Record<string, unknown>
    expect(json[GUITAR_SAMPLE]).toEqual(guitarMap('guitar/'))
    for (const n of GUITAR_NOTES) {
      const buf = readFileSync(`public/samples/guitar/${n}.wav`)
      total += statSync(`public/samples/guitar/${n}.wav`).size
      expect(buf.subarray(0, 4).toString()).toBe('RIFF')
      expect(readFileSync(`kits/coderbeats-kits/guitar/${n}.wav`).equals(buf), n).toBe(true)
      expect(credits, n).toContain(createHash('sha256').update(buf).digest('hex').slice(0, 16))
    }
    expect(total).toBeLessThan(350_000)
  })
  it('el código mostrado pide su samples() solo si la canción usa la guitarra (y una vez si el kit ya trae la misma etiqueta)', () => {
    const con = songCode(state(loop('guitarSample')), 'display')
    expect(con).toContain(`samples('${GUITAR_SAMPLES_URL}')`)
    expect(con).toContain('.s("hofner")')
    expect(songCode(state(loop()), 'display')).not.toContain('samples(')
    expect(songCode(state(loop('guitar')), 'display')).not.toContain('samples(')
    expect(songCode({ ...state(loop('guitarSample')), kit: 'drums' }, 'display').match(/samples\(/g)).toHaveLength(1)
    expect(songCode(state(loop('guitarSample')), 'engine')).not.toContain('samples(')
  })
})

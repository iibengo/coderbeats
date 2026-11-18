import { describe, expect, it } from 'vitest'
import { isFreeLoop } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { MELODY_SYNTHS, REGISTER, SYNTH_ECHO, SYNTH_SOUND } from '../../app/lib/melody'
import { songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

// un acorde de Fm9 (F3 A♭3 C4 E♭4 G4) en el paso 0 de un compás
const chord = (synth?: FreeLoop['synth']): FreeLoop => ({ id: 1, instrument: 'mel', bars: 1, phaseBar: 0, hits: [53, 56, 60, 63, 67].map((midi) => ({ pos: 0, strength: 0.8, midi, dur: 4 })) as never, muted: false, bornAt: 0, fromTemplate: false, ...(synth ? { synth } : {}) })
const state = (l: FreeLoop): SongState => ({ loops: [l], style: 'techno2', kit: 'electro', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } })

describe('el sinte dub (spec 046)', () => {
  it('existe, con su registro, y la app lo acepta al leer lo guardado', () => {
    expect(MELODY_SYNTHS).toContain('dub')
    expect(REGISTER.dub).toEqual([36, 79])
    expect(isFreeLoop(chord('dub'))).toBe(true)
  })
  it('dos sierras desafinadas, filtro resonante con envolvente rápida y sustain 0, saturación y reverb larga', () => {
    const d = SYNTH_SOUND.dub
    expect(d).toContain('.s("supersaw")')
    expect(d).toContain('.unison(2)')
    expect(Number(/detune\(([\d.]+)\)/.exec(d)![1])).toBeGreaterThan(0)
    const lpf = Number(/\.lpf\((\d+)\)/.exec(d)![1])
    expect(lpf).toBeGreaterThanOrEqual(500)
    expect(lpf).toBeLessThanOrEqual(1000)
    expect(Number(/lpq\(([\d.]+)\)/.exec(d)![1])).toBeLessThanOrEqual(6) // resonancia ligera
    expect(d).toMatch(/lpenv\(/)
    expect(d).toContain('.sustain(0)')
    expect(d).toMatch(/\.shape\(/)
    expect(d).toMatch(/\.room\(0?\.\d+\)/)
    expect(Number(/roomsize\((\d+)\)/.exec(d)![1])).toBeGreaterThanOrEqual(5)
  })
  it('el eco es de corchea con puntillo (3/16 de ciclo) y cada repetición vuelve más oscura y más baja', async () => {
    const ev = (await events(songCode(state(chord('dub')), 'display'), 1)).filter((e) => e.value.s === 'supersaw' && e.begin >= 0) // sin los ecos que vienen del compás anterior
    const starts = [...new Set(ev.map((e) => Math.round(e.begin * 16 * 1000) / 1000))].sort((a, b) => a - b)
    expect(starts).toEqual([0, 3, 6, 9]) // el golpe y tres repeticiones, cada 3 pasos (3/16)
    const at = (p: number) => ev.filter((e) => Math.round(e.begin * 16) === p)
    expect(at(0).length).toBe(5) // el acorde entero: cinco notas
    for (const p of [0, 3, 6, 9]) expect(at(p).length, `paso ${p}`).toBe(5) // y cada repetición lleva el acorde entero
    const lpfs = [0, 3, 6, 9].map((p) => Number(at(p)[0]!.value.cutoff ?? at(p)[0]!.value.lpf))
    expect(lpfs[0]).toBeGreaterThan(lpfs[1]!)
    expect(lpfs[1]).toBeGreaterThan(lpfs[2]!)
    expect(lpfs[2]).toBeGreaterThan(lpfs[3]!) // más oscura cada vez
    const pg = [3, 6, 9].map((p) => Number(at(p)[0]!.value.postgain))
    expect(pg.every((x) => x > 0 && x <= 0.6 + 1e-9)).toBe(true)
  })
  it('lo demás no cambia: los otros sintes siguen igual', () => {
    expect(SYNTH_SOUND.lead).toBe('.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)')
    expect(SYNTH_SOUND.acid).toContain('lpq(13)')
    expect(SYNTH_SOUND.guitar).toContain('distort(0.5)')
    expect(SYNTH_SOUND.pad).toBe('.s("supersaw").attack(0.08).release(0.6).lpf(1200).room(0.8)')
    expect(songCode(state(chord()), 'display')).not.toContain('.off(')
  })
  it('sin samples() ni nada de la app: el código mostrado es de strudel', () => {
    const code = songCode(state(chord('dub')), 'display')
    expect(code).not.toContain('samples(')
    expect(code).toContain('.room(0.9).roomsize(8)')
  })
  it('el eco va al final de la línea, después del gain por nota, y solo en el dub', () => {
    const code = songCode(state(chord('dub')), 'display')
    const line = code.split('\n').find((l) => l.includes('supersaw'))!
    expect(line.indexOf('.gain("')).toBeLessThan(line.indexOf('.off(3/16'))
    expect(SYNTH_ECHO.dub).toContain('.off(3/16')
    expect(Object.keys(SYNTH_ECHO)).toEqual(['dub'])
  })
})

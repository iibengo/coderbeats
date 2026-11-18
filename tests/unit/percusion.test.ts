import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { isFreeLoop } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { MELODY_SYNTHS, REGISTER, SYNTH_SOUND } from '../../app/lib/melody'
import { extraMelodies, melLoopOf } from '../../app/lib/melodyEdit'
import { PERC_MIDI, PERC_SAMPLES, PERC_SYNTHS, isPercSynth } from '../../app/lib/percSamples'
import { layersOfCell } from '../../app/lib/remixParts'
import { melodyCount } from '../../app/lib/singPart'
import { songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

let id = 0
const P = (synth: string, steps: number[], bars: FreeLoop['bars'] = 1): FreeLoop => ({ id: ++id, instrument: 'mel', bars, phaseBar: 0, hits: steps.map((pos) => ({ pos, strength: 0.7, midi: PERC_MIDI, dur: 1 })) as never, muted: false, bornAt: 0, fromTemplate: false, synth: synth as never })
const state = (loops: FreeLoop[]): SongState => ({ loops, style: 'techno2', kit: 'techno', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } })

describe('la percusión del minimal (spec 045)', () => {
  it('cinco sintes de muestra, válidos al leer lo guardado, con los nombres de strudel', () => {
    expect(PERC_SYNTHS).toEqual(['rim', 'click', 'cowbell', 'tom', 'shaker'])
    for (const s of PERC_SYNTHS) {
      expect(MELODY_SYNTHS).toContain(s)
      expect(REGISTER[s]).toBeDefined()
      expect(isPercSynth(s)).toBe(true)
      expect(isFreeLoop(P(s, [0, 5]))).toBe(true)
    }
    expect(isPercSynth('lead')).toBe(false)
    expect(SYNTH_SOUND.rim).toContain('.s("rim")')
    expect(SYNTH_SOUND.click).toContain('.s("misc").n(1)')
    expect(SYNTH_SOUND.cowbell).toContain('.s("cb")')
    expect(SYNTH_SOUND.tom).toContain('.s("mt")')
    expect(SYNTH_SOUND.shaker).toContain('.s("sh")')
  })
  it('los cinco WAV existen, pesan poco (< 90 KB) y su SHA, su origen y su licencia están en CREDITS.md', () => {
    const credits = readFileSync('public/samples/CREDITS.md', 'utf8')
    let total = 0
    for (const f of ['rim', 'click', 'cb', 'tom', 'sh']) {
      const path = `public/samples/techno/${f}.wav`
      const buf = readFileSync(path)
      total += statSync(path).size
      expect(buf.subarray(0, 4).toString()).toBe('RIFF')
      expect(credits, f).toContain(createHash('sha256').update(buf).digest('hex').slice(0, 16))
    }
    expect(total).toBeLessThan(90_000)
    for (const t of ['rim/10_rim_switchangel.wav', 'misc/11_misc_switchangel_ludens.wav', 'cb/10_perc_switchangel.wav', 'mt/10_mt_mot4i.wav', 'sh/10_sh_switchangel.wav']) expect(credits).toContain(t)
    // el motor registra los nombres de strudel con esos archivos
    expect(Object.keys(PERC_SAMPLES).sort()).toEqual(['cb', 'misc', 'mt', 'rim', 'sh'])
    expect(PERC_SAMPLES.misc).toHaveLength(2) // `.n(1)` cae en el clic
  })
  it('van en pasos concretos, también fuera de tiempo: cada golpe cae en su paso (enteros, medios pasos y tercios)', async () => {
    const steps = [1, 2.5, 6, 9.5, 11 + 1 / 3, 14]
    const ev = (await events(songCode(state([P('rim', steps)]), 'display'), 1)).filter((e) => e.value.s === 'rim')
    const begins = ev.map((e) => Math.round(e.begin * 16 * 12) / 12).sort((a, b) => a - b)
    expect(begins).toEqual(steps.map((x) => Math.round(x * 12) / 12))
  })
  it('un patrón de 2 compases (pasos del 17 al 32) cae en el segundo compás', async () => {
    const ev = (await events(songCode(state([P('shaker', [3, 19, 28], 2)]), 'display'), 2)).filter((e) => e.value.s === 'sh')
    expect(ev.map((e) => Math.round(e.begin * 16)).sort((a, b) => a - b)).toEqual([3, 19, 28])
  })
  it('el código mostrado es el de strudel: sin samples(), sin avisos de «solo suena en la app»', () => {
    const code = songCode({ ...state([P('rim', [4]), P('click', [2]), P('cowbell', [7]), P('tom', [12]), P('shaker', [1, 3])]), kit: 'electro' }, 'display') // con el kit Techno saldría su aviso, que es del kit
    expect(code).not.toContain('samples(')
    expect(code).not.toContain('solo suena')
    for (const n of ['"rim"', '"misc"', '"cb"', '"mt"', '"sh"']) expect(code).toContain(n)
  })
  it('no son melodía: el Órgano no los edita, no cuentan como melodías apiladas ni para el tope de cantar, y en el Laboratorio van con el ritmo', () => {
    const melody: FreeLoop = { id: ++id, instrument: 'mel', bars: 4, phaseBar: 0, hits: [{ pos: 0, strength: 0.8, midi: 64, dur: 8 }] as never, muted: false, bornAt: 0, fromTemplate: false }
    const percs = PERC_SYNTHS.map((s) => ({ ...P(s, [4]), bornAt: 5 })) // más recientes que la melodía
    const st = { loops: [melody, ...percs], nextId: 99 }
    expect(melLoopOf(st)?.id).toBe(melody.id)
    expect(extraMelodies(st)).toEqual([])
    expect(melodyCount([melody, ...percs])).toBe(1)
    const bd: FreeLoop = { id: ++id, instrument: 'bd', bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 0.9 }], muted: false, bornAt: 0, fromTemplate: false }
    const sd: FreeLoop = { ...bd, id: ++id, instrument: 'sd' }
    const layers = layersOfCell({ id: 1, loops: [bd, sd, melody, ...percs], parts: { bass: false, chords: false }, turns: 4, at: { x: 0, y: 0, depth: 0 } } as never)
    expect(layers.find((l) => l.key === 'tema')?.mel?.length).toBe(1) // el tema es solo la melodía
    expect(layers.find((l) => l.key === 'ritmo')?.mel?.length).toBe(PERC_SYNTHS.length) // y la percusión va con el ritmo
  })
})

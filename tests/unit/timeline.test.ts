import { describe, expect, it } from 'vitest'
import { LANES, laneOf, songTimeline } from '../../app/lib/timeline'
import { labRemixById } from '../../app/lib/labRemixes'
import type { Cell, Song } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'

const loop = (o: Partial<FreeLoop> & Pick<FreeLoop, 'instrument' | 'hits'>): FreeLoop => ({ id: 1, bars: 1, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, ...o })
const cell = (id: number, turns: Cell['turns'], loops: FreeLoop[], name?: string): Cell => ({ id, name, loops, parts: { bass: false, chords: false }, turns, at: { x: 0, y: 0, depth: 0 } }) as unknown as Cell
const song = (cells: Cell[], bpm: number | null = 120): Song => ({ version: 1, cells, order: cells.map((c) => c.id), groups: [], nextGroupId: 1, bpm, nextCellId: 9, nextLoopId: 9 })

describe('línea de tiempo de una canción (spec 049)', () => {
  it('a 120 bpm un compás dura 2 s y un paso 0,125 s: cada golpe cae en su instante', () => {
    const tl = songTimeline(song([cell(1, 2, [loop({ instrument: 'bd', hits: [{ pos: 0, strength: 1 }, { pos: 8, strength: 0.5 }] })])]), 'techno2')
    expect(tl.barSeconds).toBe(2)
    expect(tl.duration).toBe(4)
    expect(tl.events.map((e) => [e.t, e.lane, e.strength])).toEqual([[0, 'bd', 1], [1, 'bd', 0.5], [2, 'bd', 1], [3, 'bd', 0.5]])
  })
  it('un loop de 2 compases con fase: el compás b del loop suena en los compases k de la célula con (k − fase) mod 2 = b', () => {
    const tl = songTimeline(song([cell(1, 4, [loop({ instrument: 'sd', bars: 2, phaseBar: 1, hits: [{ pos: 16, strength: 1 }] })])]), 'techno2') // golpe en el compás 2 del loop
    // el compás 2 del loop (b = 1) suena donde (k − 1) mod 2 = 1 → k = 0 y k = 2
    expect(tl.events.map((e) => e.t)).toEqual([0, 4])
  })
  it('las células van una tras otra: la segunda empieza donde acaba la primera; cada sección con su nombre y sus instantes', () => {
    const tl = songTimeline(song([cell(1, 2, [loop({ instrument: 'bd', hits: [{ pos: 0, strength: 1 }] })], 'Intro'), cell(2, 4, [loop({ instrument: 'hh', hits: [{ pos: 4, strength: 1 }] })], 'Drop')]), 'techno2')
    expect(tl.sections).toEqual([{ name: 'Intro', bar0: 0, bars: 2, t0: 0, t1: 4 }, { name: 'Drop', bar0: 2, bars: 4, t0: 4, t1: 12 }])
    expect(tl.bars).toBe(6)
    expect(tl.events.filter((e) => e.lane === 'hh')[0]!.t).toBe(4 + 0.5)
  })
  it('los loops silenciados no suenan y el tempo de la canción manda sobre el del estilo (null → el del estilo)', () => {
    const base = [cell(1, 1, [loop({ instrument: 'bd', hits: [{ pos: 0, strength: 1 }], muted: true }), loop({ id: 2, instrument: 'sd', hits: [{ pos: 0, strength: 1 }] })])]
    expect(songTimeline(song(base), 'techno2').events).toHaveLength(1)
    expect(songTimeline(song(base, null), 'dnb').bpm).toBe(174)
    expect(songTimeline(song(base, 90), 'dnb').bpm).toBe(90)
  })
  it('qué sinte va a qué carril; el riser y el downlifter no tienen carril', () => {
    const l = (instrument: FreeLoop['instrument'], synth?: FreeLoop['synth']) => laneOf({ instrument, synth })
    expect([l('bd'), l('sd'), l('hh')]).toEqual(['bd', 'sd', 'hh'])
    expect([l('mel', 'sub'), l('mel', 'bass')]).toEqual(['bass', 'bass'])
    expect([l('mel', 'hat'), l('mel', 'hatOpen'), l('mel', 'crash'), l('mel', 'shaker')]).toEqual(['hh', 'hh', 'hh', 'hh'])
    expect([l('mel', 'tom'), l('mel', 'boom'), l('mel', 'impacto')]).toEqual(['sd', 'bd', 'bd'])
    expect([l('mel', 'cuerdas'), l('mel', 'coro'), l('mel', 'keys'), l('mel', 'lead'), l('voz')]).toEqual(['mel', 'mel', 'mel', 'mel', 'mel'])
    expect([l('mel', 'riser'), l('mel', 'downlifter')]).toEqual([null, null])
  })
  it('datos raros no rompen: posiciones no finitas, negativas o fuera del loop se ignoran; la fuerza se acota', () => {
    const tl = songTimeline(song([cell(1, 1, [loop({ instrument: 'bd', hits: [{ pos: Number.NaN, strength: 1 }, { pos: -3, strength: 1 }, { pos: 99, strength: 1 }, { pos: 0, strength: 7 }, { pos: 4, strength: Number.NaN }] })])]), 'techno2')
    expect(tl.events.map((e) => e.strength)).toEqual([1, 0.8]) // (batería: la fuerza tal cual)
  })
})

describe('línea de tiempo del Lacrimosa en drill (spec 049)', () => {
  const r = labRemixById('lacrimosa-drill')!
  const tl = songTimeline(r.song, r.style)
  it('72 compases a 145 bpm: unos 2 minutos, las 8 partes en orden', () => {
    expect(tl.bpm).toBe(145)
    expect(tl.bars).toBe(72)
    expect(tl.duration).toBeCloseTo(72 * (60 / 145) * 4, 6)
    expect(tl.sections.map((s) => s.name)).toEqual(['Intro', 'Estrofa', 'Subida', 'Drop', 'Break', 'Puente', 'Drop 2', 'Final'])
    for (let i = 1; i < tl.sections.length; i++) expect(tl.sections[i]!.t0).toBeCloseTo(tl.sections[i - 1]!.t1, 9)
  })
  it('los cinco carriles tienen golpes, ordenados, y el riser del puente no suma carril', () => {
    for (const v of LANES) {
      const t = tl.lanes[v].t
      expect(t.length, v).toBeGreaterThan(0)
      for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThanOrEqual(t[i - 1]!)
    }
    expect(tl.events.length).toBe(LANES.reduce((n, v) => n + tl.lanes[v].t.length, 0))
  })
  it('la energía por compás sigue la forma del tema: la intro, el puente y el final por debajo de los drops', () => {
    expect(tl.barEnergy).toHaveLength(72)
    expect(Math.max(...tl.barEnergy)).toBe(1)
    const mean = (n: string) => { const s = tl.sections.find((x) => x.name === n)!; const a = tl.barEnergy.slice(s.bar0, s.bar0 + s.bars); return a.reduce((x, y) => x + y, 0) / a.length }
    expect(mean('Drop')).toBeGreaterThan(mean('Intro') * 2)
    expect(mean('Drop 2')).toBeGreaterThan(mean('Break'))
    expect(mean('Drop')).toBeGreaterThan(mean('Puente'))
  })
  it('el bombo solo suena en los drops (la batería entera) y el platillo ya en la estrofa', () => {
    const s = (n: string) => tl.sections.find((x) => x.name === n)!
    const inSec = (v: (typeof LANES)[number], n: string) => Array.from(tl.lanes[v].t).filter((t) => t >= s(n).t0 && t < s(n).t1).length
    expect(inSec('bd', 'Intro')).toBe(0)
    expect(inSec('bd', 'Estrofa')).toBe(0)
    expect(inSec('bd', 'Drop')).toBeGreaterThan(0)
    expect(inSec('hh', 'Estrofa')).toBeGreaterThan(0)
  })
})

import { hitLevel } from '../../app/lib/timeline'
import { compress } from '../../app/lib/visuals/pulso'

describe('lo que se oye de un golpe (spec 049)', () => {
  it('en la melodía la fuerza se lleva a suelo–1, como en el audio: la fuerza 0 sigue sonando (cuerdas 0,33, charles 0,35, resto 0,55)', () => {
    expect(hitLevel({ instrument: 'mel', synth: 'cuerdas' }, 0)).toBeCloseTo(0.33, 9)
    expect(hitLevel({ instrument: 'mel', synth: 'hat' }, 0)).toBeCloseTo(0.35, 9)
    expect(hitLevel({ instrument: 'mel', synth: 'lead' }, 0)).toBeCloseTo(0.55, 9)
    expect(hitLevel({ instrument: 'mel', synth: 'cuerdas' }, 1)).toBe(1)
    expect(hitLevel({ instrument: 'mel', synth: 'coro' }, 0.8)).toBeCloseTo(0.55 + 0.45 * 0.8, 9)
  })
  it('en la batería, la fuerza tal cual; y los datos raros se acotan', () => {
    expect(hitLevel({ instrument: 'bd' }, 0.5)).toBe(0.5)
    expect(hitLevel({ instrument: 'sd' }, 9)).toBe(1)
    expect(hitLevel({ instrument: 'mel', synth: 'cuerdas' }, Number.NaN)).toBeCloseTo(0.33 + 0.67 * 0.8, 9)
  })
  it('la intro del Lacrimosa ya no sale vacía: las cuerdas suaves (fuerza 0) suenan al 33 %', () => {
    const r = labRemixById('lacrimosa-drill')!
    const tl = songTimeline(r.song, r.style)
    const intro = tl.sections[0]!
    const mel = Array.from(tl.lanes.mel.s).filter((_, i) => tl.lanes.mel.t[i]! < intro.t1)
    expect(mel.length).toBeGreaterThan(0)
    expect(Math.max(...mel)).toBeCloseTo(0.33, 6)
  })
  it('la compresión de la barra: nunca pasa de 1, sube con la suma y no es lineal', () => {
    expect(compress(0)).toBe(0)
    expect(compress(0.8)).toBeCloseTo(0.72, 2)
    expect(compress(2)).toBeLessThan(1)
    expect(compress(2)).toBeGreaterThan(compress(1))
    expect(compress(100)).toBeLessThanOrEqual(1)
  })
})

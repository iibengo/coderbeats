import { describe, expect, it } from 'vitest'
import { STYLES } from '../../app/lib/constants'
import { DEMOS } from '../../app/lib/demos'
import { songCode } from '../../app/lib/song'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { adaptTune, tunesFor } from '../../app/lib/tuneLibrary'

const demoSteps = (inst: 'bd' | 'sd' | 'hh'): number[] => DEMOS.drill[inst].split(' ').map((t, i) => (t === '~' ? -1 : i)).filter((s) => s >= 0)

describe('drill (spec 048)', () => {
  it('140 bpm, re menor, y el ritmo es de medio tiempo: caja solo en el tiempo 3', () => {
    expect(STYLES.drill.bpm).toBe(140)
    expect(STYLES.drill.legacy).toBeFalsy()
    expect(STYLE_MUSIC.drill.key).toBe('re menor')
    expect(STYLE_MUSIC.drill.scale[0]).toBe(2)
    expect(demoSteps('sd')).toEqual([8])
  })
  it('bombo escaso y platillo roto (con huecos, nunca todas las semicorcheas)', () => {
    expect(demoSteps('bd')).toEqual([0, 6, 11])
    const hh = demoSteps('hh')
    expect(hh.length).toBeGreaterThan(6)
    expect(hh.length).toBeLessThan(12)
    expect(DEMOS.drill.hh.split(' ')).toHaveLength(16)
  })
  it('los tres patrones tienen 16 pasos y las plantillas coinciden con la demo', () => {
    for (const k of ['bd', 'sd', 'hh'] as const) {
      expect(DEMOS.drill[k].split(' ')).toHaveLength(16)
      expect(STYLE_MUSIC.drill.templates[k]).toBe(DEMOS.drill[k])
    }
  })
  it('el bajo y los acordes caben en la escala del estilo', () => {
    const scale = STYLE_MUSIC.drill.scale
    for (const bar of STYLE_MUSIC.drill.chordTones) for (const pc of bar) expect(scale).toContain(pc)
  })
  it('el código de una canción drill lleva su tempo y su fondo', () => {
    const st = { loops: [], style: 'drill' as const, kit: '808' as const, background: { mode: 'manual' as const, parts: { bass: true, chords: true } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0.5 } }
    const c = songCode(st, 'display')
    expect(c).toContain('setcpm(140/4)')
    expect(c).toContain('d2')
    expect(c).toContain('d3,f3,a3')
  })
  it('tiene melodías de dominio público que le pegan, todas dentro de su escala', () => {
    const list = tunesFor('drill')
    expect(list.length).toBeGreaterThanOrEqual(2)
    for (const t of list) for (const h of adaptTune(t, 'drill')) expect(STYLE_MUSIC.drill.scale).toContain(h.midi % 12)
  })
})

import { bassCode, slideMini, type BassPattern } from '../../app/lib/bass'
import { events } from '../helpers/strudelEval'

describe('el 808 del drill se desliza (spec 048)', () => {
  it('el patrón de penv tiene la misma estructura que el de las notas', () => {
    const b = STYLE_MUSIC.drill.background.bass
    const code = bassCode(b)
    expect(code).toContain('.penv("<[-5@7 ~ ~ ~ 0@6] [4@7 ~ ~ ~ 0@6] [3@7 ~ ~ ~ 0@6] [-2@7 ~ ~ ~ 0@6]>")')
    expect(code).toContain('.pattack(0.001).pdecay(0.2).psustain(0)')
    expect(code).toContain('note("<[d2@7 ~ ~ ~ d2@6] [bb1@7 ~ ~ ~ bb1@6] [g1@7 ~ ~ ~ g1@6] [a1@7 ~ ~ ~ a1@6]>")')
  })
  it('sin deslizamientos, el código del bajo es el de siempre (los demás estilos no cambian)', () => {
    for (const id of ['hiphop90', 'house', 'dnb', 'dembow', 'reggaeton', 'techno', 'house2', 'techno2'] as const) {
      const b = STYLE_MUSIC[id].background.bass
      expect(slideMini(b)).toBe('')
      expect(bassCode(b)).not.toContain('.penv(')
    }
  })
  it('el desplazamiento se acota a ±12 y un valor raro vale 0', () => {
    const p: BassPattern = { bars: 1, notes: [{ pos: 0, dur: 8, note: 'c2', slide: 99 }, { pos: 8, dur: 8, note: 'c2', slide: Number.NaN }], sound: '.s("sine")' }
    expect(slideMini(p)).toContain('12')
    expect(slideMini(p)).not.toContain('NaN')
  })
  it('Strudel lo entiende: la primera nota de cada compás lleva su penv (−5, 4, 3, −2) y las cortas, 0', async () => {
    const code = `${bassCode(STYLE_MUSIC.drill.background.bass)}.gain(1)`
    const ev = await events(code, 4)
    expect(ev.length).toBe(8)
    const pe = ev.map((e) => Number(e.value.penv ?? 0))
    expect(pe).toEqual([-5, 0, 4, 0, 3, 0, -2, 0])
  })
})

import { DRILL_ROLLS, labRemixById } from '../../app/lib/labRemixes'
import { PERC_MIDI, isPercSynth } from '../../app/lib/percSamples'
import { SYNTH_SOUND } from '../../app/lib/melody'
import { isFreeLoop } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { melodyCount } from '../../app/lib/singPart'

describe('los redobles de tresillos del drill (spec 048)', () => {
  const hatLoop = (): FreeLoop => ({
    id: 1, instrument: 'mel', bars: 4, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, synth: 'hat',
    hits: DRILL_ROLLS.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.7 })) as never,
  })
  it('15 golpes en tres ráfagas (3, 3 y 9) a 2/3 de paso unos de otros, dentro de los 4 compases', () => {
    expect(DRILL_ROLLS).toHaveLength(15)
    expect(DRILL_ROLLS[0]).toEqual([30, 2 / 3, PERC_MIDI])
    expect(DRILL_ROLLS[1]![0]).toBeCloseTo(30 + 2 / 3, 9)
    expect(DRILL_ROLLS[3]![0]).toBe(38)
    expect(DRILL_ROLLS[6]![0]).toBe(58)
    for (const [p, d] of DRILL_ROLLS) expect(p + d).toBeLessThanOrEqual(64 + 1e-9)
  })
  it('`hat` es un sinte de muestra del 808: percusión (no melodía), válida al leer lo guardado', () => {
    expect(isPercSynth('hat')).toBe(true)
    expect(SYNTH_SOUND.hat).toContain('.s("hh").bank("RolandTR808")')
    expect(isFreeLoop(hatLoop())).toBe(true)
    expect(melodyCount([hatLoop()])).toBe(0)
  })
  it('Strudel los toca en tresillos: cada golpe cae en su sitio (en doceavos de paso)', async () => {
    const st = { loops: [hatLoop()], style: 'drill', kit: '808', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } } as unknown as Parameters<typeof songCode>[0]
    const ev = (await events(songCode(st, 'display'), 4)).filter((e) => e.value.s === 'hh')
    const got = ev.map((e) => Math.round(e.begin * 16 * 12) / 12).sort((a, b) => a - b)
    expect(got).toEqual(DRILL_ROLLS.map(([p]) => Math.round(p * 12) / 12).sort((a, b) => a - b))
  })
  it('el remix Lacrimosa los lleva en los dos drops, en la capa de ritmo', () => {
    const r = labRemixById('lacrimosa-drill')!
    for (const name of ['Drop', 'Drop 2']) {
      const ritmo = r.parts.find((p) => p.name === name)!.layers.find((l) => l.key === 'ritmo')!
      expect(ritmo.mel!.some((m) => m.synth === 'hat')).toBe(true)
    }
    expect(r.parts.find((p) => p.name === 'Intro')!.layers.some((l) => l.mel?.some((m) => m.synth === 'hat'))).toBe(false)
  })
})

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
  it('bombo escaso y platillo en chorro: seguido y con paradas (nunca las 16 semicorcheas)', () => {
    expect(demoSteps('bd')).toEqual([0, 6, 11])
    const hh = demoSteps('hh')
    expect(hh.length).toBeGreaterThanOrEqual(10)
    expect(hh.length).toBeLessThan(16)
    expect(hh.slice(0, 7)).toEqual([0, 1, 2, 3, 4, 5, 6]) // el chorro
    expect(hh).not.toContain(7) // y la parada
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

import { DRILL, labRemixById } from '../../app/lib/labRemixes'
import { PERC_MIDI, isPercSynth } from '../../app/lib/percSamples'
import { SYNTH_SOUND } from '../../app/lib/melody'
import { isFreeLoop } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { melodyCount } from '../../app/lib/singPart'

const tokens = (p: string): string[] => p.split(' ')
const stepsOf = (p: string, bar: number): number[] => tokens(p).slice(bar * 16, bar * 16 + 16).flatMap((t, i) => (t === '~' ? [] : [i]))

describe('la batería drill de los vídeos (spec 048)', () => {
  it('4 compases de 16 pasos: bombo desplazado, caja en el tiempo 3 con un redoble al final', () => {
    for (const k of ['bd', 'sd', 'hh'] as const) expect(tokens(DRILL[k])).toHaveLength(64)
    for (let b = 0; b < 4; b++) expect(stepsOf(DRILL.sd, b)).toContain(8) // la caja del tiempo 3, siempre
    expect(stepsOf(DRILL.sd, 3)).toEqual([8, 12, 13, 14, 15]) // el redoble del compás 4
    expect(stepsOf(DRILL.bd, 0)).toEqual([0, 10])
    for (let b = 0; b < 4; b++) expect(stepsOf(DRILL.bd, b)).toContain(0)
  })
  it('el charles va en chorro: tramos seguidos de semicorcheas con paradas, y nunca los 16 pasos', () => {
    for (let b = 0; b < 4; b++) {
      const s = stepsOf(DRILL.hh, b)
      expect(s.length).toBeGreaterThanOrEqual(10)
      expect(s.length).toBeLessThan(16)
      let run = 1
      let best = 1
      for (let i = 1; i < s.length; i++) best = Math.max(best, (run = s[i] === s[i - 1]! + 1 ? run + 1 : 1))
      expect(best).toBeGreaterThanOrEqual(6) // un chorro de 6 o más seguidas
    }
  })
  it('21 golpes de tresillo (3, 6, 3 y 9) a 2/3 de paso, justo donde el charles de la rejilla para', () => {
    expect(DRILL.rolls).toHaveLength(21)
    expect(DRILL.rolls[0]).toEqual([14, 2 / 3, PERC_MIDI])
    for (const [p, d] of DRILL.rolls) {
      expect(p + d).toBeLessThanOrEqual(64 + 1e-9)
      const bar = Math.floor(p / 16)
      const step = p - bar * 16
      expect(stepsOf(DRILL.hh, bar).filter((x) => x >= step - 1e-9 && x < step + d - 1e-9), `${p}`).toEqual([]) // no se pisan con un golpe de la rejilla
    }
  })
  it('`hat` es un sinte de muestra del 808: percusión (no melodía), válida al leer lo guardado', () => {
    const loop: FreeLoop = { id: 1, instrument: 'mel', bars: 4, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, synth: 'hat', hits: DRILL.rolls.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.7 })) as never }
    expect(isPercSynth('hat')).toBe(true)
    expect(SYNTH_SOUND.hat).toContain('.s("hh").bank("RolandTR808")')
    expect(isFreeLoop(loop)).toBe(true)
    expect(melodyCount([loop])).toBe(0)
  })
  it('Strudel toca los tresillos: cada golpe cae en su doceavo de paso', async () => {
    const loop: FreeLoop = { id: 1, instrument: 'mel', bars: 4, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, synth: 'hat', hits: DRILL.rolls.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.7 })) as never }
    const st = { loops: [loop], style: 'drill', kit: '808', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } } as unknown as Parameters<typeof songCode>[0]
    const ev = (await events(songCode(st, 'display'), 4)).filter((e) => e.value.s === 'hh')
    const got = ev.map((e) => Math.round(e.begin * 16 * 12) / 12).sort((a, b) => a - b)
    expect(got).toEqual(DRILL.rolls.map(([p]) => Math.round(p * 12) / 12).sort((a, b) => a - b))
  })
})

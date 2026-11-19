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
  it('bombo escaso y platillo sincopado en grupos 3-2-3, con huecos (como el tema de referencia)', () => {
    expect(demoSteps('bd')).toEqual([0, 6, 11])
    const hh = demoSteps('hh')
    expect(hh).toEqual([2, 3, 5, 7, 10, 13, 15])
    expect(hh.length).toBeLessThanOrEqual(8) // ~6 golpes por compás medidos; nunca un chorro
    const gaps = hh.slice(1).map((x, i) => x - hh[i]!)
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(3) // con huecos
    expect(gaps.filter((g) => g === 1).length).toBeLessThanOrEqual(1) // a lo sumo un par pegado
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
  it('bombo desplazado y caja en el tiempo 3 con un redoble al final del compás 4', () => {
    for (const k of ['bd', 'sd'] as const) expect(tokens(DRILL[k])).toHaveLength(64)
    for (let b = 0; b < 4; b++) expect(stepsOf(DRILL.sd, b)).toContain(8)
    expect(stepsOf(DRILL.sd, 3)).toEqual([8, 12, 13, 14, 15])
    expect(stepsOf(DRILL.bd, 0)).toEqual([0, 10])
    for (let b = 0; b < 4; b++) expect(stepsOf(DRILL.bd, b)).toContain(0)
  })
  const hatSteps = (bar: number): number[] => DRILL.hat.notes.map((n) => n[0]).filter((p) => p >= bar * 16 && p < bar * 16 + 16).map((p) => p - bar * 16)
  it('el charles es escaso, de ~6 a ~10 golpes por compás (el original tiene ~6,4), nunca un chorro', () => {
    for (let b = 0; b < 4; b++) {
      const n = hatSteps(b).length
      expect(n, `compás ${b + 1}`).toBeGreaterThanOrEqual(6)
      expect(n, `compás ${b + 1}`).toBeLessThanOrEqual(10)
    }
    expect(DRILL.hat.notes.length / 4).toBeLessThan(9)
  })
  it('sincopado en grupos 3-2-3: el esqueleto 2·5·7·10·13·15 en los cuatro compases', () => {
    for (let b = 0; b < 4; b++) for (const k of [2, 5, 7, 10]) expect(hatSteps(b), `compás ${b + 1}`).toContain(k)
    for (let b = 0; b < 3; b++) expect(hatSteps(b), `compás ${b + 1}`).toContain(13) // (el 4 lo cambia el redoble)
    const core = [2, 5, 7, 10, 13, 15].slice(1).map((x, i) => x - [2, 5, 7, 10, 13, 15][i]!)
    expect(core).toEqual([3, 2, 3, 3, 2]) // 3-2-3 · 3-2(-3)
    for (let b = 0; b < 4; b++) {
      // los huecos: no hay tramo de más de 3 golpes seguidos a semicorchea (el chorro de antes)
      const s = hatSteps(b).filter((x) => Number.isInteger(x))
      let run = 1
      let best = 1
      for (let i = 1; i < s.length; i++) best = Math.max(best, (run = s[i] === s[i - 1]! + 1 ? run + 1 : 1))
      expect(best, `compás ${b + 1}`).toBeLessThanOrEqual(2)
    }
  })
  it('la fuerza varía mucho (de 0,4 a 1) y el tono sube en el redoble', () => {
    const st = DRILL.hat.strengths
    expect(st).toHaveLength(DRILL.hat.notes.length)
    expect(Math.min(...st)).toBeLessThanOrEqual(0.45)
    expect(Math.max(...st)).toBe(1)
    expect(new Set(st).size).toBeGreaterThanOrEqual(7)
    // el redoble del compás 4: tres golpes a 2/3 de paso, cada vez más fuertes y más agudos (y solo ese: el original casi no tiene golpes pegados)
    const roll = DRILL.hat.notes.map((n, i) => ({ n, s: st[i]! })).filter((x) => x.n[0] >= 48 + 14)
    expect(roll).toHaveLength(3)
    for (let i = 1; i < roll.length; i++) {
      expect(roll[i]!.n[2]).toBeGreaterThan(roll[i - 1]!.n[2])
      expect(roll[i]!.s).toBeGreaterThan(roll[i - 1]!.s)
    }
    expect(roll[0]!.n[2]).toBeGreaterThan(PERC_MIDI)
    const adjacent = DRILL.hat.notes.filter((n, i, a) => i > 0 && n[0] - a[i - 1]![0] < 1 - 1e-9).length
    expect(adjacent).toBeLessThanOrEqual(2) // como mucho dos golpes pegados en los 4 compases
  })
  it('todo cae en la rejilla de semicorcheas o de tresillos de semicorchea (doceavos de paso) y cabe en 4 compases', () => {
    for (const [p, d] of DRILL.hat.notes) {
      expect(Math.abs(p * 3 - Math.round(p * 3)), `${p}`).toBeLessThan(1e-9)
      expect(p + d).toBeLessThanOrEqual(64 + 1e-9)
    }
  })
  const hatLoop = (): FreeLoop => ({ id: 1, instrument: 'mel', bars: 4, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, synth: 'hat', hits: DRILL.hat.notes.map(([pos, dur, midi], i) => ({ pos, dur, midi, strength: DRILL.hat.strengths[i]! })) as never })
  it('`hat` es un sinte de muestra del 808, fino y seco: percusión (no melodía), válida al leer lo guardado', () => {
    expect(isPercSynth('hat')).toBe(true)
    expect(SYNTH_SOUND.hat).toContain('.s("hh").bank("RolandTR808")')
    expect(SYNTH_SOUND.hat).toContain('.hpf(6500)') // fino
    expect(SYNTH_SOUND.hat).toContain('.sustain(0)') // sin cola
    expect(isFreeLoop(hatLoop())).toBe(true)
    expect(melodyCount([hatLoop()])).toBe(0)
  })
  it('Strudel toca cada golpe en su doceavo de paso, con su volumen (de 0,2 a 1 del volumen del loop) y su tono', async () => {
    const st = { loops: [hatLoop()], style: 'drill', kit: '808', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } } as unknown as Parameters<typeof songCode>[0]
    const code = songCode(st, 'display')
    const ev = (await events(code, 4)).filter((e) => e.value.s === 'hh')
    const got = ev.map((e) => Math.round(e.begin * 16 * 12) / 12).sort((a, b) => a - b)
    expect(got).toEqual(DRILL.hat.notes.map(([p]) => Math.round(p * 12) / 12).sort((a, b) => a - b))
    const gains = ev.map((e) => Number(e.value.gain)).filter((g) => Number.isFinite(g))
    expect(gains.length).toBe(ev.length)
    expect(Math.max(...gains) / Math.min(...gains)).toBeGreaterThan(1.4) // la fuerza se nota (el rango medido es más amplio; el suelo es 0,35)
  })
})

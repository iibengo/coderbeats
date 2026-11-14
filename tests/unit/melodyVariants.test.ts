import { describe, expect, it } from 'vitest'
import { melodyMini, type MelodyHit } from '../../app/lib/melody'
import { assistMelody } from '../../app/lib/melodyAssist'
import { applyLegato, CURRENT_SOUND, fxSuffix, glideOffsets, TIMBRES, variantCode, variantMini, type SoundConfig } from '../../app/lib/melodyVariants'
import { SYNTH_SOUND } from '../../app/lib/melody'
import { events } from '../helpers/strudelEval'

const h = (pos: number, dur: number, midi: number): MelodyHit => ({ pos, dur, midi, strength: 1 })
const input = (hits: MelodyHit[], o = {}) => ({ hits, bars: 1, phaseBar: 0, synth: 'piano' as const, bpm: 90, ...o })
const cfg = (o: Partial<SoundConfig> = {}): SoundConfig => ({ ...CURRENT_SOUND, ...o })

describe('legato', () => {
  it('rellena los huecos de hasta 2 pasos dentro del compás y no cruza la línea de compás', () => {
    const r = applyLegato([h(0, 2, 57), h(3, 2, 60), h(8, 2, 64), h(14, 2, 62)])
    expect(r.map((x) => [x.pos, x.dur])).toEqual([[0, 3], [3, 2], [8, 2], [14, 2]]) // 3→5 hueco de 3: no; 0→3 hueco 1: sí
  })
  it('un hueco mayor que el máximo se queda', () => {
    expect(applyLegato([h(0, 1, 57), h(5, 1, 60)]).map((x) => x.dur)).toEqual([1, 1])
    expect(applyLegato([h(0, 1, 57), h(5, 1, 60)], 4).map((x) => x.dur)).toEqual([5, 1])
  })
  it('entre compases no une', () => {
    expect(applyLegato([h(14, 1, 57), h(16, 1, 60)]).map((x) => x.dur)).toEqual([1, 1])
  })
})

describe('glide', () => {
  it('cada nota parte de la anterior si está pegada; acotado a ±12', () => {
    expect(glideOffsets([h(0, 2, 57), h(2, 2, 60), h(4, 2, 55)])).toEqual([0, -3, 5])
    expect(glideOffsets([h(0, 2, 40), h(2, 2, 80)])).toEqual([0, -12])
  })
  it('tras un hueco, un silencio o en otro compás, sin glide', () => {
    expect(glideOffsets([h(0, 1, 57), h(3, 1, 60)])).toEqual([0, 0])
    expect(glideOffsets([h(14, 2, 57), h(16, 2, 60)])).toEqual([0, 0])
  })
})

describe('variantMini', () => {
  it('con los nombres de nota da lo mismo que melodyMini (misma estructura)', () => {
    const hits = [h(0, 4, 57), h(4, 2, 60), h(8, 4, 64), h(16, 4, 62)]
    const names = (x: MelodyHit) => melodyMini([x], 1, 0).split(' ')[0]!.split('@')[0]!
    expect(variantMini(hits, 2, 0, (x) => names({ ...x, pos: 0 }))).toBe(melodyMini(hits, 2, 0))
    expect(variantMini(hits, 2, 1, (x) => names({ ...x, pos: 0 }))).toBe(melodyMini(hits, 2, 1))
  })
  it('un valor por nota con el mismo ritmo', () => {
    expect(variantMini([h(0, 2, 57), h(4, 2, 60)], 1, 0, (_x, i) => String(i))).toBe('0@2 ~@2 1@2 ~@10')
  })
})

describe('código de cada variante', () => {
  const hits = [h(0, 3, 57), h(3, 2, 60), h(5, 3, 64)]
  it('la actual es exactamente la línea de la app', () => {
    const code = variantCode(cfg(), input(hits))
    expect(code).toBe(`setcpm(90/4)\nnote("a3@3 c4@2 e4@3 ~@8")${SYNTH_SOUND.piano}.orbit(5)`)
  })
  it('legato solapado añade clip; huecos rellena', () => {
    expect(variantCode(cfg({ legato: 'huecos' }), input([h(0, 2, 57), h(3, 2, 60)]))).toContain('note("a3@3 c4@2 ~@11")')
    expect(variantCode(cfg({ legato: 'solapado' }), input(hits))).toContain('.clip(1.15)')
  })
  it('glide por penv: mismo ritmo que note(), enteros, y envolvente de altura', () => {
    const code = variantCode(cfg({ glide: 'penv', glideMs: 120 }), input(hits))
    expect(code).toContain('.penv("0@3 -3@2 -4@3 ~@8")'.replace('-4@3', '-4@3'))
    expect(code).toMatch(/\.pattack\(0\.001\)\.pdecay\(0\.12\)\.psustain\(0\)/)
  })
  it('reverb y delay extra, con el eco a una corchea con puntillo', () => {
    expect(fxSuffix(0, 0, 90)).toBe('')
    expect(fxSuffix(0.5, 0.5, 90)).toBe('.room(0.5).roomsize(3.5).delay(0.3).delaytime(0.5).delayfeedback(0.4)')
    expect(fxSuffix(2, 2, 120)).toContain('.room(1)')
  })
  it('cada combinación de sinte y timbre se evalúa en Strudel y toca las mismas notas', async () => {
    for (const synth of ['piano', 'lead', 'pad'] as const)
      for (const timbre of ['actual', 'b', 'c'] as const) {
        const ev = await events(variantCode(cfg({ timbre, glide: 'penv' }), input(hits, { synth })), 2)
        const notes = ev.filter((e) => e.value.note !== undefined)
        expect(notes.map((e) => e.value.note), `${synth} ${timbre}`).toEqual(['a3', 'c4', 'e4', 'a3', 'c4', 'e4'])
        expect(notes[0]!.value.penv, `${synth} ${timbre}`).toBe(0)
        expect(notes[1]!.value.penv).toBe(-3)
      }
  })
  it('todos los timbres tienen su línea', () => {
    for (const s of Object.values(TIMBRES)) for (const t of Object.values(s)) expect(t).toMatch(/^\.s\("/)
  })
})

describe('duración real (durGrid) en la ayuda', () => {
  const raw = [
    { step: 0, dur: 2.6, midi: 57, strength: 0.5 },
    { step: 4, dur: 0.7, midi: 60, strength: 0.5 },
    { step: 8, dur: 5.4, midi: 64, strength: 0.5 },
  ]
  const o = { assist: true, style: 'hiphop90' as const, startBar: 0, bars: 1, register: 'piano' as const, stepSeconds: 60 / 90 / 4 }
  it('sin la opción, la duración sigue yendo a celdas (el sonido de hoy no cambia)', () => {
    expect(assistMelody(raw, o).map((x) => x.dur)).toEqual([3, 1, 5])
  })
  it('con durGrid 0,25 la duración se acerca a lo cantado; el inicio sigue en la semicorchea', () => {
    const r = assistMelody(raw, { ...o, durGrid: 0.25 })
    expect(r.map((x) => x.pos)).toEqual([0, 4, 8])
    expect(r.map((x) => x.dur)).toEqual([2.5, 0.75, 5.5])
  })
})

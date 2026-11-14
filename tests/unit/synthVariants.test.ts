import { describe, expect, it } from 'vitest'
import { SYNTH_SOUND } from '../../app/lib/melody'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { SYNTH_VARIANTS, variantDemoCode } from '../../app/lib/synthVariants'
import { events } from '../helpers/strudelEval'

describe('variantes de sintes (spec 010, §6): solo para elegir de oído', () => {
  it('las referencias son los sonidos de hoy: no se tocan', () => {
    const by = (id: string) => SYNTH_VARIANTS.find((v) => v.id === id)!
    expect(by('lead-actual').line).toBe(SYNTH_SOUND.lead)
    expect(by('pad-actual').line).toBe(SYNTH_SOUND.pad)
    expect(by('bass-actual').line).toBe(STYLE_MUSIC.techno.background.bass.sound)
    // y los sonidos de la app siguen siendo los de siempre
    expect(SYNTH_SOUND.lead).toBe('.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)')
    expect(STYLE_MUSIC.techno.background.bass.sound).toBe('.s("sawtooth").lpf(450).gain(0.5)')
  })
  it('hay variantes de lead, pad y bajo, con id único', () => {
    expect(new Set(SYNTH_VARIANTS.map((v) => v.id)).size).toBe(SYNTH_VARIANTS.length)
    for (const role of ['lead', 'pad', 'bass']) expect(SYNTH_VARIANTS.filter((v) => v.role === role).length, role).toBeGreaterThanOrEqual(2)
  })
  it('cada variante es Strudel válido y trae los controles que dice', async () => {
    for (const v of SYNTH_VARIANTS) {
      const ev = await events(variantDemoCode(v), 4)
      expect(ev.length, v.id).toBeGreaterThan(0)
    }
    const val = async (id: string) => (await events(variantDemoCode(SYNTH_VARIANTS.find((v) => v.id === id)!), 1))[0]!.value
    expect(await val('lead-saw')).toMatchObject({ s: 'supersaw', unison: 5, detune: 0.25 })
    expect(await val('pad-ancho')).toMatchObject({ s: 'supersaw', attack: 0.8, release: 1.2 })
    expect(await val('bass-sat')).toMatchObject({ s: 'sawtooth', shape: 0.35 })
    expect(await val('bass-fm')).toMatchObject({ s: 'sine', fmi: 4 })
  })
})

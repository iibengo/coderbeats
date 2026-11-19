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
    expect(c).toContain('d1')
    expect(c).toContain('d3,f3,a3')
  })
  it('tiene melodías de dominio público que le pegan, todas dentro de su escala', () => {
    const list = tunesFor('drill')
    expect(list.length).toBeGreaterThanOrEqual(2)
    for (const t of list) for (const h of adaptTune(t, 'drill')) expect(STYLE_MUSIC.drill.scale).toContain(h.midi % 12)
  })
})

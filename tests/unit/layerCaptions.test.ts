import { describe, expect, it } from 'vitest'
import { STYLES } from '../../app/lib/constants'
import { describeDrums, hasGhostNotes, layerCaption, STYLE_LAYERS, type LayerKind } from '../../app/lib/layerCaptions'
import type { StyleId } from '../../app/lib/types'

const styles = Object.keys(STYLES) as StyleId[]
const kinds: LayerKind[] = ['bd', 'sd', 'hh', 'bass', 'chords', 'mel', 'ghost']

describe('rótulos de capa de Previsualizar (spec 016 §15)', () => {
  it('los 5 estilos tienen frase para las 7 capas, cortas (caben en un rótulo)', () => {
    for (const s of styles) for (const k of kinds) {
      const i = STYLE_LAYERS[s][k]
      expect(i.name.length, `${s} ${k}`).toBeGreaterThan(2)
      expect(i.line.length, `${s} ${k}`).toBeGreaterThan(5)
      expect(layerCaption(1, k, s).length, `${s} ${k}`).toBeLessThan(70)
    }
  })
  it('el formato es «n · Nombre: frase» (los ejemplos de la idea)', () => {
    expect(layerCaption(1, 'bd', 'techno')).toMatch(/^1 · Bombo: /)
    expect(layerCaption(4, 'ghost', 'dembow')).toBe('4 · Ghost notes: golpes suaves de caja justo antes')
  })
  it('lo que dicen los datos: patrones conocidos y, si no, cuántos golpes', () => {
    expect(describeDrums('bd', [0, 4, 8, 12])).toMatch(/cada tiempo/)
    expect(describeDrums('bd', [0, 8])).toMatch(/1 y el 3/)
    expect(describeDrums('sd', [12, 4])).toMatch(/backbeat/)
    expect(describeDrums('hh', Array.from({ length: 16 }, (_, i) => i))).toMatch(/semicorcheas/)
    expect(describeDrums('hh', [0, 2, 4, 6, 8, 10, 12, 14])).toMatch(/corcheas/)
    expect(describeDrums('hh', [2, 6, 10, 14])).toMatch(/contratiempos/)
    expect(describeDrums('sd', [3, 7, 11])).toMatch(/entre los tiempos/)
    expect(describeDrums('bd', [0, 3, 6, 10, 13])).toBe('5 golpes por compás')
    expect(describeDrums('bd', [5])).toBe('1 golpe por compás')
    expect(describeDrums('bd', [])).toBeNull()
  })
  it('con datos, el rótulo suma la frase del estilo y lo generado', () => {
    expect(layerCaption(2, 'sd', 'hiphop90', [4, 12])).toBe('2 · Caja: el golpe seco en 2 y 4 · en el 2 y el 4 (el backbeat)')
    expect(layerCaption(3, 'mel', 'house', [0, 4])).not.toContain('·  ·')
  })
  it('las ghost notes se detectan: suave justo antes de uno fuerte; no si están lejos o si todo es fuerte', () => {
    expect(hasGhostNotes([{ pos: 2, strength: 0.3 }, { pos: 4, strength: 0.9 }])).toBe(true)
    expect(hasGhostNotes([{ pos: 0, strength: 0.3 }, { pos: 4, strength: 0.9 }])).toBe(false)
    expect(hasGhostNotes([{ pos: 3, strength: 0.8 }, { pos: 4, strength: 0.9 }])).toBe(false)
    expect(hasGhostNotes([])).toBe(false)
  })
})

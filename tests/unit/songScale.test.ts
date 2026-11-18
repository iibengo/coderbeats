import { describe, expect, it } from 'vitest'
import { inferScale, inScale, isSongScale, outOfScale, parseScale, scaleLabel, scalePcs } from '../../app/lib/songScale'

describe('la escala de la canción (spec 038)', () => {
  it('lee las formas de escribirla', () => {
    const casos: [string, { tonic: number; mode: 'major' | 'minor' }][] = [
      ['sol menor', { tonic: 7, mode: 'minor' }], ['Sol menor', { tonic: 7, mode: 'minor' }], ['Gm', { tonic: 7, mode: 'minor' }], ['G minor', { tonic: 7, mode: 'minor' }],
      ['La mayor', { tonic: 9, mode: 'major' }], ['A', { tonic: 9, mode: 'major' }], ['C', { tonic: 0, mode: 'major' }], ['F#m', { tonic: 6, mode: 'minor' }],
      ['si bemol mayor', { tonic: 10, mode: 'major' }], ['Bb', { tonic: 10, mode: 'major' }], ['Bbm', { tonic: 10, mode: 'minor' }], ['do# menor', { tonic: 1, mode: 'minor' }],
      ['re♭ mayor', { tonic: 1, mode: 'major' }], ['B', { tonic: 11, mode: 'major' }], ['Em', { tonic: 4, mode: 'minor' }], ['CM', { tonic: 0, mode: 'major' }],
    ]
    for (const [t, e] of casos) expect(parseScale(t), t).toEqual(e)
  })
  it('lo que no entiende, lo rechaza (no adivina)', () => {
    for (const t of ['', 'blues', 'sol dorico', 'H menor', 'xyz', 'sol menor extra', 'a'.repeat(60)]) expect(parseScale(t), t).toBeNull()
  })
  it('las notas de cada escala y su nombre', () => {
    expect(scalePcs({ tonic: 7, mode: 'minor' })).toEqual([7, 9, 10, 0, 2, 3, 5]) // sol la si♭ do re mi♭ fa
    expect(scalePcs({ tonic: 0, mode: 'major' })).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(scaleLabel({ tonic: 7, mode: 'minor' })).toBe('sol menor')
    expect(scaleLabel({ tonic: 10, mode: 'major' })).toBe('si♭ mayor')
    expect(scaleLabel({ tonic: 6, mode: 'minor' })).toBe('fa♯ menor')
  })
  it('valida la forma exacta (datos, no código)', () => {
    expect(isSongScale({ tonic: 7, mode: 'minor' })).toBe(true)
    for (const x of [null, undefined, 5, 'sol', [], {}, { tonic: 12, mode: 'minor' }, { tonic: -1, mode: 'minor' }, { tonic: 7.5, mode: 'minor' }, { tonic: '7', mode: 'minor' }, { tonic: 7, mode: 'dorian' }, { tonic: 7, mode: 'minor', extra: 1 }, { tonic: 7 }, { mode: 'minor' }, JSON.parse('{"tonic":7,"mode":"minor","__proto__":{"x":1}}'), { tonic: 7, mode: 'minor', constructor: 1 }])
      expect(isSongScale(x), JSON.stringify(x)).toBe(false)
  })
  it('deduce la escala de los acordes: Gm–B♭–E♭–D es sol menor; Am–F–C–G, la menor; D–G–A, re mayor', () => {
    const ch = (...m: number[]) => m.map((midi) => ({ midi, weight: 16 }))
    const gm = [...ch(55, 58, 62), ...ch(58, 62, 65), ...ch(51, 55, 58), ...ch(50, 54, 57)] // Gm Bb Eb D(con F#)
    expect(inferScale(gm, [55, 58, 62], [50, 54, 57])).toEqual({ tonic: 7, mode: 'minor' })
    const am = [...ch(57, 60, 64), ...ch(53, 57, 60), ...ch(48, 52, 55), ...ch(55, 59, 62)]
    expect(inferScale(am, [57, 60, 64], [55, 59, 62])).toEqual({ tonic: 9, mode: 'minor' })
    const d = [...ch(50, 54, 57), ...ch(55, 59, 62), ...ch(57, 61, 64), ...ch(50, 54, 57)]
    expect(inferScale(d, [50, 54, 57], [50, 54, 57])).toEqual({ tonic: 2, mode: 'major' })
    expect(inferScale([])).toBeNull()
  })
  it('qué notas se salen', () => {
    const s = { tonic: 7, mode: 'minor' as const }
    expect(inScale(67, s)).toBe(true) // sol
    expect(inScale(66, s)).toBe(false) // fa♯
    expect(outOfScale([67, 66, 66, 61, 70], s)).toEqual([66, 61])
  })
})

import { emptySong, isSong } from '../../app/lib/cells'
import { savedFromShareObject } from '../../app/lib/shareLink'

describe('la escala en la canción guardada: opcional y compatible (spec 038)', () => {
  const base = () => emptySong()
  it('sin escala, la canción vale exactamente como antes; con una escala válida, también', () => {
    expect(isSong(base())).toBe(true)
    expect('scale' in base()).toBe(false)
    expect(isSong({ ...base(), scale: { tonic: 7, mode: 'minor' } })).toBe(true)
  })
  it('una escala mal formada hace que la canción no se abra (no se borra, no se arregla)', () => {
    for (const scale of [null, 'sol menor', { tonic: 99, mode: 'minor' }, { tonic: 7, mode: 'minor', x: '<script>' }, [], 7])
      expect(isSong({ ...base(), scale }), JSON.stringify(scale)).toBe(false)
  })
  it('viaja en el archivo/enlace y vuelve igual; sin ella, el archivo no lleva el campo', () => {
    const o = (g: unknown) => ({ v: 1, n: 'x', s: 'techno2', k: '808', b: 'manual', f: { filter: 1, space: 0, warmth: 0.5 }, g })
    const con = savedFromShareObject(o({ ...base(), scale: { tonic: 7, mode: 'minor' } }))
    expect(con?.song.scale).toEqual({ tonic: 7, mode: 'minor' })
    const sin = savedFromShareObject(o(base()))
    expect(sin).not.toBeNull()
    expect('scale' in sin!.song).toBe(false)
    expect(savedFromShareObject(o({ ...base(), scale: { tonic: 99, mode: 'minor' } }))).toBeNull()
  })
})

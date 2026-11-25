import { describe, expect, it } from 'vitest'
import { asciiRow, bandEdges, bandLevels, quietRow, smoothLevels } from '../../app/lib/cardLevels'

const SR = 48000
const FFT = 1024
const binHz = SR / FFT

/** un espectro con energía solo en la frecuencia dada */
const tone = (hz: number, v = 255): Uint8Array => {
  const b = new Uint8Array(FFT / 2)
  b[Math.round(hz / binHz)] = v
  return b
}

describe('energía por bandas para animar la tarjeta (spec 061, paso 4)', () => {
  it('los límites de las bandas crecen, en escala logarítmica', () => {
    const e = bandEdges(5)
    expect(e.length).toBe(6)
    expect(e[0]).toBeCloseTo(40)
    expect(e[5]).toBeCloseTo(12000)
    for (let i = 1; i < e.length; i++) expect(e[i]!).toBeGreaterThan(e[i - 1]!)
    expect(e[2]! / e[1]!).toBeCloseTo(e[3]! / e[2]!, 6)
  })

  it('un grave mueve la banda de los graves, y un agudo la de los agudos; en silencio, todo a cero', () => {
    const edges = bandEdges(5)
    const low = bandLevels(tone(80), SR, FFT, edges)
    const high = bandLevels(tone(8000), SR, FFT, edges)
    expect(low[0]!).toBeGreaterThan(0)
    expect(low.slice(2).every((v) => v === 0)).toBe(true)
    expect(high[4]!).toBeGreaterThan(0)
    expect(high.slice(0, 3).every((v) => v === 0)).toBe(true)
    expect(bandLevels(new Uint8Array(FFT / 2), SR, FFT, edges)).toEqual([0, 0, 0, 0, 0])
  })

  it('siempre entre 0 y 1, y sin NaN aunque el espectro sea raro', () => {
    for (const bytes of [new Uint8Array(FFT / 2).fill(255), new Uint8Array(4), new Uint8Array(0)]) {
      for (const v of bandLevels(bytes, SR, FFT, bandEdges(16))) {
        expect(Number.isFinite(v)).toBe(true)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  it('el suavizado sube deprisa y baja despacio (no tiembla)', () => {
    const up = smoothLevels([0, 0], [1, 1])
    expect(up[0]!).toBeGreaterThan(0.5)
    const down = smoothLevels([1, 1], [0, 0])
    expect(down[0]!).toBeGreaterThan(0.85)
    let v: number[] = [1]
    for (let i = 0; i < 40; i++) v = smoothLevels(v, [0])
    expect(v[0]!).toBeLessThan(0.01)
    expect(smoothLevels(undefined, [0.4])[0]!).toBeGreaterThan(0)
  })

  it('la fila de barras en texto: ▁ en silencio, ▇ al máximo, una por valor', () => {
    expect(asciiRow([0, 1])).toBe('▁▇')
    expect(asciiRow([-3, 9, 0.5])).toHaveLength(3)
    expect(asciiRow([0.5])).toBe('▄')
    expect(quietRow(4)).toBe('▁▁▁▁')
    expect(quietRow(-1)).toBe('')
  })
})

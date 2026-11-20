import { describe, expect, it } from 'vitest'
import { encodeMp3, firstSound, joinChunks, mp3FileName, sliceWithFade, toInt16 } from '../../app/lib/audioExport'

describe('exportar audio a MP3 (spec 054): partes puras', () => {
  it('joinChunks pega los bloques en orden', () => {
    expect([...joinChunks([new Float32Array([1, 2]), new Float32Array([]), new Float32Array([3])])]).toEqual([1, 2, 3])
  })
  it('firstSound: el primer fotograma con sonido en cualquiera de los dos canales, o -1', () => {
    const z = new Float32Array(10)
    expect(firstSound(z, z)).toBe(-1)
    const l = new Float32Array(10)
    const r = new Float32Array(10)
    r[4] = 0.2
    l[7] = 0.5
    expect(firstSound(l, r)).toBe(4)
    r[2] = 5e-5 // por debajo del umbral: sigue siendo silencio
    expect(firstSound(l, r)).toBe(4)
  })
  it('sliceWithFade: exactamente los fotogramas pedidos y un fundido de salida sin chasquido', () => {
    const x = new Float32Array(100).fill(1)
    const y = sliceWithFade(x, 10, 50, 10)
    expect(y.length).toBe(50)
    expect(y[0]).toBe(1)
    expect(y[39]).toBe(1)
    expect(y[49]).toBe(0) // el último, a cero
    expect(y[44]).toBeCloseTo(0.5, 5)
    expect(x[59]).toBe(1) // el original no se toca
    expect(sliceWithFade(x, 90, 50, 10).length).toBe(10) // si no hay tantos, los que haya
  })
  it('toInt16 recorta lo que pasa de ±1 y respeta los extremos', () => {
    expect([...toInt16(new Float32Array([0, 1, -1, 2, -2, 0.5]))]).toEqual([0, 32767, -32768, 32767, -32768, 16383])
  })
  it('el nombre sale sin acentos ni símbolos y con la fecha', () => {
    const d = new Date(2026, 10, 20, 17, 5)
    expect(mp3FileName('Sinfonía n.º 40', d)).toBe('sinfonia-n-40-coderbeats-20261120-1705.mp3')
    expect(mp3FileName('Korobeiniki', d)).toBe('korobeiniki-coderbeats-20261120-1705.mp3')
    expect(mp3FileName('???', d)).toBe('cancion-coderbeats-20261120-1705.mp3')
  })
  it('encodeMp3: un MP3 estéreo de 320 kbps de la duración justa (≈ 2 s)', async () => {
    const sr = 44100
    const n = sr * 2
    const l = new Float32Array(n)
    const r = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      l[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / sr)
      r[i] = 0.5 * Math.sin((2 * Math.PI * 660 * i) / sr)
    }
    let last = 0
    const parts = await encodeMp3(l, r, sr, 320, (p) => (last = p))
    const bytes = parts.reduce((n, p) => n + p.byteLength, 0)
    expect(last).toBe(1)
    // 320 kbps = 40000 bytes por segundo (la duración de los fotogramas de 1152 redondea un poco)
    expect(bytes).toBeGreaterThan(40000 * 2 * 0.95)
    expect(bytes).toBeLessThan(40000 * 2 * 1.1)
    const head = parts[0]!
    expect(head[0]! & 0xff).toBe(0xff) // sincronía de un fotograma MPEG
    expect(head[1]! & 0xe0).toBe(0xe0)
  })
})

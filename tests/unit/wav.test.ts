import { describe, expect, it } from 'vitest'
import { decodeWav, encodeWav } from '../../app/lib/wav'

describe('encodeWav', () => {
  it('cabecera RIFF/WAVE PCM 16 bits mono y muestras recortadas', () => {
    const buf = encodeWav(Float32Array.from([0, 1, -1, 2]), 48000)
    const v = new DataView(buf)
    const str = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4))
    expect([str(0), str(8), str(12), str(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data'])
    expect(v.getUint32(24, true)).toBe(48000)
    expect(v.getUint16(34, true)).toBe(16)
    expect(v.getUint32(40, true)).toBe(8)
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767])
  })
})

describe('decodeWav', () => {
  it('ida y vuelta con encodeWav (16 bits)', () => {
    const x = Float32Array.from({ length: 1000 }, (_, i) => 0.8 * Math.sin(i / 7))
    const r = decodeWav(encodeWav(x, 44100))!
    expect(r.sampleRate).toBe(44100)
    expect(r.samples).toHaveLength(1000)
    for (let i = 0; i < 1000; i++) expect(r.samples[i]).toBeCloseTo(x[i]!, 3)
  })

  it('devuelve null con basura, con otro formato o con un archivo cortado', () => {
    expect(decodeWav(new ArrayBuffer(10))).toBeNull()
    expect(decodeWav(new Uint8Array(100).buffer)).toBeNull()
    const wav = encodeWav(new Float32Array(10), 48000)
    const f = new DataView(wav.slice(0))
    f.setUint16(20, 3, true) // formato float
    expect(decodeWav(f.buffer as ArrayBuffer)).toBeNull()
  })

  it('un data que dice más de lo que hay no lee fuera del archivo', () => {
    const wav = encodeWav(new Float32Array(100), 48000)
    expect(decodeWav(wav.slice(0, 44 + 50))!.samples).toHaveLength(25)
  })
})

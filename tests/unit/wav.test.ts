import { describe, expect, it } from 'vitest'
import { encodeWav } from '../../app/lib/wav'

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

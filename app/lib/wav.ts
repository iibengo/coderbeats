/** WAV PCM 16 bits mono. */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const out = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(out)
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  str(0, 'RIFF')
  v.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]!))
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true)
  }
  return out
}

/** Lee un WAV PCM de 16 bits (el que escribe `encodeWav`); si hay varios canales, el primero. Null si no lo entiende. */
export function decodeWav(buf: ArrayBuffer): { samples: Float32Array; sampleRate: number } | null {
  if (buf.byteLength < 44) return null
  const v = new DataView(buf)
  const tag = (o: number) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3))
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  let channels = 0
  let sampleRate = 0
  let bits = 0
  let format = 0
  for (let o = 12; o + 8 <= buf.byteLength; ) {
    const id = tag(o)
    const size = v.getUint32(o + 4, true)
    if (id === 'fmt ') {
      format = v.getUint16(o + 8, true)
      channels = v.getUint16(o + 10, true)
      sampleRate = v.getUint32(o + 12, true)
      bits = v.getUint16(o + 22, true)
    } else if (id === 'data') {
      if (format !== 1 || bits !== 16 || channels < 1 || !sampleRate) return null
      const frames = Math.floor(Math.min(size, buf.byteLength - o - 8) / (2 * channels))
      const samples = new Float32Array(frames)
      for (let i = 0; i < frames; i++) {
        const s = v.getInt16(o + 8 + i * 2 * channels, true)
        samples[i] = s < 0 ? s / 0x8000 : s / 0x7fff
      }
      return { samples, sampleRate }
    }
    o += 8 + size + (size % 2)
  }
  return null
}

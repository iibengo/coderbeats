import { describe, expect, it } from 'vitest'
import { coverRect, estimateBytes, fileName, formatMB, MAX_SECONDS, outputSize, pickMime, secondsFor } from '../../app/lib/videoExport'

describe('exportar vídeo: partes puras (spec 013)', () => {
  it('tamaños: vertical 9:16 con alto par, cuadrado 1:1', () => {
    expect(outputSize('vertical', 720)).toEqual({ w: 720, h: 1280 })
    expect(outputSize('vertical', 1080)).toEqual({ w: 1080, h: 1920 })
    expect(outputSize('cuadrado', 720)).toEqual({ w: 720, h: 720 })
    for (const f of ['vertical', 'cuadrado'] as const) for (const s of [720, 1080] as const) expect(outputSize(f, s).h % 2).toBe(0)
  })
  it('tipo de archivo: Safari (solo mp4) → mp4; Chrome clásico → webm; sin soporte → null', () => {
    expect(pickMime((t) => t.startsWith('video/mp4'))).toEqual({ mime: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' })
    expect(pickMime((t) => t === 'video/mp4')).toEqual({ mime: 'video/mp4', ext: 'mp4' })
    expect(pickMime((t) => t.startsWith('video/webm'))).toEqual({ mime: 'video/webm;codecs=vp9,opus', ext: 'webm' })
    expect(pickMime((t) => t === 'video/webm')).toEqual({ mime: 'video/webm', ext: 'webm' })
    expect(pickMime(() => false)).toBeNull()
  })
  it('encuadre «cubrir»: llena el lienzo y se centra; sin deformar', () => {
    const r = coverRect(400, 800, 1000, 1000)
    expect(r.sw / r.sh).toBeCloseTo(1)
    expect(r.sx).toBeCloseTo(0)
    expect(r.sy).toBeCloseTo(200)
    const v = coverRect(400, 800, 720, 1280)
    expect(v.sw / v.sh).toBeCloseTo(720 / 1280)
    expect(v.sx).toBeCloseTo(0)
    const wide = coverRect(1600, 800, 720, 1280)
    expect(wide.sy).toBeCloseTo(0)
    expect(wide.sx).toBeGreaterThan(0)
  })
  it('tamaño estimado y tope', () => {
    expect(estimateBytes(60, 720)).toBeCloseTo(31_000_000, -6)
    expect(estimateBytes(60, 1080)).toBeGreaterThan(estimateBytes(60, 720))
    expect(formatMB(31_000_000)).toBe('30 MB')
    expect(formatMB(2_000_000)).toBe('1.9 MB')
    expect(secondsFor(4, 120)).toBe(8)
    expect(secondsFor(10_000, 90)).toBe(MAX_SECONDS)
  })
  it('nombre del archivo limpio', () => {
    expect(fileName('Hip hop 90', new Date(2026, 10, 5, 9, 7), 'mp4')).toBe('coderbeats-hip-hop-90-20261105-0907.mp4')
    expect(fileName('¡¡!!', new Date(2026, 0, 1, 0, 0), 'webm')).toBe('coderbeats-cancion-20260101-0000.webm')
  })
})

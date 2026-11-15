import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CalibrationSample } from '../../app/lib/types'
import { FakeStorage } from '../helpers/fakeStorage'

const KEY = 'coderbeats:calibration:v1'
const sample = (instrument: CalibrationSample['instrument'], k: number): CalibrationSample => ({
  instrument,
  features: { centroid: 0.1 * k, bands: [0.4, 0.3, 0.2, 0.1], mfcc: Array.from({ length: 13 }, (_, i) => i * k), zcr: 0.1, rms: 0.3 },
})
let ls: FakeStorage

async function fresh(preload?: (s: FakeStorage) => void) {
  vi.resetModules()
  ls = new FakeStorage()
  preload?.(ls)
  vi.stubGlobal('localStorage', ls)
  const { useCalibration } = await import('../../app/composables/useCalibration')
  return useCalibration()
}
beforeEach(() => vi.unstubAllGlobals())

describe('useCalibration: la calibración guardada (spec 001, 003 E6)', () => {
  it('sin calibración: no hay latencia ni muestras ni clasificador', async () => {
    const c = await fresh()
    expect(c.data.value).toBeNull()
    expect(c.hasLatency.value).toBe(false)
    expect(c.hasSamples.value).toBe(false)
    expect(c.classifier.value).toBeNull()
  })
  it('guardar la latencia la escribe y la conserva al volver a abrir', async () => {
    const c = await fresh()
    c.saveLatency({ ms: 42, spreadMs: 3, measuredAt: '2026-11-15T10:00:00Z' }, 48000)
    expect(c.hasLatency.value).toBe(true)
    expect(JSON.parse(ls.data.get(KEY)!).latency.ms).toBe(42)
    const saved = ls.data.get(KEY)!
    const again = await fresh((s) => s.data.set(KEY, saved))
    expect(again.data.value?.latency?.ms).toBe(42)
  })
  it('guardar las muestras calcula la normalización, conserva la latencia y arma el clasificador', async () => {
    const c = await fresh()
    c.saveLatency({ ms: 30, spreadMs: 2, measuredAt: '2026-11-15T10:00:00Z' }, 48000)
    c.saveSamples([sample('bd', 1), sample('sd', 2), sample('hh', 3), sample('bd', 1.2)], 48000)
    expect(c.hasSamples.value).toBe(true)
    expect(c.data.value?.latency?.ms).toBe(30)
    expect(c.data.value?.samples).toHaveLength(4)
    expect(c.data.value?.norm.mean.length).toBeGreaterThan(0)
    expect(c.classifier.value).not.toBeNull()
  })
  it('repetir la calibración de sonidos sustituye las muestras y no toca la latencia', async () => {
    const c = await fresh()
    c.saveLatency({ ms: 30, spreadMs: 2, measuredAt: 'x' }, 48000)
    c.saveSamples([sample('bd', 1)], 48000)
    c.saveSamples([sample('sd', 2), sample('hh', 3)], 48000)
    expect(c.data.value?.samples.map((s) => s.instrument)).toEqual(['sd', 'hh'])
    expect(c.data.value?.latency?.ms).toBe(30)
  })
  it('lo guardado con forma rara no se usa (se descarta al leer, sin tirar)', async () => {
    for (const bad of ['{', '"hola"', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, sampleRate: 'x', samples: [], norm: {} })]) {
      const c = await fresh((s) => s.data.set(KEY, bad))
      expect(c.data.value).toBeNull()
      expect(ls.data.get(KEY)).toBe(bad) // leer no borra
    }
  })
  it('sin almacenamiento, la calibración vale solo para esta sesión', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', undefined)
    const { useCalibration } = await import('../../app/composables/useCalibration')
    const c = useCalibration()
    c.saveLatency({ ms: 20, spreadMs: 1, measuredAt: 'x' }, 44100)
    expect(c.hasLatency.value).toBe(true)
  })
})

import { computed, shallowRef } from 'vue'
import { computeNorm, KnnClassifier } from '~/lib/classifier'
import { toVector } from '~/lib/features'
import { readJson, writeJson } from '~/lib/storage'
import type { CalibrationData, CalibrationSample, LatencyCalibration } from '~/lib/types'

const KEY = 'coderbeats:calibration:v1'

function isCalibration(x: unknown): x is CalibrationData {
  if (!x || typeof x !== 'object') return false
  const c = x as Partial<CalibrationData>
  return (
    c.version === 1 &&
    typeof c.sampleRate === 'number' &&
    Array.isArray(c.samples) &&
    c.samples.every((s) => s && ['bd', 'sd', 'hh'].includes(s.instrument) && Array.isArray(s.features?.mfcc)) &&
    !!c.norm &&
    Array.isArray(c.norm.mean)
  )
}

const read = (): CalibrationData | null => readJson(KEY, isCalibration)

const data = shallowRef<CalibrationData | null>(null)
let loaded = false

function write(next: CalibrationData) {
  data.value = next
  // sin almacenamiento (modo privado): la calibración vale solo para esta sesión
  writeJson(KEY, next)
}

export function useCalibration() {
  if (!loaded && import.meta.client) {
    data.value = read()
    loaded = true
  }

  const classifier = computed(() =>
    data.value && data.value.samples.length ? new KnnClassifier(data.value.samples, data.value.norm) : null,
  )

  function base(sampleRate: number): CalibrationData {
    return (
      data.value ?? {
        version: 1,
        createdAt: new Date().toISOString(),
        sampleRate,
        samples: [],
        norm: { mean: [], std: [] },
        latency: null,
      }
    )
  }

  function saveLatency(latency: LatencyCalibration, sampleRate: number) {
    write({ ...base(sampleRate), latency })
  }

  function saveSamples(reactiveSamples: CalibrationSample[], sampleRate: number) {
    // copia plana: puede venir de un ref de Vue (proxy) y debe poder enviarse al worker
    const samples = JSON.parse(JSON.stringify(reactiveSamples)) as CalibrationSample[]
    write({
      ...base(sampleRate),
      createdAt: new Date().toISOString(),
      sampleRate,
      samples,
      norm: computeNorm(samples.map((s) => toVector(s.features))),
    })
  }

  return {
    data,
    classifier,
    hasLatency: computed(() => !!data.value?.latency),
    hasSamples: computed(() => (data.value?.samples.length ?? 0) > 0),
    saveLatency,
    saveSamples,
  }
}

import { computed, shallowRef } from 'vue'
import { computeNorm, KnnClassifier } from '~/lib/classifier'
import { toVector } from '~/lib/features'
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

function read(): CalibrationData | null {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isCalibration(parsed) ? parsed : null
  } catch {
    return null
  }
}

const data = shallowRef<CalibrationData | null>(null)
let loaded = false

function write(next: CalibrationData) {
  data.value = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // sin almacenamiento (modo privado): la calibración vale solo para esta sesión
  }
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

  function saveSamples(samples: CalibrationSample[], sampleRate: number) {
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

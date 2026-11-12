import type { CalibrationSample, Instrument, Norm } from './types'

/** hilo principal → worker de análisis */
export type ToWorker =
  | { type: 'init'; sampleRate: number; samples: CalibrationSample[]; norm: Norm }
  | { type: 'calibration'; samples: CalibrationSample[]; norm: Norm }
  | {
      type: 'start'
      minGap: number
      echo: { roundTrip: number; echoLevel: number } | null
    }
  | { type: 'stop' }
  /** tiempos de contexto en los que la app hará sonar algo (para el filtro de eco) */
  | { type: 'output'; times: number[] }

/** worker de análisis → hilo principal */
export type FromWorker =
  | {
      type: 'hit'
      /** tiempo de contexto del onset (frame / sampleRate) */
      time: number
      instrument: Instrument | 'unknown'
      confidence: number
      strength: number
      /** ms desde el onset hasta la decisión */
      decisionMs: number
    }
  | { type: 'echo'; time: number; strength: number }

/** Muestras que necesita la extracción de features tras el onset (2 ventanas de 2048 solapadas a la mitad). */
export const FEATURE_SPAN = 3072

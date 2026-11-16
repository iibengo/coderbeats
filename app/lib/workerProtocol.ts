import type { CalibrationSample, Instrument, Norm } from './types'

/** hilo principal → worker de análisis */
export type ToWorker =
  /** `default`: son las muestras del modelo por defecto (se adapta al micro, spec 001 §17.8); `centers`: lo aprendido en otra sesión */
  | { type: 'init'; sampleRate: number; samples: CalibrationSample[]; norm: Norm; default?: boolean; centers?: number[] | null }
  | { type: 'calibration'; samples: CalibrationSample[]; norm: Norm; default?: boolean; centers?: number[] | null }
  | {
      type: 'start'
      minGap: number
      echo: { roundTrip: number; echoLevel: number } | null
      /** seguir la altura de la voz (spec 002): los golpes esperan ~0,35 s a saber si son melodía */
      melody?: boolean
    }
  | { type: 'stop' }
  /** tiempos de contexto en los que la app hará sonar algo (para el filtro de eco) */
  | { type: 'output'; times: number[] }
  /** carriles que graban (spec 003, E4.2): el clasificador elige solo entre ellos */
  | { type: 'lanes'; armed: Instrument[] }
  /** activa o desactiva la melodía en marcha (spec 002) */
  | { type: 'melody'; on: boolean }
  /** pide las notas de la voz entre dos tiempos de contexto (s); se contesta con `notes` */
  | { type: 'notes'; id: number; from: number; to: number }

/** worker de análisis → hilo principal */
export type FromWorker =
  | {
      type: 'hit'
      /** tiempo de contexto del onset (frame / sampleRate) */
      time: number
      instrument: Instrument | 'unknown'
      confidence: number
      strength: number
      /** volumen relativo a tu calibración (1 = como tus golpes); null sin calibración (E4.0) */
      vol: number | null
      /** ms desde el onset hasta la decisión */
      decisionMs: number
      /** lo lejos que cae de las muestras de su clase (distancia al vecino más cercano ÷ distancia media entre muestras); `null` si no hay modelo o fue desconocido (modelFit) */
      fit?: number | null
      /** cómo sonó el golpe para el diagnóstico: centroide, cruces por cero y energía por debajo de 800 Hz */
      feat?: { c: number; z: number; low: number }
    }
  /** el modelo por defecto aprendió (o ajustó) los tres centros de claridad de este micro: bum, pff, ts */
  | { type: 'learned'; centers: number[] }
  | { type: 'echo'; time: number; strength: number }
  /** golpe de un carril apagado: se ignora (spec 003, E4.2) */
  | { type: 'ignored'; time: number; instrument: Instrument; confidence: number; vol: number | null }
  /** una nota de la voz acaba de nacer (spec 002): `time` es su inicio */
  | { type: 'melodic'; time: number; midi: number }
  /** la altura de la voz ahora (~30 por segundo, solo con melodía): `midi: null` si no hay voz */
  | { type: 'pitch'; time: number; midi: number | null }
  /** un golpe que cayó dentro de una nota: es melodía, no batería (no se manda como golpe) */
  | { type: 'absorbed'; time: number }
  | { type: 'notes'; id: number; notes: { start: number; end: number; midi: number; rms: number }[] }

/** Muestras que necesita la extracción de features tras el onset (2 ventanas de 2048 solapadas a la mitad). */
export const FEATURE_SPAN = 3072

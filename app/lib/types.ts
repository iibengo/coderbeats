export type Instrument = 'bd' | 'sd' | 'hh'
export type KitId = 'electro' | '808' | 'vinyl'
/** `house` y `techno` son los de siempre (**clásicos**: las canciones guardadas siguen sonando igual); `house2` y `techno2` son los nuevos, diferenciados por patrones (spec 023) */
export type StyleId = 'hiphop90' | 'house' | 'dnb' | 'dembow' | 'techno' | 'house2' | 'techno2'

export interface Style {
  id: StyleId
  label: string
  bpm: number
  /** al grabar, cuantizar cada N semicorcheas (2 = corcheas, medio tiempo de dnb) */
  quantizeEvery: 1 | 2
  /** estilo de antes de la spec 023: no sale en la lista para elegir, pero abre y suena igual las canciones guardadas con él */
  legacy?: boolean
}

export interface Kit {
  id: KitId
  label: string
  /** banco de strudel.cc; `null` = sin `.bank()` (el kit por defecto de strudel.cc, uzu-drumkit; spec 010) */
  strudelBank: string | null
  /** línea `samples('github:…')` que el código mostrado necesita en strudel.cc si el kit no es de los suyos (spec 010) */
  samples?: string
  /** índice del sample en el mapa de strudel.cc (para que suene igual al copiar el código) */
  sampleIndex: Record<Instrument, number>
}

/** time en segundos desde el inicio del buffer analizado */
export interface Onset {
  time: number
  strength: number
}

export interface FeatureVector {
  /** centroide normalizado a 0..1 (fracción de Nyquist) */
  centroid: number
  /** proporción de energía en <150, 150-800, 800-4k, >4k Hz */
  bands: [number, number, number, number]
  /** 13 coeficientes */
  mfcc: number[]
  /** cruces por cero por muestra (0..1) */
  zcr: number
  /** no entra en la distancia */
  rms: number
}

export interface CalibrationSample {
  instrument: Instrument
  features: FeatureVector
}

export interface Norm {
  mean: number[]
  std: number[]
}

export interface LatencyCalibration {
  ms: number
  spreadMs: number
  measuredAt: string
}

export interface CalibrationData {
  version: 1
  createdAt: string
  sampleRate: number
  samples: CalibrationSample[]
  norm: Norm
  latency: LatencyCalibration | null
}

export interface ClassifiedHit {
  onset: Onset
  instrument: Instrument | 'unknown'
  confidence: number
}

export type Step = Instrument | null

export interface Pattern {
  stepsPerBar: 16
  bars: number
  steps: Step[]
  offsetsMs: (number | null)[]
}

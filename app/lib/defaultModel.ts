/**
 * El modelo por defecto de «bum · pff · ts» (spec 001, «Modelo por defecto»): para empezar a tocar al instante, sin calibrar. Son **prototipos genéricos** de las tres
 * clases en el espacio de características que ya usa el clasificador (centroide, energía por bandas y cruces por cero), sacados de cómo suena el beatbox típico:
 *   - «bum» (bombo): energía abajo (< 800 Hz), poco brillo, pocos cruces por cero;
 *   - «pff» (caja): ruido en medio y arriba (800 Hz – 4 kHz sobre todo), cruces medios;
 *   - «ts» (platillo): casi todo por encima de 4 kHz, muchos cruces por cero.
 * Los MFCC dependen mucho de la voz y del micro: aquí **no pesan** (desviación enorme, así no distinguen ni mueven la distancia). Sin volumen de referencia (`rms` 0):
 * no se descarta ningún golpe por flojo hasta que haya calibración propia. Puro y determinista.
 */
import { KnnClassifier } from './classifier'
import { toVector } from './features'
import type { CalibrationSample, FeatureVector, Instrument, Norm } from './types'

interface Proto {
  centroid: number
  bands: [number, number, number, number]
  zcr: number
}

/** valores medios por clase (a afinar con más tomas; medidos con `tests/unit/defaultModel.test.ts` sobre las tomas del laboratorio) */
export const PROTOTYPES: Record<Instrument, Proto> = {
  bd: { centroid: 0.31, bands: [0.35, 0.4, 0.1, 0.15], zcr: 0.15 },
  sd: { centroid: 0.38, bands: [0.0, 0.05, 0.55, 0.4], zcr: 0.3 },
  hh: { centroid: 0.51, bands: [0.0, 0.0, 0.01, 0.99], zcr: 0.5 },
}

/** variación de cada muestra alrededor del prototipo: da al clasificador una nube pequeña (k = 3) en vez de un punto */
const JITTER: { c: number; b: number; z: number }[] = [
  { c: 0, b: 0, z: 0 },
  { c: 0.02, b: 0.04, z: 0.02 },
  { c: -0.02, b: -0.04, z: -0.02 },
  { c: 0.01, b: -0.03, z: 0.03 },
  { c: -0.01, b: 0.03, z: -0.03 },
]

function sample(inst: Instrument, j: { c: number; b: number; z: number }): CalibrationSample {
  const p = PROTOTYPES[inst]
  // el jitter de bandas mueve energía entre la primera y la última con energía, sin salirse de 0..1
  const bands = p.bands.map((x, i) => Math.min(1, Math.max(0, x + (i === 0 || i === 3 ? j.b * (x > 0.005 ? 1 : 0) : 0)))) as FeatureVector['bands']
  const features: FeatureVector = { centroid: p.centroid + j.c, bands, mfcc: new Array<number>(13).fill(0), zcr: Math.max(0, p.zcr + j.z), rms: 0 }
  return { instrument: inst, features }
}

/** escala de cada dimensión (centroide, 4 bandas, 13 MFCC, zcr): los MFCC con una desviación enorme no cuentan */
const STD = [0.08, 0.25, 0.25, 0.25, 0.25, ...new Array<number>(13).fill(1e6), 0.12]

export interface DefaultCalibration {
  samples: CalibrationSample[]
  norm: Norm
}

/** Las muestras y la normalización del modelo por defecto. */
export function defaultCalibration(): DefaultCalibration {
  const samples = (['bd', 'sd', 'hh'] as const).flatMap((i) => JITTER.map((j) => sample(i, j)))
  const vectors = samples.map((s) => toVector(s.features))
  const mean = STD.map((_, d) => vectors.reduce((n, v) => n + v[d]!, 0) / vectors.length)
  return { samples, norm: { mean, std: [...STD] } }
}

/** El clasificador por defecto (k-NN sobre los prototipos). */
export const defaultClassifier = (): KnnClassifier => {
  const c = defaultCalibration()
  return new KnnClassifier(c.samples, c.norm)
}

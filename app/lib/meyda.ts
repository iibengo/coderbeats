import Meyda from 'meyda'
import type { MeydaAudioFeature, MeydaFeaturesObject } from 'meyda'

/**
 * Envoltorio mínimo sobre Meyda: su configuración es global, así que cada llamada
 * fija bufferSize y sampleRate antes de extraer.
 */
export function extract(
  features: MeydaAudioFeature[],
  frame: Float32Array,
  sampleRate: number,
): Partial<MeydaFeaturesObject> {
  Meyda.bufferSize = frame.length
  Meyda.sampleRate = sampleRate
  Meyda.numberOfMFCCCoefficients = 13
  Meyda.windowingFunction = 'hanning'
  return (Meyda.extract(features, frame) ?? {}) as Partial<MeydaFeaturesObject>
}

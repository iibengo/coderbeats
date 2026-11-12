import { StreamingOnsetDetector, type OnsetOptions } from './streamingOnsets'
import type { Onset } from './types'

export { DEFAULT_ONSET_OPTIONS, minGapForCell, type OnsetOptions } from './streamingOnsets'

/**
 * Detección offline: el mismo detector en streaming, alimentado con el buffer entero.
 * Así offline y streaming dan exactamente el mismo resultado.
 */
export function detectOnsets(buf: Float32Array, sampleRate: number, options: Partial<OnsetOptions> = {}): Onset[] {
  const d = new StreamingOnsetDetector(sampleRate, options)
  return [...d.push(buf), ...d.flush()].map(({ time, strength }) => ({ time, strength }))
}

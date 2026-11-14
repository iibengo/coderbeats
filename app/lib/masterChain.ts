/**
 * Cadena master «cálida» (spec 010, §7): saturación suave y compresión de pegamento delante del limitador de siempre.
 * Un solo sonido, sin opción. Aquí, lo puro: la curva del saturador y los ajustes del compresor. El compresor en sí es
 * el worklet `public/worklets/master-glue.js` (sin latencia, para no mover la latencia que miden el `echoGate` y la
 * calibración); el cableado está en `useAudioEngine.start()`.
 *
 *   masterIn → saturador → compresor de pegamento → limitador (−6 dB, ratio 20) → techo −1 dB → salida
 */

/** El saturador: `tanh` con una pizca de asimetría (armónicos pares, el calor) y ganancia 1 con señal pequeña. */
export const SATURATION = { drive: 1.25, bias: 0.06 } as const

/** Un punto de la curva del saturador, `x` entre −1 y 1. Impar-ish, monótona, acotada y con pendiente 1 en el 0. */
export function saturate(x: number, drive: number = SATURATION.drive, bias: number = SATURATION.bias): number {
  const y = Math.tanh(drive * (x + bias)) - Math.tanh(drive * bias)
  // pendiente en 0 = drive·(1 − tanh²(drive·bias)); se divide para que sea 1 (sin subir ni bajar lo que es pequeño)
  return y / (drive * (1 - Math.tanh(drive * bias) ** 2))
}

/** La curva para un `WaveShaperNode` (de −1 a 1 en `n` puntos). */
export function saturationCurve(n = 2049, drive: number = SATURATION.drive, bias: number = SATURATION.bias): Float32Array {
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) c[i] = saturate((i * 2) / (n - 1) - 1, drive, bias)
  return c
}

export interface GlueOptions {
  /** nivel (dB) por encima del cual empieza a comprimir */
  thresholdDb: number
  ratio: number
  /** anchura de la rodilla (dB) */
  kneeDb: number
  /** segundos; el ataque lento deja pasar el golpe del bombo */
  attack: number
  /** segundos; más corto que un tiempo (a 128 bpm, 0,47 s) para que no «respire» con el bombo */
  release: number
  /** ventana del detector RMS, en ms */
  rmsMs: number
  makeupDb: number
}

/** Ajustes del compresor: ratio bajo y umbral alto, para 1–2 dB de reducción como mucho en una mezcla normal. */
export const GLUE_WARM: GlueOptions = { thresholdDb: -16, ratio: 1.8, kneeDb: 12, attack: 0.03, release: 0.12, rmsMs: 40, makeupDb: 1 }

/**
 * Pista de voz real (spec 007), partes puras: cortar la toma alineada a la línea de compás (con la latencia corregida), fundidos y normalización,
 * 16 bits para guardar, envolvente para dibujar, y el identificador del audio (que acaba escrito en el código Strudel: patrón estricto).
 */

/** El identificador del audio: letras minúsculas y números, empieza por `v` (spec 007 §7). */
export const VOICE_ID = /^v[a-z0-9]{6,20}$/
export const isVoiceId = (x: unknown): x is string => typeof x === 'string' && VOICE_ID.test(x)

/** Un identificador nuevo (se genera aquí; nunca se lee tal cual de fuera). `rand` devuelve 0..1. */
export function newVoiceId(rand: () => number = Math.random): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = 'v'
  for (let i = 0; i < 10; i++) s += abc[Math.floor(rand() * abc.length) % abc.length]
  return s
}

/** Límites de guardado (spec 007 §9). */
export const MAX_VOICE_BYTES_PER_TAKE = 3 * 1024 * 1024
export const MAX_VOICE_BYTES_TOTAL = 60 * 1024 * 1024
/** Compases que dura una toma: 1, 2 o 4 (spec 007 §6.1). */
export type VoiceBars = 1 | 2 | 4

/** Muestras exactas de `bars` compases a `bpm` (4 tiempos por compás): el bucle dura siempre compases enteros. */
export const loopSamples = (bars: number, bpm: number, sampleRate: number): number => Math.round((bars * 4 * 60 * sampleRate) / bpm)

/**
 * Corta de una captura (`buffer`, que empieza en el instante de contexto `bufferStart`, s) el trozo que **se cantó** entre `start` (la línea de compás)
 * y `bars` compases después. La voz llega al micro con la ida y vuelta de la calibración (`latencySec`) de retraso, así que se toma desde `start + latencySec`.
 * Lo que falte (la captura empezó tarde o acabó pronto) se rellena con silencio: la longitud es siempre la del bucle.
 */
export function cutBars(buffer: Float32Array, bufferStart: number, sampleRate: number, start: number, bars: number, bpm: number, latencySec: number): Float32Array {
  const n = loopSamples(bars, bpm, sampleRate)
  const out = new Float32Array(n)
  const from = Math.round((start + latencySec - bufferStart) * sampleRate)
  for (let i = 0; i < n; i++) {
    const j = from + i
    if (j >= 0 && j < buffer.length) out[i] = buffer[j]!
  }
  return out
}

/** Fundido de entrada y de salida (por defecto 5 ms) para que el empalme del bucle no haga clic. Modifica y devuelve el mismo arreglo. */
export function fadeEdges(samples: Float32Array, sampleRate: number, ms = 5): Float32Array {
  const k = Math.min(Math.floor((ms / 1000) * sampleRate), samples.length >> 1)
  for (let i = 0; i < k; i++) {
    const g = i / k
    samples[i] = samples[i]! * g
    samples[samples.length - 1 - i] = samples[samples.length - 1 - i]! * g
  }
  return samples
}

/** Baja el pico a −3 dBFS si lo pasa; **no** sube lo flojo (no se amplifica el ruido). */
export function normalizePeak(samples: Float32Array, ceilingDb = -3): Float32Array {
  let peak = 0
  for (const v of samples) peak = Math.max(peak, Math.abs(v))
  const ceil = 10 ** (ceilingDb / 20)
  if (peak <= ceil) return samples
  const g = ceil / peak
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * g
  return samples
}

/** Remuestrea por interpolación lineal (para guardar a 24 kHz: suficiente por debajo de 12 kHz). */
export function resample(samples: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return samples
  const n = Math.round((samples.length * to) / from)
  const out = new Float32Array(n)
  const r = from / to
  for (let i = 0; i < n; i++) {
    const x = i * r
    const i0 = Math.floor(x)
    const f = x - i0
    out[i] = samples[i0]! * (1 - f) + (samples[Math.min(samples.length - 1, i0 + 1)] ?? 0) * f
  }
  return out
}

export function toPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767)
  return out
}

export function fromPcm16(pcm: Int16Array): Float32Array {
  const out = new Float32Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i]! / 32767
  return out
}

/** La envolvente para dibujar la onda: el pico de cada uno de los `bins` tramos, 0..1. Se calcula una vez al nacer el loop. */
export function envelope(samples: Float32Array, bins = 180): Float32Array {
  const out = new Float32Array(bins)
  const per = samples.length / bins
  for (let b = 0; b < bins; b++) {
    let peak = 0
    for (let i = Math.floor(b * per); i < Math.floor((b + 1) * per); i++) peak = Math.max(peak, Math.abs(samples[i]!))
    out[b] = peak
  }
  return out
}

/** ¿Hay algo cantado? (el pico del trozo supera un umbral: una toma de silencio no se guarda) */
export const hasVoice = (samples: Float32Array, threshold = 0.02): boolean => samples.some((v) => Math.abs(v) >= threshold)

/**
 * Prepara una toma para guardarla: corta, fundidos, normaliza, y a 24 kHz y 16 bits. Devuelve `null` si no hay voz o pesa más de lo permitido.
 */
export function prepareTake(
  capture: { buffer: Float32Array; startTime: number; sampleRate: number },
  start: number, bars: VoiceBars, bpm: number, latencySec: number,
  storeRate = 24000,
): { pcm: Int16Array; sampleRate: number; envelope: Float32Array } | null {
  const cut = cutBars(capture.buffer, capture.startTime, capture.sampleRate, start, bars, bpm, latencySec)
  if (!hasVoice(cut)) return null
  const low = resample(normalizePeak(fadeEdges(cut, capture.sampleRate)), capture.sampleRate, storeRate)
  const pcm = toPcm16(low)
  if (pcm.byteLength > MAX_VOICE_BYTES_PER_TAKE) return null
  return { pcm, sampleRate: storeRate, envelope: envelope(low) }
}

/** Audios que ya no usa nadie: los guardados que no están en la lista de los que usan las canciones guardadas y la sesión (recuento de referencias). */
export const unusedAudio = (stored: readonly string[], used: Iterable<string>): string[] => {
  const keep = new Set(used)
  return stored.filter((id) => !keep.has(id))
}

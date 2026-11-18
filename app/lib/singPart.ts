/**
 * Cantar una parte (spec 039). Puro. De 2–4 compases de voz (ya cortados y alineados con el compás de la parte) a los golpes de un loop de melodía:
 * se siguen las alturas con el detector de siempre (`trackPitch` + `segmentNotes`), se ajustan a la **escala de la canción** y se cuantizan a la rejilla
 * de semicorcheas (`assistMelody`, con la escala propia). Sin red ni IA.
 */
import { hasVoice } from './voiceLoop'
import { assistMelody, type RawNote } from './melodyAssist'
import type { FreeLoop } from './freeLoops'
import { isFxLoop } from './melodyEdit'
import { applyLegato } from './melodyVariants'
import type { MelodyHit, MelodySynth } from './melody'
import { segmentNotes } from './notes'
import { trackPitch } from './pitch'
import { scalePcs, type SongScale } from './songScale'

export const SING_BARS = [2, 4] as const
export type SingBars = (typeof SING_BARS)[number]
/** como mucho esta cantidad de melodías (sin contar efectos ni el bajo y los acordes propios) en una parte */
export const MAX_PART_MELODIES = 3

export interface SungOptions {
  scale: SongScale
  /** compases cantados (2 o 4) */
  bars: number
  /** segundos por semicorchea */
  stepSeconds: number
  /** de qué sinte es el registro (la melodía se sube o baja por octavas hasta él) */
  register: MelodySynth | 'bass'
}

/** Cuántas melodías hay en la parte (sin contar efectos ni el bajo y los acordes propios de la canción). */
export const melodyCount = (loops: readonly FreeLoop[]): number => loops.filter((l) => l.instrument === 'mel' && !isFxLoop(l) && l.synth !== 'bass' && l.synth !== 'keys').length

/** ¿Se oyó algo? (una toma de silencio no crea nada) */
export const hasSung = (samples: Float32Array): boolean => hasVoice(samples)

/**
 * Las notas cantadas → golpes del loop (`pos` relativo al inicio de la toma). `heard` = notas que detectó el detector (para decir «oí 7 notas»).
 */
export function hitsFromSung(samples: Float32Array, sampleRate: number, o: SungOptions): { hits: MelodyHit[]; heard: number } {
  if (!hasSung(samples)) return { hits: [], heard: 0 }
  const notes = segmentNotes(trackPitch(samples, sampleRate), [])
  const raw: RawNote[] = notes.map((n) => ({ step: n.start / o.stepSeconds, dur: (n.end - n.start) / o.stepSeconds, midi: n.midi, strength: Math.min(1, n.rms * 20) }))
  const hits = assistMelody(raw, { assist: true, style: 'techno2', startBar: 0, bars: o.bars, register: o.register, stepSeconds: o.stepSeconds, scale: scalePcs(o.scale) })
  return { hits: applyLegato(hits, 2), heard: notes.length }
}

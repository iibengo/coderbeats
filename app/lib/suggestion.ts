/**
 * Cuándo y qué se sugiere (spec 012, §3): la lógica de decisión de la melodía sugerida, pura. El motor solo la llama y guarda el resultado.
 * Se propone **solo** si «Sugerencias» está encendido, se está en Jugar, hay una sola célula, hay un ritmo hecho, la franja de la melodía está **vacía**
 * y **no se está cantando** (la voz manda); y no se ha descartado esa sugerencia para ese ritmo.
 */
import type { MelodyHit, MelodySynth } from './melody'
import type { FreeLoop } from './freeLoops'
import type { StyleId } from './types'
import { STYLE_MUSIC } from './styles'
import { rhythmKey, suggestMelody, type DrumSteps } from './suggestMelody'

export interface Suggestion {
  hits: MelodyHit[]
  /** la sugerencia número `seed` de este ritmo («otra» = la siguiente) */
  seed: number
  /** la huella del ritmo (con el estilo) */
  key: number
  synth: MelodySynth
  bpm: number
  style: StyleId
}

/** Golpes mínimos del ritmo para que haya algo que seguir */
export const MIN_RHYTHM_HITS = 4

/** Los golpes de batería de los loops (sin silenciar) como pasos 0..63 de 4 compases (un loop corto se repite). */
export function drumStepsOf(loops: readonly Pick<FreeLoop, 'instrument' | 'bars' | 'hits' | 'muted'>[]): DrumSteps {
  const out: { bd: number[]; sd: number[]; hh: number[] } = { bd: [], sd: [], hh: [] }
  for (const l of loops) {
    if (l.muted || (l.instrument !== 'bd' && l.instrument !== 'sd' && l.instrument !== 'hh')) continue
    const len = l.bars * 16
    for (let off = 0; off < 64; off += len) for (const h of l.hits) if (h.pos < len) out[l.instrument].push(off + h.pos)
  }
  return out
}

export interface SuggestContext {
  /** «Sugerencias» de ⋯ */
  enabled: boolean
  jugar: boolean
  /** la canción tiene varias células */
  multi: boolean
  loops: readonly FreeLoop[]
  style: StyleId
  bpm: number
  /** la semilla en curso de cada ritmo («otra» la sube) */
  seeds: ReadonlyMap<number, number>
  /** huellas de ritmos cuya sugerencia se ha descartado */
  dismissed: ReadonlySet<number>
  /** la voz manda: se está cantando (o se cantó hace poco) */
  voiceHold: boolean
  /** sinte para la melodía (el del estilo si no se da) */
  synth?: MelodySynth
}

/** La sugerencia que toca ahora, o `null` si no hay que proponer nada. */
export function suggestFor(c: SuggestContext): Suggestion | null {
  if (!c.enabled || !c.jugar || c.multi || c.voiceHold) return null
  if (c.loops.some((l) => l.instrument === 'mel')) return null // la franja no está vacía: se canta o se escribió a mano
  const raw = c.loops.filter((l) => !l.muted && (l.instrument === 'bd' || l.instrument === 'sd' || l.instrument === 'hh')).reduce((n, l) => n + l.hits.length, 0)
  if (raw < MIN_RHYTHM_HITS) return null // (los golpes del patrón, sin contar sus repeticiones)
  const drums = drumStepsOf(c.loops)
  const key = rhythmKey(c.style, drums)
  if (c.dismissed.has(key)) return null
  const seed = c.seeds.get(key) ?? 0
  const synth = c.synth ?? STYLE_MUSIC[c.style].synth
  const hits = suggestMelody({ style: c.style, drums, bpm: c.bpm, synth, seed })
  return hits.length ? { hits, seed, key, synth, bpm: c.bpm, style: c.style } : null
}

/** ¿Es la misma sugerencia (para no reevaluar el motor sin cambios)? */
export const sameSuggestion = (a: Suggestion | null, b: Suggestion | null): boolean =>
  a === b || (!!a && !!b && a.key === b.key && a.seed === b.seed && a.bpm === b.bpm && a.style === b.style && a.synth === b.synth)

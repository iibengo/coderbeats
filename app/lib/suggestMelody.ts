/**
 * La melodía sugerida (spec 012, §3): con un ritmo hecho, una melodía **en la escala del estilo** que encaja con los golpes. Pura y **determinista**:
 * misma entrada y misma `seed` = misma melodía; «otra» = la siguiente semilla (secuencia fija y reproducible, decisión 3).
 *
 * Sigue **el estilo** (§3.2b): la escala y los acordes por compás (`STYLE_MUSIC`), el tempo (una nota no dura menos de ≈ 0,12 s; dnb va en corcheas),
 * los golpes del ritmo como anclas y una densidad por estilo. La frase es de 4 compases: un **motivo de 2** y su **respuesta** (mismo ritmo, otro final,
 * que **acaba en la tónica**). Todo en el **registro** del sinte.
 */
import { STYLES } from './constants'
import { rangeOf, scaleNotes } from './melodyView'
import { snapToScale } from './melodyAssist'
import { type MelodyHit, type MelodySynth } from './melody'
import { STYLE_MUSIC } from './styles'
import type { StyleId } from './types'

/** Los golpes de batería del loop de 4 compases: pasos 0..63 de cada instrumento (un loop de 1 compás se repite antes de llamar). */
export interface DrumSteps {
  bd: readonly number[]
  sd: readonly number[]
  hh: readonly number[]
}

export interface SuggestInput {
  style: StyleId
  drums: DrumSteps
  /** tempo (bpm); sin él, el del estilo */
  bpm?: number
  synth?: MelodySynth
  /** 0, 1, 2…: la sugerencia número `seed` de este ritmo */
  seed: number
}

/** Notas por compás de la melodía, por estilo (propuesta, a afinar de oído; spec 012 §3.2b). */
export const DENSITY: Record<StyleId, readonly [number, number]> = {
  hiphop90: [3, 5],
  house: [4, 7],
  dnb: [3, 5],
  dembow: [4, 6],
  reggaeton: [3, 5],
  techno: [5, 8],
  house2: [4, 7],
  techno2: [5, 8],
}

/** Una nota no dura menos de esto (s). */
export const MIN_NOTE_SEC = 0.12
/** El volumen de la sugerida respecto a una melodía normal (decisión 2: ≈ 35 %). */
export const SUGGEST_GAIN = 0.35

const mod = (a: number, n: number) => ((a % n) + n) % n

/** PRNG pequeño y estable (mulberry32). */
function prng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Una huella estable del ritmo (para que cada ritmo tenga su propia secuencia de sugerencias). */
export function rhythmKey(style: StyleId, d: DrumSteps): number {
  let h = 2166136261
  const mix = (n: number) => {
    h ^= n + 1
    h = Math.imul(h, 16777619) >>> 0
  }
  for (const c of style) mix(c.charCodeAt(0))
  for (const k of ['bd', 'sd', 'hh'] as const) {
    mix(100 + k.charCodeAt(0))
    for (const p of [...d[k]].sort((a, b) => a - b)) mix(p)
  }
  return h >>> 0
}

const pick = <T>(rand: () => number, items: readonly T[], weights: readonly number[]): T => {
  const total = weights.reduce((s, w) => s + w, 0)
  let r = rand() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!
    if (r <= 0) return items[i]!
  }
  return items[items.length - 1]!
}

/** Las posiciones (pasos 0..15 de un compás) de las notas del compás: anclas del ritmo y rejilla del estilo, con separación mínima. */
function barRhythm(rand: () => number, count: number, o: { anchors: Set<number>; weak: Set<number>; grid: number; minSteps: number }): number[] {
  const cands: number[] = []
  const weights: number[] = []
  for (let s = 0; s < 16; s += o.grid) {
    cands.push(s)
    const strong = o.anchors.has(s)
    const weak = o.weak.has(s)
    weights.push((strong ? 6 : weak ? 1.4 : s % 4 === 0 ? 1.2 : s % 2 === 0 ? 0.8 : 0.3) * (s === 0 ? 1.5 : 1))
  }
  const chosen: number[] = []
  const pool = cands.map((c, i) => ({ c, w: weights[i] ?? 1 }))
  while (chosen.length < count && pool.length) {
    const next = pick(rand, pool, pool.map((p) => p.w))
    chosen.push(next.c)
    for (let i = pool.length - 1; i >= 0; i--) if (Math.abs(pool[i]!.c - next.c) < o.minSteps) pool.splice(i, 1)
  }
  return chosen.sort((a, b) => a - b)
}

/**
 * Una melodía sugerida de 4 compases (16 pasos cada uno) para ese ritmo y estilo, o `[]` si no hay ritmo.
 * Las notas **no cruzan la línea de compás**, están **en la escala** del estilo, caen en una **nota del acorde** en los apoyos (el primer paso del compás y los golpes de bombo)
 * y la última es la **tónica**.
 */
export function suggestMelody(i: SuggestInput): MelodyHit[] {
  const music = STYLE_MUSIC[i.style]
  const style = STYLES[i.style]
  const hasDrums = i.drums.bd.length + i.drums.sd.length + i.drums.hh.length > 0
  if (!hasDrums) return []
  const synth = i.synth ?? music.synth
  const range = rangeOf(synth)
  const bpm = i.bpm && i.bpm > 0 ? i.bpm : style.bpm
  const stepSec = 60 / bpm / 4
  const grid = style.quantizeEvery
  const minSteps = Math.max(grid, Math.ceil(MIN_NOTE_SEC / stepSec - 1e-9))
  const rand = prng(rhythmKey(i.style, i.drums) + Math.imul(i.seed + 1, 0x9e3779b1))

  const barSteps = (inst: readonly number[], b: number) => new Set(inst.filter((p) => Math.floor(p / 16) === b).map((p) => p % 16))
  const [dMin, dMax] = DENSITY[i.style]

  // ── 1. el ritmo del motivo (compases 0 y 1) ──
  const motif: number[][] = []
  for (let b = 0; b < 2; b++) {
    const anchors = new Set([...barSteps(i.drums.sd, b), ...barSteps(i.drums.bd, b)])
    const weak = barSteps(i.drums.hh, b)
    const maxHere = Math.min(dMax, Math.floor(16 / minSteps))
    const count = Math.max(1, Math.min(maxHere, dMin + Math.floor(rand() * (dMax - dMin + 1))))
    motif.push(barRhythm(rand, count, { anchors, weak, grid, minSteps }))
  }
  // el motivo debe empezar en el paso 0 si el ritmo tiene un golpe de bombo ahí (apoyo fuerte)
  if ((i.drums.bd.includes(0) || i.drums.bd.some((p) => p % 16 === 0)) && !motif[0]!.includes(0)) motif[0]!.unshift(0)

  // ── 2. la altura del motivo y de la respuesta ──
  const pool = scaleNotes(i.style, range)
  const lo = range[0]
  const hi = range[1]
  const chordAt = (bar: number) => music.chordTones[mod(bar, music.chordTones.length)] ?? []
  const tonic = music.scale[0]!
  const near = (target: number, set: readonly number[]) => [...set].sort((a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b)[0]!
  const chordNotes = (bar: number) => pool.filter((m) => chordAt(bar).includes(mod(m, 12)))

  const isTechno = i.style === 'techno' || i.style === 'techno2'
  const repeatCap = isTechno ? 3 : 2
  const walk = (bars: number[][], startBar: number, upBias: number, from: number): number[][] => {
    let cur = from
    let same = 1
    return bars.map((steps, k) => {
      const bar = startBar + k
      return steps.map((s) => {
        const strong = s === 0 || i.drums.bd.some((p) => Math.floor(p / 16) === bar && p % 16 === s)
        let next: number
        if (strong && chordNotes(bar).length) {
          // en los apoyos, una nota del acorde: la más cercana a donde iría la melodía
          const target = cur + (rand() < 0.5 + upBias ? 2 : -2)
          next = near(target, chordNotes(bar))
        } else {
          const idx = pool.indexOf(cur) >= 0 ? pool.indexOf(cur) : pool.indexOf(near(cur, pool))
          const stepwise = isTechno ? [0, 1, -1, 2, -2] : [1, -1, 0, 2, -2, 3, -3]
          const w = isTechno ? [0.4, 0.3 + upBias, 0.3 - upBias, 0.1, 0.1] : [0.34 + upBias, 0.34 - upBias, 0.1, 0.12, 0.12, 0.04, 0.04]
          const d = pick(rand, stepwise, w.map((x) => Math.max(0.02, x)))
          next = pool[Math.max(0, Math.min(pool.length - 1, idx + d))]!
        }
        if (next === cur) {
          same++
          if (same > repeatCap) {
            const keep = next
            const idx = pool.indexOf(next)
            if (strong && chordNotes(bar).length > 1) next = near(keep + (rand() < 0.5 ? 3 : -3), chordNotes(bar).filter((m) => m !== keep)) // en un apoyo, otra nota del acorde
            else next = pool[Math.max(0, Math.min(pool.length - 1, idx + (idx + 1 < pool.length && rand() < 0.5 ? 1 : -1)))]!
            same = 1
          }
        } else same = 1
        cur = next
        return next
      })
    })
  }

  const center = Math.round((lo + hi) / 2)
  const start = near(center, chordNotes(0).length ? chordNotes(0) : pool)
  const motifPitch = walk(motif, 0, 0.12, start) // sube un poco
  const answerPitch = walk(motif, 2, -0.12, motifPitch[1]![motifPitch[1]!.length - 1] ?? start) // y baja

  const bars = [motif[0]!, motif[1]!, motif[0]!, motif[1]!]
  // ── 3. la respuesta acaba en la tónica ──
  const lastBar = answerPitch[1]!
  const tonics = pool.filter((m) => mod(m, 12) === tonic)
  if (lastBar.length) {
    lastBar[lastBar.length - 1] = near(lastBar[lastBar.length - 1]!, tonics.length ? tonics : pool)
    if (lastBar.length > 1) {
      // la nota anterior, un grado al lado de la tónica (la cadencia)
      const t = lastBar[lastBar.length - 1]!
      const ti = pool.indexOf(t)
      // (si cae en un apoyo, se queda la nota del acorde: los apoyos mandan)
      if (bars[3]![lastBar.length - 2] !== 0) lastBar[lastBar.length - 2] = pool[Math.max(0, Math.min(pool.length - 1, ti + (lastBar[lastBar.length - 2]! >= t ? 1 : -1)))]!
    }
  }

  // ── 4. a notas (pos, dur) por compás, sin cruzar la línea de compás ──
  const out: MelodyHit[] = []
  const pitches = [motifPitch[0]!, motifPitch[1]!, answerPitch[0]!, answerPitch[1]!]
  bars.forEach((steps, b) => {
    steps.forEach((s, k) => {
      const next = steps[k + 1] ?? 16
      const last = b === 3 && k === steps.length - 1
      const dur = Math.max(minSteps, Math.min(last ? 16 - s : next - s, 8))
      const strong = s === 0 || i.drums.bd.some((p) => Math.floor(p / 16) === b && p % 16 === s)
      out.push({ pos: b * 16 + s, dur: Math.min(dur, 16 - s), midi: pitches[b]![k]!, strength: strong ? 0.8 : 0.6 })
    })
  })

  // ── 5. todo en la escala (las notas ya salen de ella y del registro; esto lo garantiza) ──
  return out.map((h, k) => ({ ...h, midi: snapToScale(h.midi, music.scale, chordAt(Math.floor(h.pos / 16)), k ? out[k - 1]!.midi : null) }))
}

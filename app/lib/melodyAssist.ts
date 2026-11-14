/**
 * Ayuda de la melodía (spec 002, §5). Puro. De las notas detectadas (altura decimal, inicio y duración en pasos
 * globales) a los golpes de un loop (`MelodyHit`): MIDI entero, posición y duración en semicorcheas.
 *
 * Con ayuda: errores de octava, notas muy cortas, escala del estilo, rejilla de semicorcheas, legato y registro.
 * Sin ayuda: se respetan tus notas (al semitono) y tu ritmo (en una rejilla fina de un cuarto de paso, porque
 * `.nudge()` no vale para sintes) y solo se corrige el registro.
 */
import { isMidi, MIDI_MAX, MIDI_MIN, REGISTER, type MelodyHit, type MelodySynth } from './melody'
import { applyLegato } from './melodyVariants'
import { STYLE_MUSIC } from './styles'
import type { StyleId } from './types'

export interface RawNote {
  /** paso global (semicorcheas, decimal) en el que empieza */
  step: number
  /** duración en semicorcheas (decimal) */
  dur: number
  /** altura MIDI decimal */
  midi: number
  strength: number
}

export interface AssistOptions {
  assist: boolean
  style: StyleId
  /** compás global en el que empieza la frase */
  startBar: number
  /** compases del loop (1, 2 o 4) */
  bars: number
  /** de qué sinte es el registro */
  register: MelodySynth | 'bass'
  /** segundos por semicorchea (para el mínimo de 60 ms) */
  stepSeconds: number
  /**
   * Rejilla de las duraciones (pasos). Por defecto la misma que la del inicio (con ayuda, 1: la duración se redondea a
   * celdas, que es lo que suena hoy). Con 0,25 la duración se acerca a lo cantado (spec 002, §17; solo el laboratorio).
   */
  durGrid?: number
}

/** Semitono más pequeño de la rejilla fina sin ayuda: un cuarto de semicorchea. */
export const FINE_GRID = 0.25
/** Distancia a dos grados de la escala (en semitonos) por debajo de la cual se considera un empate. */
const TIE = 0.05
const MIN_NOTE_SEC = 0.06

const mod = (a: number, n: number) => ((a % n) + n) % n
const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b)
  return s.length ? s[s.length >> 1]! : 0
}

/**
 * §5.1 (relajado el 2026-11-14, ver "decisiones a revisar"): una nota aislada a más de 7 semitonos de sus dos vecinas
 * que, desplazada una octava, queda a ≤ 7 de ambas, se desplaza. La spec pedía estar a ±12 (±0,5) de las dos, y una
 * vecina a 10 (57, 69, 59) ya no valía: demasiado estricto para un fallo de octava de YIN.
 */
export function fixOctaveErrors(midi: readonly number[]): number[] {
  const out = [...midi]
  for (let i = 1; i < out.length - 1; i++) {
    const prev = out[i - 1]!
    const next = out[i + 1]!
    const m = out[i]!
    if (Math.abs(m - prev) <= 7 || Math.abs(m - next) <= 7) continue
    for (const shift of [-12, 12]) {
      const s = m + shift
      if (Math.abs(s - prev) <= 7 && Math.abs(s - next) <= 7) {
        out[i] = s
        break
      }
    }
  }
  return out
}

/**
 * La nota de la escala más cercana a `midi` (decimal). En un empate (dos grados a la misma distancia, ±TIE) gana
 * una nota del acorde del compás (`chord`) y, si no, la más cercana a `previous`.
 */
export function snapToScale(midi: number, scale: readonly number[], chord: readonly number[], previous: number | null): number {
  const base = Math.floor(midi / 12) * 12
  const cands: number[] = []
  for (let oct = -12; oct <= 24; oct += 12) for (const pc of scale) cands.push(base + oct + pc)
  cands.sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi) || a - b)
  const best = cands[0]!
  const tied = cands.filter((c) => Math.abs(Math.abs(c - midi) - Math.abs(best - midi)) <= TIE)
  if (tied.length === 1) return best
  const inChord = tied.filter((c) => chord.includes(mod(c, 12)))
  const pool = inChord.length ? inChord : tied
  if (previous === null) return pool[0]!
  return [...pool].sort((a, b) => Math.abs(a - previous) - Math.abs(b - previous) || a - b)[0]!
}

/** Sube o baja toda la melodía por octavas para que su mediana caiga en el registro. */
export function fitRegister(midi: readonly number[], range: readonly [number, number]): number[] {
  if (!midi.length) return []
  const m = median([...midi])
  const [lo, hi] = range
  let best = 0
  let bestDist = Infinity
  for (let k = -6; k <= 6; k++) {
    const v = m + 12 * k
    const dist = v < lo ? lo - v : v > hi ? v - hi : 0
    const center = Math.abs(v - (lo + hi) / 2)
    if (dist < bestDist || (dist === bestDist && center < Math.abs(m + 12 * best - (lo + hi) / 2))) {
      best = k
      bestDist = dist
    }
  }
  return midi.map((v) => v + 12 * best)
}

/** Pliega un MIDI al rango admitido (por octavas). */
const fold = (m: number): number => {
  let v = m
  while (v < MIDI_MIN) v += 12
  while (v > MIDI_MAX) v -= 12
  return v
}

interface Work extends RawNote {
  /** posición relativa al inicio de la frase (pasos) */
  rel: number
}

export function assistMelody(notes: readonly RawNote[], o: AssistOptions): MelodyHit[] {
  const total = o.bars * 16
  const music = STYLE_MUSIC[o.style]
  let work: Work[] = notes
    .filter((n) => Number.isFinite(n.step) && Number.isFinite(n.dur) && Number.isFinite(n.midi) && n.dur > 0)
    .map((n) => ({ ...n, rel: n.step - o.startBar * 16 }))
    .filter((n) => n.rel > -0.5 && n.rel < total)
    .sort((a, b) => a.rel - b.rel)
  if (!work.length) return []

  if (o.assist) {
    // 1. errores de octava
    const fixed = fixOctaveErrors(work.map((n) => n.midi))
    work = work.map((n, i) => ({ ...n, midi: fixed[i]! }))
    // 2. notas muy cortas: se funden con la vecina de altura parecida o se quitan
    const minSteps = Math.max(0.5, MIN_NOTE_SEC / o.stepSeconds)
    for (let i = 0; i < work.length; ) {
      const n = work[i]!
      if (n.dur >= minSteps) {
        i++
        continue
      }
      const prev = work[i - 1]
      const next = work[i + 1]
      const near = [prev, next]
        .filter((x): x is Work => !!x && Math.abs(x.midi - n.midi) <= 3 && (x === prev ? n.rel - (x.rel + x.dur) <= 1 : x.rel - (n.rel + n.dur) <= 1))
        .sort((a, b) => Math.abs(a.midi - n.midi) - Math.abs(b.midi - n.midi))[0]
      if (near) {
        const end = Math.max(near.rel + near.dur, n.rel + n.dur)
        near.rel = Math.min(near.rel, n.rel)
        near.dur = end - near.rel
      }
      work.splice(i, 1)
    }
    // 3. escala del estilo
    let prevMidi: number | null = null
    work = work.map((n) => {
      const bar = o.startBar + Math.max(0, Math.floor(n.rel / 16))
      const chord = music.chordTones[mod(bar, music.chordTones.length)] ?? []
      const midi = snapToScale(n.midi, music.scale, chord, prevMidi)
      prevMidi = midi
      return { ...n, midi }
    })
    // 4. legato: un hueco de menos de una celda alarga la nota anterior
    for (let i = 0; i < work.length - 1; i++) {
      const gap = work[i + 1]!.rel - (work[i]!.rel + work[i]!.dur)
      if (gap > 0 && gap < 1) work[i]!.dur += gap
    }
  } else {
    work = work.map((n) => ({ ...n, midi: Math.round(n.midi) }))
  }

  // ritmo: rejilla de semicorcheas con ayuda; rejilla fina sin ella
  const grid = o.assist ? 1 : FINE_GRID
  const dg = o.durGrid ?? grid
  const minDur = dg
  let timed = work.map((n) => ({
    ...n,
    rel: Math.max(0, Math.round(n.rel / grid) * grid),
    dur: Math.max(minDur, Math.round(n.dur / dg) * dg),
  }))
  // monofonía: dos notas en el mismo inicio, queda la más larga (o la más fuerte); la anterior se corta donde empieza la siguiente
  const mono: typeof timed = []
  for (const n of timed) {
    const last = mono[mono.length - 1]
    if (last && last.rel === n.rel) {
      if (n.dur > last.dur || (n.dur === last.dur && n.strength > last.strength)) mono[mono.length - 1] = n
      continue
    }
    mono.push(n)
  }
  timed = mono
  const clipped: MelodyHit[] = []
  for (let i = 0; i < timed.length; i++) {
    const n = timed[i]!
    const barEnd = (Math.floor(n.rel / 16 + 1e-9) + 1) * 16
    const limit = Math.min(barEnd, total, timed[i + 1]?.rel ?? Infinity)
    const dur = Math.min(n.dur, limit - n.rel)
    if (dur < minDur - 1e-9 || n.rel >= total) continue
    clipped.push({ pos: n.rel, strength: n.strength, midi: n.midi, dur })
  }
  if (!clipped.length) return []

  // registro del sinte
  const shifted = fitRegister(clipped.map((h) => h.midi), REGISTER[o.register])
  return clipped.map((h, i) => ({ ...h, midi: fold(shifted[i]!) })).filter((h) => isMidi(h.midi))
}

/** Una nota como la manda el worker: tiempos de contexto (s) y volumen. */
export interface HeardNote {
  start: number
  end: number
  midi: number
  rms: number
}

export interface PhraseMelodyOptions extends AssistOptions {
  /** paso global (decimal) de un tiempo de contexto */
  globalStep: (t: number) => number
  /** latencia de entrada (s): se resta al inicio de cada nota, como en la batería */
  latencySec: number
  /** legato: se rellenan los huecos de hasta tantos pasos entre una nota y la siguiente (sin esto, como antes) */
  legatoGap?: number
}

/**
 * De las notas que oyó el worker a los golpes de la melodía de una frase: pasos globales (con la latencia de
 * entrada corregida), solo las de esta frase, y la ayuda. `raw` es lo oído que cae en la frase (para el diagnóstico).
 */
export function melodyOfPhrase(notes: readonly HeardNote[], o: PhraseMelodyOptions): { raw: RawNote[]; hits: MelodyHit[] } {
  const lo = o.startBar * 16 - 0.5
  const hi = (o.startBar + o.bars) * 16
  const raw: RawNote[] = notes
    .map((n) => ({
      step: o.globalStep(n.start - o.latencySec),
      dur: (n.end - n.start) / o.stepSeconds,
      midi: n.midi,
      strength: Math.min(1, n.rms * 20),
    }))
    .filter((n) => n.step >= lo && n.step < hi)
  const hits = assistMelody(raw, o)
  return { raw, hits: o.legatoGap ? applyLegato(hits, o.legatoGap) : hits }
}

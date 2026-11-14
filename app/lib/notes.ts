/**
 * Notas a partir de la altura (spec 002, §4.2) y puerta de tono (§4.3). Puro.
 * Tramos con voz → cortes (energía, cambio de altura sostenido, transiciones rápidas) → altura de cada nota
 * como la mediana de sus frames centrales.
 */
import type { PitchTrack } from './pitch'

export interface Note {
  /** segundos */
  start: number
  end: number
  /** MIDI decimal: mediana de los frames centrales */
  midi: number
  /** volumen medio */
  rms: number
}

export interface NoteOptions {
  /** probabilidad de voz mínima */
  minProb: number
  /** volumen mínimo para contar como voz */
  minRms: number
  /** duración mínima de una nota (s) */
  minNoteSec: number
  /** huecos sin voz de hasta esto (s) no parten la nota, salvo que haya un onset dentro */
  gapSec: number
  /** cambio de altura respecto a la mediana del tramo que corta (semitonos) */
  splitSemitones: number
  /** durante cuánto tiempo (s) tiene que sostenerse el cambio */
  splitSec: number
  /** pendiente (semitonos por segundo) a partir de la cual un frame es una transición, no una nota */
  glideSlope: number
  /** fracción de cada extremo que no cuenta para la altura */
  trim: number
}

export const DEFAULT_NOTE_OPTIONS: NoteOptions = {
  minProb: 0.6,
  minRms: 0.004,
  minNoteSec: 0.04,
  gapSec: 0.03,
  splitSemitones: 0.7,
  splitSec: 0.06,
  glideSlope: 30,
  trim: 0.2,
}

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b)
  return s.length ? s[s.length >> 1]! : Number.NaN
}

export interface Frames {
  /** frames con voz estable (no transición) */
  stable: boolean[]
  voiced: boolean[]
}

/** Qué frames tienen voz y cuáles de ellos son transiciones rápidas (deslizamientos). */
export function classifyFrames(t: PitchTrack, o: NoteOptions = DEFAULT_NOTE_OPTIONS): Frames {
  const n = t.midi.length
  const dt = t.hop / t.sampleRate
  const voiced = Array.from({ length: n }, (_, i) => t.prob[i]! >= o.minProb && t.rms[i]! >= o.minRms && !Number.isNaN(t.midi[i]!))
  const stable = voiced.map((v, i) => {
    if (!v) return false
    const a = voiced[i - 2] ? t.midi[i - 2]! : t.midi[i]!
    const b = voiced[i + 2] ? t.midi[i + 2]! : t.midi[i]!
    const span = (voiced[i + 2] ? 2 : voiced[i + 1] ? 1 : 0) + (voiced[i - 2] ? 2 : voiced[i - 1] ? 1 : 0)
    if (span === 0) return true
    return Math.abs(b - a) / (span * dt) <= o.glideSlope
  })
  return { stable, voiced }
}

/** Notas de una trayectoria. `onsets` (s): los onsets de energía parten tramos y dan el inicio de la nota. */
export function segmentNotes(t: PitchTrack, onsets: readonly number[] = [], options: Partial<NoteOptions> = {}): Note[] {
  const o = { ...DEFAULT_NOTE_OPTIONS, ...options }
  const n = t.midi.length
  const dt = t.hop / t.sampleRate
  const { stable, voiced } = classifyFrames(t, o)
  // puentes: huecos cortos entre frames estables de altura parecida (consonantes) no parten la nota
  const gapFrames = Math.round(o.gapSec / dt)
  const bridged = [...stable]
  for (let i = 0; i < n; i++) {
    if (!stable[i] || stable[i + 1]) continue
    let j = i + 1
    while (j < n && !stable[j]) j++
    if (j >= n || j - i - 1 > gapFrames) continue
    if (Math.abs(t.midi[j]! - t.midi[i]!) > o.splitSemitones) continue
    const gapStart = t.times[i]!
    const gapEnd = t.times[j]!
    if (onsets.some((x) => x > gapStart && x < gapEnd)) continue
    for (let k = i + 1; k < j; k++) bridged[k] = true
  }

  // tramos continuos
  const runs: [number, number][] = []
  for (let i = 0; i < n; ) {
    if (!bridged[i]) {
      i++
      continue
    }
    let j = i
    while (j + 1 < n && bridged[j + 1]) j++
    runs.push([i, j])
    i = j + 1
  }

  // cortes por onset y por cambio de altura sostenido
  const segments: [number, number][] = []
  for (const [a, b] of runs) {
    const cuts = new Set<number>([a])
    for (const x of onsets) {
      const k = t.times.findIndex((tt) => tt >= x)
      if (k > a + 1 && k < b - 1 && t.times[k]! - t.times[a]! > 0.03) cuts.add(k)
    }
    const starts = [...cuts].sort((p, q) => p - q)
    for (let s = 0; s < starts.length; s++) {
      const from = starts[s]!
      const to = (starts[s + 1] ?? b + 1) - 1
      let cur = from
      const need = Math.max(1, Math.round(o.splitSec / dt))
      const refFrames = Math.max(2, Math.round(0.05 / dt))
      let i = from
      while (i <= to) {
        const ref = median(Array.from({ length: Math.min(refFrames, i - cur + 1) }, (_, k) => t.midi[cur + k]!).filter((v) => !Number.isNaN(v)))
        // ¿cambia más de `splitSemitones` durante `need` frames seguidos?
        let run = 0
        let first = -1
        for (let k = i; k <= to && run < need; k++) {
          if (voiced[k] && Math.abs(t.midi[k]! - ref) > o.splitSemitones) {
            if (run === 0) first = k
            run++
          } else break
        }
        if (run >= need && first > cur) {
          segments.push([cur, first - 1])
          cur = first
          i = first + need
        } else i++
      }
      segments.push([cur, to])
    }
  }

  // altura y límites de cada nota
  const notes: Note[] = []
  for (const [a, b] of segments) {
    const frames = Array.from({ length: b - a + 1 }, (_, k) => a + k).filter((k) => voiced[k])
    const dur = (b - a + 1) * dt
    if (dur < o.minNoteSec || frames.length < 2) continue
    const cut = Math.floor(frames.length * o.trim)
    const core = frames.slice(cut, frames.length - cut)
    const midi = median((core.length ? core : frames).map((k) => t.midi[k]!))
    let start = t.times[a]!
    // el onset de energía más cercano justo antes del tramo da el inicio (la consonante)
    const near = onsets.filter((x) => x <= start + 0.02 && start - x < 0.08).sort((p, q) => q - p)[0]
    if (near !== undefined) start = near
    notes.push({ start, end: t.times[b]! + dt / 2, midi, rms: frames.reduce((s, k) => s + t.rms[k]!, 0) / frames.length })
  }
  return notes
}

export interface ToneGateOptions {
  /** duración mínima de la altura estable (s) */
  minSec: number
  /** estabilidad: desviación máxima de la mediana (semitonos) */
  tolerance: number
  /** cuánto después del onset se busca el tono (s) */
  within: number
  minProb: number
  minRms: number
}

export const DEFAULT_TONE_GATE: ToneGateOptions = { minSec: 0.08, tolerance: 1, within: 0.25, minProb: 0.6, minRms: 0.004 }

export interface ToneGateResult {
  pass: boolean
  /** altura (mediana) y duración del tramo estable, si pasa */
  midi?: number
  sec?: number
}

/**
 * Puerta de tono (spec 002, §4.3): desde un onset, ¿hay una altura estable (±`tolerance` semitonos) de al
 * menos `minSec`? Un "na" sostiene el tono; un "bum", un "pff" o un "ts" no.
 */
export function toneGate(t: PitchTrack, onset: number, options: Partial<ToneGateOptions> = {}): ToneGateResult {
  const o = { ...DEFAULT_TONE_GATE, ...options }
  const dt = t.hop / t.sampleRate
  const need = Math.max(2, Math.round(o.minSec / dt))
  const from = t.times.findIndex((x) => x >= onset - dt)
  if (from < 0) return { pass: false }
  const last = t.times.findIndex((x) => x > onset + o.within)
  const to = last < 0 ? t.midi.length - 1 : last
  let best: ToneGateResult = { pass: false }
  for (let i = from; i <= to; i++) {
    const ok = (k: number) => t.prob[k]! >= o.minProb && t.rms[k]! >= o.minRms && !Number.isNaN(t.midi[k]!)
    if (!ok(i)) continue
    const win: number[] = []
    for (let k = i; k < t.midi.length && ok(k); k++) {
      win.push(t.midi[k]!)
      const m = median(win)
      if (win.some((v) => Math.abs(v - m) > o.tolerance)) {
        win.pop()
        break
      }
    }
    if (win.length >= need && (!best.pass || win.length * dt > (best.sec ?? 0))) best = { pass: true, midi: median(win), sec: win.length * dt }
    if (best.pass) break
  }
  return best
}

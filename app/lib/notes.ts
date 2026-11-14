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

/** Un piso de volumen mayor que esto no se tiene en cuenta (un fondo así de fuerte en el micro: sin melodía, §10). */
export const FLOOR_CAP = 0.006

export interface NoteOptions {
  /** probabilidad de voz mínima */
  minProb: number
  /** volumen mínimo para contar como voz */
  minRms: number
  /** una nota tiene que llegar al menos a este volumen (percentil 80 de sus frames: la cola puede ser más suave): descarta zumbidos de fondo con tono */
  minPeakRms: number
  /**
   * Con un fondo sonando por los altavoces, el micro lo oye: el piso de volumen sube. El pico de una nota tiene que
   * superar `floorFactor` veces el piso (el 5 % más bajo del volumen de la toma, o `floor` si se da, p. ej. el de una
   * ventana móvil en vivo). Con la sala en silencio el piso es ínfimo y manda `minPeakRms`.
   */
  floorFactor: number
  floor?: number
  /** probabilidad de voz media mínima de una nota (los falsos tonos del fondo, ~0,55, no llegan) */
  minMeanProb: number
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
  /** fragmentos al empezar o terminar una nota (la voz que entra por debajo o cae al final) */
  fragment: {
    /** [duración máxima del fragmento (s), distancia máxima de altura a la nota que lo absorbe (semitonos)]: cuanto más corto, más lejos puede estar */
    tiers: readonly (readonly [number, number])[]
    /** la nota que absorbe dura al menos esto (s) y al menos `ratio` veces toda la cadena de fragmentos */
    minHostSec: number
    ratio: number
    /** separación máxima entre notas pegadas (s) */
    adjacentSec: number
  }
}

export const DEFAULT_NOTE_OPTIONS: NoteOptions = {
  minProb: 0.6,
  minRms: 0.001,
  minPeakRms: 0.004,
  floorFactor: 2,
  minMeanProb: 0.7,
  minNoteSec: 0.1,
  gapSec: 0.03,
  splitSemitones: 0.7,
  splitSec: 0.06,
  glideSlope: 30,
  trim: 0.2,
  fragment: { tiers: [[0.1, 4], [0.2, 2], [0.35, 1.2]], minHostSec: 0.4, ratio: 1.5, adjacentSec: 0.12 },
}

/** El `p` (0..1) más bajo de los valores. */
export function lowPercentile(v: ArrayLike<number>, p: number): number {
  const a = Array.from(v).sort((x, y) => x - y)
  return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))]! : 0
}

/** El valor en el percentil `p` (0..1) por arriba: `0.8` es el que deja por debajo al 80 %. */
const highPercentile = (v: number[], p: number): number => {
  const a = [...v].sort((x, y) => x - y)
  return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))]! : 0
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

  // altura y límites de cada nota; cada onset de energía se reparte entre los tramos (el primero que lo alcanza)
  const claimed = new Set<number>()
  // tope del piso: si no hay momentos de solo fondo (voz continua), el 5 % más bajo sería la propia voz
  const floor = Math.min(o.floor ?? lowPercentile(t.rms, 0.05), FLOOR_CAP)
  const minPeak = Math.max(o.minPeakRms, o.floorFactor * floor)
  interface Raw extends Note {
    /** tiene su propio ataque de energía */
    onset: number | null
  }
  let raws: Raw[] = []
  for (const [a, b] of segments) {
    const frames = Array.from({ length: b - a + 1 }, (_, k) => a + k).filter((k) => voiced[k])
    const dur = (b - a + 1) * dt
    if (dur < o.minNoteSec || frames.length < 2) continue
    // pico robusto (percentil 80): un frame del borde que ya mezcla otra voz más fuerte no cuenta
    if (highPercentile(frames.map((k) => t.rms[k]!), 0.8) < minPeak) continue
    if (frames.reduce((a, k) => a + t.prob[k]!, 0) / frames.length < o.minMeanProb) continue
    const cut = Math.floor(frames.length * o.trim)
    const core = frames.slice(cut, frames.length - cut)
    const midi = median((core.length ? core : frames).map((k) => t.midi[k]!))
    const start = t.times[a]!
    const near = onsets.find((x, i) => !claimed.has(i) && x <= start + 0.02 && start - x < 0.08)
    if (near !== undefined) claimed.add(onsets.indexOf(near))
    raws.push({ start, end: t.times[b]! + dt / 2, midi, rms: frames.reduce((s, k) => s + t.rms[k]!, 0) / frames.length, onset: near ?? null })
  }
  raws = absorbFragments(raws, o.fragment)
  return raws.map(({ onset, ...n }) => ({ ...n, start: onset !== null ? Math.min(onset, n.start) : n.start }))
}

/**
 * La voz que entra por debajo (o cae al final) deja fragmentos cortos pegados a la nota: se absorben en la nota
 * larga de al lado. Solo en los bordes de un tramo con voz (la cadena de fragmentos empieza o acaba el tramo), con
 * la altura cerca de la nota según su duración (`tiers`), y no si hay un ataque de energía propio en el sitio
 * donde empezaría la absorción (entonces son dos notas).
 */
function absorbFragments<T extends Note & { onset: number | null }>(list: T[], f: NoteOptions['fragment']): T[] {
  const notes = [...list]
  const dur = (n: Note) => n.end - n.start
  const maxSec = Math.max(...f.tiers.map(([sec]) => sec))
  const near = (frag: Note, host: Note) => {
    const d = dur(frag)
    const dm = Math.abs(frag.midi - host.midi)
    // una octava más abajo al caer la voz (voz quebrada): error de octava de YIN, no una nota
    if (d <= 0.2 && Math.abs(dm - 12) <= 1.5) return true
    return f.tiers.some(([sec, semi]) => d <= sec && dm <= semi)
  }
  for (let changed = true; changed; ) {
    changed = false
    for (let h = 0; h < notes.length && !changed; h++) {
      const host = notes[h]!
      if (dur(host) < f.minHostSec) continue
      // cadena de fragmentos pegados por delante, hasta el principio del tramo
      const lead: number[] = []
      for (let j = h - 1; j >= 0 && notes[j + 1]!.start - notes[j]!.end <= f.adjacentSec; j--) {
        if (dur(notes[j]!) > maxSec) {
          lead.length = 0
          break
        }
        lead.unshift(j)
      }
      const leadOk = lead.length > 0 && host.onset === null && lead.every((j) => near(notes[j]!, host)) && dur(host) >= f.ratio * (notes[h - 1]!.end - notes[lead[0]!]!.start)
      if (leadOk) {
        host.start = notes[lead[0]!]!.start
        host.onset = notes[lead[0]!]!.onset
        notes.splice(lead[0]!, lead.length)
        changed = true
        continue
      }
      // y por detrás, hasta el final del tramo
      const tail: number[] = []
      for (let j = h + 1; j < notes.length && notes[j]!.start - notes[j - 1]!.end <= f.adjacentSec; j++) {
        if (dur(notes[j]!) > maxSec || notes[j]!.onset !== null) {
          tail.length = 0
          break
        }
        tail.push(j)
      }
      if (tail.length && tail.every((j) => near(notes[j]!, host)) && dur(host) >= f.ratio * (notes[tail.at(-1)!]!.end - notes[h + 1]!.start)) {
        host.end = notes[tail.at(-1)!]!.end
        notes.splice(tail[0]!, tail.length)
        changed = true
      }
    }
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

export const DEFAULT_TONE_GATE: ToneGateOptions = { minSec: 0.08, tolerance: 1, within: 0.25, minProb: 0.6, minRms: 0.001 }

export interface ToneGateResult {
  pass: boolean
  /** altura (mediana) y duración del tramo estable, si pasa */
  midi?: number
  sec?: number
  /** probabilidad de voz media y volumen medio del tramo */
  prob?: number
  rms?: number
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
    if (win.length >= need && (!best.pass || win.length * dt > (best.sec ?? 0))) {
      const idx = Array.from({ length: win.length }, (_, k) => i + k)
      best = {
        pass: true,
        midi: median(win),
        sec: win.length * dt,
        prob: idx.reduce((a, k) => a + t.prob[k]!, 0) / idx.length,
        rms: idx.reduce((a, k) => a + t.rms[k]!, 0) / idx.length,
      }
    }
    if (best.pass) break
  }
  return best
}

/**
 * ¿Cada onset es melodía? (spec 002, §4.3, revisado con las tomas de voz del 2026-11-14.) Un onset es melodía si
 * cae dentro de una nota sostenida (`segmentNotes`, ≥ `minNoteSec`), con un margen para el ataque. Separa mucho
 * mejor que mirar solo 80 ms desde el onset (`toneGate`): en las tomas, 0 falsas melodías en 29 sonidos de
 * beatbox, frente a 3 de 29 con la puerta por onset y los mismos umbrales de volumen.
 */
export function melodicOnsets(onsets: readonly number[], notes: readonly Note[], lead = 0.2): boolean[] {
  return onsets.map((t) => notes.some((n) => t >= n.start - lead && t < n.end))
}

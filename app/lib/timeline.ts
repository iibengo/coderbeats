/**
 * La línea de tiempo de una canción (spec 049): de los loops, el tempo y los compases se saca **cuándo suena cada golpe y con qué fuerza**, sin motor de audio y sin reproducir.
 * Sirve para dibujar (visualizadores aparte), medir y, más adelante, para un vídeo más rápido que el tiempo real. Puro y sin DOM.
 *
 * Cinco **carriles**: las cinco voces de la paleta (`Voice`). Qué va a cuál: la batería (`bd`, `sd`, `hh`) a la suya; los sintes `sub` y `bass` al bajo; `hat`, `hatOpen`, `crash` y la percusión de
 * muestra al platillo (el tom, a la caja); `boom` e `impacto` al bombo; el riser y el downlifter **no** tienen carril (son subidas, no golpes); todo lo demás (cuerdas, coro, acordes, melodía, voz), a la melodía.
 */
import { STYLES } from './constants'
import { cellById, type Song } from './cells'
import type { FreeLoop } from './freeLoops'
import type { Voice } from './palette'
import { HAT_GAIN_FLOOR, STRINGS_GAIN_FLOOR } from './melody'
import { isPercSynth } from './percSamples'
import type { StyleId } from './types'

export const LANES: readonly Voice[] = ['bd', 'bass', 'sd', 'hh', 'mel']

export interface TlEvent {
  /** segundos desde el principio de la canción */
  t: number
  lane: Voice
  /** **lo que se oye** del golpe (0..1), no la fuerza guardada: en un loop de melodía la fuerza se lleva a `suelo`–1 como en el audio (`melodyGains`: 0,55; el charles 0,35; las cuerdas 0,33), de modo que una fuerza 0 sigue sonando; en la batería, la que traiga el golpe */
  strength: number
}
export interface TlSection {
  name: string
  bar0: number
  bars: number
  t0: number
  t1: number
}
export interface TlLane {
  /** instantes, ordenados */
  t: Float64Array
  /** fuerza de cada golpe (0..1) */
  s: Float32Array
}
export interface Timeline {
  bpm: number
  barSeconds: number
  bars: number
  duration: number
  sections: TlSection[]
  /** todos los golpes, ordenados por instante */
  events: TlEvent[]
  lanes: Record<Voice, TlLane>
  /** por compás: la suma de las fuerzas de sus golpes, normalizada a 0..1 (el compás más cargado = 1) */
  barEnergy: number[]
}

/** Tope de golpes de una línea de tiempo (una canción válida queda muy por debajo): protege de datos raros. */
const MAX_EVENTS = 200_000

/** El carril de un loop, o `null` si no son golpes (riser, downlifter, voz grabada sin golpes). */
export function laneOf(l: Pick<FreeLoop, 'instrument' | 'synth'>): Voice | null {
  if (l.instrument === 'bd' || l.instrument === 'sd' || l.instrument === 'hh') return l.instrument
  if (l.instrument === 'voz') return 'mel'
  const s = l.synth
  if (s === 'riser' || s === 'downlifter') return null
  if (s === 'sub' || s === 'bass') return 'bass'
  if (s === 'boom' || s === 'impacto') return 'bd'
  if (s === 'tom') return 'sd'
  if (s === 'crash' || isPercSynth(s)) return 'hh'
  return 'mel'
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.8)

/** El suelo de volumen de un sinte de melodía (el mismo que usa `song.ts` al generar el código): el charles y las cuerdas del drill bajan más que los demás. */
const floorOf = (synth: string | undefined): number => (synth === 'hat' ? HAT_GAIN_FLOOR : synth === 'cuerdas' ? STRINGS_GAIN_FLOOR : 0.55)

/** Lo que se oye de un golpe de un loop (spec 049): en la melodía, la fuerza llevada a `suelo`–1 (como `melodyGains`); en la batería, la fuerza tal cual. */
export function hitLevel(loop: Pick<FreeLoop, 'instrument' | 'synth'>, strength: number): number {
  const v = clamp01(strength)
  if (loop.instrument !== 'mel' && loop.instrument !== 'voz') return v
  const f = floorOf(loop.synth)
  return f + (1 - f) * v
}

export function songTimeline(song: Song, style: StyleId): Timeline {
  const bpm = song.bpm ?? STYLES[style].bpm
  const barSeconds = (60 / bpm) * 4
  const step = barSeconds / 16
  const events: TlEvent[] = []
  const sections: TlSection[] = []
  let bar0 = 0
  song.order.forEach((id, i) => {
    const cell = cellById(song, id)
    if (!cell) return
    const turns = cell.turns
    sections.push({ name: cell.name ?? `Parte ${i + 1}`, bar0, bars: turns, t0: bar0 * barSeconds, t1: (bar0 + turns) * barSeconds })
    for (const loop of cell.loops) {
      if (loop.muted || loop.voice) continue
      const lane = laneOf(loop)
      if (!lane) continue
      const bars = loop.bars
      const phase = Number.isFinite(loop.phaseBar) ? loop.phaseBar : 0
      for (const h of loop.hits) {
        if (!Number.isFinite(h.pos) || h.pos < 0) continue
        const b = Math.floor(h.pos / 16 + 1e-9)
        if (b >= bars) continue
        const within = h.pos - b * 16
        // el compás b del loop suena en los compases k de la célula con (k − fase) mod bars = b
        for (let k = (((b + phase) % bars) + bars) % bars; k < turns; k += bars) {
          if (events.length >= MAX_EVENTS) break
          events.push({ t: (bar0 + k) * barSeconds + within * step, lane, strength: hitLevel(loop, h.strength) })
        }
      }
    }
    bar0 += turns
  })
  events.sort((a, b) => a.t - b.t)
  const counts: Record<Voice, number> = { bd: 0, bass: 0, sd: 0, hh: 0, mel: 0 }
  for (const e of events) counts[e.lane]++
  const lanes = Object.fromEntries(LANES.map((v) => [v, { t: new Float64Array(counts[v]), s: new Float32Array(counts[v]) }])) as Record<Voice, TlLane>
  const at: Record<Voice, number> = { bd: 0, bass: 0, sd: 0, hh: 0, mel: 0 }
  const barSum = new Array<number>(bar0).fill(0)
  for (const e of events) {
    const l = lanes[e.lane]
    l.t[at[e.lane]] = e.t
    l.s[at[e.lane]++] = e.strength
    const b = Math.min(bar0 - 1, Math.floor(e.t / barSeconds + 1e-9))
    if (b >= 0) barSum[b]! += e.strength
  }
  const max = Math.max(0, ...barSum)
  return { bpm, barSeconds, bars: bar0, duration: bar0 * barSeconds, sections, events, lanes, barEnergy: barSum.map((v) => (max > 0 ? v / max : 0)) }
}

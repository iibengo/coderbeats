/**
 * Escenario (spec 011 §13.1): golpes de efecto en directo. Puro: las zonas del fondo, el sonido de cada golpe (datos para superdough),
 * el color de su onda, el tope por segundo y la conversión de lo tocado en loops de melodía por paso.
 */
import { VOICE_HEX } from './palette'
import { MIDI_MAX, MIDI_MIN, type MelodySynth } from './melody'
import { STYLE_MUSIC } from './styles'
import type { StyleId } from './types'

export type FxKind = 'bombo' | 'boom' | 'crash' | 'barrido'
export const FX_KINDS: readonly FxKind[] = ['bombo', 'boom', 'crash', 'barrido']

export const FX_LABEL: Record<FxKind, string> = { bombo: 'Bombo', boom: 'Boom', crash: 'Crash', barrido: 'Barrido' }
/** Los colores salen de la paleta única (bombo = rosa, caja = lila, platillo = azul). */
export const FX_COLOR: Record<FxKind, string> = { bombo: VOICE_HEX.bd, boom: VOICE_HEX.sd, crash: VOICE_HEX.hh, barrido: VOICE_HEX.hh }

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Margen (px) alrededor de los botones donde un toque no dispara nada. */
export const DEAD_MARGIN = 14

const inRect = (r: Rect, x: number, y: number, m = 0): boolean => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m

/**
 * ¿Qué golpe dispara un toque en (x, y) de una pantalla de `w`×`h`? Cuatro zonas: abajo (ancha) = bombo, centro = boom, arriba = crash, lados = barrido
 * (que se mantiene pulsado). `dead` son los rectángulos de los botones: alrededor de ellos no dispara nada.
 */
export function fxAt(x: number, y: number, w: number, h: number, dead: readonly Rect[] = []): FxKind | null {
  if (w <= 0 || h <= 0 || x < 0 || y < 0 || x > w || y > h) return null
  if (dead.some((r) => inRect(r, x, y, DEAD_MARGIN))) return null
  if (x < w * 0.16 || x > w * 0.84) return 'barrido'
  if (y > h * 0.62) return 'bombo'
  if (y < h * 0.3) return 'crash'
  return 'boom'
}

/** La raíz (MIDI) del estilo: la primera nota de la afinación del bombo (`kickTune`), o do2 si no tiene. */
export function rootMidi(style: StyleId): number {
  const tune = STYLE_MUSIC[style].kickTune
  const m = tune?.match(/([a-g])(b|#)?(\d)/)
  if (!m) return 36
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1] as 'c'] + (m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0)
  return 12 * (Number(m[3]) + 1) + base
}

/** El sinte de cada golpe y la nota que lleva (la raíz del estilo, siempre dentro de rango). */
export function fxVoice(kind: FxKind, style: StyleId): { synth: MelodySynth; midi: number } {
  const root = rootMidi(style)
  const clamp = (m: number) => Math.min(MIDI_MAX, Math.max(MIDI_MIN, m))
  switch (kind) {
    case 'bombo': return { synth: 'impacto', midi: clamp(root - 12) }
    case 'boom': return { synth: 'boom', midi: clamp(root - 12) }
    case 'crash': return { synth: 'crash', midi: 60 }
    case 'barrido': return { synth: 'riser', midi: 60 }
  }
}

/** Frecuencia (Hz) de una nota MIDI. */
export const midiHz = (m: number): number => 440 * 2 ** ((m - 69) / 12)

/**
 * El valor que se le pasa a superdough para sonar ya (sin esperar a la rejilla). Se parte de `SYNTH_SOUND` (la misma voz que en el loop grabado)
 * para que lo que se toca y lo que se graba suenen igual.
 */
export function fxValue(kind: FxKind, style: StyleId): Record<string, number | string> {
  const { synth, midi } = fxVoice(kind, style)
  const base: Record<MelodySynth, Record<string, number | string>> = {
    impacto: { s: 'sbd', decay: 0.9, pdecay: 0.12, penv: 24, shape: 0.4, gain: 0.9 },
    boom: { s: 'sbd', decay: 1.6, pdecay: 0.35, penv: 12, gain: 0.8, room: 0.3 },
    crash: { s: 'white', attack: 0.001, decay: 1.1, sustain: 0, release: 0.3, hpf: 3500, gain: 0.45, room: 0.45 },
    riser: { s: 'pink', attack: 0.12, decay: 0.2, sustain: 0.7, release: 0.05, gain: 0.6, room: 0.3 },
    lead: {}, piano: {}, pad: {}, drone: {},
  }
  return { ...base[synth], note: midi }
}

/** Duración (s) con que se pide el golpe a superdough (el barrido, 2 s: lo más simple en vez de seguir al dedo). */
export const FX_DURATION: Record<FxKind, number> = { bombo: 1, boom: 1.8, crash: 1.4, barrido: 2 }

/** Tope de golpes por segundo (toques sin querer, bombeo del limitador): se descartan los que pasan. */
export class FxLimiter {
  private times: number[] = []
  constructor(
    private readonly max = 6,
    private readonly windowSec = 1,
  ) {}
  /** ¿Se puede disparar en `now` (s)? Si sí, lo apunta. */
  take(now: number): boolean {
    this.times = this.times.filter((t) => now - t < this.windowSec)
    if (this.times.length >= this.max) return false
    this.times.push(now)
    return true
  }
  reset(): void {
    this.times = []
  }
}

// ── Grabar los efectos como capa de la célula ───────────────────────────────────────────────────
export interface FxEvent {
  kind: FxKind
  /** momento (s) del toque */
  time: number
}

export interface FxLoopHit {
  pos: number
  strength: number
  midi: number
  dur: number
}
export interface FxLoop {
  synth: MelodySynth
  hits: FxLoopHit[]
}

/**
 * De los golpes con tiempo a loops de melodía por paso (uno por tipo de golpe): `start` es el instante (s) del inicio del loop, `stepSec` lo que dura una semicorchea
 * y `bars` los compases del loop (1 o 4). Cuantizado a la semicorchea más cercana y en el compás (envuelve). `null` por tipo si no hubo golpes de ese tipo.
 */
export function fxToLoops(events: readonly FxEvent[], style: StyleId, start: number, stepSec: number, bars: 1 | 4 = 4): FxLoop[] {
  const steps = bars * 16
  const out: FxLoop[] = []
  for (const kind of FX_KINDS) {
    const { synth, midi } = fxVoice(kind, style)
    const seen = new Set<number>()
    const hits: FxLoopHit[] = []
    for (const e of events) {
      if (e.kind !== kind) continue
      const pos = ((Math.round((e.time - start) / stepSec) % steps) + steps) % steps
      if (seen.has(pos)) continue
      seen.add(pos)
      hits.push({ pos, strength: 1, midi, dur: kind === 'barrido' ? 8 : 4 })
    }
    if (hits.length) {
      hits.sort((a, b) => a.pos - b.pos)
      // un golpe no puede pisar al siguiente
      hits.forEach((h, i) => {
        const next = hits[i + 1]?.pos ?? steps + hits[0]!.pos
        h.dur = Math.max(1, Math.min(h.dur, next - h.pos))
      })
      out.push({ synth, hits })
    }
  }
  return out
}

import { hexToRgb, VOICE_HEX } from '~/lib/palette'
import type { LoopInstrument } from '~/lib/freeLoops'

/** Lo que un tema recibe en cada frame (§16.14). */
export interface VisualFrame {
  /** tiempo de contexto actual (s) */
  time: number
  playing: boolean
  bar: number
  /** fase dentro del compás, 0..1 */
  barPhase: number
  bpm: number
  /** loops con su posición en pantalla (px CSS) */
  loops: { id: number; instrument: LoopInstrument; muted: boolean; x: number; y: number; size: number }[]
  fx: { filter: number; space: number; warmth: number }
  background: { bass: boolean; chords: boolean }
  reducedMotion: boolean
}

export interface VisualHitEvent {
  /** 'hit' = suena un loop · 'heard' = el micro acaba de oír un golpe */
  kind: 'hit' | 'heard'
  time: number
  loopId: number | null
  instrument: LoopInstrument | 'bass' | 'chords'
  x: number
  y: number
  /** 0..1 */
  strength: number
}

export interface VisualBeatEvent {
  time: number
  /** 0..3; 0 = el 1 del compás */
  beat: number
  downbeat: boolean
  /** centro del anillo de compás (px CSS) */
  x: number
  y: number
  /** tamaño relativo del pulso, 0..1 (1 = el de siempre); en la colonia, el de la célula que suena */
  scale?: number
}

export interface VisualBirthEvent {
  time: number
  loopId: number
  instrument: LoopInstrument
  x: number
  y: number
}

/** Un tema visual: solo dibuja. No toca el audio ni el estado (§16.14, §16.16). */
export interface VisualTheme {
  id: string
  label: string
  /** monta el tema en un canvas a pantalla completa */
  mount(canvas: HTMLCanvasElement, opts: { dpr: number; reducedMotion: boolean }): void
  resize(width: number, height: number, dpr: number): void
  beat(e: VisualBeatEvent): void
  hit(e: VisualHitEvent): void
  birth(e: VisualBirthEvent): void
  /** un frame; debe tardar ≪ 16 ms */
  frame(f: VisualFrame): void
  /** baja la resolución interna si la capa común detecta frames lentos (0,5..1) */
  setQuality?(q: number): void
  /** nombre del modo de dibujo en uso, para diagnóstico ('webgl2', 'canvas2d'…) */
  renderer(): string
  dispose(): void
}

const unit = (hex: string) => hexToRgb(hex).map((c) => c / 255) as [number, number, number]

/** Colores por instrumento (§8.1), de la paleta única (spec 003, E1.2). */
export const INSTRUMENT_RGB: Record<LoopInstrument | 'bass' | 'chords', [number, number, number]> = {
  bd: unit(VOICE_HEX.bd),
  sd: unit(VOICE_HEX.sd),
  hh: unit(VOICE_HEX.hh),
  mel: unit(VOICE_HEX.mel),
  voz: unit(VOICE_HEX.mel),
  bass: [0.85, 0.85, 0.9],
  chords: [0.85, 0.85, 0.9],
}

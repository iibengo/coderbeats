import type { Instrument } from './types'

export type LoopBars = 1 | 2

export interface LoopHit {
  step: number
  instrument: Instrument
  layerId: number
  activeFromLap: number
  strength: number
  confidence: number
  offsetMs: number
}

export interface Layer {
  id: number
  lap: number
  hits: LoopHit[]
}

export interface Loop {
  bars: LoopBars
  stepsPerBar: 16
  layers: Layer[]
}

export interface LoopTiming {
  /** tiempo de contexto del paso 0 de la vuelta 0 */
  anchor: number
  /** duración de una semicorchea, s */
  stepSeconds: number
  /** cuantizar cada N pasos (1 = semicorcheas, 2 = corcheas) */
  quantizeEvery: number
  totalSteps: number
}

export interface Placement {
  /** vuelta en la que se tocó (capa) */
  lap: number
  /** vuelta del instante de rejilla al que se redondea */
  quantizedLap: number
  step: number
  offsetMs: number
}

export const emptyLoop = (bars: LoopBars = 1): Loop => ({ bars, stepsPerBar: 16, layers: [] })
export const totalSteps = (loop: Loop): number => loop.bars * loop.stepsPerBar

/** Coloca un golpe (tiempo ya corregido de latencia) en vuelta y paso del loop. */
export function place(tCorr: number, t: LoopTiming): Placement {
  const loopDur = t.totalSteps * t.stepSeconds
  const cell = t.stepSeconds * t.quantizeEvery
  const rel = tCorr - t.anchor
  const lap = Math.floor(rel / loopDur)
  const pos = rel - lap * loopDur
  const k = Math.round(pos / cell)
  const raw = k * t.quantizeEvery
  const wraps = raw >= t.totalSteps
  return {
    lap,
    quantizedLap: wraps ? lap + 1 : lap,
    step: wraps ? raw - t.totalSteps : raw,
    offsetMs: (pos - k * cell) * 1000,
  }
}

export type AddResult = 'added' | 'duplicate' | 'replaced' | 'weaker' | 'out-of-range'

export interface NewHit {
  placement: Placement
  instrument: Instrument
  strength: number
  confidence: number
}

/** ¿El instrumento ya está en ese paso (en cualquier capa)? */
const hasInstrumentAt = (loop: Loop, step: number, inst: Instrument) =>
  loop.layers.some((l) => l.hits.some((h) => h.step === step && h.instrument === inst))

/**
 * Añade un golpe al loop (inmutable). Reglas:
 * - vuelta cuantizada < 0 (cuenta atrás) → fuera
 * - mismo instrumento ya en ese paso → duplicado
 * - misma capa, mismo paso, otro instrumento (beatbox monofónico) → gana el más fuerte
 */
export function addHit(loop: Loop, h: NewHit): { loop: Loop; result: AddResult } {
  const { placement: p } = h
  if (p.quantizedLap < 0 || p.step < 0 || p.step >= totalSteps(loop)) return { loop, result: 'out-of-range' }
  if (hasInstrumentAt(loop, p.step, h.instrument)) return { loop, result: 'duplicate' }

  const layerLap = Math.max(0, p.lap)
  let layer = loop.layers.find((l) => l.lap === layerLap)
  const layers = [...loop.layers]
  if (!layer) {
    layer = { id: (loop.layers.at(-1)?.id ?? 0) + 1, lap: layerLap, hits: [] }
    layers.push(layer)
  }
  const hit: LoopHit = {
    step: p.step,
    instrument: h.instrument,
    layerId: layer.id,
    activeFromLap: p.quantizedLap + 1,
    strength: h.strength,
    confidence: h.confidence,
    offsetMs: p.offsetMs,
  }
  const rival = layer.hits.find((x) => x.step === p.step)
  let result: AddResult = 'added'
  let hits: LoopHit[]
  if (rival) {
    if (rival.strength * rival.confidence >= h.strength * h.confidence) return { loop, result: 'weaker' }
    hits = layer.hits.map((x) => (x === rival ? hit : x))
    result = 'replaced'
  } else hits = [...layer.hits, hit]
  const updated = { ...layer, hits }
  return { loop: { ...loop, layers: layers.map((l) => (l.id === updated.id ? updated : l)) }, result }
}

export const undoLayer = (loop: Loop): Loop => ({ ...loop, layers: loop.layers.slice(0, -1) })
export const clearLoop = (loop: Loop): Loop => ({ ...loop, layers: [] })

export const hasHitsInBar2 = (loop: Loop): boolean => loop.layers.some((l) => l.hits.some((h) => h.step >= 16))

/** 1 → 2 compases duplica; 2 → 1 descarta el segundo compás. */
export function setBars(loop: Loop, bars: LoopBars): Loop {
  if (bars === loop.bars) return loop
  if (bars === 2)
    return {
      ...loop,
      bars,
      layers: loop.layers.map((l) => ({ ...l, hits: [...l.hits, ...l.hits.map((h) => ({ ...h, step: h.step + 16 }))] })),
    }
  return {
    ...loop,
    bars,
    layers: loop.layers.map((l) => ({ ...l, hits: l.hits.filter((h) => h.step < 16) })).filter((l) => l.hits.length),
  }
}

/** Instrumentos por paso (polifonía), en orden bd, sd, hh. */
export function stepsOf(loop: Loop): Instrument[][] {
  const order: Instrument[] = ['bd', 'sd', 'hh']
  const steps: Set<Instrument>[] = Array.from({ length: totalSteps(loop) }, () => new Set())
  for (const l of loop.layers) for (const h of l.hits) steps[h.step]?.add(h.instrument)
  return steps.map((s) => order.filter((i) => s.has(i)))
}

/** Golpes que deben sonar en un paso durante la vuelta `lap`. */
export function activeAt(loop: Loop, step: number, lap: number): Instrument[] {
  const out = new Set<Instrument>()
  for (const l of loop.layers) for (const h of l.hits) if (h.step === step && h.activeFromLap <= lap) out.add(h.instrument)
  return [...out]
}

export const hitTotal = (loop: Loop): number => loop.layers.reduce((n, l) => n + l.hits.length, 0)

/** Al (re)arrancar el loop las vueltas vuelven a 0: todo lo grabado suena desde ya. */
export const settle = (loop: Loop): Loop => ({
  ...loop,
  layers: loop.layers.map((l) => ({ ...l, hits: l.hits.map((h) => ({ ...h, activeFromLap: 0 })) })),
})

/**
 * «Componer en directo» (spec 011 §14.1): la persona enciende y apaga capas al ritmo y la app apunta, **por compás**, qué capas suenan.
 * Al terminar, cada tramo seguido con las mismas capas es una célula. Todo puro: el motor solo apunta y llama a `timelineToSong`.
 */
import { fitTurns, MAX_CELLS, TURNS, type Cell, type Song, type Turns } from './cells'
import type { Parts } from './background'

/** Qué suena en un compás: los loops encendidos (ids de los loops de la célula) y el fondo. */
export interface BarLayers {
  loops: number[]
  parts: Parts
}

export const layersKey = (l: BarLayers): string => `${[...l.loops].sort((a, b) => a - b).join(',')}|${l.parts.bass ? 'b' : ''}${l.parts.chords ? 'c' : ''}`

export interface Run {
  layers: BarLayers
  bars: number
}

/** Tramos seguidos con el mismo conjunto de capas. */
export function runsOf(timeline: readonly BarLayers[]): Run[] {
  const out: Run[] = []
  for (const l of timeline) {
    const last = out[out.length - 1]
    if (last && layersKey(last.layers) === layersKey(l)) last.bars++
    else out.push({ layers: { loops: [...l.loops], parts: { ...l.parts } }, bars: 1 })
  }
  return out
}

/** El mayor 1/2/4/8/16/32 que no se pasa de `bars` (mínimo 1). */
export function roundTurns(bars: number): Turns {
  let t: Turns = 1
  for (const x of TURNS) if (x <= bars) t = x
  return t
}

/** Une los tramos más cortos que `min` compases con su vecino (el anterior; el primero, con el siguiente) y, si hay más de `max`, los más cortos de uno en uno. */
export function mergeRuns(runs: readonly Run[], min: number, max = MAX_CELLS): { runs: Run[]; merged: boolean } {
  let out = runs.map((r) => ({ layers: r.layers, bars: r.bars }))
  let merged = false
  const absorb = (i: number) => {
    const into = i > 0 ? i - 1 : 1
    if (!out[into]) return
    out[into] = { layers: out[into]!.layers, bars: out[into]!.bars + out[i]!.bars }
    out.splice(i, 1)
    merged = true
  }
  for (;;) {
    const i = out.findIndex((r) => r.bars < min)
    if (i < 0 || out.length < 2) break
    absorb(i)
  }
  while (out.length > max) {
    let k = 0
    for (let i = 1; i < out.length; i++) if (out[i]!.bars < out[k]!.bars) k = i
    absorb(k)
  }
  // tras unir, dos tramos vecinos pueden haber quedado con las mismas capas
  const joined: Run[] = []
  for (const r of out) {
    const last = joined[joined.length - 1]
    if (last && layersKey(last.layers) === layersKey(r.layers)) last.bars += r.bars
    else joined.push({ ...r })
  }
  out = joined
  return { runs: out, merged }
}

/** El nombre de un tramo por lo que tiene, comparado con lo más lleno de la grabación (misma regla que las partes de «Convertir»). */
export function nameRun(layers: BarLayers, fullest: number, index: number, count: number): string {
  const n = layers.loops.length + (layers.parts.bass ? 1 : 0) + (layers.parts.chords ? 1 : 0)
  if (n >= fullest) return 'Drop'
  return index === count - 1 ? 'Final' : index === 0 ? 'Intro' : 'Subida'
}

export interface LiveResult {
  song: Song
  /** se unieron tramos (por ser cortos o por pasarse de 16 células) */
  merged: boolean
}

/**
 * La canción grabada: una célula por tramo. `base` es la canción de **una célula** con los loops de la grabación (los ids de `BarLayers.loops` son los suyos).
 * Cada célula lleva copias de sus loops (ids nuevos). `null` si no hay nada que convertir (una sola capa fija, sin cambios).
 */
export function timelineToSong(base: Song, timeline: readonly BarLayers[]): LiveResult | null {
  const cell = base.cells[0]
  if (!cell || base.cells.length !== 1 || timeline.length === 0) return null
  const minBars = Math.max(1, ...cell.loops.map((l) => l.bars))
  const { runs, merged } = mergeRuns(runsOf(timeline), minBars)
  if (runs.length < 2) return null
  const fullest = Math.max(...runs.map((r) => r.layers.loops.length + (r.layers.parts.bass ? 1 : 0) + (r.layers.parts.chords ? 1 : 0)))
  let loopId = base.nextLoopId
  let cellId = base.nextCellId
  const cells: Cell[] = []
  runs.forEach((r, i) => {
    const loops = cell.loops
      .filter((l) => r.layers.loops.includes(l.id))
      .map((l) => ({ ...l, hits: l.hits.map((h) => ({ ...h })), id: loopId++, muted: false, bornAt: 0 }))
    const id = i === 0 ? cell.id : cellId++
    const turns = fitTurns(roundTurns(r.bars), loops)
    const c: Cell = {
      id,
      name: nameRun(r.layers, fullest, i, runs.length),
      loops,
      parts: { ...r.layers.parts },
      turns,
      at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! },
    }
    cells.push(c)
  })
  const song: Song = { ...base, cells, order: cells.map((c) => c.id), nextCellId: cellId, nextLoopId: loopId }
  return { song, merged }
}

/** ¿Se grabó algo que merezca convertir? (al menos dos tramos distintos). */
export const hasChanges = (timeline: readonly BarLayers[]): boolean => runsOf(timeline).length >= 2


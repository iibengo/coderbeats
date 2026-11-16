/**
 * «Convertir en canción» (spec 011 §14.2, 012 §6): de una célula (un loop) a la estructura completa del estilo. **No tiene lógica propia**: es una receta de
 * las variaciones de `variations.ts` (intro = menos energía, subida = sin bombo + redoble + filtro que se abre, drop = la original, final = los acordes que se apagan).
 * Pura. La célula original **se queda como el Drop**; las partes que quedarían iguales a otra se saltan.
 */
import { cellById, type Cell, type Song, type Turns } from './cells'
import { MAX_LOOPS, type FreeLoop } from './freeLoops'
import type { StyleId } from './types'
import { varyCell, withVariation } from './variations'

export type PartName = 'Intro' | 'Entra' | 'Subida' | 'Drop' | 'Final'

/** Vueltas de cada parte por estilo (propuesta, a afinar de oído; cada estilo con el compás de sus remixes de 008). */
export const PART_TURNS: Record<StyleId, Record<PartName, Turns>> = {
  hiphop90: { Intro: 4, Entra: 4, Subida: 4, Drop: 8, Final: 2 },
  house: { Intro: 4, Entra: 8, Subida: 4, Drop: 8, Final: 4 },
  dnb: { Intro: 4, Entra: 4, Subida: 4, Drop: 8, Final: 2 },
  dembow: { Intro: 4, Entra: 4, Subida: 4, Drop: 8, Final: 2 },
  techno: { Intro: 8, Entra: 8, Subida: 4, Drop: 8, Final: 4 },
}

/** El orden de las partes */
export const PART_ORDER: readonly PartName[] = ['Intro', 'Entra', 'Subida', 'Drop', 'Final']

/** El filtro que se abre en la subida (Hz por vuelta; el último valor vale para las vueltas que sobren) y el que se cierra al final. */
/** automatización de filtro de la intro y de «entra» (spec 014 §9): se van abriendo vuelta a vuelta */
const INTRO_OPEN = [1400, 2200, 3600, 6000]
const ENTRA_OPEN = [4000, 6000, 9000, 14000]
const OPEN = [600, 1500, 4000, 12000]
const CLOSE = [1800, 1100, 650, 350]

/** Una huella de lo que suena en una célula (para saltarse las partes iguales). */
const signature = (c: Cell): string =>
  JSON.stringify([c.loops.filter((l) => l.hits.length).map((l) => [l.instrument, l.bars, l.hits.map((h) => [h.pos, h.midi ?? 0])]), c.parts, c.lpf ?? null])

/** Reglas de producción opcionales (spec 014, fases 1b y 3): solo para canciones **nuevas** que se convierten; nunca se aplican a lo guardado. */
export interface TemplateOptions {
  /** fill de caja cada 4 compases en las partes con ritmo (Entra y Drop), sin tocar los ids de los loops */
  variation?: boolean
  /** subida con barrido de ruido (uplifter) en su último compás y un impacto grave al final (cae en el drop); solo si la subida no tiene ya melodía */
  transitions?: boolean
}

/** La misma célula con el fill de caja de `varyCell` **solo si ya tiene loop de caja** (así no nacen loops ni ids nuevos). */
function withSnareFill(cell: Cell, style: StyleId): Cell {
  if (!cell.loops.some((l) => l.instrument === 'sd' && l.hits.length)) return cell
  const filled = varyCell(cell, 'fill', 0, style)
  return { ...cell, loops: cell.loops.map((l) => (l.instrument === 'sd' ? filled.loops.find((f) => f.id === l.id) ?? l : l)) }
}

/** El loop del barrido que sube (el último compás de 4) y el impacto final; monofónico como toda la melodía. */
/** El barrido que baja al empezar el Final (spec 014 §9): un golpe de melodía con el sinte `downlifter` en la primera posición, largo como el primer compás. */
export function downlifterLoop(): FreeLoop {
  return {
    id: 0,
    instrument: 'mel',
    bars: 1,
    phaseBar: 0,
    muted: false,
    bornAt: 0,
    fromTemplate: false,
    synth: 'downlifter',
    hits: [{ pos: 0, strength: 1, midi: 60, dur: 15 }],
  }
}

export function riserLoop(): FreeLoop {
  return {
    id: 0,
    instrument: 'mel',
    bars: 4,
    phaseBar: 0,
    muted: false,
    bornAt: 0,
    fromTemplate: false,
    synth: 'riser',
    hits: [
      { pos: 48, strength: 1, midi: 60, dur: 15 },
      { pos: 63, strength: 1, midi: 60, dur: 1 },
    ],
  }
}

const fitLpf = (steps: readonly number[], turns: number): number[] => Array.from({ length: turns }, (_, i) => steps[Math.min(steps.length - 1, i)]!)

/** Las células de cada parte a partir de la original (sin ids ni posiciones definitivas): `null` si esa parte no tiene sentido. */
function partCells(base: Cell, style: StyleId, o: TemplateOptions = {}): { name: PartName; cell: Cell }[] {
  const turns = PART_TURNS[style]
  const drop = o.variation ? withSnareFill(varyCell(base, 'same', 0, style), style) : varyCell(base, 'same', 0, style)
  const once = varyCell(base, 'less', 0, style)
  const twice = varyCell(once, 'less', 0, style) // una capa menos: lo más pelado con ritmo
  const intro = twice
  const entra = o.variation ? withSnareFill(once, style) : once
  const subida = varyCell(varyCell(once, 'fill', 0, style), 'same', 0, style)
  // la subida: sin bombo (ya lo está), con la caja en roll y el filtro que se abre
  subida.lpf = fitLpf(OPEN, turns.Subida)
  if (o.transitions && !subida.loops.some((l) => l.instrument === 'mel') && subida.loops.length < MAX_LOOPS) subida.loops.push(riserLoop())
  if (o.transitions) {
    // automatización del filtro: la intro y «entra» se abren poco a poco hasta el drop (sin tocar el original)
    intro.lpf = fitLpf(INTRO_OPEN, turns.Intro)
    entra.lpf = fitLpf(ENTRA_OPEN, turns.Entra)
  }
  const final: Cell = { ...varyCell(base, 'same', 0, style), loops: o.transitions ? [downlifterLoop()] : [], parts: { bass: false, chords: true }, lpf: fitLpf(CLOSE, turns.Final) }
  const all: { name: PartName; cell: Cell }[] = [
    { name: 'Intro', cell: intro },
    { name: 'Entra', cell: entra },
    { name: 'Subida', cell: subida },
    { name: 'Drop', cell: drop },
    { name: 'Final', cell: final },
  ]
  // se saltan las que quedarían iguales a otra ya puesta (Intro = Entra, o un loop de una sola capa que da lo mismo)
  const seen = new Set<string>()
  const keep: { name: PartName; cell: Cell }[] = []
  for (const p of all) {
    const sig = signature(p.cell)
    // el Drop y el Final siempre van; las demás, solo si son distintas de lo ya puesto
    if (p.name !== 'Drop' && p.name !== 'Final' && seen.has(sig)) continue
    seen.add(sig)
    keep.push(p)
  }
  // lo que queda igual al Drop (una célula pobre: sin nada que quitar) no aporta: se quita
  const dropSig = signature(drop)
  return keep.filter((p) => p.name === 'Drop' || p.name === 'Final' || signature(p.cell) !== dropSig)
}

/**
 * Convierte una canción de **una sola célula** en la estructura del estilo, o `null` si no se puede (ya tiene varias células o la célula no tiene nada).
 * La célula original se queda como el Drop (mismo id y mismos loops); las demás partes son células nuevas, en orden, con ids de célula y de loop nuevos.
 */
export function convertToSong(song: Song, style: StyleId, opts: TemplateOptions = {}): Song | null {
  if (song.order.length !== 1 || song.cells.length !== 1) return null
  const base = cellById(song, song.order[0]!)
  if (!base || !base.loops.some((l) => l.hits.length)) return null
  const parts = partCells(base, style, opts)
  if (parts.length < 2) return null
  let next: Song = { ...song }
  let cellId = song.nextCellId
  const cells: Cell[] = []
  const order: number[] = []
  parts.forEach((p, i) => {
    const turns = PART_TURNS[style][p.name]
    const at = { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! }
    if (p.name === 'Drop') {
      // la original: conserva su id y sus loops
      const orig: Cell = { ...base, ...(opts.variation ? { loops: p.cell.loops } : {}), name: 'Drop', turns, at }
      cells.push(orig)
      order.push(orig.id)
      return
    }
    const id = cellId++
    const placeholder: Cell = { ...base, id, name: p.name, turns, at, loops: [], parts: { ...base.parts } }
    delete placeholder.groupOn
    delete placeholder.groupOff
    delete placeholder.lpf
    delete placeholder.wow
    cells.push(placeholder)
    order.push(id)
    next = { ...next, cells: [...cells], nextCellId: cellId }
    // los loops de la parte, con ids nuevos de loop (sin repetirlos en la canción)
    next = withVariation(next, id, p.cell)
    cells[cells.length - 1] = cellById(next, id)!
  })
  return { ...next, cells, order, nextCellId: cellId }
}

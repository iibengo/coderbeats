import { NO_PARTS, type Parts } from './background'
import { DEMOS } from './demos'
import type { FreeLoop, LoopsState } from './freeLoops'
import type { LoopLength } from './phrases'
import type { Instrument, StyleId } from './types'
import { isValidBpm } from './tempo'

/**
 * Células (spec 005): cada célula es un aro con sus loops, su bajo y sus acordes. Una canción es
 * varias células que suenan una tras otra, cada una sus vueltas (1 vuelta = 1 compás).
 */

export type Turns = 1 | 2 | 4 | 8
export const TURNS: readonly Turns[] = [1, 2, 4, 8]
/** como mucho 16 células por canción (§3) */
export const MAX_CELLS = 16

export interface Cell {
  id: number
  /** nombre de la sección (demos y plantillas); opcional */
  name?: string
  /** loops de la célula; `phaseBar` es relativo al inicio de la célula */
  loops: FreeLoop[]
  /** bajo y acordes del fondo que suenan en esta célula */
  parts: Parts
  /** compases que suena antes de pasar a la siguiente */
  turns: Turns
  /** posición en el mapa (unidades = radio de una gota) y profundidad 0..1 (0 = delante) */
  at: { x: number; y: number; depth: number }
}

export interface Song {
  version: 1
  cells: Cell[]
  /** orden de reproducción (ids) */
  order: number[]
  /** tempo propio; null = el del estilo */
  bpm: number | null
  nextCellId: number
  /** ids de loop únicos en toda la canción (el motor los usa en `color("l<id>")`) */
  nextLoopId: number
}

/** Tramo de la línea de tiempo: la célula `cellId` suena en los compases globales [from, to). */
export interface Segment {
  cellId: number
  from: number
  /** null = sin final (bucle, o canción de una célula) */
  to: number | null
}

/** Dónde va la canción: célula que suena y compás global en el que empezó. */
export interface Cursor {
  cellId: number
  startBar: number
}

const loopsBars = (loops: Pick<FreeLoop, 'bars'>[]): number => loops.reduce((m, l) => Math.max(m, l.bars), 1)

/** Vueltas mínimas para que quepa el loop más largo (§3). */
export const minTurns = (loops: Pick<FreeLoop, 'bars'>[]): Turns => {
  const need = loopsBars(loops)
  return TURNS.find((t) => t >= need) ?? 8
}

/** Las vueltas nunca bajan del loop más largo. */
export const fitTurns = (turns: Turns, loops: Pick<FreeLoop, 'bars'>[]): Turns => Math.max(turns, minTurns(loops)) as Turns

export const emptyCell = (id: number): Cell => ({ id, loops: [], parts: { ...NO_PARTS }, turns: 1, at: { x: 0, y: 0, depth: 0 } })

export const emptySong = (): Song => ({ version: 1, cells: [emptyCell(1)], order: [1], bpm: null, nextCellId: 2, nextLoopId: 1 })

/** Canción de una sola célula con unos loops (migración de `coderbeats:loops:v1`, §3). */
export function songFromLoops(state: LoopsState, parts: Parts = NO_PARTS): Song {
  const loops = state.loops.map(({ prev: _prev, ...l }) => ({ ...l, bornAt: 0 }))
  const cell: Cell = { ...emptyCell(1), loops, parts: { ...parts }, turns: minTurns(loops) }
  return { ...emptySong(), cells: [cell], nextLoopId: Math.max(state.nextId, ...loops.map((l) => l.id + 1)) }
}

export const isMulti = (song: Pick<Song, 'order'>): boolean => song.order.length > 1

export const cellById = (song: Pick<Song, 'cells'>, id: number): Cell | undefined => song.cells.find((c) => c.id === id)

/** Célula que va después de `id` en el orden (tras la última, la primera: §12, decisión 3). */
export function nextInOrder(song: Pick<Song, 'order'>, id: number): number {
  const i = song.order.indexOf(id)
  return song.order[(i + 1) % song.order.length] ?? song.order[0]!
}

/**
 * Avanza el cursor hasta el compás global `bar`: si la célula ya ha sonado sus vueltas, pasa a la
 * siguiente (y así, por si se saltaran varias). Con una sola célula no avanza nunca.
 */
export function advance(song: Song, cursor: Cursor, bar: number): Cursor {
  if (!isMulti(song)) return cursor
  let c = cursor
  for (let guard = 0; guard < 1000; guard++) {
    const cell = cellById(song, c.cellId)
    const turns = cell ? cell.turns : 1
    if (bar < c.startBar + turns) return c
    c = { cellId: nextInOrder(song, c.cellId), startBar: c.startBar + turns }
  }
  return c
}

/** Salto programado (§4.1): en el compás global `startBar` entra `cellId`; con `loop`, en bucle. */
export interface Jump {
  cellId: number
  startBar: number
  loop: boolean
}

/** Estado de reproducción: dónde va la canción, si está en bucle y si hay un salto pendiente. */
export interface Play {
  cursor: Cursor
  /** estado bucle: la célula se repite entera hasta "seguir" */
  loop: boolean
  jump: Jump | null
}

/**
 * Lleva el estado de reproducción hasta el compás global `bar` (§4.1). Un salto vencido gana al
 * avance normal: la célula entra en su compás y, si el salto es de bucle, se queda en bucle. En
 * bucle el cursor no avanza; si no, pasa a la siguiente célula las veces que haga falta.
 */
export function stepPlay(song: Song, play: Play, bar: number): Play {
  const { jump } = play
  if (jump && bar >= jump.startBar) {
    const entered: Play = { cursor: { cellId: jump.cellId, startBar: jump.startBar }, loop: jump.loop, jump: null }
    return jump.loop ? entered : stepPlay(song, entered, bar)
  }
  if (play.loop) return play
  // con un salto pendiente el cursor espera al salto (la célula del cursor puede haberse borrado)
  if (play.jump) return play
  const cursor = advance(song, play.cursor, bar)
  return cursor === play.cursor ? play : { ...play, cursor }
}

/** Compás global en el que acaba lo que suena: el del salto, el final de la célula o nunca (bucle). */
export function endBar(song: Song, play: Play): number {
  if (play.jump) return play.jump.startBar
  if (play.loop || !isMulti(song)) return Infinity
  return play.cursor.startBar + (cellById(song, play.cursor.cellId)?.turns ?? 1)
}

/**
 * Lo que tiene que llevar el código del motor (§4.2): la célula que suena y la siguiente, cada una
 * acotada a sus compases. Sin final, con una sola célula y en bucle. Con un salto pendiente, la que
 * suena hasta el salto y la que entra después (sin final si es de bucle).
 */
export function windowAt(song: Song, cursor: Cursor, o: { loop?: boolean; jump?: Jump | null } = {}): Segment[] {
  const cell = cellById(song, cursor.cellId)
  const { jump } = o
  // con un salto pendiente vale aunque la célula del cursor se haya borrado: suena hasta el salto y entra la otra
  if (isMulti(song) && jump) {
    const target = cellById(song, jump.cellId)
    return [
      { cellId: cursor.cellId, from: cursor.startBar, to: jump.startBar },
      { cellId: jump.cellId, from: jump.startBar, to: jump.loop || !target ? null : jump.startBar + target.turns },
    ]
  }
  if (!isMulti(song) || !cell) return [{ cellId: cursor.cellId, from: cursor.startBar, to: null }]
  if (o.loop) return [{ cellId: cursor.cellId, from: cursor.startBar, to: null }]
  const end = cursor.startBar + cell.turns
  const nextId = nextInOrder(song, cursor.cellId)
  const next = cellById(song, nextId)!
  return [
    { cellId: cursor.cellId, from: cursor.startBar, to: end },
    { cellId: nextId, from: end, to: end + next.turns },
  ]
}

/** Compases que dura una vuelta entera de la canción. */
export const songBars = (song: Song): number =>
  song.order.reduce((s, id) => s + (cellById(song, id)?.turns ?? 0), 0)

/** Valida una canción leída del almacenamiento (forma mínima). */
/**
 * Siguiente número de vueltas al tocar el número de una célula (§7.1): 1 → 2 → 4 → 8 → 1, sin bajar nunca
 * del loop más largo (`minT`): con un loop de 4 compases, solo 4 y 8.
 */
export function nextTurns(current: Turns, minT: Turns): Turns {
  const i = TURNS.indexOf(current)
  const next = TURNS[(i + 1) % TURNS.length]!
  return Math.max(next, minT) as Turns
}

/** La canción con un tempo válido: un tempo guardado roto se quita (vuelve el del estilo) sin descartar la canción. */
export const withValidBpm = (s: Song): Song => (s.bpm === null || isValidBpm(s.bpm) ? s : { ...s, bpm: null })

export function isSong(x: unknown): x is Song {
  if (!x || typeof x !== 'object') return false
  const s = x as Song
  return (
    s.version === 1 &&
    Array.isArray(s.cells) &&
    s.cells.length > 0 &&
    Array.isArray(s.order) &&
    s.order.length > 0 &&
    s.order.every((id) => s.cells.some((c) => c.id === id)) &&
    s.cells.every((c) => Array.isArray(c.loops) && TURNS.includes(c.turns)) &&
    typeof s.nextCellId === 'number' &&
    typeof s.nextLoopId === 'number'
  )
}

/** Quita lo que solo vale mientras suena (versiones previas, nacimientos) para guardar. */
export const storableSong = (song: Song): Song => ({
  ...song,
  cells: song.cells.map((c) => ({ ...c, loops: c.loops.map(({ prev: _prev, ...l }) => ({ ...l, bornAt: 0 })) })),
})

// ── Demo-canción de drum and bass (spec 005, §11) ─────────────────────────────

interface SectionSpec {
  name: string
  turns: Turns
  drums: Instrument[]
  parts: Parts
}

/** intro 4 · subida 4 · drop 8 · final 2, con los loops del reel (`DEMOS.dnb`). */
const DNB_SONG: SectionSpec[] = [
  { name: 'intro', turns: 4, drums: ['hh'], parts: { bass: false, chords: true } },
  // el bajo se guarda para que entre fuerte en el drop (§12, decisión 8)
  { name: 'subida', turns: 4, drums: ['bd', 'sd'], parts: { bass: false, chords: true } },
  { name: 'drop', turns: 8, drums: ['bd', 'sd', 'hh'], parts: { bass: true, chords: true } },
  { name: 'final', turns: 2, drums: [], parts: { bass: false, chords: true } },
]

export const SONG_DEMOS: Partial<Record<StyleId, SectionSpec[]>> = { dnb: DNB_SONG }

const demoLoop = (style: StyleId, instrument: Instrument, id: number): FreeLoop => ({
  id,
  instrument,
  bars: 1 as LoopLength,
  phaseBar: 0,
  hits: DEMOS[style][instrument]
    .split(' ')
    .map((t, step) => (t === '~' ? -1 : step))
    .filter((s) => s >= 0)
    .map((pos) => ({ pos, strength: 0.8 })),
  muted: false,
  bornAt: 0,
  fromTemplate: false,
})

/** Demo-canción del estilo, o null si el estilo aún no tiene (entonces, la demo de una célula). */
export function demoSong(style: StyleId): Song | null {
  const spec = SONG_DEMOS[style]
  if (!spec) return null
  let loopId = 1
  const cells: Cell[] = spec.map((s, i) => ({
    id: i + 1,
    name: s.name,
    loops: s.drums.map((inst) => demoLoop(style, inst, loopId++)),
    parts: { ...s.parts },
    turns: s.turns,
    // en una curva suave de izquierda a derecha, a distintas profundidades
    at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! },
  }))
  return { version: 1, cells, order: cells.map((c) => c.id), bpm: null, nextCellId: cells.length + 1, nextLoopId: loopId }
}

/**
 * Canción de prueba de rendimiento (solo desde el diagnóstico): la demo repetida hasta `count`
 * células (como mucho `MAX_CELLS`), con ids de célula y de loop nuevos y las células en la misma
 * curva de la demo. No se usa en ningún otro sitio.
 */
export function stressSong(base: Song, count: number): Song {
  const n = Math.max(1, Math.min(MAX_CELLS, Math.round(count)))
  const src = base.order.map((id) => cellById(base, id)!).filter(Boolean)
  let loopId = base.nextLoopId
  const cells: Cell[] = Array.from({ length: n }, (_, i) => {
    const from = src[i % src.length]!
    const round = Math.floor(i / src.length)
    return {
      id: i + 1,
      name: from.name && round > 0 ? `${from.name} ${round + 1}` : from.name,
      loops: from.loops.map(({ prev: _prev, ...l }) => ({ ...l, id: loopId++, bornAt: 0 })),
      parts: { ...from.parts },
      turns: from.turns,
      at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! },
    }
  })
  return { version: 1, cells, order: cells.map((c) => c.id), bpm: base.bpm, nextCellId: n + 1, nextLoopId: loopId }
}

// ── crear y borrar células (spec 005, §7.1, fase 3.2) ─────────────────────────────
/** profundidad de la célula nueva: la curva de la demo, para que no queden todas a la misma */
export const nextDepth = (count: number): number => [0, 0.4, 0.1, 0.6][count % 4]!

/**
 * Añade una célula vacía al final del orden, con su hilo desde la última. Devuelve null si ya hay
 * `MAX_CELLS`.
 */
export function withNewCell(song: Song, at: { x: number; y: number; depth?: number }): { song: Song; id: number } | null {
  if (song.cells.length >= MAX_CELLS) return null
  const id = song.nextCellId
  const cell: Cell = { ...emptyCell(id), at: { x: at.x, y: at.y, depth: at.depth ?? nextDepth(song.cells.length) } }
  return { song: { ...song, cells: [...song.cells, cell], order: [...song.order, id], nextCellId: id + 1 }, id }
}

/** La canción sin la célula `id`, en células y en orden (el hilo se cierra: la anterior pasa a la siguiente). */
export const withoutCell = (song: Song, id: number): Song => ({
  ...song,
  cells: song.cells.filter((c) => c.id !== id),
  order: song.order.filter((x) => x !== id),
})

/**
 * Dónde volver a poner `id` en el orden al deshacer un borrado: justo después de la que iba antes si
 * sigue ahí; si no, justo antes de la que iba después; si tampoco, al final.
 */
export function orderWith(order: readonly number[], id: number, prevId: number | null, nextId: number | null): number[] {
  const out = order.filter((x) => x !== id)
  const after = prevId !== null ? out.indexOf(prevId) : -1
  const before = nextId !== null ? out.indexOf(nextId) : -1
  out.splice(after >= 0 ? after + 1 : before >= 0 ? before : out.length, 0, id)
  return out
}

// ── copiar y ordenar con el asa (spec 005, §7.1, fase 3.3) ────────────────────────
/**
 * Copia la célula `srcId` en `at` (mapa): mismos loops (con ids nuevos), partes, vueltas y profundidad,
 * y la copia va justo después de la original en el orden (A → copia → la que seguía). Devuelve null si
 * ya hay `MAX_CELLS` o la original no existe.
 */
export function withCopy(song: Song, srcId: number, at: { x: number; y: number }): { song: Song; id: number } | null {
  const src = cellById(song, srcId)
  if (!src || song.cells.length >= MAX_CELLS) return null
  const id = song.nextCellId
  let loopId = song.nextLoopId
  const { name, ...rest } = src
  const cell: Cell = {
    ...rest,
    id,
    ...(name ? { name: `${name} copia` } : {}),
    loops: src.loops.map(({ prev: _prev, ...l }) => ({ ...l, id: loopId++, bornAt: 0 })),
    parts: { ...src.parts },
    at: { x: at.x, y: at.y, depth: src.at.depth },
  }
  const order = [...song.order]
  order.splice(order.indexOf(srcId) + 1, 0, id)
  return { song: { ...song, cells: [...song.cells, cell], order, nextCellId: id + 1, nextLoopId: loopId }, id }
}

/**
 * Ordenar (§7.1): soltar el hilo de A sobre B pone a B justo después de A. Devuelve null si no hay nada
 * que cambiar (misma célula, no existe, o B ya iba justo después de A). La canción es cíclica, así que
 * esta regla cubre cualquier posición.
 */
export function withOrderAfter(song: Song, aId: number, bId: number): Song | null {
  if (aId === bId || !cellById(song, aId) || !cellById(song, bId)) return null
  const order = song.order.filter((x) => x !== bId)
  const i = order.indexOf(aId)
  if (i < 0) return null
  order.splice(i + 1, 0, bId)
  return order.every((v, k) => v === song.order[k]) ? null : { ...song, order }
}

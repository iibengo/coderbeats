import { NO_PARTS, type Parts } from './background'
import { DEMOS } from './demos'
import type { FreeLoop, LoopsState } from './freeLoops'
import type { LoopLength } from './phrases'
import type { Instrument, StyleId } from './types'
import { isValidBpm } from './tempo'
import { INSTRUMENTS } from './constants'
import { isMidi } from './melody'

/**
 * Células (spec 005): cada célula es un aro con sus loops, su bajo y sus acordes. Una canción es
 * varias células que suenan una tras otra, cada una sus vueltas (1 vuelta = 1 compás).
 */

export type Turns = 1 | 2 | 4 | 8 | 16 | 32
export const TURNS: readonly Turns[] = [1, 2, 4, 8, 16, 32]
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

/**
 * Un grupo de células que suena a la vez que la canción (spec 005, enmienda 2, §16): una cadena de células
 * unidas por hilo, en un orden, que vuelve a la primera tras la última. Una libre es un grupo de una célula;
 * una suelta, el mismo apagado.
 */
export interface Group {
  id: number
  order: number[]
  /** suena (encendido) o aparcado (apagado) */
  on: boolean
}

export interface Song {
  version: 1
  cells: Cell[]
  /** orden del grupo principal: la canción (ids) */
  order: number[]
  /** los demás grupos, que suenan a la vez (§16); cada célula está en un solo grupo (la canción o uno de estos) */
  groups: Group[]
  nextGroupId: number
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

export const emptySong = (): Song => ({ version: 1, cells: [emptyCell(1)], order: [1], groups: [], nextGroupId: 1, bpm: null, nextCellId: 2, nextLoopId: 1 })

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

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isHitOf = (instrument: unknown) => (h: unknown): boolean => {
  if (!isObj(h) || !isNum(h.pos) || !isNum(h.strength)) return false
  // la melodía lleva altura MIDI entera y duración; la batería, ninguna de las dos (spec 002, §8.1)
  if (instrument === 'mel') return isMidi(h.midi) && isNum(h.dur) && h.dur > 0
  return h.midi === undefined && h.dur === undefined
}
const isHits = (instrument: unknown, a: unknown): boolean => Array.isArray(a) && a.every(isHitOf(instrument))
const isBars = (v: unknown): boolean => v === 1 || v === 2 || v === 4

/**
 * ¿Es un loop con la forma exacta? Estos campos acaban escritos en el código Strudel que se evalúa, así que
 * ids y números deben ser números finitos, el instrumento uno de la lista (batería o `'mel'`), los compases 1, 2 o 4
 * y, en la melodía, el MIDI un entero en rango y la duración un número positivo.
 */
export function isFreeLoop(x: unknown): x is FreeLoop {
  if (!isObj(x)) return false
  if (!isNum(x.id) || !isNum(x.phaseBar) || !isNum(x.bornAt) || !isBars(x.bars)) return false
  if (typeof x.instrument !== 'string' || !(x.instrument === 'mel' || INSTRUMENTS.includes(x.instrument as Instrument))) return false
  if (typeof x.muted !== 'boolean' || !isHits(x.instrument, x.hits)) return false
  const prev = x.prev
  return prev === undefined || (isObj(prev) && isHits(x.instrument, prev.hits) && isBars(prev.bars) && isNum(prev.phaseBar))
}

const isCell = (x: unknown): x is Cell => {
  if (!isObj(x) || !isNum(x.id)) return false
  if (x.name !== undefined && typeof x.name !== 'string') return false
  if (!TURNS.includes(x.turns as Turns)) return false
  const parts = x.parts
  if (!isObj(parts) || typeof parts.bass !== 'boolean' || typeof parts.chords !== 'boolean') return false
  const at = x.at
  if (!isObj(at) || !isNum(at.x) || !isNum(at.y) || !isNum(at.depth)) return false
  return Array.isArray(x.loops) && x.loops.every(isFreeLoop)
}

const isIdList = (v: unknown): boolean => Array.isArray(v) && v.every(isNum)

/**
 * Valida una canción leída del almacenamiento (o, más adelante, de un enlace). Estricta: cada célula y cada
 * loop con su forma exacta (ver `isFreeLoop`); lo que no valga no se abre, pero tampoco se borra.
 */
export function isSong(x: unknown): x is Song {
  if (!isObj(x)) return false
  const s = x as unknown as Song
  return (
    s.version === 1 &&
    Array.isArray(s.cells) &&
    s.cells.length > 0 &&
    s.cells.every(isCell) &&
    isIdList(s.order) &&
    s.order.length > 0 &&
    s.order.every((id) => s.cells.some((c) => c.id === id)) &&
    (s.groups === undefined || (Array.isArray(s.groups) && s.groups.every((g) => isObj(g) && isIdList(g.order)))) &&
    isNum(s.nextCellId) &&
    isNum(s.nextLoopId)
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
  return { version: 1, cells, order: cells.map((c) => c.id), groups: [], nextGroupId: 1, bpm: null, nextCellId: cells.length + 1, nextLoopId: loopId }
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
  return { version: 1, cells, order: cells.map((c) => c.id), groups: [], nextGroupId: 1, bpm: base.bpm, nextCellId: n + 1, nextLoopId: loopId }
}

// ── grupos de células (spec 005, enmienda 2, §16) ─────────────────────────────────
/** el id del grupo principal (la canción) */
export const MAIN = 0

/**
 * El grupo de una célula: `MAIN` (0) si está en la canción, el id de su grupo en paralelo, o null si no existe.
 * Toda célula está en un grupo.
 */
export function groupIdOf(song: Pick<Song, 'cells' | 'order' | 'groups'>, id: number): number | null {
  if (song.order.includes(id)) return MAIN
  return song.groups.find((g) => g.order.includes(id))?.id ?? null
}

/** El orden de un grupo (el de la canción para `MAIN`); vacío si no existe. */
export const orderOf = (song: Pick<Song, 'order' | 'groups'>, gid: number): number[] =>
  gid === MAIN ? song.order : (song.groups.find((g) => g.id === gid)?.order ?? [])

/** ¿Suena el grupo? El principal siempre; los demás, si están encendidos. */
export const groupOn = (song: Pick<Song, 'groups'>, gid: number): boolean => gid === MAIN || !!song.groups.find((g) => g.id === gid)?.on

/** La canción vista desde un grupo: con su orden como el orden (así `stepPlay`, `windowAt` y `endBar` sirven para cualquiera). */
export const groupSong = (song: Song, gid: number): Song => (gid === MAIN ? song : { ...song, order: orderOf(song, gid) })

/** ¿Está la célula en un grupo en paralelo (no en la canción)? */
export const inParallel = (song: Pick<Song, 'cells' | 'order' | 'groups'>, id: number): boolean => {
  const g = groupIdOf(song, id)
  return g !== null && g !== MAIN
}

/** Dónde flota la próxima célula de un grupo nuevo: encima de la curva de la canción, una al lado de otra. */
export function nextGroupSpot(song: Song): { x: number; y: number; depth: number } {
  const main = song.order.map((id) => cellById(song, id)).filter((c): c is Cell => !!c)
  const base = main.length ? main : song.cells
  return { x: Math.min(...base.map((c) => c.at.x)) + 3 * song.groups.length, y: Math.min(...base.map((c) => c.at.y)) - 3.5, depth: 0.25 }
}

/** Un grupo nuevo de una célula vacía (apagado, encima de la curva). Devuelve null si ya hay `MAX_CELLS`. */
export function withNewGroup(song: Song, at: { x: number; y: number; depth?: number } = nextGroupSpot(song)): { song: Song; id: number; groupId: number } | null {
  if (song.cells.length >= MAX_CELLS) return null
  const id = song.nextCellId
  const groupId = song.nextGroupId
  const cell: Cell = { ...emptyCell(id), at: { x: at.x, y: at.y, depth: at.depth ?? 0.25 } }
  return {
    song: { ...song, cells: [...song.cells, cell], groups: [...song.groups, { id: groupId, order: [id], on: false }], nextCellId: id + 1, nextGroupId: groupId + 1 },
    id,
    groupId,
  }
}

/** Enciende o apaga un grupo en paralelo. Devuelve null si no existe (o es el principal). */
export function withGroupOn(song: Song, gid: number, on: boolean): Song | null {
  if (!song.groups.some((g) => g.id === gid)) return null
  return { ...song, groups: song.groups.map((g) => (g.id === gid ? { ...g, on } : g)) }
}

/** Cambia el orden de un grupo (el principal o uno en paralelo). */
const withOrder = (song: Song, gid: number, order: number[]): Song =>
  gid === MAIN ? { ...song, order } : { ...song, groups: song.groups.map((g) => (g.id === gid ? { ...g, order } : g)) }

/** Quita los grupos en paralelo que se han quedado sin células. */
const dropEmpty = (song: Song): Song => ({ ...song, groups: song.groups.filter((g) => g.order.length > 0) })

// ── crear y borrar células (spec 005, §7.1, fase 3.2) ─────────────────────────────
/** profundidad de la célula nueva: la curva de la demo, para que no queden todas a la misma */
export const nextDepth = (count: number): number => [0, 0.4, 0.1, 0.6][count % 4]!

/**
 * Añade una célula vacía al final del orden de la canción, con su hilo desde la última. Devuelve null si ya
 * hay `MAX_CELLS`.
 */
export function withNewCell(song: Song, at: { x: number; y: number; depth?: number }): { song: Song; id: number } | null {
  if (song.cells.length >= MAX_CELLS) return null
  const id = song.nextCellId
  const cell: Cell = { ...emptyCell(id), at: { x: at.x, y: at.y, depth: at.depth ?? nextDepth(song.cells.length) } }
  return { song: { ...song, cells: [...song.cells, cell], order: [...song.order, id], nextCellId: id + 1 }, id }
}

/**
 * La canción sin la célula `id`: sale de su grupo y, si este se queda sin células, desaparece (el hilo se
 * cierra: la anterior pasa a la siguiente). El principal nunca se vacía aquí: lo evita quien llama.
 */
export const withoutCell = (song: Song, id: number): Song =>
  dropEmpty({
    ...song,
    cells: song.cells.filter((c) => c.id !== id),
    order: song.order.filter((x) => x !== id),
    groups: song.groups.map((g) => ({ ...g, order: g.order.filter((x) => x !== id) })),
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

/**
 * Deshacer un borrado: la célula vuelve a su grupo, entre sus mismos vecinos; si el grupo ya no existe,
 * como un grupo nuevo de una célula, apagado.
 */
export function withRestoredCell(song: Song, cell: Cell, gid: number, prevId: number | null, nextId: number | null, on: boolean): Song {
  const cells = [...song.cells, cell]
  const exists = gid === MAIN || song.groups.some((g) => g.id === gid)
  if (exists) return withOrder({ ...song, cells }, gid, orderWith(orderOf(song, gid), cell.id, prevId, nextId))
  const id = gid > 0 ? gid : song.nextGroupId
  return { ...song, cells, groups: [...song.groups, { id, order: [cell.id], on }], nextGroupId: Math.max(song.nextGroupId, id + 1) }
}

// ── copiar, juntar y separar con el asa y el hilo (§16.3) ─────────────────────────
/**
 * Copia la célula `srcId` en `at` (mapa): mismos loops (con ids nuevos), partes, vueltas y profundidad. La
 * copia es un **grupo nuevo de una célula, apagado** (§16.3). Devuelve null si ya hay `MAX_CELLS` o la
 * original no existe.
 */
export function withCopy(song: Song, srcId: number, at: { x: number; y: number }): { song: Song; id: number; groupId: number } | null {
  const src = cellById(song, srcId)
  if (!src || song.cells.length >= MAX_CELLS) return null
  const id = song.nextCellId
  const groupId = song.nextGroupId
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
  return {
    song: {
      ...song,
      cells: [...song.cells, cell],
      groups: [...song.groups, { id: groupId, order: [id], on: false }],
      nextCellId: id + 1,
      nextGroupId: groupId + 1,
      nextLoopId: loopId,
    },
    id,
    groupId,
  }
}

/**
 * Juntar y ordenar (§16.3): soltar el hilo de A sobre B pone a B **justo detrás de A, en el grupo de A**.
 * Si A es la cola de su grupo y B la cabeza del suyo, se juntan **los dos grupos enteros** (el resultado es
 * el principal si alguno lo era). Devuelve null si no hay nada que cambiar (la misma célula, una que no
 * existe, B ya iba detrás de A) o si dejaría la canción sin células.
 */
export function withOrderAfter(song: Song, aId: number, bId: number): Song | null {
  if (aId === bId) return null
  const ga = groupIdOf(song, aId)
  const gb = groupIdOf(song, bId)
  if (ga === null || gb === null) return null
  const orderA = orderOf(song, ga)
  const orderB = orderOf(song, gb)
  // dentro del mismo grupo: B pasa detrás de A (la regla de ordenar de siempre)
  if (ga === gb) {
    const order = orderA.filter((x) => x !== bId)
    order.splice(order.indexOf(aId) + 1, 0, bId)
    return order.every((v, k) => v === orderA[k]) ? null : withOrder(song, ga, order)
  }
  // la cola de un grupo sobre la cabeza de otro: se juntan enteros
  if (orderA[orderA.length - 1] === aId && orderB[0] === bId) {
    const merged = [...orderA, ...orderB]
    if (gb === MAIN) {
      // el resultado es el principal: la canción pasa a ser A… + la canción de antes
      return dropEmpty({ ...song, order: merged, groups: song.groups.filter((g) => g.id !== ga) })
    }
    return dropEmpty(withOrder({ ...song, groups: song.groups.filter((g) => g.id !== gb) }, ga, merged))
  }
  // en cualquier otro caso, solo B cambia de grupo (la canción no se queda sin células)
  if (gb === MAIN && orderB.length === 1) return null
  const without = withOrder(song, gb, orderB.filter((x) => x !== bId))
  const target = orderOf(without, ga)
  const order = [...target]
  order.splice(order.indexOf(aId) + 1, 0, bId)
  return dropEmpty(withOrder(without, ga, order))
}

/**
 * Separar (§16.3): cortar el hilo que lleva a `toId` parte el grupo en dos. La parte de detrás (desde
 * `toId`) es un **grupo nuevo, apagado**; la de delante conserva el grupo (el principal sigue siendo el que
 * lleva la primera célula de la canción). Devuelve null si `toId` es la cabeza de su grupo (no hay hilo).
 */
export function withCut(song: Song, toId: number): Song | null {
  const gid = groupIdOf(song, toId)
  if (gid === null) return null
  const order = orderOf(song, gid)
  const i = order.indexOf(toId)
  if (i <= 0) return null
  const head = order.slice(0, i)
  const tail = order.slice(i)
  const cut = withOrder(song, gid, head)
  return { ...cut, groups: [...cut.groups, { id: song.nextGroupId, order: tail, on: false }], nextGroupId: song.nextGroupId + 1 }
}

// ── lo guardado: una canción siempre con sus grupos (migra lo de antes) ───────────
/** Una célula como se guardaba antes de los grupos (con `free` y `on`), solo para migrar. */
interface LegacyCell extends Cell {
  free?: boolean
  on?: boolean
}

/**
 * La canción con sus grupos en regla (§16.6): toda célula en un solo grupo, sin grupos vacíos ni ids de
 * células que no existen. **Migra lo guardado antes**: una célula `free` (de las libres de §13.1) pasa a
 * ser un grupo de una, con su `on`; una suelta (fuera del orden), un grupo de una apagado. No pierde células.
 */
export function normalizeSong(raw: Song): Song {
  const legacy = new Map((raw.cells as LegacyCell[]).map((c) => [c.id, c]))
  const cells = (raw.cells as LegacyCell[]).map(({ free: _free, on: _on, ...c }) => c as Cell)
  const ids = new Set(cells.map((c) => c.id))
  const seen = new Set<number>()
  const take = (list: unknown): number[] => {
    const out: number[] = []
    if (Array.isArray(list)) for (const id of list) if (typeof id === 'number' && ids.has(id) && !seen.has(id)) (seen.add(id), out.push(id))
    return out
  }
  let order = take(raw.order)
  if (!order.length) order = take([cells[0]!.id])
  const usedIds = new Set<number>()
  let nextId = Math.max(1, typeof raw.nextGroupId === 'number' ? raw.nextGroupId : 1)
  const groups: Group[] = []
  const fresh = () => {
    while (usedIds.has(nextId)) nextId++
    return nextId++
  }
  for (const g of Array.isArray(raw.groups) ? raw.groups : []) {
    const o = take((g as Group).order)
    if (!o.length) continue
    const gid = typeof g.id === 'number' && g.id > 0 && !usedIds.has(g.id) ? g.id : fresh()
    usedIds.add(gid)
    groups.push({ id: gid, order: o, on: g.on === true })
  }
  // lo que queda fuera de todo: las libres de antes (con su `on`) y las sueltas, cada una en un grupo de una célula
  for (const c of cells) {
    if (seen.has(c.id)) continue
    seen.add(c.id)
    const l = legacy.get(c.id)
    const gid = fresh()
    usedIds.add(gid)
    groups.push({ id: gid, order: [c.id], on: l?.free === true && l.on === true })
  }
  const maxId = Math.max(0, ...groups.map((g) => g.id))
  return { ...raw, cells, order, groups, nextGroupId: Math.max(nextId, maxId + 1) }
}

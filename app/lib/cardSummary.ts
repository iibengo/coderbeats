/**
 * El resumen de unos 15 s de una canción para el vídeo de la tarjeta (spec 061): una **canción derivada** con la entrada, la subida y el drop recortados a **compases enteros**
 * (nunca corta a mitad de compás), que se toca de principio a fin con el reproductor de siempre: no se salta con el reloj del motor. Puro y sin DOM.
 *
 * El motor mantiene una célula al menos lo que dura su loop más largo (comprobado: con 2 vueltas y un loop de 4 compases, la célula dura 4), así que para acortar de verdad
 * se **recortan los propios loops** a los compases del tramo (se quedan los golpes y notas de esos compases; la nota que cruza el final se acorta).
 */
import { TURNS, type Cell, type Song, type Turns } from './cells'
import type { FreeLoop, LoopBars } from './freeLoops'
import { layersOfCell, roleOf } from './remixParts'

/** lo que dura el resumen (la cifra real sale de los compases enteros más cercanos) */
export const SUMMARY_SECONDS = 15
/** el fundido del final, para que no corte seco */
export const SUMMARY_FADE_SECONDS = 0.6

export interface SummaryPlan {
  /** la canción derivada: las células elegidas con sus vueltas recortadas; los grupos en paralelo que sonaban, encendidos donde tocan */
  song: Song
  /** las células elegidas (ids), en orden */
  cellIds: number[]
  /** los papeles de cada una: entrada, subida, drop */
  roles: ('intro' | 'rise' | 'drop')[]
  /** compases de cada una (siempre uno de los valores de `TURNS`, entre 2 y 8) */
  bars: number[]
  /** lo que dura de verdad: compases × 240 / bpm */
  seconds: number
  fadeSeconds: number
}

/** lo mínimo que dura un tramo del resumen (con un compás no da tiempo a que se note) */
const MIN_BARS = 2
/** castigo, en segundos, por cada célula cuyo loop se corta (a igualdad, mejor no cortar) */
const CUT_PENALTY = 0.4
const loopBarsOf = (c: Cell): number => c.loops.reduce((m, l) => (l.voice ? m : Math.max(m, l.bars)), 1)

/** El loop recortado a sus primeros `bars` compases (16 semicorcheas por compás). Los de voz y los que ya caben quedan igual. */
export function cutLoop(l: FreeLoop, bars: number): FreeLoop {
  if (l.voice || l.bars <= bars) return l
  const end = bars * 16
  const { prev: _prev, ...rest } = l
  return { ...rest, bars: bars as LoopBars, hits: l.hits.filter((h) => h.pos < end).map((h) => (h.dur !== undefined && h.pos + h.dur > end ? { ...h, dur: Math.max(1, end - h.pos) } : { ...h })) }
}

const KNOWN = /^(intro|estrofa|subida|drop|break|final|puente)(?:\s+\d+)?$/i

interface Entry {
  cell: Cell
  /** el papel por nombre o por lo que lleva (Intro, Estrofa, Subida, Drop, Break, Final) */
  role: string
  layers: number
  /** los grupos en paralelo que suenan tras empezar esta célula */
  active: number[]
}

function entriesOf(song: Song): Entry[] {
  const cellOf = (id: number) => song.cells.find((c) => c.id === id)
  const active = new Set<number>()
  const raw: { cell: Cell; layers: ReturnType<typeof layersOfCell>; active: number[] }[] = []
  for (const id of song.order) {
    const cell = cellOf(id)
    if (!cell) continue
    for (const g of cell.groupOff ?? []) active.delete(g)
    for (const g of cell.groupOn ?? []) active.add(g)
    let theme: FreeLoop | null = null
    for (const gid of active) {
      const first = cellOf(song.groups.find((g) => g.id === gid)?.order[0] ?? -1)
      theme = first?.loops.find((l) => l.instrument === 'mel' && !l.muted && l.hits.length) ?? null
      if (theme) break
    }
    const layers = layersOfCell(cell, theme)
    if (!layers.length) continue
    raw.push({ cell, layers, active: [...active] })
  }
  return raw.map((r, i) => {
    const name = (r.cell.name ?? '').trim()
    const role = KNOWN.test(name) ? name.replace(/\s+\d+$/, '').toLowerCase() : roleOf(r.layers, i, raw.length).toLowerCase()
    return { cell: r.cell, role, layers: r.layers.length, active: r.active }
  })
}

/** Las células que cuentan el tema: entrada (la primera), subida (la última antes del drop) y drop (el primero, o la más cargada). */
function pick(es: Entry[]): { intro?: Entry; rise?: Entry; drop: Entry } {
  let di = es.findIndex((e) => e.role === 'drop')
  if (di < 0) {
    di = es.length > 1 ? 1 : 0
    es.forEach((e, i) => {
      if (i > 0 && e.layers > es[di]!.layers) di = i
    })
  }
  const drop = es[di]!
  const intro = di > 0 ? es[0] : undefined
  let rise: Entry | undefined
  for (let i = di - 1; i > 0; i--) {
    if (es[i]!.role === 'subida') {
      rise = es[i]
      break
    }
  }
  if (!rise && di >= 2) rise = es[di - 1]
  return { ...(intro ? { intro } : {}), ...(rise ? { rise } : {}), drop }
}

/**
 * El plan del resumen, o `null` si la canción no tiene nada que sonar. Los compases de cada tramo salen de `TURNS` (de 2 a 8); entre las mezclas posibles gana la que más se acerca
 * a `target` s, con un pequeño castigo si el drop dura menos que lo que lo prepara y por cada loop que haya que cortar.
 */
export function planSummary(song: Song, bpm: number, target = SUMMARY_SECONDS): SummaryPlan | null {
  if (!Number.isFinite(bpm) || bpm <= 0) return null
  const es = entriesOf(song)
  if (!es.length) return null
  const p = pick(es)
  const chosen: { role: 'intro' | 'rise' | 'drop'; e: Entry }[] = [
    ...(p.intro ? [{ role: 'intro' as const, e: p.intro }] : []),
    ...(p.rise ? [{ role: 'rise' as const, e: p.rise }] : []),
    { role: 'drop' as const, e: p.drop },
  ]
  const options = chosen.map(() => TURNS.filter((t) => t >= MIN_BARS && t <= 8))
  const barSeconds = 240 / bpm
  let best: { bars: Turns[]; score: number } | null = null
  const walk = (i: number, acc: Turns[]) => {
    if (i === chosen.length) {
      const seconds = acc.reduce((s, b) => s + b, 0) * barSeconds
      let score = Math.abs(seconds - target)
      for (let k = 1; k < acc.length; k++) if (acc[k]! < acc[k - 1]!) score += 1.5
      acc.forEach((b, k) => {
        if (b < loopBarsOf(chosen[k]!.e.cell)) score += CUT_PENALTY
      })
      if (!best || score < best.score) best = { bars: [...acc], score }
      return
    }
    for (const t of options[i]!) walk(i + 1, [...acc, t])
  }
  walk(0, [])
  const bars = (best as { bars: Turns[] } | null)?.bars
  if (!bars) return null

  // los grupos en paralelo que sonaban se encienden en la célula que toca (la primera los enciende todos): la canción derivada suena como la original
  let prev = new Set<number>()
  const picked: Cell[] = chosen.map((c, i) => {
    const want = new Set(c.e.active)
    const on = [...want].filter((g) => !prev.has(g))
    const off = [...prev].filter((g) => !want.has(g))
    prev = want
    const { groupOn: _on, groupOff: _off, ...rest } = c.e.cell
    return { ...rest, loops: rest.loops.map((l) => cutLoop(l, bars[i]!)), turns: bars[i]!, ...(on.length ? { groupOn: on } : {}), ...(off.length ? { groupOff: off } : {}) }
  })
  const pickedIds = new Set(picked.map((c) => c.id))
  const mainIds = new Set(song.order)
  const others = song.cells.filter((c) => !mainIds.has(c.id) && !pickedIds.has(c.id))
  const derived: Song = { ...song, cells: [...picked, ...others], order: picked.map((c) => c.id), groups: song.groups.map((g) => ({ ...g, on: false })) }
  const total = bars.reduce((s, b) => s + b, 0)
  return { song: derived, cellIds: picked.map((c) => c.id), roles: chosen.map((c) => c.role), bars, seconds: total * barSeconds, fadeSeconds: SUMMARY_FADE_SECONDS }
}

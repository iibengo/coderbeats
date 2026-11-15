/**
 * Fundir células (spec 005 §21, M1): **añadir el contenido de A a B y borrar A**. Puro. B se queda (su sitio, nombre, hilos, grupo); A desaparece dentro de ella
 * con el borrado de siempre (`withoutCell`). Los patrones se expanden a la longitud común, los golpes del mismo paso quedan en uno (gana B), la melodía de A solo entra
 * en los huecos de la de B (monofonía), el fondo es un O lógico y las vueltas, el mayor.
 */
import { cellById, fitTurns, withoutCell, type Cell, type Song, type Turns } from './cells'
import { MAX_LOOPS, type FreeLoop } from './freeLoops'
import type { LoopLength } from './phrases'

export interface MergeResult {
  song: Song
  /** lo que no entró: golpes iguales (se quedó el de B) y notas de la melodía de A que no cupieron */
  dropped: { hits: number; notes: number }
}

const LENGTHS: readonly LoopLength[] = [1, 2, 4]
const asLength = (n: number): LoopLength => (LENGTHS.find((l) => l >= n) ?? 4) as LoopLength

interface Hit {
  pos: number
  strength: number
  midi?: number
  dur?: number
}

/** Los golpes de un loop expandidos a `len` compases de la célula (con su fase relativa a la célula). */
function expand(l: FreeLoop, len: number): Hit[] {
  const out: Hit[] = []
  for (let j = 0; j < len; j++) {
    const bar = (((j - l.phaseBar) % l.bars) + l.bars) % l.bars
    for (const h of l.hits) if (Math.floor(h.pos / 16) === bar) out.push({ ...h, pos: j * 16 + (h.pos - bar * 16) })
  }
  return out.sort((a, b) => a.pos - b.pos)
}

const cloneLoop = (l: FreeLoop): FreeLoop => ({ ...l, hits: l.hits.map((h) => ({ ...h })) })

/** Junta los golpes de batería: los de B no se tocan; uno de A a menos de media semicorchea de uno de B (o de otro de A ya puesto) no entra. */
function mergeDrums(a: Hit[], b: Hit[], total: number): { hits: Hit[]; dropped: number } {
  const out = [...b]
  let dropped = 0
  for (const h of a) {
    const near = out.some((o) => Math.min(Math.abs(o.pos - h.pos), total - Math.abs(o.pos - h.pos)) < 0.5)
    if (near) dropped++
    else out.push(h)
  }
  return { hits: out.sort((x, y) => x.pos - y.pos), dropped }
}

/** Melodía: las notas de B no se tocan; una de A solo entra si empieza en un hueco libre, y se recorta contra la siguiente de B y la línea de compás. */
function mergeMelody(a: Hit[], b: Hit[], total: number): { hits: Hit[]; dropped: number } {
  const out = b.map((h) => ({ ...h }))
  let dropped = 0
  for (const h of a) {
    const inside = out.some((o) => h.pos >= o.pos && h.pos < o.pos + (o.dur ?? 1))
    if (inside) {
      dropped++
      continue
    }
    const next = Math.min(...out.filter((o) => o.pos > h.pos).map((o) => o.pos), total)
    const barEnd = (Math.floor(h.pos / 16) + 1) * 16
    const dur = Math.min(h.dur ?? 1, next - h.pos, barEnd - h.pos)
    if (dur <= 0) dropped++
    else out.push({ ...h, dur })
  }
  return { hits: out.sort((x, y) => x.pos - y.pos), dropped }
}

/** Funde A en B. `null` si no se puede (la misma célula, o no existen). */
export function mergeCells(song: Song, aId: number, bId: number): MergeResult | null {
  const a = cellById(song, aId)
  const b = cellById(song, bId)
  if (!a || !b || aId === bId) return null
  const len = Math.max(1, ...a.loops.map((l) => l.bars), ...b.loops.map((l) => l.bars))
  const L = asLength(len)
  const total = L * 16
  const dropped = { hits: 0, notes: 0 }
  const loops: FreeLoop[] = []
  const insts = [...new Set([...b.loops, ...a.loops].map((l) => l.instrument))]
  for (const inst of insts) {
    const la = a.loops.filter((l) => l.instrument === inst)
    const lb = b.loops.filter((l) => l.instrument === inst)
    if (inst === 'voz') {
      // la voz no se mezcla: cada toma se queda tal cual
      loops.push(...lb.map(cloneLoop), ...la.map(cloneLoop))
      continue
    }
    // los silenciados no se funden (no sonaban): si hay uno que suena en alguna de las dos, el resultado es el de los que suenan
    const sa = la.filter((l) => !l.muted)
    const sb = lb.filter((l) => !l.muted)
    if (!sa.length && !sb.length) {
      loops.push(...[...lb, ...la].slice(0, 1).map(cloneLoop))
      continue
    }
    if (!sa.length || !sb.length) {
      loops.push(cloneLoop((sb.length ? sb : sa)[0]!))
      continue
    }
    const ha = sa.flatMap((l) => expand(l, L))
    const hb = sb.flatMap((l) => expand(l, L))
    const mel = inst === 'mel'
    const m = mel ? mergeMelody(ha, hb, total) : mergeDrums(ha, hb, total)
    if (mel) dropped.notes += m.dropped
    else dropped.hits += m.dropped
    const base = sb[0]!
    loops.push({ ...cloneLoop(base), bars: L, phaseBar: 0, hits: m.hits, muted: false, ...(mel ? { synth: base.synth ?? sa[0]!.synth } : {}) })
  }
  const merged: Cell = {
    ...b,
    loops: loops.slice(0, MAX_LOOPS),
    parts: { bass: a.parts.bass || b.parts.bass, chords: a.parts.chords || b.parts.chords },
    turns: fitTurns(Math.max(a.turns, b.turns) as Turns, loops),
  }
  const next = withoutCell({ ...song, cells: song.cells.map((c) => (c.id === bId ? merged : c)) }, aId)
  // los ids de loop no se repiten (los que cambiaron conservan el de B o el de A; los demás, los suyos)
  const seen = new Set<number>()
  const fixed = next.cells.map((c) => ({ ...c, loops: c.loops.map((l) => (seen.has(l.id) && c.id === bId ? { ...l, id: (next.nextLoopId += 1) - 1 } : (seen.add(l.id), l))) }))
  return { song: { ...next, cells: fixed }, dropped }
}

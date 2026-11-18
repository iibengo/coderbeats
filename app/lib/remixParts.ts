/**
 * De una canción a las partes que se actúan en el Laboratorio (spec 019/020): **un remix es un único objeto (la canción)**; esto es solo su cara de «actuarlo».
 * Tantas partes como tenga (como mucho 8): las células seguidas muy parecidas se juntan en una sola parte con nombre claro (Intro, Estrofa, Subida, Drop, Break, Final);
 * los grupos en paralelo suenan juntos dentro de la parte que los enciende; como mucho 4 capas por parte. Puro y sin DOM.
 */
import { isPercSynth } from './percSamples'
import type { Cell, Song } from './cells'
import type { FreeLoop } from './freeLoops'
import type { MelodySynth } from './melody'
import type { Note } from './remixes'
import type { Instrument } from './types'

export const MAX_PARTS = 8
export const MAX_LAYERS = 4

/** una capa que se enciende o apaga: patrones de batería, loops de melodía y/o el bajo o los acordes del fondo */
export interface LabLayer {
  key: string
  label: string
  drums?: Partial<Record<Instrument, string>>
  mel?: { notes: readonly Note[]; synth?: MelodySynth }[]
  bass?: boolean
  chords?: boolean
}
export interface LabPart {
  name: string
  layers: LabLayer[]
  /** qué capas suenan al entrar en la parte (por clave): las que lleva la canción */
  start: string[]
  /** compases que dura la parte en la canción (la suma de sus células) */
  bars: number
}

const FX_SYNTHS: readonly string[] = ['riser', 'crash', 'boom', 'impacto', 'downlifter']
const isFx = (l: FreeLoop): boolean => FX_SYNTHS.includes(l.synth ?? '') || (l.synth === 'pad' && l.hits.length <= 4)

/** El patrón de una capa de batería: 16 símbolos (un compás) o 64 (cuatro); los de 2 compases se repiten. */
export function patternOf(l: FreeLoop): string {
  const total = l.bars * 16
  const n = l.bars === 1 ? 16 : 64
  const t: string[] = Array(n).fill('~')
  for (const h of l.hits) {
    const p = Math.round(h.pos)
    if (p < 0 || p >= total) continue
    for (let at = p; at < n; at += total) t[at] = 'x'
  }
  return t.join(' ')
}
/** Las notas de un loop de melodía como un loop de 4 compases (si es más corto se repite). */
export function notesOf(l: FreeLoop): Note[] {
  const total = l.bars * 16
  if (total <= 0 || 64 % total !== 0) return []
  const out: Note[] = []
  for (let rep = 0; rep < 64 / total; rep++) for (const h of l.hits) if (typeof h.midi === 'number') out.push([h.pos + rep * total, h.dur ?? 2, h.midi] as const)
  return out
}

const median = (xs: number[]): number => {
  const a = [...xs].sort((x, y) => x - y)
  return a.length ? a[Math.floor(a.length / 2)]! : 0
}
const midiOf = (l: FreeLoop): number[] => l.hits.flatMap((h) => (typeof h.midi === 'number' ? [h.midi] : []))
/** un bajo hecho de notas: una melodía grave (mediana ≤ MIDI 45); unos acordes hechos de notas: un pad de notas largas (media ≥ 8 pasos) */
const isLowMel = (l: FreeLoop): boolean => median(midiOf(l)) <= 45
const isChordPad = (l: FreeLoop): boolean => l.synth === 'pad' && l.hits.length > 0 && l.hits.reduce((n, h) => n + (h.dur ?? 0), 0) / l.hits.length >= 8

/** Las capas de una célula (solo lo que suena). `groupTheme`: la melodía del grupo en paralelo que suena con ella, si ella no lleva ninguna. */
export function layersOfCell(cell: Cell, groupTheme: FreeLoop | null = null): LabLayer[] {
  const loops = cell.loops.filter((l) => !l.muted && !l.voice && l.hits.length)
  const drum = (i: Instrument) => loops.find((l) => l.instrument === i)
  const bd = drum('bd')
  const sd = drum('sd')
  const hh = drum('hh')
  const mels = loops.filter((l) => l.instrument === 'mel')
  const fx = mels.filter(isFx)
  // canciones propias con bajo y acordes hechos de notas (no del fondo del estilo): el bajo es la melodía grave y los acordes el pad de notas largas
  // la percusión del minimal (spec 045) no es melodía: va con el ritmo
  const percs = mels.filter((l) => isPercSynth(l.synth))
  const notes = mels.filter((l) => !isFx(l) && !isPercSynth(l.synth))
  const bassMel = cell.parts.bass ? undefined : (notes.find((l) => l.synth === 'bass') ?? notes.find(isLowMel))
  const chordMel = cell.parts.chords ? undefined : notes.find((l) => l !== bassMel && (l.synth === 'keys' || isChordPad(l)))
  const theme = notes.find((l) => l !== bassMel && l !== chordMel) ?? groupTheme ?? undefined
  const rising = fx.some((l) => l.synth === 'riser')
  const riseFx = fx.filter((l) => l.synth === 'riser' || (rising && l.synth === 'pad'))
  const dropFx = [...fx.filter((l) => !riseFx.includes(l)), ...percs]
  const m = (ls: FreeLoop[]) => ls.map((l) => ({ notes: notesOf(l), synth: l.synth }))
  const out: LabLayer[] = []
  if (bd && sd) out.push({ key: 'ritmo', label: 'ritmo', drums: { bd: patternOf(bd), sd: patternOf(sd), ...(hh ? { hh: patternOf(hh) } : {}) }, ...(dropFx.length ? { mel: m(dropFx) } : {}) })
  else {
    if (bd) out.push({ key: 'bombo', label: 'bombo', drums: { bd: patternOf(bd) } })
    if (sd) out.push({ key: 'caja', label: 'caja', drums: { sd: patternOf(sd), ...(hh ? { hh: patternOf(hh) } : {}) } })
    else if (hh) out.push({ key: 'hat', label: 'platillo', drums: { hh: patternOf(hh) } })
  }
  const leftover = out.some((l) => l.key === 'ritmo') ? riseFx : [...riseFx, ...dropFx]
  if (leftover.length) out.push({ key: 'subida', label: 'subida', mel: m(leftover) })
  if (cell.parts.bass) out.push({ key: 'bajo', label: 'bajo', bass: true })
  else if (bassMel) out.push({ key: 'bajo', label: 'bajo', mel: m([bassMel]) })
  if (cell.parts.chords) out.push({ key: 'acordes', label: 'acordes', chords: true })
  else if (chordMel) out.push({ key: 'acordes', label: 'acordes', mel: m([chordMel]) })
  if (theme) out.push({ key: 'tema', label: 'tema', mel: [{ notes: notesOf(theme), synth: theme.synth }] })
  return capLayers(out)
}

/** Como mucho 4 capas: se quitan primero el platillo suelto, los acordes, el bajo, la subida, la caja y el bombo (nunca el ritmo ni el tema). */
export function capLayers(layers: LabLayer[]): LabLayer[] {
  const out = [...layers]
  for (const k of ['hat', 'acordes', 'bajo', 'subida', 'caja', 'bombo']) {
    if (out.length <= MAX_LAYERS) break
    const i = out.findIndex((l) => l.key === k)
    if (i >= 0) out.splice(i, 1)
  }
  return out.slice(0, MAX_LAYERS)
}

const keysOf = (ls: readonly LabLayer[]): string[] => ls.map((l) => l.key).sort()
const sigOf = (ls: readonly LabLayer[]): string => keysOf(ls).join('+')
/** cuánto se parecen dos partes: las capas que no comparten (0 = iguales) */
const distance = (a: readonly LabLayer[], b: readonly LabLayer[]): number => {
  const ka = new Set(keysOf(a))
  const kb = new Set(keysOf(b))
  return [...ka].filter((k) => !kb.has(k)).length + [...kb].filter((k) => !ka.has(k)).length
}

const KNOWN = /^(intro|estrofa|subida|drop|break|final|puente)(?:\s+\d+)?$/i
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

/** El papel de una parte por lo que lleva y dónde está (si la célula no trae un nombre claro). */
export function roleOf(layers: readonly LabLayer[], index: number, count: number): string {
  const k = new Set(keysOf(layers))
  const kick = k.has('ritmo') || k.has('bombo')
  if (index === count - 1 && count > 1) return 'Final'
  if (index === 0) return 'Intro'
  if (k.has('ritmo') && k.has('acordes')) return 'Drop'
  if (!kick && (k.has('subida') || k.has('caja'))) return 'Subida'
  if (!kick && k.has('acordes')) return 'Break'
  if (k.has('ritmo')) return 'Drop'
  return 'Estrofa'
}

interface Raw {
  name: string
  layers: LabLayer[]
  bars: number
}

/**
 * Las partes de una canción: una por tramo de células con las mismas capas (se juntan las seguidas muy parecidas), con nombre claro, como mucho 8
 * (si hay más, se juntan los vecinos más parecidos). Los grupos en paralelo que enciende una célula suenan con ella y con las siguientes hasta que otra los apaga.
 */
export function partsFromSong(song: Song): LabPart[] {
  const raws: Raw[] = []
  const active = new Set<number>()
  const cellOf = (id: number) => song.cells.find((c) => c.id === id)
  for (const id of song.order) {
    const cell = cellOf(id)
    if (!cell) continue
    for (const g of cell.groupOff ?? []) active.delete(g)
    for (const g of cell.groupOn ?? []) active.add(g)
    // la melodía del primer grupo encendido (la de su primera célula con notas)
    let groupTheme: FreeLoop | null = null
    for (const gid of active) {
      const first = cellOf(song.groups.find((g) => g.id === gid)?.order[0] ?? -1)
      groupTheme = first?.loops.find((l) => l.instrument === 'mel' && !l.muted && l.hits.length) ?? null
      if (groupTheme) break
    }
    const layers = layersOfCell(cell, groupTheme)
    if (!layers.length) continue
    const last = raws[raws.length - 1]
    if (last && sigOf(last.layers) === sigOf(layers)) last.bars += cell.turns
    else raws.push({ name: cell.name ?? '', layers, bars: cell.turns })
  }
  // más de 8: se juntan los vecinos más parecidos (a igualdad, los más cortos)
  while (raws.length > MAX_PARTS) {
    let best = 0
    let bestKey = [Infinity, Infinity]
    for (let i = 0; i < raws.length - 1; i++) {
      const key = [distance(raws[i]!.layers, raws[i + 1]!.layers), raws[i]!.bars + raws[i + 1]!.bars]
      if (key[0]! < bestKey[0]! || (key[0] === bestKey[0] && key[1]! < bestKey[1]!)) {
        best = i
        bestKey = key
      }
    }
    const a = raws[best]!
    const b = raws[best + 1]!
    raws.splice(best, 2, { name: a.name, layers: b.layers.length > a.layers.length ? b.layers : a.layers, bars: a.bars + b.bars })
  }
  // nombres claros y únicos
  const seen = new Map<string, number>()
  return raws.map((r, i) => {
    const base = KNOWN.test(r.name.trim()) ? cap(r.name.trim().replace(/\s+\d+$/, '')) : roleOf(r.layers, i, raws.length)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { name: n === 1 ? base : `${base} ${n}`, layers: r.layers, start: r.layers.map((l) => l.key), bars: r.bars }
  })
}

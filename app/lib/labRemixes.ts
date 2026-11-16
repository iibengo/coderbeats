/**
 * Remixes del Laboratorio (spec 019): la versión **simplificada** de cada remix del Estudio, para actuar con ella.
 * Cuatro partes (Intro, Subida, Drop, Final), como mucho cuatro capas por parte, cada parte suena bien en bucle sola. Las notas y los patrones son los
 * del Estudio (`remixes.ts`, que no se toca); aquí solo se eligen y se agrupan. Todo puro.
 */
import { MAX_CELLS, TURNS, type Cell, type Song, type Turns } from './cells'
import { STYLES } from './constants'
import type { FreeLoop } from './freeLoops'
import type { MelodySynth } from './melody'
import {
  DIES_A, DIES_B, MZ, MZ_CLAP_FILL, MZ_CRASH, MZ_ROOTS, MZ_UP, ODE_A, ODE_A2, ODE_B, ODE_CRASH, ODE_ROOTS, P, RISER2_NOISE, RISER2_PAD, RISER2_ROLL, RISER_NOISE, RISER_PAD, RISER_ROLL, T, WOW_HOOK, WOW_IMPACT, up,
  type Note,
} from './remixes'
import type { Instrument, KitId, StyleId } from './types'

export type LabPartName = 'Intro' | 'Subida' | 'Drop' | 'Final'
export const PART_NAMES: readonly LabPartName[] = ['Intro', 'Subida', 'Drop', 'Final']
export const MAX_LAYERS = 4

/** una capa que se enciende o apaga: patrones de batería, loops de melodía y/o el bajo o los acordes del fondo */
export interface LabLayer {
  key: string
  label: string
  drums?: Partial<Record<Instrument, string>>
  mel?: { notes: readonly Note[]; synth: MelodySynth }[]
  bass?: boolean
  chords?: boolean
}
export interface LabPart {
  name: LabPartName
  layers: LabLayer[]
  /** qué capas suenan al entrar en la parte (por clave) */
  start: string[]
}
export interface LabRemix {
  id: string
  title: string
  composer: string
  style: StyleId
  kit: KitId
  key: string
  parts: Record<LabPartName, LabPart>
}

const L = {
  kick: (p: string): LabLayer => ({ key: 'bombo', label: 'bombo', drums: { bd: p } }),
  hat: (p: string): LabLayer => ({ key: 'hat', label: 'platillo', drums: { hh: p } }),
  bass: { key: 'bajo', label: 'bajo', bass: true } as LabLayer,
  chords: { key: 'acordes', label: 'acordes', chords: true } as LabLayer,
  theme: (notes: readonly Note[], synth: MelodySynth, label = 'tema'): LabLayer => ({ key: 'tema', label, mel: [{ notes, synth }] }),
}
const riser = (noise: readonly Note[], pad: readonly Note[]): LabLayer => ({ key: 'subida', label: 'subida', mel: [{ notes: noise, synth: 'riser' }, { notes: pad, synth: 'pad' }] })

interface Recipe {
  id: string
  title: string
  composer: string
  style: StyleId
  kit: KitId
  key: string
  kick: string
  clap: string
  hat: string
  hats16: string
  roll: string
  noise: readonly Note[]
  pad: readonly Note[]
  rollRiser: string
  /** el tema: en la intro (en pad, suave), en la subida, en el drop y en el final */
  intro: readonly Note[]
  sub: readonly Note[]
  drop: readonly Note[]
  final: readonly Note[]
  /** lo que remata el drop: platillo, impacto, pad en la raíz */
  dropFx: { notes: readonly Note[]; synth: MelodySynth }[]
}

function recipe(r: Recipe): LabRemix {
  const parts: Record<LabPartName, LabPart> = {
    Intro: { name: 'Intro', layers: [L.kick(r.kick), L.hat(r.hat), L.bass, L.theme(r.intro, 'pad')], start: ['bombo', 'tema'] },
    // sin bombo: la caja que se acelera, el riser, el bajo y el tema
    Subida: { name: 'Subida', layers: [{ key: 'caja', label: 'caja', drums: { sd: r.roll, hh: r.hats16 } }, riser(r.noise, r.pad), L.bass, L.theme(r.sub, 'lead')], start: ['caja', 'subida', 'bajo', 'tema'] },
    // con todo: el ritmo entero (con el platillo grande al entrar), el bajo, los acordes y el tema
    Drop: { name: 'Drop', layers: [{ key: 'ritmo', label: 'ritmo', drums: { bd: r.kick, sd: r.clap, hh: r.hats16 }, mel: r.dropFx }, L.bass, L.chords, L.theme(r.drop, 'lead')], start: ['ritmo', 'bajo', 'acordes', 'tema'] },
    Final: { name: 'Final', layers: [L.chords, L.theme(r.final, 'pad'), L.hat(r.hat)], start: ['acordes', 'tema'] },
  }
  return { id: r.id, title: r.title, composer: r.composer, style: r.style, kit: r.kit, key: r.key, parts }
}

const TECHNO = { kick: T.bd4, clap: T.clap, hat: T.hat, hats16: T.hats16, roll: T.roll, noise: RISER_NOISE, pad: RISER_PAD, rollRiser: RISER_ROLL }

export const LAB_REMIXES: readonly LabRemix[] = [
  recipe({
    id: 'oda-alegria-dembow', title: 'Himno de la alegría', composer: 'Beethoven', style: 'dembow', kit: '808', key: 'Re mayor',
    kick: P.bd, clap: P.sdFill, hat: P.hh8, hats16: P.hh16, roll: P.sdRoll, noise: RISER2_NOISE, pad: RISER2_PAD, rollRiser: RISER2_ROLL,
    intro: ODE_A, sub: ODE_B, drop: up(ODE_A, 12), final: ODE_A2,
    dropFx: [{ notes: ODE_CRASH, synth: 'crash' }, { notes: ODE_ROOTS, synth: 'pad' }],
  }),
  recipe({
    id: 'dies-irae-techno', title: 'Dies Irae', composer: 'gregoriano, s. XIII', style: 'techno', kit: 'electro', key: 'Do menor', ...TECHNO,
    intro: DIES_A, sub: DIES_B, drop: DIES_A, final: DIES_B,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }],
  }),
  recipe({
    id: 'wow-techno', title: 'Wow', composer: 'coderbeats', style: 'techno', kit: 'electro', key: 'Do menor', ...TECHNO, clap: MZ_CLAP_FILL,
    intro: WOW_HOOK, sub: WOW_HOOK, drop: WOW_HOOK, final: WOW_HOOK,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }, { notes: WOW_IMPACT, synth: 'boom' }],
  }),
  recipe({
    // OJO: las notas del tema de Mozart están «de oído» y falta contrastarlas con la partitura (ver spec 019, §6)
    id: 'sinfonia-40-techno', title: 'Sinfonía n.º 40', composer: 'Mozart', style: 'techno', kit: 'electro', key: 'Do menor', ...TECHNO, clap: MZ_CLAP_FILL,
    intro: MZ.a, sub: MZ.b, drop: MZ_UP.a, final: MZ.b,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }, { notes: MZ_ROOTS, synth: 'pad' }],
  }),
]
export const labRemixById = (id: string): LabRemix | undefined => LAB_REMIXES.find((r) => r.id === id)

// ── duraciones ─────────────────────────────────────────────────────────────────────────────────────
export const barSeconds = (style: StyleId): number => (60 / STYLES[style].bpm) * 4
/** El remix del Laboratorio dura ≈ 1 min: 32 compases a 128 (60 s); a 120, 64 s. Intro 8 · Subida 4 · Drop 16 · Final 4 (32), siempre en valores de vueltas. */
export const REMIX_BARS: Record<LabPartName, Turns> = { Intro: 8, Subida: 4, Drop: 16, Final: 4 }
export const remixSeconds = (style: StyleId): number => Object.values(REMIX_BARS).reduce((s, b) => s + b, 0) * barSeconds(style)

/** Lo que dura como mucho lo grabado (2 min) y cuánto antes entra el final (≈ 8 s), en compases enteros. */
export const MAX_TAKE_SECONDS = 120
export const FINAL_SECONDS = 8
export function takePlan(style: StyleId): { maxBars: number; finalBars: number; finalStart: number } {
  const bs = barSeconds(style)
  const maxBars = Math.floor(MAX_TAKE_SECONDS / bs)
  const finalBars = Math.max(2, Math.round(FINAL_SECONDS / bs))
  return { maxBars, finalBars, finalStart: maxBars - finalBars }
}

// ── loops de una parte ─────────────────────────────────────────────────────────────────────────────
export interface PartLoops {
  loops: FreeLoop[]
  /** los ids de loop de cada capa (las de fondo, vacías) */
  ids: Record<string, number[]>
  nextId: number
}
/** Los loops de las capas de una parte. `muteOff`: las capas apagadas se crean silenciadas (para poder encenderlas); si no, solo se crean las encendidas. */
export function partLoops(part: LabPart, on: ReadonlySet<string>, firstId: number, muteOff: boolean): PartLoops {
  const loops: FreeLoop[] = []
  const ids: Record<string, number[]> = {}
  let id = firstId
  for (const l of part.layers) {
    ids[l.key] = []
    const muted = !on.has(l.key)
    if (muted && !muteOff) continue
    const add = (f: Omit<FreeLoop, 'id' | 'muted' | 'bornAt' | 'fromTemplate' | 'phaseBar'>) => {
      ids[l.key]!.push(id)
      loops.push({ ...f, id: id++, phaseBar: 0, muted, bornAt: 0, fromTemplate: false })
    }
    for (const inst of ['bd', 'sd', 'hh'] as const) {
      const pattern = l.drums?.[inst]
      if (!pattern) continue
      const tokens = pattern.split(' ')
      add({ instrument: inst, bars: tokens.length === 64 ? 4 : 1, hits: tokens.flatMap((t, step) => (t === '~' ? [] : [{ pos: step, strength: 0.8 }])) })
    }
    for (const m of l.mel ?? []) add({ instrument: 'mel', bars: 4, hits: m.notes.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.8 })), synth: m.synth })
  }
  return { loops, ids, nextId: id }
}
export const partsOn = (part: LabPart, on: ReadonlySet<string>): { bass: boolean; chords: boolean } => ({
  bass: part.layers.some((l) => l.bass && on.has(l.key)),
  chords: part.layers.some((l) => l.chords && on.has(l.key)),
})

// ── canciones: el remix a su ritmo y lo que yo actúo ───────────────────────────────────────────────
/** un compás de lo actuado: en qué parte estaba y qué capas sonaban */
export interface TakeBar {
  part: LabPartName
  on: string[]
}

/** Trozos de vueltas válidas (1, 2, 4, 8, 16, 32) que suman `bars`, de mayor a menor. */
export function turnChunks(bars: number): Turns[] {
  const out: Turns[] = []
  let left = bars
  for (const t of [...TURNS].reverse()) {
    while (left >= t) {
      out.push(t)
      left -= t
    }
  }
  return out
}

interface Run {
  part: LabPartName
  on: string[]
  bars: number
}
const sig = (b: { part: LabPartName; on: string[] }): string => `${b.part}|${[...b.on].sort().join(',')}`

/** Tramos seguidos iguales; si salen más células de las que caben, el tramo más corto se une al anterior (los compases no cambian). */
export function runsOfTake(take: readonly TakeBar[]): Run[] {
  let runs: Run[] = []
  for (const b of take) {
    const last = runs[runs.length - 1]
    if (last && sig(last) === sig(b)) last.bars++
    else runs.push({ part: b.part, on: [...b.on], bars: 1 })
  }
  const cells = (rs: Run[]) => rs.reduce((n, r) => n + turnChunks(r.bars).length, 0)
  while (cells(runs) > MAX_CELLS && runs.length > 1) {
    let k = 1
    for (let i = 1; i < runs.length; i++) if (runs[i]!.bars < runs[k]!.bars) k = i
    runs[k - 1]!.bars += runs[k]!.bars
    runs.splice(k, 1)
    runs = runs.reduce<Run[]>((acc, r) => {
      const last = acc[acc.length - 1]
      if (last && sig(last) === sig(r)) last.bars += r.bars
      else acc.push({ ...r })
      return acc
    }, [])
  }
  return runs
}

/** La canción de una actuación: una célula por tramo (partida en vueltas válidas si hace falta), con solo las capas que sonaban. `null` si no hay compases. */
export function songFromTake(remix: LabRemix, take: readonly TakeBar[]): Song | null {
  if (!take.length) return null
  const cells: Cell[] = []
  let loopId = 1
  let cellId = 1
  for (const run of runsOfTake(take)) {
    const part = remix.parts[run.part]
    const on = new Set(run.on)
    for (const turns of turnChunks(run.bars)) {
      const pl = partLoops(part, on, loopId, false)
      loopId = pl.nextId
      const i = cells.length
      cells.push({ id: cellId++, name: run.part, loops: pl.loops, parts: partsOn(part, on), turns, at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! } })
    }
  }
  return { version: 1, cells, order: cells.map((c) => c.id), groups: [], nextGroupId: 1, bpm: null, nextCellId: cellId, nextLoopId: loopId }
}

/** El remix «original» del Laboratorio: las cuatro partes, cada una con sus capas de salida, en su duración de ≈ 1 min. */
export function remixTake(remix: LabRemix): TakeBar[] {
  return PART_NAMES.flatMap((p) => Array.from({ length: REMIX_BARS[p] }, () => ({ part: p, on: [...remix.parts[p].start] })))
}

/**
 * Remixes (spec 008): canciones de demo que mezclan un estilo con una melodía de **dominio público**. La melodía va como
 * notas (aquí no hay ningún audio de terceros) y el arreglo (ritmo, bajo, acordes, estructura) es original.
 */
import { MAX_CELLS, type Cell, type Group, type Song, type Turns } from './cells'
import type { FreeLoop } from './freeLoops'
import type { MelodySynth } from './melody'
import type { Parts } from './background'
import type { Instrument, KitId, StyleId } from './types'

export interface RemixInfo {
  /** nombre de la célula y lo que añade, para la lista */
  cells: { name: string; turns: number; text: string }[]
}

export interface Remix {
  id: string
  title: string
  /** atribución, a la vista en la lista */
  composer: string
  years: string
  /** por qué es de dominio público (una línea) */
  publicDomain: string
  style: StyleId
  kit: KitId
  /** tonalidad, p. ej. "Re mayor" */
  key: string
  info: RemixInfo
  /** la canción con sus células (cada llamada da una nueva) */
  build(): Song
}

type Note = readonly [pos: number, dur: number, midi: number]

// ── La Oda a la alegría (Beethoven, 1824), tema principal en re mayor ───────────────────────────────
// D4=62 E4=64 F#4=66 G4=67 A4=69. Cada frase es de 4 compases de 16 pasos (negra = 4, corchea = 2, blanca = 8).
const ODE_START: readonly Note[] = [
  [0, 4, 66], [4, 4, 66], [8, 4, 67], [12, 4, 69], // F# F# G A
  [16, 4, 69], [20, 4, 67], [24, 4, 66], [28, 4, 64], // A G F# E
  [32, 4, 62], [36, 4, 62], [40, 4, 64], [44, 4, 66], // D D E F#
]
/** frase A (cadencia abierta): ... F#. E E */
export const ODE_A: readonly Note[] = [...ODE_START, [48, 6, 66], [54, 2, 64], [56, 8, 64]]
/** frase A′ (cadencia cerrada): ... E. D D */
export const ODE_A2: readonly Note[] = [...ODE_START, [48, 6, 64], [54, 2, 62], [56, 8, 62]]
/** frase B (el puente): E E F♯ D | E F♯G F♯ D | E F♯G F♯ E | D E A(grave) */
export const ODE_B: readonly Note[] = [
  [0, 4, 64], [4, 4, 64], [8, 4, 66], [12, 4, 62], // E E F# D
  [16, 4, 64], [20, 2, 66], [22, 2, 67], [24, 4, 66], [28, 4, 62], // E F# G F# D
  [32, 4, 64], [36, 2, 66], [38, 2, 67], [40, 4, 66], [44, 4, 64], // E F# G F# E
  [48, 4, 62], [52, 4, 64], [56, 8, 57], // D E A
]
const up = (notes: readonly Note[], semitones: number): Note[] => notes.map(([p, d, m]) => [p, d, m + semitones] as const)

// ── Patrones de un compás (16 pasos) o de cuatro (64) ─────────────────────────────────────────────
const P = {
  hh8: 'hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~',
  hh16: Array(16).fill('hh').join(' '),
  bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
  sd: '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~',
  /** la caja que se acelera en 4 compases: negras, corcheas, semicorcheas y semicorcheas */
  sdRoll: [
    'sd ~ ~ ~ sd ~ ~ ~ sd ~ ~ ~ sd ~ ~ ~',
    'sd ~ sd ~ sd ~ sd ~ sd ~ sd ~ sd ~ sd ~',
    Array(16).fill('sd').join(' '),
    Array(16).fill('sd').join(' '),
  ].join(' '),
}

/**
 * Un grupo en paralelo (spec 005, §22): células de solo melodía que suenan seguidas, encendido por la célula `on` de la
 * canción y apagado por la `off` (por nombre).
 */
interface GroupSpec {
  on: string
  off?: string
  cells: { name: string; turns: Turns; mel: { notes: readonly Note[]; synth: MelodySynth }; lpf?: number[] }[]
}

interface CellSpec {
  name: string
  turns: Turns
  parts: Parts
  drums: Partial<Record<Instrument, string>>
  mel?: { notes: readonly Note[]; synth: MelodySynth }
  lpf?: number[]
  /** lo que añade, para la lista */
  text: string
}

const ODE_DEMBOW: CellSpec[] = [
  { name: 'Intro', turns: 4, parts: { bass: false, chords: true }, drums: {}, lpf: [800, 900, 1000, 1200], text: 'solo los acordes, suaves' },
  { name: 'Despierta', turns: 4, parts: { bass: false, chords: true }, drums: { hh: P.hh8 }, mel: { notes: ODE_A, synth: 'pad' }, text: '+ platillo y la melodía, suave y lejana' },
  { name: 'Entra el ritmo', turns: 4, parts: { bass: false, chords: true }, drums: { hh: P.hh8, bd: P.bd }, mel: { notes: ODE_A, synth: 'pad' }, text: '+ bombo' },
  { name: 'Dembow', turns: 8, parts: { bass: false, chords: true }, drums: { hh: P.hh16, bd: P.bd, sd: P.sd }, text: '+ caja dembow; entra el Himno completo, claro (A, A′)' },
  { name: 'Subida', turns: 4, parts: { bass: false, chords: true }, drums: { hh: P.hh16, sd: P.sdRoll }, lpf: [600, 1000, 2000, 6000], text: 'sin bombo, la caja se acelera y el filtro se abre; el puente (B)' },
  { name: 'Subidón', turns: 8, parts: { bass: true, chords: true }, drums: { hh: P.hh16, bd: P.bd, sd: P.sd }, text: 'todo, con el bajo y el Himno una octava más aguda (A↑, A′↑)' },
  { name: 'Final', turns: 2, parts: { bass: false, chords: true }, drums: {}, lpf: [1500, 350], text: 'solo los acordes, que se apagan (el Himno se apaga)' },
]

/** El Himno, en orden y sin repetirse, en un grupo que se enciende con el Dembow y se apaga con el Final (20 compases = 8 + 4 + 8). */
const ODE_GROUP: GroupSpec = {
  on: 'Dembow',
  off: 'Final',
  cells: [
    { name: 'Himno A', turns: 4, mel: { notes: ODE_A, synth: 'lead' } },
    { name: 'Himno A′', turns: 4, mel: { notes: ODE_A2, synth: 'lead' } },
    { name: 'Puente B', turns: 4, mel: { notes: ODE_B, synth: 'lead' }, lpf: [600, 1000, 2000, 6000] },
    { name: 'Himno A↑', turns: 4, mel: { notes: up(ODE_A, 12), synth: 'lead' } },
    { name: 'Himno A′↑', turns: 4, mel: { notes: up(ODE_A2, 12), synth: 'lead' } },
  ],
}

function buildSong(specs: readonly CellSpec[], groupSpecs: readonly GroupSpec[] = []): Song {
  let id = 1
  const loop = (instrument: FreeLoop['instrument'], bars: 1 | 4, hits: FreeLoop['hits'], synth?: MelodySynth): FreeLoop => ({
    id: id++, instrument, bars, phaseBar: 0, hits, muted: false, bornAt: 0, fromTemplate: false, ...(synth ? { synth } : {}),
  })
  const cells: Cell[] = specs.slice(0, MAX_CELLS).map((s, i) => {
    const loops: FreeLoop[] = []
    for (const inst of ['bd', 'sd', 'hh'] as const) {
      const pattern = s.drums[inst]
      if (!pattern) continue
      const tokens = pattern.split(' ')
      loops.push(loop(inst, tokens.length === 64 ? 4 : 1, tokens.flatMap((t, step) => (t === '~' ? [] : [{ pos: step, strength: 0.8 }]))))
    }
    if (s.mel) loops.push(loop('mel', 4, s.mel.notes.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.8 })), s.mel.synth))
    return {
      id: i + 1,
      name: s.name,
      loops,
      parts: { ...s.parts },
      turns: s.turns,
      ...(s.lpf ? { lpf: [...s.lpf] } : {}),
      // en una curva suave de izquierda a derecha, a distintas profundidades (como la demo de dembow)
      at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! },
    }
  })
  // los grupos en paralelo: sus células (solo melodía) debajo de la canción, y los disparadores en las células de la canción que los encienden y apagan
  const groups: Group[] = []
  let nextCell = cells.length + 1
  groupSpecs.forEach((g, gi) => {
    const gid = gi + 1
    const ids: number[] = []
    g.cells.forEach((gc, k) => {
      const cid = nextCell++
      ids.push(cid)
      cells.push({
        id: cid, name: gc.name, loops: [loop('mel', 4, gc.mel.notes.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.8 })), gc.mel.synth)],
        parts: { bass: false, chords: false }, turns: gc.turns, ...(gc.lpf ? { lpf: [...gc.lpf] } : {}),
        at: { x: 9 + k * 3, y: 4.5 + gi * 2.5, depth: [0.5, 0.2, 0.6, 0.3][k % 4]! },
      })
    })
    groups.push({ id: gid, order: ids, on: false })
    const on = cells.find((c) => c.name === g.on)
    if (on) on.groupOn = [...(on.groupOn ?? []), gid]
    const off = g.off ? cells.find((c) => c.name === g.off) : undefined
    if (off) off.groupOff = [...(off.groupOff ?? []), gid]
  })
  return { version: 1, cells, order: cells.slice(0, specs.length).map((c) => c.id), groups, nextGroupId: groups.length + 1, bpm: null, nextCellId: nextCell, nextLoopId: id }
}

export const REMIXES: readonly Remix[] = [
  {
    id: 'oda-alegria-dembow',
    title: 'Himno de la alegría',
    composer: 'Ludwig van Beethoven',
    years: '1770–1827',
    publicDomain: 'Obra de dominio público (el autor murió en 1827); el arreglo es de coderbeats.',
    style: 'dembow',
    kit: '808',
    key: 'Re mayor',
    info: { cells: ODE_DEMBOW.map((s) => ({ name: s.name, turns: s.turns, text: s.text })) },
    build: () => buildSong(ODE_DEMBOW, [ODE_GROUP]),
  },
]

export const remixById = (id: string): Remix | undefined => REMIXES.find((r) => r.id === id)

/** Compases que dura un remix entero. */
export const remixBars = (r: Remix): number => r.info.cells.reduce((s, c) => s + c.turns, 0)

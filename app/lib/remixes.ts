/**
 * Remixes (spec 008): canciones de demo que mezclan un estilo con una melodía de **dominio público**. La melodía va como
 * notas (aquí no hay ningún audio de terceros) y el arreglo (ritmo, bajo, acordes, estructura) es original.
 */
import { MAX_CELLS, type Cell, type Group, type Song, type Turns } from './cells'
import type { FreeLoop } from './freeLoops'
import type { MelodySynth } from './melody'
import type { Parts } from './background'
import type { Instrument, KitId, StyleId } from './types'
import { WOW_PRESETS, type Wow } from './wow'

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
  /** el "wowo" del filtro de la célula (spec 008, §9): resonancia y envolvente sobre el `lpf` */
  wow?: Wow
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
    { name: 'Himno A2', turns: 4, mel: { notes: ODE_A2, synth: 'lead' } },
    { name: 'Puente B', turns: 4, mel: { notes: ODE_B, synth: 'lead' }, lpf: [600, 1000, 2000, 6000] },
    { name: 'Himno A agudo', turns: 4, mel: { notes: up(ODE_A, 12), synth: 'lead' } },
    { name: 'Himno A2 agudo', turns: 4, mel: { notes: up(ODE_A2, 12), synth: 'lead' } },
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
      ...(s.wow ? { wow: { ...s.wow } } : {}),
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
        at: { x: 8 + k * 3.6, y: 4.8 + gi * 2.5, depth: [0.5, 0.2, 0.6, 0.3][k % 4]! },
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

// ── El Dies Irae (gregoriano, s. XIII), en do menor (spec 008, §9) ──────────────────────────────────
// La secuencia del juicio final: la nota repetida de cada frase es lo que le da el carácter de martillo. C3=48 D3=50
// Eb3=51 F3=53 G3=55 Ab3=56 Bb3=58 (la escala del techno, do menor).
/** Las cuatro frases, 2 compases cada una (32 pasos); la nota pedal de cada una se repite en negras. */
const DIES_PHRASES: readonly (readonly Note[])[] = [
  // F F F F | D F F F: la frase que da nombre a la secuencia
  [[0, 2, 53], [2, 2, 53], [4, 2, 53], [6, 2, 53], [8, 2, 50], [10, 2, 53], [12, 2, 53], [14, 2, 53], [16, 2, 53], [18, 2, 53], [20, 2, 53], [22, 2, 53], [24, 2, 50], [26, 2, 53], [28, 2, 53], [30, 2, 53]],
  // F F F F | D F F F (repite, más larga al final): el martillo sube
  [[0, 2, 53], [2, 2, 53], [4, 2, 53], [6, 2, 53], [8, 2, 50], [10, 2, 53], [12, 4, 53], [16, 2, 53], [18, 2, 53], [20, 2, 53], [22, 2, 53], [24, 2, 50], [26, 2, 53], [28, 4, 53]],
  // Ab… G… F… Eb…: la figura que se desliza hacia abajo
  [[0, 2, 56], [2, 2, 56], [4, 2, 56], [6, 2, 56], [8, 2, 55], [10, 2, 55], [12, 2, 55], [14, 2, 55], [16, 4, 53], [20, 2, 53], [22, 2, 53], [24, 2, 51], [26, 2, 51], [28, 4, 51]],
  // Bb… D… Bb… Eb…: la cadencia que vuelve al D (el "pozo" del tema), en Bb (do menor natural)
  [[0, 2, 58], [2, 2, 58], [4, 2, 58], [6, 2, 58], [8, 2, 50], [10, 2, 50], [12, 2, 50], [14, 2, 50], [16, 2, 58], [18, 2, 58], [20, 2, 58], [22, 2, 58], [24, 2, 51], [26, 2, 51], [28, 2, 51], [30, 2, 51]],
]
/** Un tema de 4 compases con las frases 1–2 y otro con las 3–4: dos células de 4 compases. */
const DIES_A: readonly Note[] = [...DIES_PHRASES[0]!, ...DIES_PHRASES[1]!.map(([p, d, m]) => [p, d, m] as const)]
const DIES_B: readonly Note[] = [...DIES_PHRASES[2]!, ...DIES_PHRASES[3]!.map(([p, d, m]) => [p, d, m] as const)]

/**
 * ── Techno (spec 008, §9): el molde del house/dnb, con el wowo ─────────────────────────────────────
 *
 * Las células con `lpf` no llevan bajo ni acordes (spec 008, §5): el `lpf` de la célula sustituye al suyo. Por eso el
 * bajo no está en "Entra el tema" (el drop no, y se nota el contraste) y en el groove; en los builds va fuera del filtro
 * resonante del wowo (su propio bajo, con su lpf).
 */
const T = {
  /** bombo 4×4 */
  bd4: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
  /** palmada en 2 y 4 */
  clap: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
  /** el open hat a contratiempo (la corchea de la 8ª, el "tss" del techno) */
  hat: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
  /** la misma batería, 4 compases, con la caja en roll al final: negras, corcheas, semicorcheas y 16 */
  roll: [
    'sd ~ ~ ~ sd ~ ~ ~ sd ~ ~ ~ sd ~ ~ ~',
    'sd ~ sd ~ sd ~ sd ~ sd ~ sd ~ sd ~ sd ~',
    Array(16).fill('sd').join(' '),
    Array(16).fill('sd').join(' '),
  ].join(' '),
  /** el platillo en semicorcheas, para el drop */
  hats16: Array(16).fill('hh').join(' '),
}

/** El Dies Irae en techno: entra poco a poco (con wowo en el build) y estalla en el drop. */
const DIES_TECHNO: CellSpec[] = [
  { name: 'Pulso', turns: 4, parts: { bass: true, chords: false }, drums: { bd: T.bd4 }, text: 'solo el pulso: bombo 4×4 y el bajo a corcheas' },
  { name: 'Hats', turns: 4, parts: { bass: true, chords: false }, drums: { bd: T.bd4, hh: T.hat }, text: '+ palmada y open hat a contratiempo' },
  { name: 'Entra el tema', turns: 8, parts: { bass: false, chords: false }, drums: { bd: T.bd4, sd: T.clap, hh: T.hat }, mel: { notes: DIES_A, synth: 'lead' }, lpf: [500, 700, 900, 1200, 1600, 2100, 2800, 3600], wow: WOW_PRESETS.acid, text: 'el tema con el wowo: el filtro se abre en cada golpe' },
  { name: 'Build', turns: 8, parts: { bass: true, chords: false }, drums: { sd: T.roll, hh: T.hats16 }, mel: { notes: DIES_B, synth: 'lead' }, lpf: [1400, 1800, 2400, 3000, 3800, 4800, 6200, 8000], wow: WOW_PRESETS.house, text: 'sin bombo: la caja se acelera, el bajo en el wowo y el filtro se abre hasta 8 000 Hz (hasta el drop)' },
  { name: 'DROP', turns: 8, parts: { bass: true, chords: true }, drums: { bd: T.bd4, sd: T.clap, hh: T.hats16 }, mel: { notes: DIES_A, synth: 'lead' }, text: 'el drop: todo, bajo y acordes, el tema limpio y el platillo en semicorcheas' },
  { name: 'Groove', turns: 4, parts: { bass: false, chords: false }, drums: { bd: T.bd4, sd: T.clap, hh: T.hat }, mel: { notes: DIES_B, synth: 'lead' }, lpf: [2200, 2600, 3000, 3400], wow: WOW_PRESETS.house, text: 'el groove en paralelo al tema (segunda vuelta)' },
  { name: 'Build 2', turns: 4, parts: { bass: true, chords: false }, drums: { sd: T.roll, hh: T.hats16 }, mel: { notes: DIES_A, synth: 'lead' }, lpf: [2000, 2600, 3400, 4600], wow: WOW_PRESETS.acid, text: 'el segundo build, más corto' },
  { name: 'DROP 2', turns: 8, parts: { bass: true, chords: true }, drums: { bd: T.bd4, sd: T.clap, hh: T.hats16 }, mel: { notes: DIES_B, synth: 'lead' }, text: 'el drop final: todo, sin wowo (el tema, con otra frase)' },
  { name: 'Salida', turns: 2, parts: { bass: false, chords: true }, drums: {}, lpf: [1800, 600], text: 'solo los acordes, que se apagan' },
]

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
  {
    id: 'dies-irae-techno',
    title: 'Dies Irae',
    composer: 'Anónimo (gregoriano, s. XIII)',
    years: 's. XIII',
    publicDomain: 'Melodía gregoriana anónima, del siglo XIII, de dominio público; el arreglo (ritmo, bajo, acordes, estructura) es de coderbeats.',
    style: 'techno',
    kit: '909',
    key: 'Do menor',
    info: { cells: DIES_TECHNO.map((s) => ({ name: s.name, turns: s.turns, text: s.text })) },
    build: () => buildSong(DIES_TECHNO),
  },
]

export const remixById = (id: string): Remix | undefined => REMIXES.find((r) => r.id === id)

/** Compases que dura un remix entero. */
export const remixBars = (r: Remix): number => r.info.cells.reduce((s, c) => s + c.turns, 0)

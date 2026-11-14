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
  /** la caja dembow en 4 compases, con el **redoble** de semicorcheas al final del cuarto (spec 008, §13) */
  sdFill: ['~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~', '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~', '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~', '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd sd sd sd sd'].join(' '),
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
  /** la célula (o las células) de la canción que lo encienden, por nombre */
  on: string | readonly string[]
  /** la que lo apaga (o las que lo apagan), por nombre */
  off?: string | readonly string[]
  cells: { name: string; turns: Turns; mel: { notes: readonly Note[]; synth: MelodySynth }; lpf?: number[] }[]
}

interface CellSpec {
  name: string
  turns: Turns
  parts: Parts
  drums: Partial<Record<Instrument, string>>
  mel?: { notes: readonly Note[]; synth: MelodySynth }
  /** más loops de melodía en la célula (el riser de ruido y su pad, §11) */
  extra?: { notes: readonly Note[]; synth: MelodySynth }[]
  lpf?: number[]
  /** el "wowo" del filtro de la célula (spec 008, §9): resonancia y envolvente sobre el `lpf` */
  wow?: Wow
  /** lo que añade, para la lista */
  text: string
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
    for (const m of [...(s.mel ? [s.mel] : []), ...(s.extra ?? [])]) loops.push(loop('mel', 4, m.notes.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.8 })), m.synth))
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
    for (const name of [g.on].flat()) {
      const on = cells.find((c) => c.name === name)
      if (on) on.groupOn = [...(on.groupOn ?? []), gid]
    }
    for (const name of g.off ? [g.off].flat() : []) {
      const off = cells.find((c) => c.name === name)
      if (off) off.groupOff = [...(off.groupOff ?? []), gid]
    }
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
 * El bajo va por fuera del filtro y del wowo de la célula (spec 008, §10): en el motor es el fondo, que no pasa por el
 * filtro de la célula; en el código mostrado se saca del `stack` filtrado. El wowo solo afecta a la melodía (y a los
 * acordes, si los hay). El bombo va afinado a la raíz de cada acorde (`kickTune`).
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

/**
 * El build de verdad antes del drop (spec 008, §11): 4 compases, y el **último en silencio** (el aire antes de que caiga el
 * drop). El riser es ruido rosa a negras que el filtro de la célula abre compás a compás, la caja en roll que se aprieta y un pad
 * de otro color que sube Ab–Bb–D (la dominante, que pide el Do menor del drop).
 */
const RISER_NOISE: readonly Note[] = Array.from({ length: 12 }, (_, i) => [i * 4, 4, 60] as const)
const RISER_PAD: readonly Note[] = [[0, 16, 56], [16, 16, 58], [32, 16, 62]]
/** la caja del riser: corcheas, semicorcheas, semicorcheas y silencio (4 compases) */
const RISER_ROLL = [
  'sd ~ sd ~ sd ~ sd ~ sd ~ sd ~ sd ~ sd ~',
  Array(16).fill('sd').join(' '),
  Array(16).fill('sd').join(' '),
  Array(16).fill('~').join(' '),
].join(' ')

/** La versión corta, 2 compases (antes del DROP 2): uno que se abre y otro en silencio. */
const RISER2_NOISE: readonly Note[] = Array.from({ length: 4 }, (_, i) => [i * 4, 4, 60] as const)
const RISER2_PAD: readonly Note[] = [[0, 16, 62]]
// (el loop es de 4 compases, la célula dura 2: el 2.º, y los de después, en silencio)
const RISER2_ROLL = [Array(16).fill('sd').join(' '), ...Array(3).fill(Array(16).fill('~').join(' '))].join(' ')

/** El Dies Irae en techno: entra poco a poco (con wowo en el build) y estalla en el drop. */
const DIES_TECHNO: CellSpec[] = [
  { name: 'Pulso', turns: 4, parts: { bass: true, chords: false }, drums: { bd: T.bd4 }, text: 'solo el pulso: bombo 4×4 y el bajo a corcheas' },
  { name: 'Hats', turns: 4, parts: { bass: true, chords: false }, drums: { bd: T.bd4, hh: T.hat }, text: '+ palmada y open hat a contratiempo' },
  { name: 'Entra el tema', turns: 8, parts: { bass: true, chords: false }, drums: { bd: T.bd4, sd: T.clap, hh: T.hat }, mel: { notes: DIES_A, synth: 'lead' }, lpf: [500, 700, 900, 1200, 1600, 2100, 2800, 3600], wow: WOW_PRESETS.acid, text: 'el tema con el wowo (el filtro se abre en cada golpe) sobre el bajo, que no pasa por el filtro' },
  { name: 'Build', turns: 8, parts: { bass: true, chords: false }, drums: { sd: T.roll, hh: T.hats16 }, mel: { notes: DIES_B, synth: 'lead' }, lpf: [1400, 1800, 2400, 3000, 3800, 4800, 6200, 8000], wow: WOW_PRESETS.house, text: 'sin bombo: la caja se acelera, el bajo en el wowo y el filtro se abre hasta 8 000 Hz (hasta el drop)' },
  { name: 'Riser', turns: 4, parts: { bass: false, chords: false }, drums: { sd: RISER_ROLL }, extra: [{ notes: RISER_NOISE, synth: 'riser' }, { notes: RISER_PAD, synth: 'pad' }], lpf: [600, 1500, 4000, 12000], text: 'el build de verdad: ruido y pad que se abren, la caja en roll y el último compás en silencio' },
  { name: 'DROP', turns: 8, parts: { bass: true, chords: true }, drums: { bd: T.bd4, sd: T.clap, hh: T.hats16 }, mel: { notes: DIES_A, synth: 'lead' }, text: 'el drop: todo, bajo y acordes, el tema limpio y el platillo en semicorcheas' },
  { name: 'Groove', turns: 4, parts: { bass: true, chords: false }, drums: { bd: T.bd4, sd: T.clap, hh: T.hat }, mel: { notes: DIES_B, synth: 'lead' }, lpf: [2200, 2600, 3000, 3400], wow: WOW_PRESETS.house, text: 'el groove en paralelo al tema (segunda vuelta), con bajo' },
  { name: 'Build 2', turns: 4, parts: { bass: true, chords: false }, drums: { sd: T.roll, hh: T.hats16 }, mel: { notes: DIES_A, synth: 'lead' }, lpf: [2000, 2600, 3400, 4600], wow: WOW_PRESETS.acid, text: 'el segundo build, más corto' },
  { name: 'Riser 2', turns: 2, parts: { bass: false, chords: false }, drums: { sd: RISER2_ROLL }, extra: [{ notes: RISER2_NOISE, synth: 'riser' }, { notes: RISER2_PAD, synth: 'pad' }], lpf: [3000, 12000], text: 'el build corto antes del drop final: un compás que se abre y otro en silencio' },
  { name: 'DROP 2', turns: 8, parts: { bass: true, chords: true }, drums: { bd: T.bd4, sd: T.clap, hh: T.hats16 }, mel: { notes: DIES_B, synth: 'lead' }, text: 'el drop final: todo, sin wowo (el tema, con otra frase)' },
  { name: 'Salida', turns: 2, parts: { bass: false, chords: true }, drums: {}, lpf: [1800, 600], text: 'solo los acordes, que se apagan' },
]

// ── Sinfonía n.º 40 de Mozart (K. 550, 1.er movimiento, 1788), en techno (spec 008, §12) ───────────────────────────
// El tema, escrito de oído por coderbeats (revisar las notas contra la partitura, que es de dominio público): sol menor,
// con la célula de tres notas «mi♭ re re» repetida y el salto de sexta. Aquí **bajado una quinta a do menor** (−7), la
// tonalidad del techno de la app (bajo en do y acordes Cm–A♭–B♭–Gm; el bombo afinado a esas raíces, `kickTune`). Un compás
// del tema = un compás de 16 pasos (negra = 4, corchea = 2). MIDI en sol menor: E♭5=75 D5=74 B♭5=82 A5=81 G5=79 F♯5=78.
const MOZART_G: { a: readonly Note[]; b: readonly Note[] } = {
  // A: la célula tres veces, el salto B♭5 y la bajada sobre sol (4 compases)
  a: [
    [0, 2, 75], [2, 2, 74], [4, 4, 74], [8, 2, 75], [10, 2, 74], [12, 4, 74], // mi♭ re re · mi♭ re re
    [16, 2, 75], [18, 2, 74], [20, 4, 74], [24, 4, 82], [28, 4, 81], // mi♭ re re · si♭ la (el salto)
    [32, 4, 79], [36, 2, 78], [38, 2, 79], [40, 4, 81], [44, 4, 82], // sol fa♯ sol la si♭
    [48, 4, 81], [52, 4, 79], [56, 4, 78], [60, 4, 79], // la sol fa♯ sol
  ],
  // B: la respuesta, con la misma célula y una bajada que cierra
  b: [
    [0, 2, 75], [2, 2, 74], [4, 4, 74], [8, 2, 75], [10, 2, 74], [12, 4, 74],
    [16, 2, 75], [18, 2, 74], [20, 4, 74], [24, 4, 79], [28, 4, 78],
    [32, 4, 75], [36, 4, 74], [40, 4, 72], [44, 4, 70],
    [48, 8, 69], [56, 8, 67],
  ],
}
const MOZART_SHIFT = -7 // sol menor → do menor
const MZ = { a: up(MOZART_G.a, MOZART_SHIFT), b: up(MOZART_G.b, MOZART_SHIFT) }
const MZ_UP = { a: up(MZ.a, 12), b: up(MZ.b, 12) }
/** el pad que sostiene la raíz de cada acorde (Cm A♭ B♭ Gm), un compás cada uno */
const MZ_ROOTS: readonly Note[] = [[0, 16, 60], [16, 16, 56], [32, 16, 58], [48, 16, 55]]
/** el platillo (ruido) en el primer compás del loop de 4: al entrar el drop y cada 4 compases */
const MZ_CRASH: readonly Note[] = [[0, 16, 60]]
/** la palmada en 2 y 4 durante 4 compases, con el **redoble** de semicorcheas al final del cuarto */
const MZ_CLAP_FILL = [T.clap, T.clap, T.clap, '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd sd sd sd'].join(' ')

/**
 * Doce células (126 compases ≈ 3 min 56 s a 128 bpm) y dos grupos en paralelo con el tema (que avanza entero: A, B, A, B…).
 * Un compás de 4 del loop se repite, así que el redoble y el platillo caen cada 4 compases (§12: aproximación del modelo).
 */
const MOZART_TECHNO: CellSpec[] = [
  { name: 'Intro', turns: 16, parts: { bass: false, chords: false }, drums: { bd: T.bd4 }, lpf: [200, 200, 200, 200, 260, 260, 260, 260, 900, 1400, 2200, 3500, 5000, 8000, 12000, 20000], text: 'solo el bombo afinado; el filtro se abre a partir del compás 9' },
  { name: 'Entra el tema', turns: 16, parts: { bass: true, chords: false }, drums: { bd: T.bd4, hh: T.hat }, mel: { notes: MZ.a, synth: 'lead' }, lpf: [500, 550, 620, 700, 800, 900, 1050, 1200, 1400, 1650, 1900, 2200, 2600, 3000, 3500, 4200], wow: WOW_PRESETS.acid, text: 'el tema con el wowo, que se abre poco a poco, sobre el bajo y el bombo' },
  { name: 'Groove', turns: 16, parts: { bass: true, chords: false }, drums: { bd: T.bd4, sd: MZ_CLAP_FILL, hh: T.hat }, text: 'palmada y platillo, con redoble cada 4 compases; entra el tema completo (A, B, A, B)' },
  { name: 'Break', turns: 8, parts: { bass: false, chords: true }, drums: {}, mel: { notes: MZ.a, synth: 'pad' }, lpf: [900, 1100, 1300, 1500, 1800, 2200, 2800, 3500], text: 'sin bombo: los acordes y el tema en pad, que se abre' },
  { name: 'Build', turns: 8, parts: { bass: true, chords: false }, drums: { sd: T.roll, hh: T.hats16 }, mel: { notes: MZ.b, synth: 'lead' }, lpf: [1400, 1800, 2400, 3000, 3800, 4800, 6200, 8000], wow: WOW_PRESETS.house, text: 'sin bombo: la caja en roll, el platillo en semicorcheas y el wowo abriéndose hasta 8 000 Hz' },
  { name: 'Riser', turns: 4, parts: { bass: false, chords: false }, drums: { sd: RISER_ROLL }, extra: [{ notes: RISER_NOISE, synth: 'riser' }, { notes: RISER_PAD, synth: 'pad' }], lpf: [600, 1500, 4000, 12000], text: 'ruido y pad que se abren, la caja en roll y el último compás en silencio' },
  { name: 'Drop 1', turns: 16, parts: { bass: true, chords: true }, drums: { bd: T.bd4, sd: MZ_CLAP_FILL, hh: T.hats16 }, extra: [{ notes: MZ_CRASH, synth: 'crash' }], text: 'el drop: todo, con el platillo al entrar; el tema una octava más alta (A↑, B↑)' },
  { name: 'Break corto', turns: 4, parts: { bass: false, chords: true }, drums: {}, mel: { notes: MZ.a, synth: 'pad' }, lpf: [1200, 1800, 2800, 4200], text: 'un respiro: los acordes y el tema en pad' },
  { name: 'Build 2', turns: 4, parts: { bass: true, chords: false }, drums: { sd: T.roll, hh: T.hats16 }, mel: { notes: MZ.b, synth: 'lead' }, lpf: [2000, 2600, 3400, 4600], wow: WOW_PRESETS.acid, text: 'el segundo build, más corto' },
  { name: 'Riser 2', turns: 2, parts: { bass: false, chords: false }, drums: { sd: RISER2_ROLL }, extra: [{ notes: RISER2_NOISE, synth: 'riser' }, { notes: RISER2_PAD, synth: 'pad' }], lpf: [3000, 12000], text: 'el build corto: un compás que se abre y otro en silencio' },
  { name: 'Drop 2', turns: 16, parts: { bass: true, chords: true }, drums: { bd: T.bd4, sd: MZ_CLAP_FILL, hh: T.hats16 }, extra: [{ notes: MZ_CRASH, synth: 'crash' }, { notes: MZ_ROOTS, synth: 'pad' }], text: 'el drop final, más fuerte: además un pad que sostiene la raíz de cada acorde; el tema una octava más alta' },
  { name: 'Salida', turns: 16, parts: { bass: false, chords: true }, drums: { hh: T.hat }, mel: { notes: MZ.a, synth: 'pad' }, lpf: [3200, 3000, 2800, 2500, 2200, 1900, 1600, 1400, 1200, 1000, 850, 700, 600, 500, 420, 350], text: 'los acordes y el tema en pad, que se apaga' },
]

/** El tema, en orden y sin repetirse, en grupos que se encienden con el Groove (plano) y con cada drop (una octava más alto). */
const MOZART_GROUPS: GroupSpec[] = [
  { on: 'Groove', off: 'Break', cells: [{ name: 'Tema A', turns: 4, mel: { notes: MZ.a, synth: 'lead' } }, { name: 'Tema B', turns: 4, mel: { notes: MZ.b, synth: 'lead' } }] },
  { on: ['Drop 1', 'Drop 2'], off: ['Break corto', 'Salida'], cells: [{ name: 'Tema A↑', turns: 4, mel: { notes: MZ_UP.a, synth: 'lead' } }, { name: 'Tema B↑', turns: 4, mel: { notes: MZ_UP.b, synth: 'lead' } }] },
]

// ── El Himno de la alegría en dembow, mejorado (spec 008, §13) ──────────────────────────────────────────────
/** el platillo del drop (ruido): en el primer compás del loop de 4, al entrar y cada 4 compases */
const ODE_CRASH: readonly Note[] = [[0, 16, 62]]
/** el pad que sostiene la raíz de cada acorde (Bm, G), un compás cada uno, para el drop final */
const ODE_ROOTS: readonly Note[] = [[0, 16, 59], [16, 16, 55], [32, 16, 59], [48, 16, 55]]

/**
 * Doce células, 56 compases (≈ 1 min 52 s a 120 bpm), dos drops y dos grupos en paralelo con el tema (A, A′ y, una octava más
 * aguda, A↑, A′↑). El puente B va en la propia célula de la subida, con el wowo.
 */
const ODE_DEMBOW: CellSpec[] = [
  { name: 'Intro', turns: 4, parts: { bass: false, chords: true }, drums: {}, lpf: [800, 900, 1000, 1200], text: 'solo los acordes, suaves' },
  { name: 'Despierta', turns: 4, parts: { bass: false, chords: true }, drums: { hh: P.hh8 }, mel: { notes: ODE_A, synth: 'pad' }, text: '+ platillo y la melodía, suave y lejana' },
  { name: 'Entra el ritmo', turns: 4, parts: { bass: false, chords: true }, drums: { hh: P.hh8, bd: P.bd }, mel: { notes: ODE_A, synth: 'pad' }, text: '+ bombo (afinado a la raíz de cada acorde)' },
  { name: 'Dembow', turns: 8, parts: { bass: true, chords: true }, drums: { hh: P.hh16, bd: P.bd, sd: P.sdFill }, text: '+ bajo y caja dembow, con redoble cada 4 compases; entra el Himno completo, claro (A, A′)' },
  { name: 'Subida', turns: 4, parts: { bass: true, chords: true }, drums: { hh: P.hh16, sd: P.sdRoll }, mel: { notes: ODE_B, synth: 'lead' }, lpf: [600, 1000, 2000, 6000], wow: WOW_PRESETS.house, text: 'sin bombo: la caja se acelera y el puente (B) con el wowo, que se abre' },
  { name: 'Riser', turns: 2, parts: { bass: false, chords: false }, drums: { sd: RISER2_ROLL }, extra: [{ notes: RISER2_NOISE, synth: 'riser' }, { notes: RISER2_PAD, synth: 'pad' }], lpf: [3000, 12000], text: 'ruido y pad que se abren y la caja; el último compás, en silencio' },
  { name: 'Subidón', turns: 8, parts: { bass: true, chords: true }, drums: { hh: P.hh16, bd: P.bd, sd: P.sdFill }, extra: [{ notes: ODE_CRASH, synth: 'crash' }], text: 'el drop: todo, con el platillo al entrar y el Himno una octava más aguda (A↑, A′↑)' },
  { name: 'Break', turns: 4, parts: { bass: false, chords: true }, drums: {}, mel: { notes: ODE_A, synth: 'pad' }, lpf: [1200, 1800, 2800, 4200], text: 'un respiro: los acordes y el Himno en pad' },
  { name: 'Subida 2', turns: 4, parts: { bass: true, chords: true }, drums: { hh: P.hh16, sd: P.sdRoll }, mel: { notes: up(ODE_B, 12), synth: 'lead' }, lpf: [1000, 2000, 4000, 8000], wow: WOW_PRESETS.acid, text: 'el segundo build: el puente una octava más aguda, con el wowo acid' },
  { name: 'Riser 2', turns: 2, parts: { bass: false, chords: false }, drums: { sd: RISER2_ROLL }, extra: [{ notes: RISER2_NOISE, synth: 'riser' }, { notes: RISER2_PAD, synth: 'pad' }], lpf: [3000, 12000], text: 'el build corto antes del drop final; el último compás, en silencio' },
  { name: 'Subidón 2', turns: 8, parts: { bass: true, chords: true }, drums: { hh: P.hh16, bd: P.bd, sd: P.sdFill }, extra: [{ notes: ODE_CRASH, synth: 'crash' }, { notes: ODE_ROOTS, synth: 'pad' }], text: 'el drop final, más fuerte: además un pad que sostiene la raíz de cada acorde' },
  { name: 'Final', turns: 4, parts: { bass: false, chords: true }, drums: {}, lpf: [1800, 1100, 650, 350], text: 'solo los acordes, que se apagan (el Himno se apaga)' },
]

/** El Himno, en orden y sin repetirse: claro con el Dembow (A, A′) y una octava más aguda en cada drop (A↑, A′↑). */
const ODE_GROUPS: GroupSpec[] = [
  { on: 'Dembow', off: 'Subida', cells: [{ name: 'Himno A', turns: 4, mel: { notes: ODE_A, synth: 'lead' } }, { name: 'Himno A2', turns: 4, mel: { notes: ODE_A2, synth: 'lead' } }] },
  { on: ['Subidón', 'Subidón 2'], off: ['Break', 'Final'], cells: [{ name: 'Himno A agudo', turns: 4, mel: { notes: up(ODE_A, 12), synth: 'lead' } }, { name: 'Himno A2 agudo', turns: 4, mel: { notes: up(ODE_A2, 12), synth: 'lead' } }] },
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
    build: () => buildSong(ODE_DEMBOW, ODE_GROUPS),
  },
  {
    id: 'dies-irae-techno',
    title: 'Dies Irae',
    composer: 'Anónimo (gregoriano, s. XIII)',
    years: 's. XIII',
    publicDomain: 'Melodía gregoriana anónima, del siglo XIII, de dominio público; el arreglo (ritmo, bajo, acordes, estructura) es de coderbeats.',
    style: 'techno',
    kit: 'electro',
    key: 'Do menor',
    info: { cells: DIES_TECHNO.map((s) => ({ name: s.name, turns: s.turns, text: s.text })) },
    build: () => buildSong(DIES_TECHNO),
  },
  {
    id: 'sinfonia-40-techno',
    title: 'Sinfonía n.º 40',
    composer: 'Wolfgang Amadeus Mozart',
    years: '1756–1791',
    publicDomain: 'Obra de dominio público (el autor murió en 1791); el arreglo (ritmo, bajo, acordes, estructura; el tema bajado de sol menor a do menor) es de coderbeats.',
    style: 'techno',
    kit: 'electro',
    key: 'Do menor',
    info: { cells: MOZART_TECHNO.map((s) => ({ name: s.name, turns: s.turns, text: s.text })) },
    build: () => buildSong(MOZART_TECHNO, MOZART_GROUPS),
  },
]

export const remixById = (id: string): Remix | undefined => REMIXES.find((r) => r.id === id)

/** Compases que dura un remix entero. */
export const remixBars = (r: Remix): number => r.info.cells.reduce((s, c) => s + c.turns, 0)

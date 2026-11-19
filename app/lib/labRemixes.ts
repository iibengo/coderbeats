/**
 * Remixes del Laboratorio (spec 019/020): la versión principal (≈ 1 min) de cada remix, simplificada, y cómo se actúa. **El remix es la canción**; sus partes
 * (como mucho 8, con como mucho 4 capas cada una, cada una suena bien en bucle sola) salen de ella (`remixParts.ts`). Las notas y los patrones son los
 * del Estudio (`remixes.ts`, que no se toca); aquí solo se eligen y se agrupan. Todo puro.
 */
import { MAX_CELLS, TURNS, songBars, type Cell, type Song, type Turns } from './cells'
import { STYLES } from './constants'
import type { FreeLoop } from './freeLoops'
import {
  DIES_A, DIES_B, MZ, MZ_CLAP_FILL, MZ_CRASH, MZ_ROOTS, MZ_UP, ODE_A, ODE_A2, ODE_B, ODE_CRASH, ODE_ROOTS, P, RISER2_NOISE, RISER2_PAD, RISER2_ROLL, RISER_NOISE, RISER_PAD, RISER_ROLL, T, WOW_HOOK, WOW_IMPACT, up,
  type Note,
} from './remixes'
import { DEMOS } from './demos'
import { PERC_MIDI } from './percSamples'
import { LAC, lacSlice } from './lacrimosa'
import type { MelodySynth } from './melody'
import { fast, shift, ELISA_A, ELISA_B, GRIEG_A, GRIEG_B, HABANERA_A, HABANERA_B, KOROBEINIKI_A, KOROBEINIKI_B } from './publicTunes'
import type { KitId, StyleId } from './types'
import { MAX_LAYERS, MAX_PARTS, partsFromSong, type LabLayer, type LabPart } from './remixParts'
export { MAX_LAYERS, MAX_PARTS }
export type { LabLayer, LabPart }

/** Un remix tal como se actúa: sus partes (como mucho 8) salen de **la canción** (`partsFromSong`), que es el único objeto del remix. */
export interface LabRemix {
  id: string
  title: string
  composer: string
  style: StyleId
  kit: KitId
  key: string
  song: Song
  parts: LabPart[]
  /** el tema está escrito de memoria o de oído: revisar con la partitura */
  unverified?: boolean
}

const L = {
  kick: (p: string): LabLayer => ({ key: 'bombo', label: 'bombo', drums: { bd: p } }),
  hat: (p: string): LabLayer => ({ key: 'hat', label: 'platillo', drums: { hh: p } }),
  bass: { key: 'bajo', label: 'bajo', bass: true } as LabLayer,
  chords: { key: 'acordes', label: 'acordes', chords: true } as LabLayer,
  theme: (notes: readonly Note[], synth: MelodySynth): LabLayer => ({ key: 'tema', label: 'tema', mel: [{ notes, synth }] }),
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
  /** el tema: en la intro (suave), en la subida, en el drop, en el segundo drop y en el final */
  intro: readonly Note[]
  sub: readonly Note[]
  drop: readonly Note[]
  drop2: readonly Note[]
  final: readonly Note[]
  /** lo que remata el drop: platillo, impacto, pad en la raíz */
  dropFx: { notes: readonly Note[]; synth: MelodySynth }[]
  /** otra estructura (por defecto, las 7 partes de arriba) */
  shape?: { name: PartKind; bars: number }[]
  /** el tema está escrito de memoria: falta contrastarlo con la partitura */
  unverified?: boolean
}

type PartKind = 'Intro' | 'Estrofa' | 'Subida' | 'Drop' | 'Break' | 'Drop 2' | 'Final'
/** Las partes de la canción principal (por defecto, 7: ≈ 1 min 10 s a 128 bpm), cada una con las capas que **suenan** (lo que lleva la canción). */
const SHAPE: { name: PartKind; bars: number }[] = [
  { name: 'Intro', bars: 4 },
  { name: 'Estrofa', bars: 4 },
  { name: 'Subida', bars: 4 },
  { name: 'Drop', bars: 8 },
  { name: 'Break', bars: 4 },
  { name: 'Drop 2', bars: 8 },
  { name: 'Final', bars: 4 },
]
function layersOf(r: Recipe, name: PartKind): LabLayer[] {
  const fx = (extra: { notes: readonly Note[]; synth: MelodySynth }[]): LabLayer => ({ key: 'ritmo', label: 'ritmo', drums: { bd: r.kick, sd: r.clap, hh: r.hats16 }, mel: extra })
  switch (name) {
    case 'Intro':
      return [L.kick(r.kick), L.theme(r.intro, 'pad')]
    case 'Estrofa':
      return [L.kick(r.kick), L.hat(r.hat), L.bass, L.theme(r.intro, 'lead')]
    // sin bombo: la caja que se acelera, el riser, el bajo y el tema
    case 'Subida':
      return [{ key: 'caja', label: 'caja', drums: { sd: r.roll, hh: r.hats16 } }, riser(r.noise, r.pad), L.bass, L.theme(r.sub, 'lead')]
    // con todo: el ritmo entero (con el platillo grande al entrar), el bajo, los acordes y el tema
    case 'Drop':
      return [fx(r.dropFx.slice(0, 1)), L.bass, L.chords, L.theme(r.drop, 'lead')]
    // sin bombo: un respiro con los acordes y el tema suave
    case 'Break':
    case 'Final':
      return [L.chords, L.theme(r.final, 'pad')]
    case 'Drop 2':
      return [fx(r.dropFx), L.bass, L.chords, L.theme(r.drop2, 'lead')]
  }
}
function recipeParts(r: Recipe): { name: string; bars: Turns; layers: LabLayer[] }[] {
  return (r.shape ?? SHAPE).map((p) => ({ name: p.name, bars: p.bars as Turns, layers: layersOf(r, p.name) }))
}

/** La canción de una receta: una célula por parte, con sus capas encendidas (es **el** remix; las partes del Laboratorio salen de ella). */
function songOf(r: Recipe): Song {
  return songFromParts(recipeParts(r))
}
/** La canción de unas partes ya escritas con sus capas (cada parte, una célula con sus capas encendidas). */
function songFromParts(parts: { name: string; bars: Turns; layers: LabLayer[] }[]): Song {
  const cells: Cell[] = []
  let loopId = 1
  parts.forEach((p, i) => {
    const on = new Set(p.layers.map((l) => l.key))
    const pl = partLoops({ name: p.name, layers: p.layers, start: [...on], bars: p.bars }, on, loopId, false)
    loopId = pl.nextId
    cells.push({ id: i + 1, name: p.name, loops: pl.loops, parts: partsOn({ name: p.name, layers: p.layers, start: [...on], bars: p.bars }, on), turns: p.bars, at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! } })
  })
  return { version: 1, cells, order: cells.map((c) => c.id), groups: [], nextGroupId: 1, bpm: null, nextCellId: cells.length + 1, nextLoopId: loopId }
}

function recipe(r: Recipe): LabRemix {
  const song = songOf(r)
  return { id: r.id, title: r.title, composer: r.composer, style: r.style, kit: r.kit, key: r.key, song, parts: partsFromSong(song), ...(r.unverified ? { unverified: true } : {}) }
}

/** deja las notas dentro del registro del sinte agudo (hasta MIDI 84) bajando una octava las que se pasan */
const inLead = (notes: readonly Note[]): Note[] => notes.map(([p, d, m]) => [p, d, m > 84 ? m - 12 : m] as const)

const TECHNO = { kick: T.bd4, clap: T.clap, hat: T.hat, hats16: T.hats16, roll: T.roll, noise: RISER_NOISE, pad: RISER_PAD }

// ── Lacrimosa (Mozart, Requiem) en drill (spec 048) ───────────────────────────────────────────────────
/** Un patrón de batería de 4 compases (64 símbolos) a partir de los pasos de cada compás. */
const drums4 = (name: 'bd' | 'sd', bars: readonly (readonly number[])[]): string => bars.flatMap((steps) => Array.from({ length: 16 }, (_, i) => (steps.includes(i) ? name : '~'))).join(' ')

/** Un golpe de charles: paso del compás, fuerza (0..1) y semitonos que sube el tono (0 si no se dice). */
type HatHit = readonly [step: number, strength: number, pitch?: number]
/**
 * El charles del drill como en el tema de referencia (medido sobre su audio, dos drops de 12 s): **~6 golpes por compás**, en la rejilla de semicorcheas, con **grupos 3-2-3** (intervalos de 3 y 2 semicorcheas, algún par pegado)
 * y huecos largos, y una **fuerza muy variable** (de 0,2 a 1). Aquí, 4 compases: el mismo esqueleto (2 5 7 · 10 13 15) con un golpe de más que cambia cada compás, una ráfaga de tresillos con el tono subiendo al final del 2
 * y un redoble de 6 al final del 4 que crece. Es el sinte `hat` (el charles del 808, fino y cortado al instante).
 */
const HAT_BARS: readonly (readonly HatHit[])[] = [
  [[2, 0.8], [3, 0.55], [5, 0.85], [7, 0.45], [10, 0.8], [13, 0.7], [15, 0.5]],
  [[0, 0.6], [2, 0.75], [5, 0.8], [7, 0.4], [10, 0.85], [13, 0.7], [14, 0.5], [14 + 2 / 3, 0.6, 1], [15 + 1 / 3, 0.8, 2]],
  [[0, 0.5], [2, 0.85], [3, 0.5], [5, 0.8], [7, 0.5], [10, 0.75], [13, 0.7], [15, 0.45]],
  [[2, 0.8], [5, 0.85], [7, 0.5], [10, 0.8], [12, 0.4], [12 + 2 / 3, 0.5, 1], [13 + 1 / 3, 0.6, 2], [14, 0.7, 3], [14 + 2 / 3, 0.85, 4], [15 + 1 / 3, 1, 5]],
]
const hatHits = HAT_BARS.flatMap((bar, b) => bar.map(([step, strength, pitch]) => ({ note: [b * 16 + step, Number.isInteger(step) ? 1 : 2 / 3, PERC_MIDI + (pitch ?? 0)] as const, strength })))

/**
 * La batería drill de los vídeos (spec 048), en 4 compases: **bombo desplazado**, **caja solo en el tiempo 3** con un redoble al final del compás 4 y el **charles** `hat` de arriba.
 */
export const DRILL = {
  bd: drums4('bd', [[0, 10], [0, 7, 11], [0, 10], [0, 7, 9, 14]]),
  sd: drums4('sd', [[8], [8], [8, 15], [8, 12, 13, 14, 15]]),
  /** el charles: las notas (en pasos del loop de 4 compases) y la fuerza de cada una */
  hat: { notes: hatHits.map((h) => h.note) as readonly Note[], strengths: hatHits.map((h) => h.strength) as readonly number[] },
} as const

/**
 * El Lacrimosa en drill, **armado como un tema de techno minimal** (spec 048) y medido sobre un tema de referencia de YouTube (2:26, ~145 bpm, **si menor**, cuerdas muy bajitas al principio,
 * drops largos y un respiro de silencio antes del último): no se toca la melodía entera de seguido, sino que se juega con cuatro trozos de la obra (cada uno, 2 compases de 12/8 = 4 de 4/4 a medio tiempo,
 * un loop de 4 compases que **se repite** dentro de cada parte), cada uno **con su bajo y sus acordes** (la armonía siempre es la de Mozart):
 * - el **gancho** (compases 1–2): el «suspiro» de los violines, que abre y cierra, **suave**;
 * - **el tema** (3–4): «La-cry-mo-sa di-es il-la», **cantado por un coro de fondo**; vuelve en cada drop (16 compases cada uno), sobre las cuerdas (violines y viola);
 * - **la escalera** (5–6): el soprano sube re–mi–fa–sol–la–si–do–re: el respiro del break;
 * - **la subida** (7–8): el soprano sube cromático hasta la5: la melodía **cambia antes del drop**.
 * Todo **tres semitonos más grave que Mozart** (re menor → si menor) y a **145 bpm**. La batería drill entra por capas (charles, caja que se acelera, y luego todo) y se va en el break y en el puente (solo el gancho,
 * suave: el silencio de antes del último drop). Cuerdas con ataque firme y grano (`cuerdas`), coro de fondo `coro`, bajo `sub` (808 que se desliza en saltos cortos). Fondo del estilo apagado. 72 compases ≈ 2 min. Sin oír.
 */
function lacrimosaDrill(): LabRemix {
  const HOOK = 0
  const TUNE = 2
  const STAIRS = 4
  const CLIMB = 6
  const SOFT = 0 // la fuerza más baja (el 0,55 del volumen): las cuerdas de la intro, el puente y el final
  const bar = (from: number, notes: readonly Note[]): Note[] => lacSlice(shift(notes, LAC_SHIFT), from, from + 2)
  // el gancho lo tocan las cuerdas (el violín I); el resto del tema lo **canta el coro de fondo** (el soprano, sinte `coro`), envuelto en reverb
  const tema = (from: number, strength?: number): LabLayer => ({ key: 'tema', label: 'tema', mel: [{ notes: bar(from, from === HOOK ? LAC.vln1 : LAC.soprano), synth: from === HOOK ? 'cuerdas' : 'coro', ...(strength !== undefined ? { strength } : {}) }] })
  const acordes = (from: number, strength?: number): LabLayer => ({
    key: 'acordes',
    label: 'acordes',
    mel: [{ notes: [...bar(from, LAC.vln2), ...bar(from, LAC.viola), ...(from > HOOK ? bar(from, LAC.vln1) : [])], synth: 'cuerdas', ...(strength !== undefined ? { strength } : {}) }],
  })
  const bajo = (from: number): LabLayer => ({ key: 'bajo', label: 'bajo', mel: [{ notes: bar(from, LAC.bajo), synth: 'sub' }] })
  const charles = { notes: DRILL.hat.notes, strengths: DRILL.hat.strengths, synth: 'hat' as const }
  const ritmo: LabLayer = { key: 'ritmo', label: 'ritmo', drums: { bd: DRILL.bd, sd: DRILL.sd }, mel: [charles] }
  const caja: LabLayer = { key: 'caja', label: 'caja', drums: { sd: P.sdRoll }, mel: [charles] }
  const hat: LabLayer = { key: 'hat', label: 'platillo', mel: [charles] }
  const parts: { name: string; bars: Turns; layers: LabLayer[] }[] = [
    { name: 'Intro', bars: 8, layers: [acordes(HOOK, SOFT), tema(HOOK, SOFT)] },
    { name: 'Estrofa', bars: 8, layers: [hat, bajo(TUNE), acordes(TUNE), tema(TUNE)] },
    { name: 'Subida', bars: 4, layers: [caja, bajo(CLIMB), acordes(CLIMB), tema(CLIMB)] },
    { name: 'Drop', bars: 16, layers: [ritmo, bajo(TUNE), acordes(TUNE), tema(TUNE)] },
    { name: 'Break', bars: 8, layers: [acordes(STAIRS), tema(STAIRS)] },
    { name: 'Puente', bars: 4, layers: [tema(HOOK, SOFT)] },
    { name: 'Drop 2', bars: 16, layers: [ritmo, bajo(TUNE), acordes(TUNE), tema(TUNE)] },
    { name: 'Final', bars: 8, layers: [acordes(HOOK, SOFT), tema(HOOK, SOFT)] },
  ]
  const song = { ...songFromParts(parts), bpm: LAC_BPM }
  return { id: 'lacrimosa-drill', title: 'Lacrimosa (Requiem)', composer: 'Mozart', style: 'drill', kit: '808', key: 'Si menor', song, parts: partsFromSong(song) }
}
/** el Lacrimosa del remix, tres semitonos más grave que el original (re menor → si menor) y el tempo del tema de referencia */
const LAC_SHIFT = -3
const LAC_BPM = 145

export const LAB_REMIXES: readonly LabRemix[] = [
  recipe({
    id: 'oda-alegria-dembow', title: 'Himno de la alegría', composer: 'Beethoven', style: 'dembow', kit: '808', key: 'Re mayor',
    kick: P.bd, clap: P.sdFill, hat: P.hh8, hats16: P.hh16, roll: P.sdRoll, noise: RISER2_NOISE, pad: RISER2_PAD,
    intro: ODE_A, sub: ODE_B, drop: up(ODE_A, 12), drop2: up(ODE_A2, 12), final: ODE_A2,
    dropFx: [{ notes: ODE_CRASH, synth: 'crash' }, { notes: ODE_ROOTS, synth: 'pad' }],
  }),
  recipe({
    id: 'dies-irae-techno', title: 'Dies Irae', composer: 'gregoriano, s. XIII', style: 'techno', kit: 'electro', key: 'Do menor', ...TECHNO,
    intro: DIES_A, sub: DIES_B, drop: DIES_A, drop2: DIES_B, final: DIES_B,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }],
  }),
  recipe({
    id: 'wow-techno', title: 'Wow', composer: 'coderbeats', style: 'techno', kit: 'electro', key: 'Do menor', ...TECHNO, clap: MZ_CLAP_FILL,
    intro: WOW_HOOK, sub: WOW_HOOK, drop: WOW_HOOK, drop2: up(WOW_HOOK, 12), final: WOW_HOOK,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }, { notes: WOW_IMPACT, synth: 'boom' }],
  }),
  recipe({
    // OJO: las notas del tema de Mozart están «de oído» y falta contrastarlas con la partitura (ver spec 019, §6)
    id: 'sinfonia-40-techno', title: 'Sinfonía n.º 40', composer: 'Mozart', style: 'techno', kit: 'electro', key: 'Do menor', ...TECHNO, clap: MZ_CLAP_FILL, unverified: true,
    intro: MZ.a, sub: MZ.b, drop: MZ_UP.a, drop2: MZ_UP.b, final: MZ.b,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }, { notes: MZ_ROOTS, synth: 'pad' }],
  }),
  // los dos estilos nuevos (spec 023) también tienen su remix principal: la demo de cada estilo es su remix
  recipe({
    id: 'himno-house', title: 'Himno de la alegría', composer: 'Beethoven', style: 'house2', kit: '808', key: 'Do mayor',
    kick: T.bd4, clap: T.clap, hat: T.hat, hats16: T.hats16, roll: T.roll, noise: RISER_NOISE, pad: RISER_PAD,
    intro: up(ODE_A, -2), sub: up(ODE_B, -2), drop: up(ODE_A, 10), drop2: up(ODE_A2, 10), final: up(ODE_A2, -2),
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }],
  }),
  recipe({
    id: 'wow-techno-2', title: 'Wow', composer: 'coderbeats', style: 'techno2', kit: 'electro', key: 'Do menor',
    kick: T.bd4, clap: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hat: '~ ~ hh ~ ~ hh hh ~ ~ ~ hh ~ ~ hh hh ~', hats16: T.hats16, roll: T.roll, noise: RISER_NOISE, pad: RISER_PAD,
    intro: WOW_HOOK, sub: WOW_HOOK, drop: WOW_HOOK, drop2: up(WOW_HOOK, 12), final: WOW_HOOK,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }, { notes: WOW_IMPACT, synth: 'boom' }],
  }),
  // Korobeiniki (canción popular rusa, dominio público) en techno; el tema está escrito de memoria
  recipe({
    id: 'korobeiniki-techno', title: 'Korobeiniki', composer: 'popular rusa', style: 'techno2', kit: 'electro', key: 'Do menor',
    kick: T.bd4, clap: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~', hat: DEMOS.techno2.hh, hats16: T.hats16, roll: T.roll, noise: RISER_NOISE, pad: RISER_PAD,
    intro: shift(KOROBEINIKI_A, 3), sub: shift(KOROBEINIKI_B, 3), drop: shift(KOROBEINIKI_A, 3), drop2: shift(KOROBEINIKI_B, 3), final: shift(KOROBEINIKI_A, 3),
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }], unverified: true,
  }),
  // En la gruta del rey de la montaña (Grieg, dominio público) en dnb, **acelerando**: el tema se dobla (corcheas → semicorcheas) a medida que sube la energía; de memoria
  recipe({
    id: 'gruta-dnb', title: 'En la gruta del rey de la montaña', composer: 'Grieg', style: 'dnb', kit: 'electro', key: 'Re menor',
    kick: DEMOS.dnb.bd, clap: DEMOS.dnb.sd, hat: P.hh8, hats16: DEMOS.dnb.hh, roll: T.roll, noise: RISER_NOISE, pad: RISER_PAD,
    intro: inLead(shift(GRIEG_A, 3)), sub: inLead(fast(shift(GRIEG_A, 3), 2)), drop: inLead(fast(shift(GRIEG_B, 3), 2)), drop2: inLead(fast(shift(GRIEG_A, 3), 4)), final: inLead(shift(GRIEG_B, 3)),
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }], unverified: true,
  }),
  // Para Elisa (Beethoven, dominio público) en hip hop: el tema en corcheas sobre un ritmo de 90 bpm; 24 compases ≈ 1 min; de memoria
  recipe({
    id: 'para-elisa-hiphop', title: 'Para Elisa', composer: 'Beethoven', style: 'hiphop90', kit: '808', key: 'La menor',
    kick: DEMOS.hiphop90.bd, clap: DEMOS.hiphop90.sd, hat: P.hh8, hats16: P.hh8, roll: P.sdRoll, noise: RISER_NOISE, pad: RISER_PAD,
    intro: ELISA_A, sub: ELISA_B, drop: ELISA_A, drop2: ELISA_B, final: ELISA_B,
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }], unverified: true,
    shape: [{ name: 'Intro', bars: 4 }, { name: 'Estrofa', bars: 4 }, { name: 'Subida', bars: 4 }, { name: 'Drop', bars: 8 }, { name: 'Final', bars: 4 }],
  }),
  // Habanera de Carmen (Bizet, dominio público) en dembow: el descenso cromático, de Re menor a Si menor (el del estilo); de memoria
  recipe({
    id: 'habanera-dembow', title: 'Habanera (Carmen)', composer: 'Bizet', style: 'dembow', kit: '808', key: 'Si menor',
    kick: P.bd, clap: P.sdFill, hat: P.hh8, hats16: P.hh16, roll: P.sdRoll, noise: RISER2_NOISE, pad: RISER2_PAD,
    intro: shift(HABANERA_A, 9), sub: shift(HABANERA_B, 9), drop: shift(HABANERA_A, 9), drop2: shift(HABANERA_B, 9), final: shift(HABANERA_B, 9),
    dropFx: [{ notes: ODE_CRASH, synth: 'crash' }], unverified: true,
  }),
  // Habanera de Carmen (Bizet, dominio público) en reggaetón a 95 bpm: la habanera y el dembow comparten el ritmo de tresillo; de Re menor a Sol menor (el del estilo); de memoria
  // 32 compases ≈ 1 min 21 s: Intro 4 · Estrofa 4 · Subida 4 · Drop 8 · Break 4 · Drop 2 4 · Final 4
  recipe({
    id: 'habanera-reggaeton', title: 'Habanera (Carmen)', composer: 'Bizet', style: 'reggaeton', kit: '808', key: 'Sol menor',
    kick: DEMOS.reggaeton.bd, clap: DEMOS.reggaeton.sd, hat: DEMOS.reggaeton.hh, hats16: P.hh8, roll: P.sdRoll, noise: RISER_NOISE, pad: RISER_PAD,
    intro: shift(HABANERA_A, 5), sub: shift(HABANERA_B, 5), drop: shift(HABANERA_A, 5), drop2: shift(HABANERA_B, 5), final: shift(HABANERA_B, 5),
    dropFx: [{ notes: MZ_CRASH, synth: 'crash' }], unverified: true,
    shape: [{ name: 'Intro', bars: 4 }, { name: 'Estrofa', bars: 4 }, { name: 'Subida', bars: 4 }, { name: 'Drop', bars: 8 }, { name: 'Break', bars: 4 }, { name: 'Drop 2', bars: 4 }, { name: 'Final', bars: 4 }],
  }),
  lacrimosaDrill(),
]
export const labRemixById = (id: string): LabRemix | undefined => LAB_REMIXES.find((r) => r.id === id)

// ── duraciones ─────────────────────────────────────────────────────────────────────────────────────
/** El tempo del remix: **el de la canción si lo tiene** (un remix o una canción guardada con tempo propio) y, si no, el del estilo. */
export const remixBpm = (r: Pick<LabRemix, 'style' | 'song'>): number => r.song.bpm ?? STYLES[r.style].bpm
/** Lo que dura un compás (s): con `bpm` el de la canción; sin él, el del estilo. */
export const barSeconds = (style: StyleId, bpm?: number | null): number => (60 / (bpm ?? STYLES[style].bpm)) * 4
/** Lo que dura el remix principal: la suma de sus partes (≈ 1 min 10 s con las 7 de las recetas; entre 45 y 120 s). */
export const remixBars = (r: LabRemix): number => r.parts.reduce((n, p) => n + p.bars, 0)
export const remixSeconds = (r: LabRemix): number => remixBars(r) * barSeconds(r.style, r.song.bpm)

/** Lo que dura como mucho lo grabado (2 min) y cuánto antes entra el final (≈ 8 s), en compases enteros. */
export const MAX_TAKE_SECONDS = 120
export const FINAL_SECONDS = 8
export function takePlan(style: StyleId, bpm?: number | null): { maxBars: number; finalBars: number; finalStart: number } {
  const bs = barSeconds(style, bpm)
  const maxBars = Math.floor(MAX_TAKE_SECONDS / bs)
  const finalBars = Math.max(2, Math.round(FINAL_SECONDS / bs))
  return { maxBars, finalBars, finalStart: maxBars - finalBars }
}
/** La parte con la que se acaba (la última de la canción). */
export const finalPartOf = (r: LabRemix): LabPart => r.parts[r.parts.length - 1]!

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
    for (const m of l.mel ?? []) add({ instrument: 'mel', bars: 4, hits: m.notes.map(([pos, dur, midi], i) => ({ pos, dur, midi, strength: m.strengths?.[i] ?? m.strength ?? 0.8 })), ...(m.synth ? { synth: m.synth } : {}) })
  }
  return { loops, ids, nextId: id }
}
export function partsOn(part: LabPart, on: ReadonlySet<string>): { bass: boolean; chords: boolean } {
  return { bass: part.layers.some((l) => l.bass && on.has(l.key)), chords: part.layers.some((l) => l.chords && on.has(l.key)) }
}

// ── canciones: el remix a su ritmo y lo que yo actúo ───────────────────────────────────────────────
/** un compás de lo actuado: en qué parte estaba (por nombre) y qué capas sonaban */
export interface TakeBar {
  part: string
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
  part: string
  on: string[]
  bars: number
}
const sig = (b: { part: string; on: string[] }): string => `${b.part}|${[...b.on].sort().join(',')}`

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

/** La canción de una actuación: una célula por tramo (partida en vueltas válidas si hace falta), con solo las capas que sonaban. Las partes que ya no existen se ignoran. `null` si no hay compases. */
export function songFromTake(remix: LabRemix, take: readonly TakeBar[]): Song | null {
  const known = take.filter((b) => remix.parts.some((p) => p.name === b.part))
  if (!known.length) return null
  const cells: Cell[] = []
  let loopId = 1
  let cellId = 1
  for (const run of runsOfTake(known)) {
    const part = remix.parts.find((p) => p.name === run.part)!
    const on = new Set(run.on)
    for (const turns of turnChunks(run.bars)) {
      const pl = partLoops(part, on, loopId, false)
      loopId = pl.nextId
      const i = cells.length
      cells.push({ id: cellId++, name: run.part, loops: pl.loops, parts: partsOn(part, on), turns, at: { x: i * 3, y: Math.sin(i * 1.3) * 1.2, depth: [0, 0.4, 0.1, 0.6][i % 4]! } })
    }
  }
  return { version: 1, cells, order: cells.map((c) => c.id), groups: [], nextGroupId: 1, bpm: remix.song.bpm ?? null, nextCellId: cellId, nextLoopId: loopId }
}

/** El remix «original» del Laboratorio: las partes, cada una con sus capas de salida y su duración. */
export function remixTake(remix: LabRemix): TakeBar[] {
  return remix.parts.flatMap((p) => Array.from({ length: p.bars }, () => ({ part: p.name, on: [...p.start] })))
}
export { songBars }

/** Un remix guardado desde el Estudio (con la marca `lab`) como remix «mío» del Laboratorio: las mismas partes que tiene la canción (`partsFromSong`). `null` si no vale. */
export function labRemixFromSaved(saved: { id: string; name: string; style: StyleId; kit: KitId; song: Song; lab?: { remixId: string } }): LabRemix | null {
  const base = saved.lab ? labRemixById(saved.lab.remixId) : undefined
  const parts = partsFromSong(saved.song)
  if (!parts.length) return null
  return { id: `mio:${saved.id}`, title: saved.name, composer: base?.composer ?? 'mío', style: saved.style, kit: saved.kit, key: base?.key ?? '', song: saved.song, parts }
}

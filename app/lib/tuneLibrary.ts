/**
 * La biblioteca de melodías del sintetizador guiado (spec 015 §13): temas de **dominio público** (4 compases = 64 pasos; negra = 4) y su **adaptación al estilo**:
 * se transporta la tónica del tema a la del estilo (todos los estilos son menores), se coloca en el registro del sinte y cada nota se lleva a la nota más
 * cercana **de la escala del estilo** (las que el sintetizador toca de verdad). Pura y determinista.
 */
import { DIES_PHRASES, MOZART_G, ODE_A } from './remixes'
import { fitRegister } from './melodyAssist'
import { MIDI_MAX, MIDI_MIN, type MelodyHit, type MelodySynth } from './melody'
import { STYLE_MUSIC } from './styles'
import type { StyleId } from './types'
import { scaleNotes } from './waterKeys'

type Note = readonly [pos: number, dur: number, midi: number]

export interface Tune {
  id: string
  name: string
  /** los estilos a los que pega (tempo y carácter): solo se ofrece en ellos; en el resto no se ofrece (spec 016 §16) */
  styles: readonly StyleId[]
  /** clase de altura (0 = do) de la tónica del tema en la tonalidad en que está escrito */
  tonic: number
  notes: readonly Note[]
}

/** negra = 4 pasos; `q(i)` = la i-ésima negra */
const seq = (items: readonly [number, number][], first: number, dur = 4): Note[] => items.map(([at, semi]) => [at, dur, first + semi] as const)

export const TUNES: readonly Tune[] = [
  { id: 'oda', name: 'Himno de la alegría', styles: ['dembow', 'house', 'hiphop90'], tonic: 2, notes: ODE_A },
  { id: 'mozart', name: 'Sinfonía n.º 40', styles: ['techno'], tonic: 7, notes: MOZART_G.a },
  {
    id: 'jacques',
    name: 'Fray Santiago',
    styles: ['hiphop90', 'dembow', 'house'],
    tonic: 0,
    // do re mi do | do re mi do | mi fa sol | mi fa sol | sol la sol fa mi do | sol la sol fa mi do | do sol do | do sol do
    notes: [
      [0, 4, 60], [4, 4, 62], [8, 4, 64], [12, 4, 60], [16, 4, 60], [20, 4, 62], [24, 4, 64], [28, 4, 60],
      [32, 4, 64], [36, 4, 65], [40, 8, 67], [48, 4, 64], [52, 4, 65], [56, 8, 67],
    ],
  },
  {
    id: 'estrellita',
    name: 'Estrellita, ¿dónde estás?',
    styles: ['hiphop90', 'dembow', 'house'],
    tonic: 0,
    // do do sol sol la la sol(2) | fa fa mi mi re re do(2)
    notes: [...seq([[0, 0], [4, 0], [8, 7], [12, 7], [16, 9], [20, 9]], 60), [24, 8, 67], ...seq([[32, 5], [36, 5], [40, 4], [44, 4], [48, 2], [52, 2]], 60), [56, 8, 60]],
  },
  {
    id: 'elisa',
    name: 'Para Elisa',
    styles: ['hiphop90', 'house'],
    tonic: 9,
    // mi re# mi re# mi si re do la | do mi la si | mi sol# si do
    notes: [
      [0, 2, 76], [2, 2, 75], [4, 2, 76], [6, 2, 75], [8, 2, 76], [10, 2, 71], [12, 2, 74], [14, 2, 72], [16, 6, 69],
      [24, 2, 60], [26, 2, 64], [28, 2, 69], [30, 6, 71],
      [40, 2, 64], [42, 2, 68], [44, 2, 71], [46, 6, 72],
    ],
  },
  // las dos frases una tras otra (la segunda, desde el compás 3)
  { id: 'dies', name: 'Dies irae', styles: ['techno', 'dnb'], tonic: 0, notes: [...DIES_PHRASES[0]!, ...DIES_PHRASES[1]!.map(([p, d, m]) => [p + 32, d, m] as const)] },
]

/** Las melodías que pegan con el estilo (a su tempo y carácter); si ninguna, no se ofrece melodía. */
export const tunesFor = (style: StyleId): Tune[] => TUNES.filter((t) => t.styles.includes(style))

export const tuneById = (id: string): Tune | undefined => TUNES.find((t) => t.id === id)

const mod = (a: number, n: number) => ((a % n) + n) % n

/** La nota de `list` (ordenada) más cercana a `midi`; en un empate, la más grave. */
const nearest = (midi: number, list: readonly number[]): number => list.reduce((best, n) => (Math.abs(n - midi) < Math.abs(best - midi) ? n : best), list[0]!)

/**
 * El tema adaptado al estilo: mismas posiciones y duraciones, notas **de la escala del estilo y dentro del registro** del sinte. Las notas seguidas que acaban en
 * la misma nota se mantienen (no se pierde el dibujo del tema), y una nota nunca pisa a la siguiente.
 */
export function adaptTune(tune: Tune, style: StyleId, synth: MelodySynth = STYLE_MUSIC[style].synth): MelodyHit[] {
  const list = scaleNotes(style, synth)
  if (!list.length || !tune.notes.length) return []
  const tonic = STYLE_MUSIC[style].scale[0]!
  const shift = mod(tonic - tune.tonic + 6, 12) - 6 // el giro más corto a la tónica del estilo
  const moved = tune.notes.map(([, , m]) => m + shift)
  const [lo, hi] = [list[0]!, list[list.length - 1]!]
  const placed = fitRegister(moved, [lo, hi])
  const sorted = [...tune.notes].map((n, i) => ({ n, midi: placed[i]! })).sort((a, b) => a.n[0] - b.n[0])
  return sorted.map(({ n, midi }, i) => {
    const next = sorted[i + 1]?.n[0]
    const dur = Math.max(1, Math.min(n[1], next !== undefined ? next - n[0] : n[1]))
    return { pos: n[0], dur, midi: Math.min(MIDI_MAX, Math.max(MIDI_MIN, nearest(midi, list))), strength: 0.8 }
  })
}

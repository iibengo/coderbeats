import type { BassPattern } from './bass'
import type { Instrument, StyleId } from './types'
import type { MelodySynth } from './melody'

/** 16 pesos (0..1) por paso: cuánto "atrae" cada paso a un golpe de ese instrumento. */
export type Prior = number[]

export interface StyleMusic {
  key: string
  priors: Record<Instrument, Prior>
  /** patrón típico (16 tokens) cuando la frase tiene un solo golpe de ese instrumento */
  templates: Record<Instrument, string>
  /**
   * Fondo musical. El bajo, como datos (spec 003, E1.3; `bassCode` genera su línea). Los acordes,
   * líneas Strudel literales (sin coma final ni orbit). El generador añade `.orbit(2)` al bajo y
   * `.orbit(3)` a los acordes; lo que va en `chords` entra y sale con ellos.
   */
  background: { bass: BassPattern; chords: string[] }
  /**
   * Afinación del bombo por compás (spec 008, §10): un patrón de notas de Strudel, una por acorde del fondo (la raíz), que se
   * pone al bombo con `.note(...)` (superdough repite el sample a esa altura, `c3` = sin cambio). Sin él, el bombo suena como siempre.
   */
  kickTune?: string
  /** escala del estilo (spec 002, §5): clases de altura (0 = do … 11 = si) */
  scale: readonly number[]
  /** notas del acorde de cada compás del fondo (clases de altura; se repite): desempata la escala */
  chordTones: readonly (readonly number[])[]
  /** sinte por defecto de la melodía (spec 002, §6) */
  synth: MelodySynth
}

/** Construye un prior: `base` en todos los pasos y los pesos indicados en algunos. */
function prior(base: number, weights: Record<number, number>): Prior {
  return Array.from({ length: 16 }, (_, i) => weights[i] ?? base)
}

const eighths = (w: number) => Object.fromEntries([0, 2, 4, 6, 8, 10, 12, 14].map((s) => [s, w]))

const BACKBEAT = '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~'
const HH_EIGHTHS = 'hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~'

export const STYLE_MUSIC: Record<StyleId, StyleMusic> = {
  hiphop90: {
    key: 'la menor',
    priors: {
      bd: prior(0.25, { 0: 1, 8: 0.6, 10: 0.6, 2: 0.4, 14: 0.4 }),
      sd: prior(0.1, { 4: 1, 12: 1 }),
      hh: prior(0.3, eighths(1)),
    },
    templates: { bd: 'bd ~ ~ ~ ~ ~ ~ ~ bd ~ bd ~ ~ ~ ~ ~', sd: BACKBEAT, hh: HH_EIGHTHS },
    background: {
      // note("<a1 d2>")
      bass: {
        bars: 2,
        notes: [
          { pos: 0, dur: 16, note: 'a1' },
          { pos: 16, dur: 16, note: 'd2' },
        ],
        sound: '.s("triangle").lpf(600).gain(0.7)',
      },
      chords: ['note("<[a3,c4,e4,g4] [d3,f3,a3,c4]>").s("triangle").lpf(2000).room(0.4).gain(0.22)'],
    },
    // la menor: A B C D E F G
    scale: [9, 11, 0, 2, 4, 5, 7],
    chordTones: [
      [9, 0, 4, 7],
      [2, 5, 9, 0],
    ],
    synth: 'piano',
  },
  house: {
    key: 'fa menor',
    priors: {
      bd: prior(0.04, { 0: 1, 4: 1, 8: 1, 12: 1 }),
      sd: prior(0.1, { 4: 1, 12: 1 }),
      hh: prior(0.2, { 2: 1, 6: 1, 10: 1, 14: 1 }),
    },
    templates: {
      bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
      sd: BACKBEAT,
      hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
    },
    background: {
      // note("<[~ f1 ~ f1] [~ bb0 ~ bb0]>")
      bass: {
        bars: 2,
        notes: [
          { pos: 4, dur: 4, note: 'f1' },
          { pos: 12, dur: 4, note: 'f1' },
          { pos: 20, dur: 4, note: 'bb0' },
          { pos: 28, dur: 4, note: 'bb0' },
        ],
        sound: '.s("sawtooth").lpf(500).lpenv(2).decay(0.15).sustain(0).gain(0.6)',
      },
      chords: [
        'note("<[f3,ab3,c4,eb4] [bb2,db3,f3,ab3]>").struct("~ x ~ x").s("supersaw").decay(0.2).sustain(0).room(0.3).gain(0.22)',
      ],
    },
    // fa menor: F G Ab Bb C Db Eb
    scale: [5, 7, 8, 10, 0, 1, 3],
    chordTones: [
      [5, 8, 0, 3],
      [10, 1, 5, 8],
    ],
    synth: 'lead',
  },
  dnb: {
    key: 're menor',
    priors: {
      bd: prior(0.2, { 0: 1, 10: 0.8 }),
      sd: prior(0.04, { 4: 1, 12: 1 }),
      hh: prior(0.3, eighths(1)),
    },
    templates: { bd: 'bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~', sd: BACKBEAT, hh: HH_EIGHTHS },
    background: {
      // el fondo de tu primer reel (§16.15): líneas literales
      // note("<d1 d1 f1 c1>")
      bass: {
        bars: 4,
        notes: [
          { pos: 0, dur: 16, note: 'd1' },
          { pos: 16, dur: 16, note: 'd1' },
          { pos: 32, dur: 16, note: 'f1' },
          { pos: 48, dur: 16, note: 'c1' },
        ],
        sound: '.s("sawtooth").lpf(400).distort(0.3)',
      },
      chords: [
        'note("<[d3,f3,a3] [d3,f3,a3] [f3,a3,c4] [c3,e3,g3]>").s("triangle").room(0.6).gain(0.3)',
        's("[~ oh]*4").gain(0.25)',
      ],
    },
    // re menor: D E F G A Bb C
    scale: [2, 4, 5, 7, 9, 10, 0],
    chordTones: [
      [2, 5, 9],
      [2, 5, 9],
      [5, 9, 0],
      [0, 4, 7],
    ],
    synth: 'pad',
  },
  // dembow (2026-11-14): 120 bpm, si menor, kit 808. Bombo a negras, caja en 3 6 11 14 (el "dembow"), platillo en semicorcheas.
  dembow: {
    key: 'si menor',
    priors: {
      bd: prior(0.03, { 0: 1, 4: 1, 8: 1, 12: 1 }),
      sd: prior(0.04, { 3: 1, 6: 1, 11: 1, 14: 1 }),
      hh: prior(1, {}),
    },
    templates: {
      bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
      sd: '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~',
      hh: 'hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh',
    },
    background: {
      // note("<b1 g1>").struct("x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~"): cuatro notas de un paso por compás
      bass: {
        bars: 2,
        notes: [
          { pos: 0, dur: 1, note: 'b1' },
          { pos: 4, dur: 1, note: 'b1' },
          { pos: 8, dur: 1, note: 'b1' },
          { pos: 12, dur: 1, note: 'b1' },
          { pos: 16, dur: 1, note: 'g1' },
          { pos: 20, dur: 1, note: 'g1' },
          { pos: 24, dur: 1, note: 'g1' },
          { pos: 28, dur: 1, note: 'g1' },
        ],
        sound: '.s("sawtooth").lpf(350).gain(0.5)',
      },
      chords: ['note("<[b3,d4,f#4] [g3,b3,d4]>").s("triangle").attack(0.02).release(0.4).lpf(2000).room(0.4).gain(0.3)'],
    },
    // si menor: B C# D E F# G A
    scale: [11, 1, 2, 4, 6, 7, 9],
    chordTones: [
      [11, 2, 6],
      [7, 11, 2],
    ],
    synth: 'lead',
  },
  // techno (2026-11-14, spec 008 §9): 128 bpm, do menor, kit 909. Bombo 4×4, caja (palmada) en 2 y 4, open hat a
  // contratiempo; el bajo, a corcheas, el pulso que no para. La melodía va a semicorcheas con las notas repetidas
  // apagadas (una nota = un golpe), para que el lead de una célula con wowo pase por el filtro golpe a golpe.
  techno: {
    key: 'do menor',
    priors: {
      bd: prior(0.03, { 0: 1, 4: 1, 8: 1, 12: 1 }),
      sd: prior(0.04, { 4: 1, 12: 1 }),
      hh: prior(0.15, { 2: 1, 6: 1, 10: 1, 14: 1 }),
    },
    templates: {
      bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
      sd: BACKBEAT,
      hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
    },
    background: {
      // note("<[~ c2]*8>").s("sawtooth").lpf(450).gain(0.5): el pulso a corcheas
      bass: {
        bars: 1,
        notes: Array.from({ length: 8 }, (_, i) => ({ pos: i * 2, dur: 2, note: 'c2' })),
        sound: '.s("sawtooth").lpf(450).gain(0.5)',
      },
      chords: ['note("<[c3,eb3,g3] [ab2,c3,eb3] [bb2,d3,f3] [g2,bb2,d3]>").s("supersaw").attack(0.02).release(0.3).lpf(1800).room(0.5).gain(0.25)'],
    },
    // do menor: C D Eb F G Ab Bb
    // el bombo, afinado a la raíz de cada acorde del fondo (Cm A♭ B♭ Gm), uno por compás: el drop "cae" sobre ellos
    kickTune: '<c3 ab2 bb2 g2>',
    scale: [0, 2, 3, 5, 7, 8, 10],
    chordTones: [
      [0, 3, 7],
      [8, 0, 3],
      [10, 2, 5],
      [7, 10, 2],
    ],
    synth: 'lead',
  },
}

/** Pasos (0..15) con golpe de una plantilla. */
export const templateSteps = (template: string): number[] =>
  template
    .split(' ')
    .map((t, i) => (t === '~' ? -1 : i))
    .filter((i) => i >= 0)

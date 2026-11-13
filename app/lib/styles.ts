import type { BassPattern } from './bass'
import type { Instrument, StyleId } from './types'

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
  },
}

/** Pasos (0..15) con golpe de una plantilla. */
export const templateSteps = (template: string): number[] =>
  template
    .split(' ')
    .map((t, i) => (t === '~' ? -1 : i))
    .filter((i) => i >= 0)

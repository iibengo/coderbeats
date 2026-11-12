import type { Instrument, StyleId } from './types'

/** 16 pesos (0..1) por paso: cuánto "atrae" cada paso a un golpe de ese instrumento. */
export type Prior = number[]

export interface StyleMusic {
  key: string
  priors: Record<Instrument, Prior>
  /** patrón típico (16 tokens) cuando la frase tiene un solo golpe de ese instrumento */
  templates: Record<Instrument, string>
  /** fondo musical: líneas Strudel completas (sin coma final); bajo en el orbit 2 y acordes en el 3 */
  background: { bass: string; chords: string }
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
      bass: 'note("<a1 d2>").s("triangle").lpf(600).gain(0.7).orbit(2)',
      chords: 'note("<[a3,c4,e4,g4] [d3,f3,a3,c4]>").s("triangle").lpf(2000).room(0.4).gain(0.22).orbit(3)',
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
      bass: 'note("<[~ f1 ~ f1] [~ bb0 ~ bb0]>").s("sawtooth").lpf(500).lpenv(2).decay(0.15).sustain(0).gain(0.6).orbit(2)',
      chords:
        'note("<[f3,ab3,c4,eb4] [bb2,db3,f3,ab3]>").struct("~ x ~ x").s("supersaw").decay(0.2).sustain(0).room(0.3).gain(0.22).orbit(3)',
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
      bass: 'note("<d1 d1 bb0 c1>").s("sawtooth").lpf(380).lpenv(3).lpq(6).gain(0.55).orbit(2)',
      chords: 'note("<[d3,f3,a3,c4] [bb2,d3,f3,a3]>/2").s("supersaw").lpf(1800).room(0.8).gain(0.22).orbit(3)',
    },
  },
}

/** Pasos (0..15) con golpe de una plantilla. */
export const templateSteps = (template: string): number[] =>
  template
    .split(' ')
    .map((t, i) => (t === '~' ? -1 : i))
    .filter((i) => i >= 0)

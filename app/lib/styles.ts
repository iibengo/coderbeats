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
    // El bombo 808 (el de RolandTR808, sample de 3 s) suena a ≈ 50 Hz = midi 31,4 (medido): `.note(x)` lo mueve midi(x) − 36, así que
    // para dejarlo en la raíz del acorde (Bm: b1 = 35, G: g1 = 31) la nota es la raíz + 5: `e2` (40) para si y `c2` (36) para sol.
    kickTune: '<e2 c2>',
    // si menor: B C# D E F# G A
    scale: [11, 1, 2, 4, 6, 7, 9],
    chordTones: [
      [11, 2, 6],
      [7, 11, 2],
    ],
    synth: 'lead',
  },
  // reggaetón (2026-11-17, spec 032): ~95 bpm, sol menor, kit 808. El ritmo de dembow (bombo a negras, caja en 3 6 11 14) pero más lento y con aire: platillo a contratiempo,
  // un 808 grave que sigue al bombo y stabs cortos de acordes entre los golpes (Gm – E♭ – B♭ – F). Sin probar de oído.
  reggaeton: {
    key: 'sol menor',
    priors: {
      bd: prior(0.03, { 0: 1, 4: 1, 8: 1, 12: 1 }),
      sd: prior(0.04, { 3: 1, 6: 1, 11: 1, 14: 1 }),
      hh: prior(0.2, { 2: 1, 6: 1, 10: 1, 14: 1 }),
    },
    templates: {
      bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
      sd: '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~',
      hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
    },
    background: {
      // el 808 grave: la raíz en el compás con un golpe largo, uno corto a contratiempo y otro que se alarga; un acorde por compás (Gm E♭ B♭ F)
      bass: {
        bars: 4,
        notes: [
          { pos: 0, dur: 3, note: 'g1' }, { pos: 6, dur: 2, note: 'g1' }, { pos: 8, dur: 3, note: 'g1' }, { pos: 14, dur: 2, note: 'g1' },
          { pos: 16, dur: 3, note: 'eb1' }, { pos: 22, dur: 2, note: 'eb1' }, { pos: 24, dur: 3, note: 'eb1' }, { pos: 30, dur: 2, note: 'eb1' },
          { pos: 32, dur: 3, note: 'bb1' }, { pos: 38, dur: 2, note: 'bb1' }, { pos: 40, dur: 3, note: 'bb1' }, { pos: 46, dur: 2, note: 'bb1' },
          { pos: 48, dur: 3, note: 'f1' }, { pos: 54, dur: 2, note: 'f1' }, { pos: 56, dur: 3, note: 'f1' }, { pos: 62, dur: 2, note: 'f1' },
        ],
        sound: '.s("sine").lpf(300).decay(0.6).sustain(0.5).gain(0.9)',
      },
      chords: ['note("<[g3,bb3,d4] [eb3,g3,bb3] [bb3,d4,f4] [f3,a3,c4]>").struct("~ x ~ ~ x ~ x ~").s("triangle").decay(0.2).sustain(0).lpf(2200).room(0.3).gain(0.28)'],
    },
    // sol menor: G A B♭ C D E♭ F
    scale: [7, 9, 10, 0, 2, 3, 5],
    chordTones: [
      [7, 10, 2],
      [3, 7, 10],
      [10, 2, 5],
      [5, 9, 0],
    ],
    synth: 'lead',
  },
  // drill (2026-11-19, spec 048): UK drill, 140 bpm, re menor, kit 808. Medio tiempo: caja solo en el tiempo 3, bombo escaso, platillo sincopado en grupos 3-2-3, con huecos
  // y un 808 largo y grave (re – si♭ – sol – la) que se desliza entre raíces, con stabs oscuros de acordes (Dm B♭ Gm Am). Los redobles de tresillos van aparte (sinte `hat`). Sin probar de oído.
  drill: {
    key: 're menor',
    priors: {
      bd: prior(0.03, { 0: 1, 6: 0.8, 11: 0.8 }),
      sd: prior(0.02, { 8: 1 }),
      hh: prior(0.15, { 2: 1, 3: 0.6, 5: 1, 7: 0.8, 10: 1, 13: 1, 15: 0.8, 0: 0.5 }),
    },
    templates: {
      bd: 'bd ~ ~ ~ ~ ~ bd ~ ~ ~ ~ bd ~ ~ ~ ~',
      sd: '~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~',
      hh: '~ ~ hh hh ~ hh ~ hh ~ ~ hh ~ ~ hh ~ hh',
    },
    background: {
      // el 808: un golpe largo en el 1 y uno corto a contratiempo, cada compás una raíz (re, si♭, sol, la; de 49 a 73 Hz: más grave se pierde en un móvil). El golpe largo **se desliza**
      // desde la raíz anterior (`slide` = raíz anterior − esta, en semitonos): el portamento del 808 del drill
      bass: {
        bars: 4,
        notes: [
          { pos: 0, dur: 7, note: 'd2', slide: -5 }, { pos: 10, dur: 6, note: 'd2' },
          { pos: 16, dur: 7, note: 'bb1', slide: 4 }, { pos: 26, dur: 6, note: 'bb1' },
          { pos: 32, dur: 7, note: 'g1', slide: 3 }, { pos: 42, dur: 6, note: 'g1' },
          { pos: 48, dur: 7, note: 'a1', slide: -2 }, { pos: 58, dur: 6, note: 'a1' },
        ],
        sound: '.s("sine").lpf(300).decay(0.9).sustain(0.5).shape(0.3).gain(0.9)',
      },
      chords: ['note("<[d3,f3,a3] [bb2,d3,f3] [g2,bb2,d3] [a2,c3,e3]>").struct("x ~ ~ ~ ~ ~ x ~").s("triangle").decay(0.3).sustain(0).lpf(1800).room(0.4).gain(0.26)'],
    },
    // re menor: D E F G A B♭ C
    scale: [2, 4, 5, 7, 9, 10, 0],
    chordTones: [
      [2, 5, 9],
      [10, 2, 5],
      [7, 10, 2],
      [9, 0, 4],
    ],
    synth: 'lead',
  },
  // techno (2026-11-14, spec 008 §9): 128 bpm, do menor, kit «Electrónico» (antes 909, spec 010). Bombo 4×4, caja (palmada) en 2 y 4, open hat a
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
    // el bombo, afinado a la raíz de cada acorde del fondo (Cm A♭ B♭ Gm), uno por compás: el drop "cae" sobre ellos.
    // `.note(x)` sobre un sample lo mueve (midi(x) − 36) semitonos: `c2` (midi 36) no lo mueve, `c3` lo subiría una octava. El bombo del kit
    // «Electrónico» (bd 0 de uzu-drumkit) suena a ≈63 Hz (≈ do, medido), así que `c2` lo deja en do y las demás notas lo bajan a la raíz.
    kickTune: '<c2 ab1 bb1 g1>',
    scale: [0, 2, 3, 5, 7, 8, 10],
    chordTones: [
      [0, 3, 7],
      [8, 0, 3],
      [10, 2, 5],
      [7, 10, 2],
    ],
    synth: 'lead',
  },
  // ── house y techno nuevos (spec 023, 2026-11-16): los de arriba (`house`, `techno`) se quedan como estaban para que lo guardado suene igual ──
  // house (124 bpm): bombo 4×4 con peso, palmada en 2 y 4, platillo abierto a contratiempo, bajo sincopado y redondo, acordes de «piano» alegres (do mayor).
  // (El swing de las semicorcheas lo da «Producción», que ya existe.) Sin probar de oído.
  house2: {
    key: 'do mayor',
    priors: {
      bd: prior(0.04, { 0: 1, 4: 1, 8: 1, 12: 1 }),
      sd: prior(0.06, { 4: 1, 12: 1 }),
      hh: prior(0.18, { 2: 1, 6: 1, 10: 1, 14: 1, 3: 0.35, 11: 0.35 }),
    },
    templates: {
      bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
      sd: BACKBEAT,
      hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
    },
    background: {
      // bajo sincopado entre los bombos: c2 en el compás 1, a1 en el 2
      bass: {
        bars: 2,
        notes: [
          { pos: 2, dur: 2, note: 'c2' },
          { pos: 6, dur: 2, note: 'c2' },
          { pos: 10, dur: 2, note: 'c2' },
          { pos: 14, dur: 1, note: 'e2' },
          { pos: 18, dur: 2, note: 'a1' },
          { pos: 22, dur: 2, note: 'a1' },
          { pos: 26, dur: 2, note: 'a1' },
          { pos: 30, dur: 1, note: 'c2' },
        ],
        sound: '.s("sawtooth").lpf(650).lpenv(2).decay(0.2).sustain(0).gain(0.6)',
      },
      // stabs de «piano» (triangular con caída corta) a contratiempo: Cmaj7 · Am7 · Fmaj7 · G7
      chords: [
        'note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [f2,a2,c3,e3] [g2,b2,d3,f3]>").struct("~ x ~ x ~ ~ x ~").s("triangle").decay(0.22).sustain(0).lpf(3200).room(0.3).gain(0.3)',
      ],
    },
    // do mayor: C D E F G A B
    scale: [0, 2, 4, 5, 7, 9, 11],
    chordTones: [
      [0, 4, 7, 11],
      [9, 0, 4, 7],
      [5, 9, 0, 4],
      [7, 11, 2, 5],
    ],
    synth: 'piano',
  },
  // techno (132 bpm): bombo constante y seco, bajo rodante en semicorcheas, percusión hipnótica, casi sin acordes (una sola nota larga y oscura), do frigio. Sin probar de oído.
  techno2: {
    key: 'do menor',
    priors: {
      bd: prior(0.03, { 0: 1, 4: 1, 8: 1, 12: 1 }),
      sd: prior(0.03, { 12: 0.5 }),
      hh: prior(0.35, { 2: 1, 6: 1, 10: 1, 14: 1, 5: 0.7, 7: 0.7, 13: 0.7, 15: 0.7 }),
    },
    templates: {
      bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
      sd: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
      hh: '~ ~ hh ~ ~ hh hh ~ ~ ~ hh ~ ~ hh hh ~',
    },
    background: {
      // el bajo rueda en semicorcheas, apagado donde cae el bombo (pasos 0, 4, 8, 12)
      bass: {
        bars: 1,
        notes: Array.from({ length: 16 }, (_, i) => i)
          .filter((i) => i % 4 !== 0)
          .map((i) => ({ pos: i, dur: 1, note: i % 8 === 7 ? 'c3' : 'c2' })),
        sound: '.s("sawtooth").lpf(380).lpenv(1.5).decay(0.12).sustain(0).gain(0.55)',
      },
      // casi sin acordes: una sola nota larga y oscura, muy baja de volumen
      chords: ['note("<[c3,eb3,g3]>").s("supersaw").attack(0.6).release(1.2).lpf(700).room(0.6).gain(0.1)'],
    },
    // do frigio (más oscuro): C Db Eb F G Ab Bb
    scale: [0, 1, 3, 5, 7, 8, 10],
    chordTones: [
      [0, 3, 7],
      [0, 3, 7, 10],
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

import type { FreeLoop, LoopsState } from './freeLoops'
import type { Instrument, StyleId } from './types'

/**
 * Canciones de ejemplo por estilo (§16.20): un compás por instrumento, más bajo y acordes del fondo.
 * Cada parte se carga como una bola normal (se puede silenciar, borrar o sustituir con la boca).
 */
export const DEMOS: Record<StyleId, Record<Instrument, string>> = {
  // el primer reel: bombo, caja, platillos en semicorcheas (hh*16) + bajo y acordes del fondo dnb
  dnb: {
    bd: 'bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~',
    sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
    hh: 'hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh',
  },
  // boom bap: bombo en 1, en la "y" del 2 y en el 3; caja en 2 y 4; platillo en corcheas
  hiphop90: {
    bd: 'bd ~ ~ ~ ~ ~ ~ bd ~ ~ bd ~ ~ ~ ~ ~',
    sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
    hh: 'hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~ hh ~',
  },
  // dembow: bombo a negras, caja en 3 6 11 14, platillo en semicorcheas (el patrón de la demo, sin la intro)
  dembow: {
    bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
    sd: '~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~',
    hh: 'hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh hh',
  },
  // house: bombo a negras, caja (palmada) en 2 y 4, platillo a contratiempo
  house: {
    bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
    sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
    hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
  },
  // house (spec 023): bombo 4×4, palmada en 2 y 4, platillo abierto a contratiempo
  house2: {
    bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
    sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
    hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
  },
  // techno (spec 023): bombo constante, un solo golpe de caja y percusión hipnótica
  techno2: {
    bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
    sd: '~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
    hh: '~ ~ hh ~ ~ hh hh ~ ~ ~ hh ~ ~ hh hh ~',
  },
  // techno: bombo 4×4, palmada en 2 y 4, open hat a contratiempo (el dibujo que se deja grabar)
  techno: {
    bd: 'bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~',
    sd: '~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~',
    hh: '~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~ ~ ~ hh ~',
  },
}

/** Loops de la demo de un estilo, con ids a partir de `nextId`, que empiezan a sonar en `bornAt`. */
export function demoState(style: StyleId, nextId: number, bornAt: number): LoopsState {
  const loops: FreeLoop[] = (['bd', 'sd', 'hh'] as const).map((instrument, i) => ({
    id: nextId + i,
    instrument,
    bars: 1,
    phaseBar: 0,
    hits: DEMOS[style][instrument]
      .split(' ')
      .map((t, step) => (t === '~' ? -1 : step))
      .filter((s) => s >= 0)
      .map((pos) => ({ pos, strength: 0.8 })),
    muted: false,
    bornAt,
    fromTemplate: false,
  }))
  return { loops, nextId: nextId + loops.length }
}

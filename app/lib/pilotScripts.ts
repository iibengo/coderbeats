/**
 * Guiones del piloto automático (spec 009 §4.4, §7). Datos puros: el guion dice la intención; el cómo (el dedo, las pausas, las imperfecciones)
 * lo decide `pilot.ts`, y el conductor (`usePilot`) lo ejecuta con gestos reales sobre la pantalla.
 *
 * Desviación de la spec (decisión a revisar): los pasos van **en orden con esperas en compases** y no con un `at` absoluto; es lo más simple y suena igual
 * (cada frase de la boca espera a la línea de compás).
 */
import type { Instrument, KitId, StyleId } from './types'

export type PilotTarget =
  | { t: 'play' }
  | { t: 'ball'; part: 'bass' | 'chords' }
  | { t: 'strip'; voice: Instrument; step: number }
  /** un botón por su `aria-label` exacto (los del selector de modo) */
  | { t: 'label'; label: string }

export type PilotStep =
  /** un rótulo (apagable) */
  | { do: 'caption'; text: string }
  /** un toque del dedo fantasma */
  | { do: 'tap'; on: PilotTarget; caption?: string }
  /** «grabar con la boca»: el bocadillo dice `says` en cada golpe y la frase empieza en la línea de compás */
  | { do: 'mouth'; instrument: Instrument; steps: number[]; says: string; caption?: string }
  | { do: 'wait'; bars: number }
  /** en Componer: arrastra el asa de la última célula a agua vacía (copiarla) → una célula nueva al final del orden */
  | { do: 'copy' }
  /** «cambio lo necesario»: la célula nº `cell` del orden de la canción toma sus loops, partes, vueltas y filtro (lo que ningún gesto hace) */
  | { do: 'fill'; cell: number }

export interface PilotScript {
  version: 1
  id: string
  title: string
  style: StyleId
  kit: KitId
  steps: PilotStep[]
  /** lo que debe quedar construido (para comprobarlo en los tests y para «saltar al final») */
  final: { loops: Partial<Record<Instrument, number[]>>; parts: { bass: boolean; chords: boolean } }
}

const all16 = Array.from({ length: 16 }, (_, i) => i)

/** La demo del dembow (005 §20), célula Principal: platillo con la boca, bombo tocando el aro, caja con la boca, y el fondo. ~50 s a 120 bpm. */
export const DEMO_DEMBOW: PilotScript = {
  version: 1,
  id: 'demo-dembow',
  title: 'Demo de dembow',
  style: 'dembow',
  kit: '808',
  steps: [
    { do: 'caption', text: 'Dembow, 120 bpm' },
    { do: 'tap', on: { t: 'play' } },
    { do: 'wait', bars: 1 },
    { do: 'tap', on: { t: 'ball', part: 'chords' }, caption: '+ acordes' },
    { do: 'wait', bars: 1 },
    { do: 'mouth', instrument: 'hh', steps: all16, says: 'ts', caption: 'el platillo, con la boca' },
    { do: 'wait', bars: 2 },
    { do: 'caption', text: 'el bombo, tocando el aro' },
    { do: 'tap', on: { t: 'strip', voice: 'bd', step: 0 } },
    { do: 'tap', on: { t: 'strip', voice: 'bd', step: 4 } },
    { do: 'tap', on: { t: 'strip', voice: 'bd', step: 8 } },
    { do: 'tap', on: { t: 'strip', voice: 'bd', step: 12 } },
    { do: 'wait', bars: 2 },
    { do: 'mouth', instrument: 'sd', steps: [3, 6, 11, 14], says: 'pff', caption: 'la caja dembow, con la boca' },
    { do: 'wait', bars: 2 },
    { do: 'tap', on: { t: 'ball', part: 'bass' }, caption: '+ bajo' },
    { do: 'wait', bars: 4 },
  ],
  final: { loops: { bd: [0, 4, 8, 12], sd: [3, 6, 11, 14], hh: all16 }, parts: { bass: true, chords: true } },
}

export const PILOT_SCRIPTS: Partial<Record<StyleId, PilotScript>> = { dembow: DEMO_DEMBOW }

/** Lo que construye un guion, sin ejecutarlo: los pasos de cada instrumento (toques y frases) y las bolas del fondo. */
export function outcomeOf(script: PilotScript): PilotScript['final'] {
  const loops: Partial<Record<Instrument, number[]>> = {}
  const parts = { bass: false, chords: false }
  for (const s of script.steps) {
    if (s.do === 'mouth') loops[s.instrument] = [...new Set([...(loops[s.instrument] ?? []), ...s.steps])].sort((a, b) => a - b)
    else if (s.do === 'tap' && s.on.t === 'strip') loops[s.on.voice] = [...new Set([...(loops[s.on.voice] ?? []), s.on.step])].sort((a, b) => a - b)
    else if (s.do === 'tap' && s.on.t === 'ball') parts[s.on.part] = !parts[s.on.part]
  }
  return { loops, parts }
}

import type { FreeLoop, LoopsState } from './freeLoops'

/** ¿Lo construido es idéntico a lo que declara el guion? Cada instrumento con exactamente sus pasos (enteros), ningún loop de más, y el fondo. */
export function checkOutcome(state: LoopsState, parts: { bass: boolean; chords: boolean }, final: PilotScript['final']): { ok: boolean; diff: string[] } {
  const diff: string[] = []
  const want = Object.entries(final.loops) as [Instrument, number[]][]
  for (const l of state.loops) if (!(l.instrument in final.loops)) diff.push(`loop de más: ${l.instrument}`)
  for (const [inst, steps] of want) {
    const ls = state.loops.filter((l) => l.instrument === inst)
    if (ls.length !== 1) {
      diff.push(`${inst}: ${ls.length} loops`)
      continue
    }
    const l = ls[0]!
    const got = l.hits.map((h) => h.pos).sort((a, b) => a - b)
    if (l.bars !== 1 || got.length !== steps.length || got.some((p, i) => p !== steps[i])) diff.push(`${inst}: ${got.join(',')} ≠ ${steps.join(',')}`)
  }
  if (parts.bass !== final.parts.bass || parts.chords !== final.parts.chords) diff.push('fondo distinto')
  return { ok: diff.length === 0, diff }
}

/** Deja exactamente los loops del guion (los de más se quitan, los que faltan se crean, los golpes en su paso exacto), conservando ids y nacimiento de los que ya estaban. */
export function correctLoops(state: LoopsState, final: PilotScript['final'], bornAt: number): LoopsState {
  let nextId = state.nextId
  const loops: FreeLoop[] = []
  for (const [inst, steps] of Object.entries(final.loops) as [Instrument, number[]][]) {
    const old = state.loops.find((l) => l.instrument === inst)
    loops.push({
      id: old?.id ?? nextId++, instrument: inst, bars: 1, phaseBar: 0, muted: false, bornAt: old?.bornAt ?? bornAt, fromTemplate: false,
      hits: steps.map((pos) => ({ pos, strength: 0.8 })),
    })
  }
  return { loops, nextId }
}

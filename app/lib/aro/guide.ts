/**
 * Guía al tocar (spec 003, E3.3). Puro.
 * - Fantasma: dónde caerá el golpe que arrastras (con el imán), o null si no caerá en ningún sitio.
 * - Sugerencias del estilo: solo en franjas de batería vacías, de las plantillas del estilo.
 * Sin ayuda (modo libre), ni fantasma ni sugerencias.
 */
import { snapStep } from '../loopEdit'
import type { Voice } from '../palette'
import { STYLE_MUSIC, templateSteps } from '../styles'
import type { Instrument, StyleId } from '../types'
import { dropAction } from './drop'

export interface GuideOptions {
  assist: boolean
  quantizeEvery: 1 | 2
}

export interface GuideSpot {
  voice: Instrument
  /** paso del compás, 0..16 */
  step: number
}

const DRUMS: readonly Instrument[] = ['bd', 'sd', 'hh']

/** Dónde caerá al soltarlo un golpe de `from` arrastrado a (u, step) sobre la franja `band`. */
export function ghostTarget(from: Voice, u: number, step: number, band: Voice | null, o: GuideOptions): GuideSpot | null {
  if (!o.assist) return null
  const act = dropAction(from, u, band)
  if (act.kind !== 'move' || !DRUMS.includes(act.to as Instrument)) return null
  return { voice: act.to as Instrument, step: snapStep(step, o) }
}

/** Sugerencias del estilo para las franjas de batería sin golpes en el compás que se ve. */
export function suggestions(style: StyleId, withHits: ReadonlySet<Voice>, o: GuideOptions): GuideSpot[] {
  if (!o.assist) return []
  const out: GuideSpot[] = []
  for (const voice of DRUMS) {
    if (withHits.has(voice)) continue
    for (const step of templateSteps(STYLE_MUSIC[style].templates[voice])) out.push({ voice, step })
  }
  return out
}

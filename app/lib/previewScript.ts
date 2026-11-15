/**
 * «Previsualizar» (spec 009, ampliada): el guion del piloto **generado a partir de los datos de cualquier canción** (demo, remix o Mis canciones).
 * Pura. Primera célula, capa a capa, con los gestos que la interfaz tiene: la batería de un compás (bombo, caja, platillo) con golpes en pasos enteros se
 * construye con la boca (≥ 8 golpes) o tocando el aro, y el fondo con las bolas. Lo que la interfaz no puede hacer con un gesto (melodía, loops de 4 compases,
 * voz, filtro, grupos, las demás células) **no se inventa**: se enseña al final con la canción entera, restaurada desde los datos.
 */
import { cellById, type Song } from './cells'
import type { PilotScript, PilotStep } from './pilotScripts'
import type { Instrument, KitId, StyleId } from './types'

const ORDER: Instrument[] = ['hh', 'bd', 'sd']
const NAMES: Record<Instrument, string> = { bd: 'el bombo', sd: 'la caja', hh: 'el platillo' }

/** Los pasos enteros (0..15) de un loop de batería gesticulable, o `null` (más de un compás, golpe a medio paso o vacío). */
export function gestureSteps(hits: readonly { pos: number }[], bars: number): number[] | null {
  if (bars !== 1 || !hits.length) return null
  const steps = hits.map((h) => h.pos)
  if (steps.some((p) => !Number.isInteger(p) || p < 0 || p > 15)) return null
  return [...new Set(steps)].sort((a, b) => a - b)
}

export function previewScript(song: Song, style: StyleId, kit: KitId, title = 'Tu canción'): PilotScript {
  const first = cellById(song, song.order[0] ?? song.cells[0]?.id ?? -1) ?? song.cells[0]
  const steps: PilotStep[] = [{ do: 'caption', text: title }, { do: 'tap', on: { t: 'play' } }, { do: 'wait', bars: 1 }]
  const loops: PilotScript['final']['loops'] = {}
  for (const inst of ORDER) {
    const l = first?.loops.find((x) => x.instrument === inst && !x.muted)
    const g = l ? gestureSteps(l.hits, l.bars) : null
    if (!g) continue
    loops[inst] = g
    steps.push({ do: 'caption', text: `${NAMES[inst]}${g.length >= 8 ? ', con la boca' : ', tocando el aro'}` })
    if (g.length >= 8) steps.push({ do: 'mouth', instrument: inst, steps: g, says: inst === 'hh' ? 'ts' : inst === 'sd' ? 'pff' : 'bum' })
    else for (const step of g) steps.push({ do: 'tap', on: { t: 'strip', voice: inst, step } })
    steps.push({ do: 'wait', bars: 2 })
  }
  const parts = { bass: !!first?.parts.bass, chords: !!first?.parts.chords }
  if (parts.chords) steps.push({ do: 'tap', on: { t: 'ball', part: 'chords' }, caption: '+ acordes' })
  if (parts.bass) steps.push({ do: 'tap', on: { t: 'ball', part: 'bass' }, caption: '+ bajo' })
  steps.push({ do: 'wait', bars: 2 })
  const rest = song.order.slice(1).map((id) => cellById(song, id)?.name).filter(Boolean)
  steps.push({ do: 'caption', text: rest.length ? `Después: ${rest.join(' · ')}` : 'Y suena entera' })
  return { version: 1, id: 'preview', title, style, kit, steps, final: { loops, parts } }
}

/** Los compases que dura la demostración final de la canción entera (como mucho 8). */
export const showBars = (total: number): number => Math.max(2, Math.min(8, total))

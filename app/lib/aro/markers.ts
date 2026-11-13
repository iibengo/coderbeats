/**
 * Marcadores del borde (spec 005, §5.3): cada célula fuera de pantalla es un puntito en el borde del
 * rectángulo libre, en la dirección donde está. Puro y sin DOM.
 */
import type { Rect } from './shape'

export interface MarkerIn {
  id: number
  /** dónde está la célula respecto al centro de la pantalla (px) */
  dx: number
  dy: number
}

export interface Marker {
  id: number
  x: number
  y: number
  /** la siguiente que va a sonar (se ve en rosa) */
  next: boolean
  /** id del marcador que la representa: ella misma si manda, o el que la absorbe por estar a menos de `merge` px */
  leader: number
  /** cuántas células representa (≥ 1 en el que manda) */
  count: number
}

/** separación del borde del rectángulo libre (px) y distancia bajo la cual se agrupan (px) */
export const MARKER_PAD = 14
export const MARKER_MERGE = 16

/**
 * Coloca los marcadores donde el rayo desde el centro hacia cada célula corta el borde del
 * rectángulo (menos `pad`). Los que quedan a menos de `merge` px se agrupan en el que manda: la
 * siguiente en sonar, y si no, la más cercana.
 */
export function edgeMarkers(free: Rect, items: readonly MarkerIn[], nextId: number | null, pad = MARKER_PAD, merge = MARKER_MERGE): Marker[] {
  const cx = (free.x0 + free.x1) / 2
  const cy = (free.y0 + free.y1) / 2
  const hw = Math.max(1, (free.x1 - free.x0) / 2 - pad)
  const hh = Math.max(1, (free.y1 - free.y0) / 2 - pad)
  const placed = items.map((it) => {
    // una célula justo en el centro sale hacia la derecha
    const [dx, dy] = Math.hypot(it.dx, it.dy) < 1e-6 ? [1, 0] : [it.dx, it.dy]
    const s = Math.min(hw / Math.max(1e-9, Math.abs(dx)), hh / Math.max(1e-9, Math.abs(dy)))
    return { id: it.id, x: cx + dx * s, y: cy + dy * s, next: it.id === nextId, dist: Math.hypot(it.dx, it.dy) }
  })
  placed.sort((a, b) => Number(b.next) - Number(a.next) || a.dist - b.dist || a.id - b.id)
  const out: Marker[] = []
  for (const p of placed) {
    const lead = out.find((m) => m.leader === m.id && Math.hypot(m.x - p.x, m.y - p.y) < merge)
    if (lead) {
      lead.count++
      out.push({ id: p.id, x: lead.x, y: lead.y, next: p.next, leader: lead.id, count: 0 })
    } else out.push({ id: p.id, x: p.x, y: p.y, next: p.next, leader: p.id, count: 1 })
  }
  return out
}

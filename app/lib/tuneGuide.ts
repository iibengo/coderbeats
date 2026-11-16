/**
 * El modo guiado del sintetizador (spec 015 §13), partes puras: dónde aparece la nota fantasma **sobre la curva** y cuándo cuenta como tocada.
 * No hay tiempo que cumplir: la nota espera; lo que se graba son las posiciones del tema (encajado en el ritmo y la escala).
 */
import { curvePoint, type LissajousParams, type P2 } from './theremin'

/** Radio (px) de la zona en la que el dedo «llega» a la nota fantasma. */
export const GHOST_R = 46

/** La altura (px) de la franja de la nota `idx` (0 = la más grave) entre `n`: la que tendría al tocarla libremente. */
export const noteY = (idx: number, n: number, h: number): number => h * (1 - (idx + 0.5) / Math.max(1, n))

export interface Ghost extends P2 {
  /** el parámetro de la curva (0…2π) en el que está */
  t: number
}

/**
 * Dónde pone la nota fantasma: un punto de la curva a la altura de su franja (o lo más cerca que llegue la curva). Entre los puntos igual de buenos
 * elige el más cercano al anterior que quede a más de `2,5·r` de él (que una nota repetida no esté ya bajo el dedo); sin anterior, el más centrado.
 */
export function placeGhost(p: LissajousParams, w: number, h: number, idx: number, n: number, prev: P2 | null, phase: number, r = GHOST_R, steps = 192): Ghost {
  const y0 = noteY(idx, n, h)
  const cands: Ghost[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    cands.push({ ...curvePoint(p, t, w, h, phase), t })
  }
  const minDy = Math.min(...cands.map((c) => Math.abs(c.y - y0)))
  const tol = minDy + (h / Math.max(1, n)) * 0.4
  const good = cands.filter((c) => Math.abs(c.y - y0) <= tol)
  if (!prev) return good.reduce((b, c) => (Math.abs(c.x - w / 2) < Math.abs(b.x - w / 2) ? c : b), good[0]!)
  const far = good.filter((c) => Math.hypot(c.x - prev.x, c.y - prev.y) >= 2.5 * r)
  if (far.length) return far.reduce((b, c) => (Math.hypot(c.x - prev.x, c.y - prev.y) < Math.hypot(b.x - prev.x, b.y - prev.y) ? c : b), far[0]!)
  return good.reduce((b, c) => (Math.hypot(c.x - prev.x, c.y - prev.y) > Math.hypot(b.x - prev.x, b.y - prev.y) ? c : b), good[0]!)
}

export interface GuideState {
  /** cuántas notas del tema ya se tocaron */
  k: number
  /** ¿puede contar la siguiente? Tras tocar una hay que salir de su zona o levantar el dedo (si no, una nota repetida contaría sola) */
  armed: boolean
  done: boolean
}
export const GUIDE_FRESH: GuideState = { k: 0, armed: true, done: false }

/** Un paso del modo guiado: el dedo (o `null` si se levantó) frente a la nota fantasma. `hit` dice si esta vez cuenta la nota. */
export function guideStep(s: GuideState, total: number, finger: P2 | null, ghost: P2 | null, r = GHOST_R): { state: GuideState; hit: boolean } {
  if (s.done || !ghost) return { state: s, hit: false }
  if (!finger) return { state: s.armed ? s : { ...s, armed: true }, hit: false }
  const d = Math.hypot(finger.x - ghost.x, finger.y - ghost.y)
  if (!s.armed) return { state: d > r * 1.5 ? { ...s, armed: true } : s, hit: false }
  if (d > r) return { state: s, hit: false }
  const k = s.k + 1
  return { state: { k, armed: false, done: k >= total }, hit: true }
}

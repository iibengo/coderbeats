/**
 * El fluido del agua (spec 015, fase 2), partes puras: la **estela del dedo** (puntos que se desvanecen) y las **venas** (partículas que corren por los hilos entre células).
 * Todo con topes duros (puntos y partículas) y sin asignar de más: se dibuja encima del agua y el vigilante de frames lo apaga si va lento.
 */
export interface TrailPoint {
  x: number
  y: number
  t: number
}

export const TRAIL_LIFE = 0.55
export const TRAIL_MAX = 28
/** distancia mínima entre puntos de la estela (px): un dedo quieto no la llena */
export const TRAIL_MIN_DIST = 5

/** Añade el punto del dedo a la estela (si se movió lo bastante) y quita los viejos. Devuelve la misma lista, cambiada. */
export function trailPush(trail: TrailPoint[], x: number, y: number, now: number): TrailPoint[] {
  const last = trail[trail.length - 1]
  if (Number.isFinite(x) && Number.isFinite(y) && (!last || Math.hypot(x - last.x, y - last.y) >= TRAIL_MIN_DIST)) trail.push({ x, y, t: now })
  return trailPrune(trail, now)
}

export function trailPrune(trail: TrailPoint[], now: number): TrailPoint[] {
  let drop = 0
  while (drop < trail.length && now - trail[drop]!.t > TRAIL_LIFE) drop++
  if (drop) trail.splice(0, drop)
  if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX)
  return trail
}

/** Opacidad (0..1) de un punto de la estela: 1 recién puesto, 0 al acabar su vida. */
export const trailAlpha = (p: TrailPoint, now: number): number => Math.max(0, 1 - (now - p.t) / TRAIL_LIFE)

export interface VeinSeg {
  fromId: number
  toId: number
  a: { x: number; y: number }
  b: { x: number; y: number }
}
export interface VeinDot {
  x: number
  y: number
  /** 0..1: más claro en medio del hilo, se apaga en los extremos */
  a: number
}

export const VEIN_PER_THREAD = 3
export const VEIN_MAX = 48
/** vueltas al hilo por segundo */
export const VEIN_SPEED = 0.22

/**
 * Las partículas de las venas en el instante `t` (s): cada hilo (los tramos seguidos con el mismo `fromId`→`toId`) lleva `perThread` puntos repartidos
 * a lo largo, que corren de la célula de origen a la de destino. Como mucho `max` en total (los primeros hilos).
 */
export function veinDots(segs: readonly VeinSeg[], t: number, perThread = VEIN_PER_THREAD, max = VEIN_MAX): VeinDot[] {
  const out: VeinDot[] = []
  let i = 0
  while (i < segs.length && out.length < max) {
    let j = i + 1
    while (j < segs.length && segs[j]!.fromId === segs[i]!.fromId && segs[j]!.toId === segs[i]!.toId) j++
    const n = j - i
    // longitud acumulada del hilo para repartir por distancia y no por tramo
    const cum: number[] = [0]
    for (let k = i; k < j; k++) cum.push(cum[cum.length - 1]! + Math.hypot(segs[k]!.b.x - segs[k]!.a.x, segs[k]!.b.y - segs[k]!.a.y))
    const total = cum[n]!
    if (total > 1) {
      for (let q = 0; q < perThread && out.length < max; q++) {
        const f = (((t * VEIN_SPEED + q / perThread) % 1) + 1) % 1
        const d = f * total
        let k = 0
        while (k < n - 1 && cum[k + 1]! < d) k++
        const s = segs[i + k]!
        const len = cum[k + 1]! - cum[k]!
        const u = len > 0 ? (d - cum[k]!) / len : 0
        out.push({ x: s.a.x + (s.b.x - s.a.x) * u, y: s.a.y + (s.b.y - s.a.y) * u, a: Math.sin(Math.PI * f) })
      }
    }
    i = j
  }
  return out
}

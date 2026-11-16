/**
 * El vigilante de frames (spec 003 E1.7), puro: decide cuándo bajar el detalle gráfico y, **ahora también, cuándo volver a subirlo**.
 * Cada ventana de frames se resume en su p95 (ms). Por encima de `SLOW_MS` se baja un escalón (primero el detalle de las células de fondo si se estaba en la
 * colonia, luego el agua, luego el aro); por debajo de `FAST_MS` durante `UP_AFTER` ventanas seguidas se sube uno, en orden inverso. Para no oscilar,
 * tras bajar hay que esperar más cada vez que una subida fue seguida de otra bajada.
 */
export const SLOW_MS = 14
export const FAST_MS = 8
/** ventanas rápidas seguidas para subir un escalón (cada ventana son 120 frames ≈ 2 s) */
export const UP_AFTER = 5
export const QUALITY_STEP = 0.15

export interface GovernorState {
  /** detalle de las células de fondo: 0 = completo, 2 = el más simple */
  crowd: 0 | 1 | 2
  /** calidad del agua, 0,5..1 */
  quality: number
  /** adornos del agua (estela del dedo y venas): 1 = encendidos, 0 = apagados; es lo **primero** que se apaga y lo último que vuelve */
  flow: 0 | 1
  /** detalle del aro: 1 o 0,5 */
  aro: 1 | 0.5
  /** ventanas rápidas seguidas */
  fast: number
  /** ventanas rápidas que hacen falta ahora para subir (crece si una subida acaba en bajada) */
  need: number
  /** ¿lo último que se hizo fue subir? */
  justUp: boolean
}

export const initialGovernor = (): GovernorState => ({ crowd: 0, quality: 1, flow: 1, aro: 1, fast: 0, need: UP_AFTER, justUp: false })

export interface GovernorOptions {
  /** la ventana se pasó sobre todo en la colonia (el detalle de las células solo cuenta ahí) */
  inColony: boolean
  /** el tema permite bajar la calidad del agua */
  canQuality: boolean
  /** hay aro con detalle */
  canAro: boolean
  /** los adornos están encendidos por el interruptor (si no, no hay nada que apagar) */
  canFlow?: boolean
}

/** Una ventana más: devuelve el estado nuevo (puro). */
export function governorStep(s: GovernorState, p95: number, o: GovernorOptions): GovernorState {
  if (p95 > SLOW_MS) {
    const next = { ...s, fast: 0 }
    // si lo último fue subir y ya vuelve a ir lento, se espera más para la próxima subida
    if (s.justUp) next.need = Math.min(s.need * 2, UP_AFTER * 8)
    next.justUp = false
    if (o.canFlow && s.flow) next.flow = 0
    else if (o.inColony && s.crowd < 2) next.crowd = (s.crowd + 1) as 1 | 2
    else if (o.canQuality && s.quality > 0.5 + 1e-6) next.quality = Math.max(0.5, s.quality - QUALITY_STEP)
    else if (o.canAro && s.aro > 0.5) next.aro = 0.5
    return next
  }
  if (p95 < FAST_MS) {
    const fast = s.fast + 1
    if (fast < s.need) return { ...s, fast }
    const next = { ...s, fast: 0 }
    // se sube en orden inverso al de bajar: el aro, el agua y por último las células de fondo
    if (s.aro < 1) next.aro = 1
    else if (s.quality < 1 - 1e-6) next.quality = Math.min(1, s.quality + QUALITY_STEP)
    else if (s.crowd > 0) next.crowd = (s.crowd - 1) as 0 | 1
    else if (!s.flow) next.flow = 1
    else return { ...s, fast: 0, justUp: false } // ya está todo al máximo
    next.justUp = true
    return next
  }
  // ni lento ni claramente rápido: se queda como está
  return { ...s, fast: 0 }
}

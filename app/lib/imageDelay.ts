/**
 * Retraso de imagen (spec 003, E6). Puro.
 *
 * La imagen (aguja, ondas, bolas) va con lo que se oye: se retrasa la latencia de salida. Con cascos
 * Bluetooth el navegador informa de una latencia de salida falsa (en iOS, unos 18 ms) y la imagen va
 * por delante del sonido (~200 ms). Dos remedios, que se suman:
 * - automático: la calibración de palmadas mide la ida y vuelta (salida + entrada); quitando lo que
 *   suele tardar la entrada y lo que ya informa el navegador, queda la salida que falta;
 * - ajuste fino a mano, por si no basta o se cambia de cascos.
 */

/** lo que suele tardar la entrada del micro dentro de la ida y vuelta medida (ms) */
export const INPUT_LATENCY_GUESS_MS = 30
/** si lo que falta es menos que esto, no se corrige (es la imprecisión de la medida, no un Bluetooth) */
export const AUTO_MIN_MS = 40
/** rango del ajuste fino (ms) y paso del deslizador */
export const FINE_MIN_MS = -150
export const FINE_MAX_MS = 300
export const FINE_STEP_MS = 5
/** el retraso de imagen total no pasa de esto (ms) */
export const IMAGE_MAX_MS = 500

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * Retraso automático (ms): ida y vuelta calibrada − entrada típica − salida que ya informa el navegador.
 * 0 si no hay calibración o lo que falta es poco (altavoces o cascos con cable, el PC).
 */
export function autoImageDelayMs(roundTripMs: number, reportedOutputMs: number): number {
  if (!(roundTripMs > 0)) return 0
  const missing = roundTripMs - INPUT_LATENCY_GUESS_MS - Math.max(0, reportedOutputMs)
  return missing >= AUTO_MIN_MS ? Math.round(missing) : 0
}

/** Ajuste fino válido (lo que se lee del almacenamiento puede venir roto): entero en el rango, múltiplo del paso. */
export function sanitizeFine(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return clamp(Math.round(v / FINE_STEP_MS) * FINE_STEP_MS, FINE_MIN_MS, FINE_MAX_MS)
}

export interface ImageDelayInput {
  /** usar la calibración (automático) */
  auto: boolean
  /** ajuste fino a mano (ms) */
  fineMs: number
  /** ida y vuelta calibrada (ms); 0 sin calibración */
  roundTripMs: number
  /** latencia de salida que informa el navegador (ms) */
  reportedOutputMs: number
}

/** Retraso de imagen total (ms): el automático (si está encendido) más el ajuste fino, entre 0 y 500. */
export function imageDelayMs(o: ImageDelayInput): number {
  const auto = o.auto ? autoImageDelayMs(o.roundTripMs, o.reportedOutputMs) : 0
  return clamp(Math.round(auto + sanitizeFine(o.fineMs)), 0, IMAGE_MAX_MS)
}

/**
 * Lo que se guardó del retraso de imagen (por dispositivo), con valores por defecto si faltan o están
 * rotos: automático encendido y sin ajuste fino (como antes de E6).
 */
export function restoreImageDelay(saved: { imageAuto?: unknown; imageFineMs?: unknown }): { auto: boolean; fineMs: number } {
  return { auto: typeof saved.imageAuto === 'boolean' ? saved.imageAuto : true, fineMs: sanitizeFine(saved.imageFineMs) }
}

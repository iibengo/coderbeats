export const AXIS_LOCK_PX = 12
/** djf de Strudel: 0,5 = abierto; por debajo, paso bajo. Nunca lo cerramos del todo. */
export const DJF_MIN = 0.1
export const DJF_OPEN = 0.5

export type Axis = 'x' | 'y' | null

/** Fija el eje con el primer movimiento de ≥ 12 px. */
export function lockAxis(dx: number, dy: number): Axis {
  if (Math.hypot(dx, dy) < AXIS_LOCK_PX) return null
  return Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x'
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Nuevo valor 0..1 tras arrastrar. Recorrer la dimensión entera de la pantalla = rango completo.
 * Vertical: arriba sube (dy negativo). Horizontal: derecha sube.
 */
export function dragValue(start: number, axis: 'x' | 'y', delta: number, size: number): number {
  const d = axis === 'y' ? -delta : delta
  return clamp01(start + d / Math.max(1, size))
}

/** Filtro: 0..1 → djf (1 = abierto = 0,5). Filtro DJ por bus: no pisa los lpf de cada línea. */
export const filterDjf = (v: number): number => Math.round((DJF_MIN + (DJF_OPEN - DJF_MIN) * clamp01(v)) * 1000) / 1000

/** Espacio: 0..1 → reverb y delay. */
export const spaceParams = (v: number): { room: number; delay: number } => ({
  room: Math.round(clamp01(v) * 0.6 * 100) / 100,
  delay: Math.round(clamp01(v) * 0.35 * 100) / 100,
})

/** Calor: 0..1 → saturación. */
export const warmthShape = (v: number): number => Math.round(clamp01(v) * 0.5 * 100) / 100

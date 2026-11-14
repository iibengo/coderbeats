/**
 * La recompensa de Jugar (spec 011, §12.3): cuando todos los carriles tienen algo, el disco entero se enciende una vuelta.
 * Lo puro: la condición y la forma del destello. El dibujo está en `AroCanvas`.
 */

/** Lo mínimo que hace falta saber de un loop. */
export interface RewardLoop {
  instrument: string
  hits: readonly unknown[]
  muted?: boolean
}

/** ¿Tienen algo todos los carriles? Bombo, caja y platillo con golpes (sin silenciar), y la melodía si está activada. */
export function allLanesFilled(loops: readonly RewardLoop[], melodyOn: boolean): boolean {
  const has = (i: string) => loops.some((l) => l.instrument === i && !l.muted && l.hits.length > 0)
  return has('bd') && has('sd') && has('hh') && (!melodyOn || has('mel'))
}

/** Cuánto se enciende y cuánto del disco ya se ha barrido. `sweep` 0..1 (la aguja da una vuelta) y `glow` 0..1 (brillo). */
export interface RewardFrame {
  sweep: number
  glow: number
}

/** Cuánto dura el apagado tras la vuelta, en vueltas (compases) */
export const REWARD_FADE = 0.3

/**
 * La forma del destello según cuántas vueltas han pasado desde que empezó (`p`): la luz barre el disco con la aguja durante una
 * vuelta (el brillo crece) y luego se apaga deprisa. Antes de empezar o pasado el apagado, `null`.
 */
export function rewardFrame(p: number): RewardFrame | null {
  if (!Number.isFinite(p) || p < 0 || p > 1 + REWARD_FADE) return null
  if (p <= 1) return { sweep: p, glow: 0.35 + 0.65 * p }
  return { sweep: 1, glow: 1 - (p - 1) / REWARD_FADE }
}

/**
 * La melodía por toques de la portada (spec 016 §16, «Magic Piano»): cada toque suena la **siguiente nota** de la melodía y tú marcas el ritmo. Partes puras: el cuantizado
 * suave al compás y la «toma» (los toques seguidos forman un loop; tras una pausa larga, empieza otra).
 */
import type { KeyEvent } from './waterKeys'

/** Cuánto puede retrasarse (s) una nota para caer en el paso del compás que tiene justo por delante. */
export const SOFT_AHEAD = 0.07
/** Una pausa más larga que esto (s) cierra la toma: el siguiente toque empieza otra melodía (sustituye a la anterior). */
export const TAKE_GAP = 4
/** Silencio (s) tras el último toque para pasar la toma al loop. */
export const COMMIT_IDLE = 1.2

/**
 * La hora a la que suena un toque en `now`: si hay un paso del compás (`origin` + k·`stepSec`) a menos de `maxAhead` por delante, **cae en él**; si no, suena ya (nunca se adelanta:
 * no se puede). Lo grabado se cuantiza aparte, al paso más cercano.
 */
export function softQuantize(now: number, origin: number, stepSec: number, maxAhead = SOFT_AHEAD): number {
  if (!(stepSec > 0) || !Number.isFinite(origin)) return now
  const next = origin + Math.ceil((now - origin) / stepSec - 1e-9) * stepSec
  return next - now <= maxAhead ? next : now
}

export class TapTake {
  private events: KeyEvent[] = []
  private lastAt = -Infinity

  /** Apunta un toque; si pasó la pausa larga desde el anterior, esta toma empieza de cero. Devuelve los toques de la toma. */
  add(e: KeyEvent, gap = TAKE_GAP): readonly KeyEvent[] {
    if (e.time - this.lastAt > gap) this.events = []
    this.events.push(e)
    this.lastAt = e.time
    return this.events
  }
  /** los toques de la toma en curso */
  get list(): readonly KeyEvent[] {
    return this.events
  }
  get count(): number {
    return this.events.length
  }
  reset(): void {
    this.events = []
    this.lastAt = -Infinity
  }
}

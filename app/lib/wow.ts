/**
 * El "wowo": el filtro de una célula que respira en cada vuelta (spec 008, §9). `Cell.lpf` da un valor por vuelta
 * (un compás); el wowo le pone resonancia y hace que el filtro **se abra en cada golpe**, y vuelva al valor de la
 * vuelta con una envolvente (`lpenv`). Las cifras están copiadas de las variantes de sonido ya afinadas de oído
 * (spec 002, §17, `melodyVariants.ts`: el lead "c" es el acid y el "b" el supersaw del house). Puro: sin wowo no
 * cambia ningún código.
 */
export interface Wow {
  /** cuánto se abre el filtro en cada golpe (`lpenv`): el 1 abre una octava */
  depth: number
  /** resonancia del filtro (`lpq`): lo que hace el "wowo" */
  q: number
  /** ataque y caída de la envolvente, en segundos (`lpa`, `lpd`) */
  attack: number
  decay: number
}

export const WOW_LIMITS = {
  depth: [0.5, 5],
  q: [0, 20],
  attack: [0.001, 0.5],
  decay: [0.01, 2],
} as const satisfies Record<keyof Wow, readonly [number, number]>

/** Presets de oído: `acid` (el lead "c": lpq 8, lpenv 3), `breathe` (el pad "c": lpenv 1,5) y `house` (el lead "b"). */
export const WOW_PRESETS: Record<'acid' | 'breathe' | 'house', Wow> = {
  acid: { depth: 3, q: 8, attack: 0.005, decay: 0.15 },
  breathe: { depth: 1.5, q: 4, attack: 0.3, decay: 0.8 },
  house: { depth: 2.5, q: 6, attack: 0.005, decay: 0.18 },
}

/** Lo que recibe el motor: los cuatro controles de superdough que son del wowo (el filtro se queda en el `lpf`). */
export const WOW_KEYS = ['lpq', 'lpenv', 'lpa', 'lpd'] as const

const inRange = (v: unknown, [lo, hi]: readonly [number, number]): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi

/** true si es un wowo válido: los cuatro números, en rango (lo que se guarda y lo que se lee). */
export function isWow(x: unknown): x is Wow {
  if (typeof x !== 'object' || x === null) return false
  const w = x as Record<string, unknown>
  return inRange(w.depth, WOW_LIMITS.depth) && inRange(w.q, WOW_LIMITS.q) && inRange(w.attack, WOW_LIMITS.attack) && inRange(w.decay, WOW_LIMITS.decay)
}

/** Los controles de Strudel de un wowo, acotados y redondeados: `{ lpq, lpenv, lpa, lpd }` (nada leído se escribe tal cual). */
export function wowControls(wow: Wow | undefined): Record<string, number> {
  if (!isWow(wow)) return {}
  const n = (v: number, lim: readonly [number, number], d: number) => {
    const c = Math.min(lim[1], Math.max(lim[0], v))
    return Math.round(c * 10 ** d) / 10 ** d
  }
  return {
    lpq: n(wow.q, WOW_LIMITS.q, 2),
    lpenv: n(wow.depth, WOW_LIMITS.depth, 2),
    lpa: n(wow.attack, WOW_LIMITS.attack, 3),
    lpd: n(wow.decay, WOW_LIMITS.decay, 3),
  }
}

/** El wowo como código de Strudel (`,.lpq(8).lpenv(3).lpa(0.005).lpd(0.15)`), o vacío si no es válido. */
export function wowCode(wow: Wow | undefined): string {
  const c = wowControls(wow)
  return isWow(wow) ? `.lpq(${c.lpq}).lpenv(${c.lpenv}).lpa(${c.lpa}).lpd(${c.lpd})` : ''
}

/**
 * «Zoom infinito» (spec 026): cada parte es una gota y dentro se ve, pequeña, la siguiente; al zambullirse la cámara cae dentro y **la última contiene a la primera**.
 * Geometría pura (sin DOM ni lienzo): radios, partes y opacidad de cada gota según el progreso del zambullido. Quien dibuja (Remixes) solo pinta círculos con esto.
 */

/** la gota de dentro mide esto de la de fuera */
export const NESTED_SCALE = 0.25
/** niveles que se ven a la vez (la que suena y las que van dentro) */
export const MAX_LEVELS = 3
/** opacidad de cada nivel en reposo: la que suena, la siguiente y la siguiente de esa */
export const LEVEL_ALPHA: readonly number[] = [1, 0.45, 0.2]

export interface Ring {
  /** índice de la parte (0..n−1) */
  part: number
  /** nivel continuo: 0 = la que suena, 1 = la siguiente… (negativo = la que se está yendo) */
  level: number
  /** radio en unidades del lienzo */
  r: number
  alpha: number
}

const mod = (a: number, n: number) => ((a % n) + n) % n
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Opacidad de un nivel continuo: de 1 en el nivel 0 a 0 en el último; y de 1 a 0 al irse por fuera (nivel −1). */
export function alphaOfLevel(x: number): number {
  if (x <= -1 || x >= MAX_LEVELS) return 0
  if (x <= 0) return lerp(0, LEVEL_ALPHA[0]!, x + 1)
  const k = Math.min(MAX_LEVELS - 1, Math.floor(x))
  const next = LEVEL_ALPHA[k + 1] ?? 0
  return lerp(LEVEL_ALPHA[k]!, next, x - k)
}

/** Cuántas partes hay que atravesar para ir de `from` a `to` hacia delante (el zoom siempre va hacia dentro; de la última se pasa a la primera). 0 si es la misma. */
export const dives = (from: number, to: number, n: number): number => (n <= 0 ? 0 : mod(to - from, n))

/**
 * Las gotas a pintar con el zambullido en `p` (0 = en reposo; `p` = 1 = la siguiente ya es la grande; admite 2, 3… si se atraviesan varias).
 * `r0` = radio de la gota grande en reposo. Con una sola parte no hay anidado: solo la grande.
 */
export function stackAt(p: number, from: number, n: number, r0: number): Ring[] {
  if (n <= 0) return []
  if (n === 1) return [{ part: 0, level: 0, r: r0, alpha: 1 }]
  const out: Ring[] = []
  const first = Math.floor(p) - 1
  for (let k = first; k <= Math.ceil(p) + MAX_LEVELS; k++) {
    const x = k - p
    const alpha = alphaOfLevel(x)
    if (alpha <= 0.001) continue
    out.push({ part: mod(from + k, n), level: x, r: r0 * NESTED_SCALE ** x, alpha })
  }
  // de la más grande a la más pequeña (así se pintan de fuera hacia dentro)
  return out.sort((a, b) => b.r - a.r)
}

/** Suaviza el arranque y el aterrizaje (el exponente ya da velocidad percibida constante). */
export const easeDive = (t: number): number => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/**
 * Progreso (0..`d`) de un zambullido que **empieza al tocar** (`startS`) y **aterriza en la línea de compás** (`landS`): si falta menos de `minS` para la línea, la imagen
 * se alarga hasta la siguiente (el sonido no: entra en la primera).
 */
export function diveWindow(nowS: number, barSec: number, barPhase: number, minS = 0.3, maxBars = 1): { startS: number; landS: number } {
  const toLine = (1 - barPhase) * barSec
  const wait = toLine < minS ? toLine + barSec : toLine
  return { startS: nowS, landS: nowS + Math.min(wait, maxBars * barSec + barSec) }
}
export function diveProgress(nowS: number, startS: number, landS: number, d: number): number {
  if (landS <= startS) return d
  return d * easeDive((nowS - startS) / (landS - startS))
}

/** Movimiento reducido: sin zoom; fundido entre la gota que se va y la que entra (160 ms). */
export const FADE_S = 0.16
export const reducedFade = (sinceS: number): { out: number; in: number } => {
  const t = Math.min(1, Math.max(0, sinceS / FADE_S))
  return { out: 1 - t, in: t }
}

/**
 * Vigilante mínimo del Laboratorio: según el p95 de las últimas ventanas de frames, cuántos niveles se pintan (3 → 2 → 1) con histéresis para no oscilar.
 * Por encima de 14 ms baja un nivel; por debajo de 8 ms sube uno (como `lib/frameGovernor.ts`).
 */
export const SLOW_MS = 14
export const FAST_MS = 8
export function levelsFor(p95Ms: number, current: number): number {
  if (p95Ms > SLOW_MS) return Math.max(1, current - 1)
  if (p95Ms < FAST_MS) return Math.min(MAX_LEVELS, current + 1)
  return current
}

/** ¿Toca el punto (x, y) la gota pequeña (la siguiente), en reposo? Zona mínima de 44 px **reales** (`scale` = ancho en pantalla / ancho del lienzo). */
export function hitsNext(x: number, y: number, cx: number, cy: number, r0: number, scale: number): boolean {
  const r = Math.max(r0 * NESTED_SCALE, 22 / Math.max(0.1, scale))
  return Math.hypot(x - cx, y - cy) <= r
}

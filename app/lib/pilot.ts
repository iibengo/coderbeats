/**
 * Piloto automático (spec 009 §5): la capa de «humanización». Pura (sin DOM): el guion dice la intención y esto decide el cómo —
 * trayectorias curvas con perfil de velocidad en campana y ley de Fitts, pausas de duración variable, imperfecciones recuperables
 * y semilla (la misma semilla da la misma toma).
 */

/** Generador pseudoaleatorio determinista (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Profile = 'calm' | 'normal' | 'lively'
/** Cuánto escala cada perfil las pausas (más = más lento). */
export const PROFILE_PACE: Record<Profile, number> = { calm: 1.35, normal: 1, lively: 0.7 }

export interface Pt {
  x: number
  y: number
}

/** Duración (s) de un movimiento de `dist` px hasta un blanco de `width` px (ley de Fitts, con tope): más lento y preciso al acercarse a un blanco pequeño. */
export function fittsDuration(dist: number, width: number, pace = 1): number {
  const id = Math.log2(dist / Math.max(8, width) + 1)
  return Math.min(1.6, Math.max(0.18, (0.12 + 0.11 * id) * pace))
}

/** Perfil de posición de mínima sacudida: 0..1 → 0..1, con velocidad en campana (empieza y acaba en reposo). */
export const minJerk = (t: number): number => {
  const u = Math.min(1, Math.max(0, t))
  return u * u * u * (10 - 15 * u + 6 * u * u)
}

export interface Move {
  /** duración total (s) */
  duration: number
  /** posición del dedo en el instante `t` (s) */
  at(t: number): Pt
}

/**
 * La trayectoria de `from` a `to`: una curva (Bézier cuadrática con el punto de control desviado hacia un lado), con perfil de campana y un temblor
 * pequeño que **se apaga al llegar** (acaba exactamente en el blanco). Con `overshoot`, pasa un poco de largo y rectifica (una imperfección recuperable).
 */
export function trajectory(from: Pt, to: Pt, rand: () => number, o: { width?: number; pace?: number; tremor?: number; overshoot?: boolean } = {}): Move {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const duration = fittsDuration(dist, o.width ?? 40, o.pace ?? 1) * (o.overshoot ? 1.25 : 1)
  const side = rand() < 0.5 ? -1 : 1
  const bend = Math.min(0.25, 0.08 + rand() * 0.12) * dist * side
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const nx = dist ? -(to.y - from.y) / dist : 0
  const ny = dist ? (to.x - from.x) / dist : 0
  const c: Pt = { x: mx + nx * bend, y: my + ny * bend }
  const tremor = o.tremor ?? 1.2
  const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28]
  // el punto de paso pasado de largo (si se pide): un 6–10 % más allá del blanco
  const over: Pt = o.overshoot ? { x: to.x + (to.x - from.x) * (0.06 + rand() * 0.04), y: to.y + (to.y - from.y) * (0.06 + rand() * 0.04) } : to
  return {
    duration,
    at(t) {
      const u = duration ? Math.min(1, Math.max(0, t / duration)) : 1
      // con sobrepaso: los primeros 78 % hacia el punto pasado, el resto vuelve al blanco
      let p: Pt
      if (o.overshoot) {
        const k = 0.78
        if (u < k) p = quad(from, c, over, minJerk(u / k))
        else {
          const q = minJerk((u - k) / (1 - k))
          p = { x: over.x + (to.x - over.x) * q, y: over.y + (to.y - over.y) * q }
        }
      } else p = quad(from, c, to, minJerk(u))
      // temblor: máximo a mitad del camino, cero al principio y al final
      const k = Math.sin(Math.PI * u) * tremor
      return { x: p.x + k * (Math.sin(ph[0]! + t * 31) + 0.5 * Math.sin(ph[1]! + t * 57)), y: p.y + k * (Math.sin(ph[2]! + t * 37) + 0.5 * Math.sin(ph[3]! + t * 61)) }
    },
  }
}

const quad = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
})

export type PauseKind = 'between' | 'section' | 'hover'
const PAUSE: Record<PauseKind, readonly [number, number]> = { between: [0.25, 0.9], section: [0.8, 1.8], hover: [0.08, 0.3] }

/** Una pausa (s) de duración variable (log-normal acotada); las de cambio de sección son más largas; el perfil la escala. */
export function pause(kind: PauseKind, rand: () => number, profile: Profile = 'normal'): number {
  const [lo, hi] = PAUSE[kind]
  // log-normal por Box–Muller, recortada a [lo, hi]
  const g = Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand())
  const mid = Math.sqrt(lo * hi)
  const v = mid * Math.exp(0.35 * g)
  return Math.min(hi, Math.max(lo, v)) * PROFILE_PACE[profile]
}

export interface Imperfections {
  /** desvío (px) del toque respecto al blanco (que el imán corrige), o null */
  offset: Pt | null
  /** el camino pasa de largo y rectifica */
  overshoot: boolean
  /** duda sobre el sitio antes de tocar (s), o 0 */
  hesitate: number
}

/**
 * Las imperfecciones de un gesto (con probabilidad baja y semilla). **Siempre son recuperables**: el desvío es de menos de 0,6 de la tolerancia del blanco
 * (`tolerance` px, la del imán), así que el resultado final es el del guion; nunca cambian la canción.
 */
export function imperfections(rand: () => number, tolerance: number, profile: Profile = 'normal'): Imperfections {
  const amp = profile === 'lively' ? 0.6 : 1
  const offset = rand() < 0.12 * amp ? { x: (rand() * 2 - 1) * 0.6 * tolerance, y: (rand() * 2 - 1) * 0.6 * tolerance } : null
  return { offset, overshoot: rand() < 0.1 * amp, hesitate: rand() < 0.18 * amp ? pause('hover', rand, profile) : 0 }
}

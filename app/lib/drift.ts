/**
 * Deriva de los loops sobre el agua (capa común de §16.14): movimiento lento, determinista,
 * que no se sale de la pantalla, que se aparta de las zonas reservadas (anillo, Play) y en el
 * que los loops no se solapan.
 */

export interface Body {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  /** radio en px */
  r: number
}

export interface Zone {
  x: number
  y: number
  r: number
}

/** Órbita alrededor del anillo: los loops flotan en la banda [r, r + band] desde (x, y). */
export interface Orbit {
  x: number
  y: number
  r: number
  band: number
}

export interface DriftBounds {
  w: number
  h: number
  /** margen a los bordes */
  margin: number
  /** zonas a evitar (anillo de compás, botón Play…) */
  avoid: Zone[]
  /** si existe, los loops flotan alrededor del anillo (§16.18) en lugar de por toda la pantalla */
  orbit?: Orbit
}

const WANDER = 6 // px/s² de empuje aleatorio suave
const DAMPING = 0.9 // por segundo (fracción de velocidad que queda)
const MAX_SPEED = 18 // px/s
const GAP = 14 // px de separación entre loops
const ORBIT_SPIN = 3 // px/s² tangencial: giran despacio alrededor del anillo

/** Ruido determinista suave por id (sumas de senos). */
function wander(id: number, t: number): [number, number] {
  const a = id * 12.9898
  return [
    Math.sin(t * 0.37 + a) + 0.5 * Math.sin(t * 0.91 + a * 1.7),
    Math.cos(t * 0.29 + a * 0.6) + 0.5 * Math.cos(t * 0.83 + a * 2.3),
  ]
}

/** Un paso de simulación de `dt` segundos en el instante `t`. Devuelve cuerpos nuevos. */
export function stepDrift(bodies: Body[], dt: number, t: number, b: DriftBounds): Body[] {
  const out = bodies.map((p) => ({ ...p }))
  for (const p of out) {
    const [wx, wy] = wander(p.id, t)
    let ax = wx * WANDER
    let ay = wy * WANDER
    // bordes: muelle suave hacia dentro
    const left = b.margin + p.r
    const right = b.w - b.margin - p.r
    const top = b.margin + p.r
    const bottom = b.h - b.margin - p.r
    if (p.x < left) ax += (left - p.x) * 4
    if (p.x > right) ax -= (p.x - right) * 4
    if (p.y < top) ay += (top - p.y) * 4
    if (p.y > bottom) ay -= (p.y - bottom) * 4
    // zonas reservadas y otros loops: repulsión
    const push = (zx: number, zy: number, minDist: number, k: number) => {
      const dx = p.x - zx
      const dy = p.y - zy
      const d = Math.hypot(dx, dy) || 0.001
      if (d < minDist) {
        ax += (dx / d) * (minDist - d) * k
        ay += (dy / d) * (minDist - d) * k
      }
    }
    for (const z of b.avoid) push(z.x, z.y, z.r + p.r, 6)
    // órbita: muelle hacia la banda alrededor del anillo y un giro lento
    if (b.orbit) {
      const o = b.orbit
      const dx = p.x - o.x
      const dy = p.y - o.y
      const d = Math.hypot(dx, dy) || 0.001
      if (d < o.r) {
        ax += (dx / d) * (o.r - d) * 3
        ay += (dy / d) * (o.r - d) * 3
      } else if (d > o.r + o.band) {
        ax -= (dx / d) * (d - o.r - o.band) * 3
        ay -= (dy / d) * (d - o.r - o.band) * 3
      }
      ax += (-dy / d) * ORBIT_SPIN
      ay += (dx / d) * ORBIT_SPIN
    }
    for (const q of out) if (q !== p) push(q.x, q.y, p.r + q.r + GAP, 5)
    const damp = DAMPING ** dt
    p.vx = (p.vx + ax * dt) * damp
    p.vy = (p.vy + ay * dt) * damp
    // lejos de su banda (p. ej. loops restaurados), vuelven deprisa; dentro, deriva lenta
    const far = b.orbit ? Math.abs(Math.hypot(p.x - b.orbit.x, p.y - b.orbit.y) - b.orbit.r - b.orbit.band / 2) > b.orbit.band : false
    const cap = far ? MAX_SPEED * 4 : MAX_SPEED
    const sp = Math.hypot(p.vx, p.vy)
    if (sp > cap) {
      p.vx = (p.vx / sp) * cap
      p.vy = (p.vy / sp) * cap
    }
  }
  for (const p of out) {
    p.x += p.vx * dt
    p.y += p.vy * dt
  }
  return out
}

/**
 * Sitio donde cae un loop nuevo: el punto (de una rejilla de candidatos) más alejado de los
 * loops existentes y de las zonas reservadas, dentro de los márgenes.
 */
export function spawnPoint(bodies: Pick<Body, 'x' | 'y' | 'r'>[], b: DriftBounds, r: number): { x: number; y: number } {
  const score = (x: number, y: number) => {
    let s = Infinity
    for (const q of bodies) s = Math.min(s, Math.hypot(x - q.x, y - q.y) - q.r - r)
    for (const z of b.avoid) s = Math.min(s, Math.hypot(x - z.x, y - z.y) - z.r - r)
    return s
  }
  const inside = (x: number, y: number) =>
    x >= b.margin + r && x <= b.w - b.margin - r && y >= b.margin + r && y <= b.h - b.margin - r
  // con órbita: el mejor punto de la circunferencia media de la banda que quepa en pantalla
  if (b.orbit) {
    const o = b.orbit
    let best: { x: number; y: number } | null = null
    let bestScore = -Infinity
    for (const rr of [o.r + o.band / 2, o.r + o.band * 0.15, o.r + o.band * 0.85])
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2
        const x = o.x + Math.cos(a) * rr
        const y = o.y + Math.sin(a) * rr
        if (!inside(x, y)) continue
        const sc = score(x, y)
        if (sc > bestScore) {
          bestScore = sc
          best = { x, y }
        }
      }
    if (best && bestScore > 0) return best
  }
  let best = { x: b.w / 2, y: b.h / 2 }
  let bestScore = -Infinity
  const cols = 9
  const rows = 13
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const x = b.margin + r + ((b.w - 2 * (b.margin + r)) * (i + 0.5)) / cols
      const y = b.margin + r + ((b.h - 2 * (b.margin + r)) * (j + 0.5)) / rows
      const sc = score(x, y)
      if (sc > bestScore) {
        bestScore = sc
        best = { x, y }
      }
    }
  return best
}

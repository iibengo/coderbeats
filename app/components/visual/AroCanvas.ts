/**
 * Dibujo del aro en Canvas 2D (spec 003, fases 1 y 2): la gota, sus franjas, la aguja, los golpes
 * (puntos; el bajo, rayitas) y lo que pasa al sonar: una onda pequeña en el golpe y un arco fino
 * que corre por su franja, y en el bombo un latido desde el centro que empuja el borde.
 * Solo dibuja; no toca el audio ni el estado. La interacción llega en la fase 3.
 */
import { bandLayout, bandMid, BAND_ORDER, type Layout, type Weights } from '~/lib/aro/bands'
import { BREATH, bumpAt, bumpEnvelope, INNER_WOBBLE, outerRadius, radiusAt, stepAngle, TAU, type Bump, type DropGeo } from '~/lib/aro/shape'
import { INK, VOICE_RGB_CSS, type Voice } from '~/lib/palette'

export interface AroDot {
  key: string
  /** loop al que pertenece; −1 = el bajo del fondo */
  loopId: number
  /** paso dentro del compás, 0..16 (decimal sin ayuda) */
  step: number
  voice: Voice
  muted: boolean
}

export interface AroFrame {
  /** segundos de reloj de pared (para la respiración) */
  wall: number
  geo: DropGeo
  weights: Weights
  playing: boolean
  /** fase del compás que se oye, 0..1 */
  phase: number
  dots: AroDot[]
  phraseDots: { key: string; step: number; voice: Voice }[]
  /** loop resaltado (al tocar su bola) */
  highlight: number | null
  /** compás que suena del loop más largo, si hay loops de más de un compás */
  bars: { current: number; total: number } | null
  reduced: boolean
}

/** radio del punto en reposo por voz (px) */
const DOT_R: Record<Voice, number> = { bd: 5, bass: 4, sd: 4.5, mel: 3.6, hh: 4 }
/** duración del encendido al sonar (s) */
const FLASH_TAU = 0.18
/** vida de la onda y el arco por voz (s); el platillo, la más corta; el bajo, la más lenta */
const WAVE_LIFE: Record<Voice, number> = { bd: 0.9, bass: 1.4, sd: 0.9, mel: 0.8, hh: 0.45 }
/** hasta dónde corre el arco por su franja (rad, a cada lado) */
const WAVE_SPREAD: Record<Voice, number> = { bd: 1.05, bass: 1.5, sd: 1.05, mel: 1.05, hh: 0.45 }
/** latido del bombo: el anillo rosa desde el centro, el empujón del borde y el centro */
const KICK_RING_S = 1.2
const KICK_BUMP_S = 0.7
const KICK_BUMP_PX = 9
const KICK_CORE_S = 0.6
const MAX_WAVES = 32

interface Wave {
  voice: Voice
  th: number
  born: number
}

export class AroCanvas {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  /** 1 = detalle completo; 0,5 = menos ángulos y bordes interiores lisos (vigilante de frames) */
  private detail = 1
  private flashes = new Map<string, number>()
  private waves: Wave[] = []
  private bumps: (Bump & { a0: number; born: number })[] = []
  private kick = -1e9
  private reduced = false
  private last: { geo: DropGeo; layout: Layout; t: number; dots: AroDot[] } | null = null
  /** radio exterior muestreado en cada frame (con los empujones); lo usan franjas, golpes y ondas */
  private ro = new Float32Array(0)
  private wob = INNER_WOBBLE

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('sin Canvas 2D')
    this.ctx = ctx
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w
    this.h = h
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  setDetail(d: number) {
    this.detail = Math.max(0.5, Math.min(1, d))
  }

  /** Suena el golpe de un loop en un paso: se enciende y suelta su onda. Devuelve su posición. */
  light(loopId: number, step: number): { x: number; y: number } | null {
    const d = this.last?.dots.find((p) => p.loopId === loopId && stepDist(p.step, step) < 0.5)
    if (!d) return null
    this.sound(d)
    return this.pointOf(d.voice, d.step)
  }

  /** Suena una voz sin loop (el bajo del fondo) en un paso. */
  lightVoice(voice: Voice, step: number) {
    const d = this.last?.dots.find((p) => p.voice === voice && stepDist(p.step, step) < 0.5)
    if (d) this.sound(d)
  }

  private sound(d: AroDot) {
    const now = performance.now() / 1000
    this.flashes.set(d.key, now)
    if (this.reduced) return // sin ondas ni latido (E1.7): solo se enciende
    const th = stepAngle(d.step)
    if (this.waves.length >= MAX_WAVES) this.waves.shift()
    this.waves.push({ voice: d.voice, th, born: now })
    if (d.voice === 'bd') {
      this.kick = now
      this.bumps.push({ th, a: 0, a0: KICK_BUMP_PX, born: now })
    }
  }

  /** Posición (px CSS) de un paso en el centro de la franja de una voz. */
  pointOf(voice: Voice, step: number): { x: number; y: number } {
    const L = this.last
    if (!L) return { x: this.w / 2, y: this.h / 2 }
    const [x, y] = this.at(stepAngle(step), bandMid(voice, L.layout))
    return { x, y }
  }

  /** radio exterior en `th`, interpolado de la muestra del frame */
  private roAt(th: number): number {
    const n = this.ro.length
    if (!n) return 0
    const f = ((((th / TAU) * n) % n) + n) % n
    const k = Math.floor(f)
    const a = this.ro[k]!
    const b = this.ro[(k + 1) % n]!
    return a + (b - a) * (f - k)
  }

  private at(th: number, u: number, wobble = this.wob): [number, number] {
    const L = this.last!
    const r = radiusAt(th, u, this.roAt(th), L.geo.core, L.t, wobble)
    return [L.geo.cx + Math.cos(th) * r, L.geo.cy + Math.sin(th) * r]
  }

  /** contorno cerrado de radio `u` (al revés para recortar el hueco de una franja) */
  private loopPath(p: Path2D, u: number, reverse: boolean) {
    const L = this.last!
    const n = this.ro.length
    for (let i = 0; i <= n; i++) {
      const k = reverse ? (n - (i % n)) % n : i % n
      const th = (k / n) * TAU
      const r = radiusAt(th, u, this.ro[k]!, L.geo.core, L.t, this.wob)
      const px = L.geo.cx + Math.cos(th) * r
      const py = L.geo.cy + Math.sin(th) * r
      if (i === 0) p.moveTo(px, py)
      else p.lineTo(px, py)
    }
    p.closePath()
  }

  private arcPath(u: number, a0: number, a1: number) {
    const x = this.ctx
    const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * 16))
    for (let k = 0; k <= n; k++) {
      const [px, py] = this.at(a0 + ((a1 - a0) * k) / n, u)
      if (k === 0) x.moveTo(px, py)
      else x.lineTo(px, py)
    }
  }

  draw(f: AroFrame) {
    const x = this.ctx
    const { geo } = f
    this.reduced = f.reduced
    const t = f.reduced ? 0 : f.wall
    const breath = f.reduced ? 0 : BREATH
    this.wob = f.reduced ? INNER_WOBBLE * 0.6 : this.detail < 0.75 ? 0 : INNER_WOBBLE // quieta, pero imperfecta
    const layout = bandLayout(f.weights)
    this.last = { geo, layout, t, dots: f.dots }
    const now = performance.now() / 1000
    x.clearRect(0, 0, this.w, this.h)

    // empujones del borde (latido del bombo)
    this.bumps = this.bumps.filter((b) => now - b.born < KICK_BUMP_S)
    for (const b of this.bumps) b.a = b.a0 * bumpEnvelope((now - b.born) / KICK_BUMP_S)

    // radio exterior en N ángulos, una vez por frame
    const n = this.detail < 0.75 ? 72 : 120
    if (this.ro.length !== n) this.ro = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      const th = (k / n) * TAU
      this.ro[k] = outerRadius(th, geo, t, breath, this.bumps.length ? bumpAt(th, this.bumps) : 0)
    }

    // latido del bombo: un anillo rosa muy suave sale del centro (detrás de las franjas)
    const kp = (now - this.kick) / KICK_RING_S
    if (kp >= 0 && kp < 1) {
      const e = 1 - (1 - kp) ** 3
      const p = new Path2D()
      this.loopPath(p, Math.min(1.1, e * 1.15), false)
      x.strokeStyle = `rgba(${VOICE_RGB_CSS.bd},${(1 - kp) * 0.1})`
      x.lineWidth = 7 * (1 - kp) + 1
      x.stroke(p)
    }

    // franjas: relleno muy tenue y borde fino exterior; su contorno sirve para recortar las ondas
    const ringPath = {} as Record<Voice, Path2D>
    for (const v of BAND_ORDER) {
      const wt = f.weights[v]
      if (wt < 0.03) continue
      const { a, b } = layout[v]
      const col = VOICE_RGB_CSS[v]
      const outer = new Path2D()
      this.loopPath(outer, b, false)
      const ring = new Path2D(outer)
      this.loopPath(ring, a, true)
      ringPath[v] = ring
      x.fillStyle = `rgba(${col},${0.035 * wt})`
      x.fill(ring)
      x.strokeStyle = `rgba(${col},${0.24 * wt})`
      x.lineWidth = 1
      x.stroke(outer)
    }

    // ondas: una pequeña en el golpe y un arco que corre por su franja; no salen de ella
    this.waves = this.waves.filter((w) => now - w.born < WAVE_LIFE[w.voice] && f.weights[w.voice] >= 0.05)
    for (const w of this.waves) {
      const ring = ringPath[w.voice]
      if (!ring) continue
      const p = (now - w.born) / WAVE_LIFE[w.voice]
      const e = 1 - (1 - p) ** 3
      const al = (1 - p) * f.weights[w.voice]
      const { a, b } = layout[w.voice]
      const mid = (a + b) / 2
      const sp = e * WAVE_SPREAD[w.voice]
      const col = VOICE_RGB_CSS[w.voice]
      x.save()
      x.clip(ring)
      if (w.voice === 'hh') x.setLineDash([2, 4])
      x.strokeStyle = `rgba(${col},${al * 0.9})`
      x.lineWidth = w.voice === 'bd' ? 2.5 + 4 * (1 - p) : w.voice === 'hh' ? 1.2 : 1.8
      x.beginPath()
      this.arcPath(mid, w.th - sp, w.th + sp)
      x.stroke()
      x.setLineDash([])
      const [ox, oy] = this.at(w.th, mid)
      const bw = (this.roAt(w.th) - geo.core) * (b - a)
      x.lineWidth = 1
      x.strokeStyle = `rgba(${col},${al * 0.55})`
      x.beginPath()
      x.arc(ox, oy, 4 + e * bw * 0.9, 0, TAU)
      x.stroke()
      if (w.voice === 'bass') {
        // brillo suave en la franja
        x.fillStyle = `rgba(${col},${al * 0.08})`
        x.beginPath()
        this.arcPath(b, w.th - sp, w.th + sp)
        const m = 20
        for (let k = 0; k <= m; k++) {
          const [px, py] = this.at(w.th + sp - (2 * sp * k) / m, a)
          x.lineTo(px, py)
        }
        x.closePath()
        x.fill()
      }
      x.restore()
    }

    // golpes: puntos; el bajo, rayitas
    const head = stepAngle(f.phase * 16)
    for (const d of f.dots) {
      const wt = f.weights[d.voice]
      if (wt < 0.05) continue
      const th = stepAngle(d.step)
      const [px, py] = this.at(th, bandMid(d.voice, layout))
      const dd = f.playing ? Math.abs(((th - head + Math.PI * 3) % TAU) - Math.PI) : Math.PI
      const near = f.reduced ? 0 : Math.exp(-dd * dd * 30)
      const since = now - (this.flashes.get(d.key) ?? -1e9)
      const fl = since >= 0 ? Math.exp(-since / FLASH_TAU) : 0
      const hl = f.highlight === d.loopId
      const faded = f.highlight !== null && !hl
      const grow = f.reduced ? 0 : near * 2 + fl * 1.5
      const r = (DOT_R[d.voice] + grow) * (hl ? 1.45 : 1) * wt
      const col = VOICE_RGB_CSS[d.voice]
      const alpha = (0.55 + Math.max(near, fl) * 0.45) * (faded ? 0.25 : 1)
      if (d.voice === 'bass') {
        x.save()
        x.translate(px, py)
        x.rotate(th) // radial, como en el boceto
        x.fillStyle = `rgba(${col},${d.muted ? alpha * 0.4 : alpha})`
        x.fillRect(-r * 1.5, -r / 2, r * 3, r)
        x.restore()
        continue
      }
      x.beginPath()
      x.arc(px, py, r, 0, TAU)
      if (d.muted) {
        x.strokeStyle = `rgba(${col},${0.5 * (faded ? 0.25 : 1)})`
        x.lineWidth = 1.2
        x.stroke()
      } else {
        x.fillStyle = `rgba(${col},${alpha})`
        x.fill()
      }
      if (hl) {
        x.strokeStyle = 'rgba(255,255,255,0.9)'
        x.lineWidth = 1.5
        x.beginPath()
        x.arc(px, py, r + 3, 0, TAU)
        x.stroke()
      }
    }
    for (const [k, at] of this.flashes) if (now - at > FLASH_TAU * 6) this.flashes.delete(k)

    // frase en curso: al instante, más grandes
    for (const d of f.phraseDots) {
      const [px, py] = this.at(stepAngle(d.step), bandMid(d.voice, layout))
      x.fillStyle = `rgba(${VOICE_RGB_CSS[d.voice]},1)`
      x.beginPath()
      x.arc(px, py, DOT_R[d.voice] + 2, 0, TAU)
      x.fill()
    }

    // aguja: del centro al borde
    if (f.playing) {
      const [ix, iy] = this.at(head, 0, 0)
      const [hx, hy] = this.at(head, 1, 0)
      x.strokeStyle = 'rgba(255,255,255,0.22)'
      x.lineWidth = 1
      x.beginPath()
      x.moveTo(ix, iy)
      x.lineTo(hx, hy)
      x.stroke()
    }

    // centro: hueco oscuro irregular con borde fino y el punto rosa; late con el bombo
    const kk = f.reduced ? 0 : Math.max(0, 1 - (now - this.kick) / KICK_CORE_S)
    x.fillStyle = INK
    x.beginPath()
    const m = 48
    for (let k = 0; k <= m; k++) {
      const th = (k / m) * TAU
      const r = geo.core - 3 + kk * 3 + (f.reduced ? 0.7 : 1.2) * Math.sin(th * 3 + t * 0.7 + 9)
      const px = geo.cx + Math.cos(th) * r
      const py = geo.cy + Math.sin(th) * r
      if (k === 0) x.moveTo(px, py)
      else x.lineTo(px, py)
    }
    x.closePath()
    x.fill()
    x.strokeStyle = 'rgba(255,255,255,0.8)'
    x.lineWidth = 1.2
    x.stroke()
    x.fillStyle = `rgba(${VOICE_RGB_CSS.bd},1)`
    x.beginPath()
    x.arc(geo.cx, geo.cy, 3 + kk * 4, 0, TAU)
    x.fill()

    // compás del loop largo (1..4): puntitos bajo el centro
    if (f.bars && f.bars.total > 1) {
      const gap = 5
      const x0 = geo.cx - ((f.bars.total - 1) * gap) / 2
      for (let i = 0; i < f.bars.total; i++) {
        x.fillStyle = i === f.bars.current ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)'
        x.beginPath()
        x.arc(x0 + i * gap, geo.cy + 11, 1.3, 0, TAU)
        x.fill()
      }
    }
  }
}

/** Distancia circular entre dos pasos de un compás de 16. */
export const stepDist = (a: number, b: number): number => {
  const d = (((a - b) % 16) + 16) % 16
  return Math.min(d, 16 - d)
}

/**
 * Dibujo del aro en Canvas 2D (spec 003, fase 1): la gota, sus franjas, la aguja y los golpes como
 * puntos simples. Solo dibuja; no toca el audio ni el estado. Las ondas, el latido y la
 * interacción llegan en las fases 2 y 3.
 */
import { bandLayout, bandMid, BAND_ORDER, type Layout, type Weights } from '~/lib/aro/bands'
import { BREATH, INNER_WOBBLE, outerRadius, radiusAt, stepAngle, TAU, type DropGeo } from '~/lib/aro/shape'
import { INK, VOICE_RGB_CSS, type Voice } from '~/lib/palette'

export interface AroDot {
  key: string
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

export class AroCanvas {
  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  /** 1 = detalle completo; 0,5 = menos ángulos y bordes interiores lisos (vigilante de frames) */
  private detail = 1
  private flashes = new Map<string, number>()
  private last: { geo: DropGeo; layout: Layout; t: number; breath: number; dots: AroDot[] } | null = null
  // radio exterior muestreado en cada frame (se reutiliza en todas las franjas)
  private ro = new Float32Array(0)

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

  getDetail() {
    return this.detail
  }

  /** Enciende el punto de un loop en un paso. Devuelve su posición (px CSS) o null. */
  light(loopId: number, step: number): { x: number; y: number } | null {
    const L = this.last
    if (!L) return null
    const d = L.dots.find((p) => p.loopId === loopId && stepDist(p.step, step) < 0.5)
    if (!d) return null
    this.flashes.set(d.key, performance.now() / 1000)
    return this.pointOf(d.voice, d.step)
  }

  /** Posición (px CSS) de un paso en el centro de la franja de una voz. */
  pointOf(voice: Voice, step: number): { x: number; y: number } {
    const L = this.last
    if (!L) return { x: this.w / 2, y: this.h / 2 }
    const [x, y] = this.at(stepAngle(step), bandMid(voice, L.layout), L)
    return { x, y }
  }

  private at(th: number, u: number, L: { geo: DropGeo; t: number; breath: number }, wobble = this.wobble()): [number, number] {
    const ro = outerRadius(th, L.geo, L.t, L.breath)
    const r = radiusAt(th, u, ro, L.geo.core, L.t, wobble)
    return [L.geo.cx + Math.cos(th) * r, L.geo.cy + Math.sin(th) * r]
  }

  private wobble() {
    return this.detail < 0.75 ? 0 : INNER_WOBBLE
  }

  draw(f: AroFrame) {
    const x = this.ctx
    const { geo } = f
    const t = f.reduced ? 0 : f.wall
    const breath = f.reduced ? 0 : BREATH
    const wobble = f.reduced ? INNER_WOBBLE * 0.6 : this.wobble() // quieta, pero sigue siendo imperfecta
    const layout = bandLayout(f.weights)
    this.last = { geo, layout, t, breath, dots: f.dots }
    x.clearRect(0, 0, this.w, this.h)

    // radio exterior en N ángulos, una vez por frame
    const n = this.detail < 0.75 ? 72 : 120
    if (this.ro.length !== n) this.ro = new Float32Array(n)
    for (let k = 0; k < n; k++) this.ro[k] = outerRadius((k / n) * TAU, geo, t, breath)

    const loop = (u: number, reverse: boolean) => {
      for (let i = 0; i <= n; i++) {
        const k = reverse ? (n - (i % n)) % n : i % n
        const th = (k / n) * TAU
        const r = radiusAt(th, u, this.ro[k]!, geo.core, t, wobble)
        const px = geo.cx + Math.cos(th) * r
        const py = geo.cy + Math.sin(th) * r
        if (i === 0) x.moveTo(px, py)
        else x.lineTo(px, py)
      }
      x.closePath()
    }

    // franjas: relleno muy tenue y borde fino exterior
    for (const v of BAND_ORDER) {
      const wt = f.weights[v]
      if (wt < 0.03) continue
      const { a, b } = layout[v]
      const col = VOICE_RGB_CSS[v]
      x.fillStyle = `rgba(${col},${0.035 * wt})`
      x.beginPath()
      loop(b, false)
      loop(a, true)
      x.fill()
      x.strokeStyle = `rgba(${col},${0.24 * wt})`
      x.lineWidth = 1
      x.beginPath()
      loop(b, false)
      x.stroke()
    }

    // golpes
    const head = stepAngle(f.phase * 16)
    const now = performance.now() / 1000
    const L = { geo, t, breath }
    for (const d of f.dots) {
      const wt = f.weights[d.voice]
      if (wt < 0.05) continue
      const th = stepAngle(d.step)
      const [px, py] = this.at(th, bandMid(d.voice, layout), L, wobble)
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
    for (const fl of [...this.flashes]) if (now - fl[1] > FLASH_TAU * 6) this.flashes.delete(fl[0])

    // frase en curso: al instante, más grandes
    for (const d of f.phraseDots) {
      const [px, py] = this.at(stepAngle(d.step), bandMid(d.voice, layout), L, wobble)
      x.fillStyle = `rgba(${VOICE_RGB_CSS[d.voice]},1)`
      x.beginPath()
      x.arc(px, py, DOT_R[d.voice] + 2, 0, TAU)
      x.fill()
    }

    // aguja: del centro al borde
    if (f.playing) {
      const [ix, iy] = this.at(head, 0, L, 0)
      const [hx, hy] = this.at(head, 1, L, 0)
      x.strokeStyle = 'rgba(255,255,255,0.22)'
      x.lineWidth = 1
      x.beginPath()
      x.moveTo(ix, iy)
      x.lineTo(hx, hy)
      x.stroke()
    }

    // centro: hueco oscuro irregular con borde fino y el punto rosa
    x.fillStyle = INK
    x.beginPath()
    const m = 48
    for (let k = 0; k <= m; k++) {
      const th = (k / m) * TAU
      const r = geo.core - 3 + (f.reduced ? 0.7 : 1.2) * Math.sin(th * 3 + t * 0.7 + 9)
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
    x.arc(geo.cx, geo.cy, 3, 0, TAU)
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

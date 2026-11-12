import { INSTRUMENT_RGB, type VisualFrame, type VisualTheme } from '../types'

interface Ring {
  x: number
  y: number
  rgb: [number, number, number]
  born: number
  amp: number
  speed: number
  life: number
}

/**
 * Respaldo del agua en Canvas 2D: anillos que se expanden y se cruzan (§16.16).
 * Con reducedMotion no hay anillos: solo un leve latido de opacidad en el centro con cada tiempo.
 */
export function createWaterCanvas2D(): VisualTheme {
  let ctx: CanvasRenderingContext2D | null = null
  let el: HTMLCanvasElement | null = null
  let w = 0
  let h = 0
  let dpr = 1
  let reduced = false
  let rings: Ring[] = []
  let glow = { x: 0, y: 0, amp: 0, born: 0 }
  const now = () => performance.now() / 1000

  const add = (r: Omit<Ring, 'born'>) => {
    if (reduced) return
    rings.push({ ...r, born: now() })
    if (rings.length > 120) rings.shift()
  }

  return {
    id: 'water',
    label: 'Agua',
    renderer: () => (reduced ? 'canvas2d-reducido' : 'canvas2d'),
    mount(canvas, opts) {
      el = canvas
      ctx = canvas.getContext('2d')
      dpr = opts.dpr
      reduced = opts.reducedMotion
    },
    resize(width, height, d) {
      w = width
      h = height
      dpr = d
      if (el) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
    },
    beat(e) {
      glow = { x: e.x, y: e.y, amp: e.downbeat ? 0.16 : 0.07, born: now() }
      add({ x: e.x, y: e.y, rgb: [1, 1, 1], amp: e.downbeat ? 0.5 : 0.18, speed: 140, life: e.downbeat ? 2.2 : 1.4 })
    },
    hit(e) {
      const rgb = INSTRUMENT_RGB[e.instrument]
      if (e.kind === 'heard') add({ x: e.x, y: e.y, rgb, amp: 0.35, speed: 70, life: 0.9 })
      else {
        const w = ({ bd: 1, sd: 0.75, hh: 0.5 } as Record<string, number>)[e.instrument] ?? 0.4
        add({ x: e.x, y: e.y, rgb, amp: 0.9 * w * e.strength, speed: 90 + 50 * w, life: 1.2 + 0.8 * w })
      }
    },
    birth(e) {
      const rgb = INSTRUMENT_RGB[e.instrument]
      add({ x: e.x, y: e.y, rgb, amp: 1, speed: 160, life: 2.6 })
      add({ x: e.x, y: e.y, rgb, amp: 0.6, speed: 90, life: 2.2 })
    },
    frame(_f: VisualFrame) {
      if (!ctx) return
      const c = ctx
      const t = now()
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.globalCompositeOperation = 'source-over'
      c.fillStyle = '#0B0B0F'
      c.fillRect(0, 0, w, h)
      const ga = glow.amp * Math.max(0, 1 - (t - glow.born) / 0.5)
      if (ga > 0.001) {
        const g = c.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, Math.min(w, h) * 0.45)
        g.addColorStop(0, `rgba(255,255,255,${ga})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        c.fillStyle = g
        c.fillRect(0, 0, w, h)
      }
      c.globalCompositeOperation = 'lighter'
      rings = rings.filter((r) => t - r.born < r.life)
      for (const r of rings) {
        const age = t - r.born
        const k = 1 - age / r.life
        const [cr, cg, cb] = r.rgb
        c.strokeStyle = `rgba(${(cr * 255) | 0},${(cg * 255) | 0},${(cb * 255) | 0},${r.amp * k * k})`
        c.lineWidth = 1.5
        c.beginPath()
        c.arc(r.x, r.y, 4 + r.speed * age, 0, Math.PI * 2)
        c.stroke()
      }
    },
    dispose() {
      ctx = null
      rings = []
    },
  }
}

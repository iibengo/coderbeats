/**
 * Dibujo del aro en Canvas 2D (spec 003, fases 1–3): la gota, sus franjas, la aguja, los golpes
 * (puntos; el bajo, rayitas) y lo que pasa al sonar: una onda pequeña en el golpe y un arco fino
 * que corre por su franja, y en el bombo un latido desde el centro que empuja el borde.
 * Para el tacto: elegir el golpe bajo el dedo, dibujarlo mientras se arrastra, el muelle con rebote
 * al soltarlo, la aparición de un golpe nuevo y la salpicadura al borrarlo.
 * Solo dibuja; no toca el audio ni el estado.
 */
import { bandAt, bandLayout, bandMid, BAND_ORDER, type Layout, type Weights } from '~/lib/aro/bands'
import {
  angleStep,
  BREATH,
  noteArc,
  bumpAt,
  bumpEnvelope,
  INNER_WOBBLE,
  noise,
  outerRadius,
  radiusAt,
  stepAngle,
  TAU,
  type Bump,
  type DropGeo,
} from '~/lib/aro/shape'
import { ghostTarget, type GuideOptions, type GuideSpot } from '~/lib/aro/guide'
import { quadAt, threadBend, threadControl } from '~/lib/aro/colony'
import { bridgeHalfWidth } from '~/lib/aro/transition'
import { FRONT, toFront, toScreen, type AroView } from '~/lib/aro/view'
import { INK, VOICE_RGB_CSS, type Voice } from '~/lib/palette'

export interface AroDot {
  key: string
  /** loop al que pertenece; −1 = el bajo del fondo */
  loopId: number
  /** paso dentro del compás, 0..16 (decimal sin ayuda) */
  step: number
  /** posición en su loop (o en el patrón del bajo), en semicorcheas: identifica el golpe */
  pos: number
  /** duración en pasos (bajo y melodía: se dibuja como arco, E3.1) */
  dur?: number
  voice: Voice
  muted: boolean
  /** solo melodía: altura MIDI y su posición vertical 0..1 en el registro de su sinte (0 = grave, dentro; 1 = agudo, fuera) */
  midi?: number
  frac?: number
}

/** Dónde cae un punto de la pantalla en el aro. */
export interface AroPlace {
  th: number
  /** 0 = borde del centro, 1 = borde exterior (< 0 = centro, > 1 = fuera) */
  u: number
  /** paso del compás, 0..16 */
  step: number
  /** franja visible bajo el punto, o null */
  voice: Voice | null
  /** distancia al borde exterior (px; > 0 = fuera de la gota) */
  outPx: number
}

/** Estiramiento del borde hacia otra célula (spec 005, §5.2): dirección y cuánto (px). */
export interface AroPull {
  th: number
  a: number
}

/** La otra célula que se ve en una transición: la que entra (tenue) o la que se apaga. Solo se ve. */
export interface AroGhost {
  /**
   * Grupo en paralelo (§16): anillo a trazos si su grupo está apagado; si es la célula que suena de un grupo
   * encendido, un anillo con su progreso (0..1; sin él, entero y quieto)
   */
  ring?: 'on' | 'off'
  ringProgress?: number | null
  geo: DropGeo
  weights: Weights
  dots: AroDot[]
  alpha: number
}

/** Puente de agua entre dos gotas (spec 005, §5.2): tramo visible y brillo, de 0 (la que sale) a 1. */
export interface AroBridge {
  from: DropGeo
  to: DropGeo
  t0: number
  t1: number
  glow: number | null
}

/** Hilo de orden entre dos células (spec 005, §7.2): tenue, con el brillo de la transición si es el de la que suena. */
export interface AroThread {
  from: DropGeo
  to: DropGeo
  alpha: number
  /** dónde va el brillo, 0 (sale) … 1 (llega), o null */
  glow: number | null
  /** en la última vuelta de la que suena, cuánto se ha llenado hacia la siguiente (0..1) */
  fill?: number
  /** el hilo que se va a cortar: se está pulsando justo encima (enmienda 1, §15.4) */
  hot?: boolean
  /** hilo de un grupo en paralelo (§16.5): con un tinte frío muy suave */
  cool?: boolean
}

/** Número pequeño junto a una célula (sus vueltas). */
export interface AroLabel {
  x: number
  y: number
  text: string
  alpha: number
  /** en la que suena: puntitos de vueltas (●●○○) en vez del número */
  dots?: { turns: number; turn: number }
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
  /** ángulos del contorno (móvil en horizontal: más al estirarse, E2.1); sin él, 120 (72 en detalle bajo) */
  contour?: number
  /** duración de una semicorchea (s), para apagar los arcos a lo largo de su nota */
  stepSec: number
  /** guía al tocar (E3.3): ayuda y rejilla del estilo; sin ayuda, ni fantasma ni sugerencias */
  guide: GuideOptions
  /** sugerencias del estilo en las franjas de batería vacías */
  suggestions: GuideSpot[]
  /** franja de la melodía: posiciones 0..1 de las notas de la escala del estilo (guías muy tenues) */
  melGuides?: number[]
  /** carriles que graban si no son todos (E4.3); null = todos (lo normal: nada que marcar) */
  lanes: ReadonlySet<Voice> | null
  /** mantener pulsado un hueco de un carril: dónde y cuánto falta (0..1) para cambiarlo (E4.1) */
  hold: { x: number; y: number; p: number } | null
  /** inclinación y parallax (E3.5, E3.6); sin ella, de frente */
  view?: AroView
  /** transición entre células (spec 005, §5.2): estiramiento, la otra gota, el puente y la opacidad */
  pull?: AroPull | null
  ghost?: AroGhost | null
  bridge?: AroBridge | null
  alpha?: number
  /** colonia (spec 005, §7.2): las demás células, pequeñas y sin ondas ni aguja */
  crowd?: AroGhost[]
  /** colonia: anillo rosa alrededor de la célula que suena (0..1) */
  halo?: number
  /** colonia: el asa de cada célula (un puntito en el borde, hacia la siguiente) */
  handles?: { x: number; y: number; alpha: number }[]
  /** colonia: el hilo que se estira desde un asa; copia sobre agua vacía, orden sobre otra célula */
  threadDrag?: { from: { x: number; y: number }; to: { x: number; y: number }; target: { x: number; y: number; r: number } | null; ghostR: number | null } | null
  /** colonia: mantener una célula la borra; el anillo se completa alrededor de ella (p = 0..1) */
  holdRing?: { x: number; y: number; r: number; p: number } | null
  /** la célula que se ve es de un grupo en paralelo: su anillo (a trazos si está apagado; con su progreso si suena) */
  groupRing?: { mode: 'on' | 'off'; progress: number | null } | null
  /** colonia: cuánto se ha llenado el anillo de la que suena (0..1); null = en bucle, sin avanzar */
  progress?: number | null
  /**
   * detalle de las células de fondo en la colonia (§7.2, E1.7): 0 = completo; 1 = menos ángulos, sin
   * bordes de franja y golpes sin ondulación; 2 = solo la silueta. Lo baja el vigilante de frames.
   */
  crowdDetail?: 0 | 1 | 2
  /** colonia: hilos de orden y número de vueltas de cada célula */
  threads?: AroThread[]
  labels?: AroLabel[]
}

/** margen (fracción de la franja) que la melodía deja arriba y abajo para que sus notas no toquen el borde */
const MEL_MARGIN = 0.1
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
/** estela de la aguja: ángulo que abarca (≈ un tiempo) y su brillo máximo (E3.4) */
const TRAIL_SPAN = Math.PI / 2
const TRAIL_ALPHA = 0.015
/** silenciados: rellenos pero apagados (E3.2) */
const MUTED_ALPHA = 0.22
/** distancia máxima del dedo a un golpe para cogerlo (px) */
const PICK_PX = 26
/** muelle del imán: tirón y amortiguación por frame de 60 Hz (como el boceto) */
const SPRING_K = 0.09
const SPRING_DAMP = 0.78
const SPAWN_TAU = 0.12
const POP_S = 0.7
/** ángulos del contorno de la otra gota de una transición (menos detalle: dura poco) */
const GHOST_POINTS = 72
/** ángulos del contorno de una célula de fondo según su nivel de detalle */
const CROWD_POINTS = [GHOST_POINTS, 40, 24] as const
/** anchura angular del estiramiento hacia la otra célula */
const PULL_SHARP = 5

const pullAt = (th: number, pull: AroPull | null | undefined): number => {
  if (!pull || pull.a <= 0) return 0
  const d = ((th - pull.th + Math.PI * 3) % TAU) - Math.PI
  return pull.a * Math.exp(-d * d * PULL_SHARP)
}

interface Spring {
  th: number
  u: number
  vth: number
  vu: number
}

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
  private last: { geo: DropGeo; layout: Layout; t: number; dots: AroDot[]; suggestions: GuideSpot[] } | null = null
  /** radio exterior muestreado en cada frame (con los empujones); lo usan franjas, golpes y ondas */
  private ro = new Float32Array(0)
  private roGhost = new Float32Array(GHOST_POINTS)
  private wob = INNER_WOBBLE
  private weights: Weights | null = null
  private drag: { key: string; th: number; u: number; outPx: number } | null = null
  private springs = new Map<string, Spring>()
  private spawns = new Map<string, number>()
  private pops: { x: number; y: number; voice: Voice; born: number }[] = []
  private lastNow = 0
  /** vista del último frame: los toques (pantalla) se traducen a la posición de frente */
  private view: AroView = FRONT
  private stepSec = 0.17
  /** arcos de nota encendidos: cuándo sonaron y cuánto duran (s) */
  private arcsLit = new Map<string, { t: number; sec: number }>()

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
    // el arco de una nota se enciende entero y se apaga a lo largo de su duración (E3.1)
    if (d.dur) this.arcsLit.set(d.key, { t: now, sec: d.dur * this.stepSec })
    if (this.reduced) return // sin ondas ni latido (E1.7): solo se enciende
    const th = stepAngle(d.step)
    if (this.waves.length >= MAX_WAVES) this.waves.shift()
    this.waves.push({ voice: d.voice, th, born: now })
    if (d.voice === 'bd') {
      this.kick = now
      this.bumps.push({ th, a: 0, a0: KICK_BUMP_PX, born: now })
    }
  }

  /** Dónde cae (px, py) en el aro. */
  where(px: number, py: number): AroPlace {
    const L = this.last
    if (!L || !this.weights) return { th: 0, u: 2, step: 0, voice: null, outPx: Infinity }
    ;[px, py] = toFront(px, py, this.view, L.geo.cx, L.geo.cy)
    const dx = px - L.geo.cx
    const dy = py - L.geo.cy
    const th = Math.atan2(dy, dx)
    const d = Math.hypot(dx, dy)
    const ro = this.roAt(th)
    const u = (d - L.geo.core) / Math.max(1, ro - L.geo.core)
    return { th, u, step: angleStep(th), voice: bandAt(u, L.layout, this.weights), outPx: d - ro }
  }

  /** Golpe más cercano a (px, py), a menos de 26 px, de una franja visible. El bajo no se coge (E1.4). */
  pick(px: number, py: number): AroDot | null {
    const L = this.last
    if (!L || !this.weights) return null
    ;[px, py] = toFront(px, py, this.view, L.geo.cx, L.geo.cy)
    let best: AroDot | null = null
    let bd = PICK_PX
    for (const d of L.dots) {
      if (this.weights[d.voice] < 0.5 || d.voice === 'bass') continue
      const [x, y] = this.at(stepAngle(d.step), this.dotU(d, L.layout))
      const dd = Math.hypot(x - px, y - py)
      if (dd < bd) {
        bd = dd
        best = d
      }
    }
    return best
  }

  /** Sugerencia del estilo más cercana a (px, py), a menos de 26 px (E3.3). */
  pickSuggestion(px: number, py: number): GuideSpot | null {
    const L = this.last
    if (!L || !this.weights) return null
    ;[px, py] = toFront(px, py, this.view, L.geo.cx, L.geo.cy)
    let best: GuideSpot | null = null
    let bd = PICK_PX
    for (const s of L.suggestions) {
      if (this.weights[s.voice] < 0.5) continue
      const [x, y] = this.at(stepAngle(s.step), bandMid(s.voice, L.layout))
      const dd = Math.hypot(x - px, y - py)
      if (dd < bd) {
        bd = dd
        best = s
      }
    }
    return best
  }

  /** Arrastra un golpe: se dibuja libre bajo el dedo. `null` lo suelta (sin animar). */
  setDrag(key: string | null, px = 0, py = 0) {
    if (!key) {
      this.drag = null
      return
    }
    const w = this.where(px, py)
    this.drag = { key, th: w.th, u: w.u, outPx: w.outPx }
  }

  /** Al soltar: el golpe `key` sale de (th, u) y se desliza a su sitio con un pequeño rebote. */
  settle(key: string, th: number, u: number) {
    this.drag = null
    if (this.reduced) return // el imán coloca sin muelle (E1.7)
    this.springs.set(key, { th, u, vth: 0, vu: 0 })
  }

  /** Golpe recién creado: aparece creciendo, con un empujoncito del borde. */
  spawn(key: string, th: number) {
    if (this.reduced) return
    const now = performance.now() / 1000
    this.spawns.set(key, now)
    this.bumps.push({ th, a: 0, a0: 6, born: now })
  }

  /** Golpe borrado en el centro: una pequeña salpicadura. */
  splash(px: number, py: number, voice: Voice) {
    if (this.reduced) return
    const L = this.last
    if (L) [px, py] = toFront(px, py, this.view, L.geo.cx, L.geo.cy)
    this.pops.push({ x: px, y: py, voice, born: performance.now() / 1000 })
  }

  /** Punto del borde exterior en el ángulo `th`, en pantalla (donde se pega la chapa de vueltas). */
  edgePoint(th: number): { x: number; y: number } | null {
    const L = this.last
    if (!L || !this.ro.length) return null
    const r = this.roAt(th)
    const [sx, sy] = toScreen(L.geo.cx + Math.cos(th) * r, L.geo.cy + Math.sin(th) * r, this.view, L.geo.cx, L.geo.cy)
    return { x: sx, y: sy }
  }

  /** Posición (px CSS) de un paso en el centro de la franja de una voz. */
  pointOf(voice: Voice, step: number): { x: number; y: number } {
    const L = this.last
    if (!L) return { x: this.w / 2, y: this.h / 2 }
    const [x, y] = this.at(stepAngle(step), bandMid(voice, L.layout))
    const [sx, sy] = toScreen(x, y, this.view, L.geo.cx, L.geo.cy)
    return { x: sx, y: sy }
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

  /** u (0..1 en el aro) donde se dibuja un golpe: el medio de su franja; en la melodía, según su altura */
  private dotU(d: AroDot, layout: Layout): number {
    const { a, b } = layout[d.voice]
    if (d.voice !== 'mel' || d.frac === undefined) return (a + b) / 2
    return a + (b - a) * (MEL_MARGIN + (1 - 2 * MEL_MARGIN) * d.frac)
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
    x.clearRect(0, 0, this.w, this.h)
    // la vista (inclinación y parallax) se aplica a todo el aro alrededor de su centro
    const v = f.view ?? FRONT
    this.view = v
    x.save()
    x.translate(v.ox, v.oy + f.geo.cy)
    x.scale(1, v.sy)
    x.translate(0, -f.geo.cy)
    try {
      // las demás células, la otra de una transición y el puente van debajo de la que suena
      for (const th of f.threads ?? []) this.drawThread(th, f)
      for (const c of f.crowd ?? []) this.drawGhost(c, f, f.crowdDetail ?? 0)
      if (f.ghost && f.ghost.alpha > 0.01) this.drawGhost(f.ghost, f)
      if (f.bridge) this.drawBridge(f.bridge, f)
      x.globalAlpha = f.alpha ?? 1
      this.drawFront(f)
      if (f.halo && f.halo > 0.01) this.drawHalo(f.halo, f.progress)
      if (f.groupRing) this.drawGroupRing(f.groupRing)
      if (f.labels?.length) this.drawLabels(f.labels)
      if (f.holdRing && f.holdRing.p > 0.08) this.drawHoldRing(f.holdRing)
      if (f.handles?.length) this.drawHandles(f.handles)
      if (f.threadDrag) this.drawThreadDrag(f.threadDrag)
    } finally {
      x.restore()
    }
  }

  /** La otra gota de una transición: franjas, golpes y centro, sin aguja ni nada que se toque. */
  private drawGhost(g: AroGhost, f: AroFrame, level: 0 | 1 | 2 = 0) {
    const x = this.ctx
    const { geo } = g
    const t = f.reduced ? 0 : f.wall
    const breath = f.reduced ? 0 : BREATH
    const n = CROWD_POINTS[level]
    if (this.roGhost.length !== n) this.roGhost = new Float32Array(n)
    const ro = this.roGhost
    for (let k = 0; k < n; k++) ro[k] = outerRadius((k / n) * TAU, geo, t, breath)
    const layout = bandLayout(g.weights)
    const contour = (p: Path2D, u: number, reverse: boolean) => {
      for (let i = 0; i <= n; i++) {
        const k = reverse ? (n - (i % n)) % n : i % n
        const th = (k / n) * TAU
        const r = geo.core + (ro[k]! - geo.core) * u
        if (i === 0) p.moveTo(geo.cx + Math.cos(th) * r, geo.cy + Math.sin(th) * r)
        else p.lineTo(geo.cx + Math.cos(th) * r, geo.cy + Math.sin(th) * r)
      }
      p.closePath()
    }
    x.save()
    x.globalAlpha = Math.min(1, g.alpha)
    if (level >= 2) {
      // solo la silueta: un trazo y un relleno, sin franjas ni golpes
      const sil = new Path2D()
      contour(sil, 1, false)
      x.fillStyle = 'rgba(255,255,255,0.05)'
      x.fill(sil)
      x.strokeStyle = 'rgba(255,255,255,0.22)'
      x.lineWidth = 1
      x.stroke(sil)
      x.fillStyle = `rgba(${VOICE_RGB_CSS.bd},1)`
      x.beginPath()
      x.arc(geo.cx, geo.cy, 2.5, 0, TAU)
      x.fill()
      if (g.ring) this.strokeRing(contour, g.ring, g.ringProgress, geo)
      x.restore()
      return
    }
    for (const v of BAND_ORDER) {
      const wt = g.weights[v]
      if (wt < 0.03) continue
      const col = VOICE_RGB_CSS[v]
      const outer = new Path2D()
      contour(outer, layout[v].b, false)
      const ring = new Path2D(outer)
      contour(ring, layout[v].a, true)
      x.fillStyle = `rgba(${col},${0.035 * wt})`
      x.fill(ring)
      // con detalle reducido, sin el borde fino de cada franja
      if (level === 0) {
        x.strokeStyle = `rgba(${col},${0.24 * wt})`
        x.lineWidth = 1
        x.stroke(outer)
      }
    }
    for (const d of g.dots) {
      const wt = g.weights[d.voice]
      if (wt < 0.05) continue
      const th = stepAngle(d.step)
      // con detalle reducido, el radio sale de la muestra del contorno en vez de recalcular el ruido
      const r =
        level === 0
          ? radiusAt(th, bandMid(d.voice, layout), outerRadius(th, geo, t, breath), geo.core, t, 0)
          : geo.core + (ro[Math.round((((th / TAU) % 1) + 1) % 1 * n) % n]! - geo.core) * bandMid(d.voice, layout)
      const px = geo.cx + Math.cos(th) * r
      const py = geo.cy + Math.sin(th) * r
      x.fillStyle = `rgba(${VOICE_RGB_CSS[d.voice]},${d.muted ? MUTED_ALPHA : 0.55})`
      if (d.voice === 'bass') {
        x.save()
        x.translate(px, py)
        x.rotate(th)
        x.fillRect(-DOT_R.bass * 1.5, -DOT_R.bass / 2, DOT_R.bass * 3, DOT_R.bass)
        x.restore()
        continue
      }
      x.beginPath()
      x.arc(px, py, DOT_R[d.voice] * wt, 0, TAU)
      x.fill()
    }
    x.fillStyle = INK
    x.beginPath()
    x.arc(geo.cx, geo.cy, geo.core - 3, 0, TAU)
    x.fill()
    x.strokeStyle = 'rgba(255,255,255,0.8)'
    x.lineWidth = 1.2
    x.stroke()
    x.fillStyle = `rgba(${VOICE_RGB_CSS.bd},1)`
    x.beginPath()
    x.arc(geo.cx, geo.cy, 3, 0, TAU)
    x.fill()
    if (g.ring) this.strokeRing(contour, g.ring, g.ringProgress, geo)
    x.restore()
  }

  /** El anillo de una libre alrededor de su contorno: continuo si suena, a trazos si está apagada. */
  private strokeRing(contour: (p: Path2D, u: number, reverse: boolean) => void, mode: 'on' | 'off', progress: number | null | undefined, geo: DropGeo) {
    const x = this.ctx
    const p = new Path2D()
    contour(p, 1.12, false)
    if (mode === 'off') {
      x.strokeStyle = 'rgba(255,255,255,0.45)'
      x.lineWidth = 1.2
      x.setLineDash([4, 4])
      x.stroke(p)
      x.setLineDash([])
      return
    }
    // la que suena en su grupo: la pista tenue y, encima, lo que se ha llenado (blanco, como el de la canción es rosa)
    x.strokeStyle = progress === null || progress === undefined ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'
    x.lineWidth = 1.6
    x.stroke(p)
    if (progress && progress > 0.002) {
      x.strokeStyle = 'rgba(255,255,255,0.95)'
      x.lineWidth = 2.2
      x.lineCap = 'round'
      x.beginPath()
      x.arc(geo.cx, geo.cy, geo.R * 1.12, -Math.PI / 2, -Math.PI / 2 + Math.min(1, progress) * TAU)
      x.stroke()
      x.lineCap = 'butt'
    }
  }

  /** Lo mismo para la célula que se ve (usa el contorno del último frame). */
  private drawGroupRing(r: { mode: 'on' | 'off'; progress: number | null }) {
    if (!this.last || !this.ro.length) return
    const p = new Path2D()
    this.loopPath(p, 1.12, false)
    const x = this.ctx
    if (r.mode === 'off') {
      x.strokeStyle = 'rgba(255,255,255,0.45)'
      x.lineWidth = 1.2
      x.setLineDash([4, 4])
      x.stroke(p)
      x.setLineDash([])
      return
    }
    x.strokeStyle = r.progress === null ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.22)'
    x.lineWidth = 1.6
    x.stroke(p)
    if (r.progress !== null && r.progress > 0.002) {
      x.strokeStyle = 'rgba(255,255,255,0.95)'
      x.lineWidth = 2.2
      x.lineCap = 'round'
      x.beginPath()
      this.arcPath(1.12, -Math.PI / 2, -Math.PI / 2 + Math.min(1, r.progress) * TAU)
      x.stroke()
      x.lineCap = 'butt'
    }
  }

  /** Hilo de agua entre dos gotas: una curva muy tenue de borde a borde, con el brillo corriendo por ella. */
  private drawThread(th: AroThread, f: AroFrame) {
    if (th.alpha < 0.01) return
    const x = this.ctx
    const t = f.reduced ? 0 : f.wall
    const breath = f.reduced ? 0 : BREATH
    const phi = Math.atan2(th.to.cy - th.from.cy, th.to.cx - th.from.cx)
    const ra = outerRadius(phi, th.from, t, breath)
    const rb = outerRadius(phi + Math.PI, th.to, t, breath)
    // si las gotas ya se tocan, no hay hilo que ver
    if (Math.hypot(th.to.cx - th.from.cx, th.to.cy - th.from.cy) < ra + rb + 4) return
    const a = { x: th.from.cx + Math.cos(phi) * ra, y: th.from.cy + Math.sin(phi) * ra }
    const b = { x: th.to.cx - Math.cos(phi) * rb, y: th.to.cy - Math.sin(phi) * rb }
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    // se curva un poco y despacio, como agua
    const c = threadControl(a, b, threadBend(len, phi, t))
    x.lineCap = 'round'
    // pulsado justo encima: se ve cuál se va a cortar
    x.strokeStyle = th.hot ? 'rgba(255,255,255,0.85)' : th.cool ? `rgba(170,205,255,${0.14 * th.alpha})` : `rgba(255,255,255,${0.11 * th.alpha})`
    x.lineWidth = th.hot ? 2.6 : 1.2
    x.beginPath()
    x.moveTo(a.x, a.y)
    x.quadraticCurveTo(c.x, c.y, b.x, b.y)
    x.stroke()
    if (th.glow !== null) {
      // el brillo de la transición: una estela corta que avanza hacia la siguiente
      const head = Math.min(1, Math.max(0, th.glow))
      const tail = Math.max(0, head - 0.22)
      x.strokeStyle = `rgba(255,255,255,${0.55 * th.alpha})`
      x.lineWidth = 2
      x.beginPath()
      for (let i = 0; i <= 10; i++) {
        const p = quadAt(a, c, b, tail + ((head - tail) * i) / 10)
        if (i === 0) x.moveTo(p.x, p.y)
        else x.lineTo(p.x, p.y)
      }
      x.stroke()
      const h = quadAt(a, c, b, head)
      const r = Math.max(6, Math.min(16, th.from.R * 0.5))
      const g = x.createRadialGradient(h.x, h.y, 0, h.x, h.y, r)
      g.addColorStop(0, `rgba(255,255,255,${0.45 * th.alpha})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.fillRect(h.x - r, h.y - r, r * 2, r * 2)
    }
    // en la última vuelta, el hilo se va llenando hacia la siguiente
    if (th.fill !== undefined && th.fill > 0.002) {
      x.strokeStyle = `rgba(${VOICE_RGB_CSS.bd},${0.7 * th.alpha})`
      x.lineWidth = 1.8
      x.beginPath()
      const end = Math.min(1, th.fill)
      for (let i = 0; i <= 14; i++) {
        const p = quadAt(a, c, b, (end * i) / 14)
        if (i === 0) x.moveTo(p.x, p.y)
        else x.lineTo(p.x, p.y)
      }
      x.stroke()
    }
    x.lineCap = 'butt'
  }

  /** Asas: un puntito con un halo fino en el borde de cada célula. */
  private drawHandles(hs: { x: number; y: number; alpha: number }[]) {
    const x = this.ctx
    for (const h of hs) {
      if (h.alpha < 0.01) continue
      x.fillStyle = `rgba(255,255,255,${0.75 * h.alpha})`
      x.beginPath()
      x.arc(h.x, h.y, 2.6, 0, TAU)
      x.fill()
      x.strokeStyle = `rgba(255,255,255,${0.25 * h.alpha})`
      x.lineWidth = 1
      x.beginPath()
      x.arc(h.x, h.y, 5.5, 0, TAU)
      x.stroke()
    }
  }

  /**
   * El hilo que sale del asa hasta el dedo. Sobre agua vacía, una silueta de la copia bajo el dedo; sobre
   * otra célula, esa célula se resalta (orden).
   */
  private drawThreadDrag(t: NonNullable<AroFrame['threadDrag']>) {
    const x = this.ctx
    const c = threadControl(t.from, t.to, Math.min(Math.hypot(t.to.x - t.from.x, t.to.y - t.from.y) * 0.08, 14))
    x.strokeStyle = 'rgba(255,255,255,0.6)'
    x.lineWidth = 1.8
    x.lineCap = 'round'
    x.beginPath()
    x.moveTo(t.from.x, t.from.y)
    x.quadraticCurveTo(c.x, c.y, t.to.x, t.to.y)
    x.stroke()
    x.lineCap = 'butt'
    if (t.target) {
      x.strokeStyle = 'rgba(255,255,255,0.9)'
      x.lineWidth = 2
      x.beginPath()
      x.arc(t.target.x, t.target.y, Math.max(t.target.r, 10) + 5, 0, TAU)
      x.stroke()
    } else if (t.ghostR) {
      x.strokeStyle = 'rgba(255,255,255,0.55)'
      x.lineWidth = 1.2
      x.setLineDash([3, 3])
      x.beginPath()
      x.arc(t.to.x, t.to.y, Math.max(t.ghostR, 8), 0, TAU)
      x.stroke()
      x.setLineDash([])
    }
  }

  /** Anillo fino que se completa alrededor de la célula que se mantiene pulsada (se borra al llegar a 1). */
  private drawHoldRing(h: { x: number; y: number; r: number; p: number }) {
    const x = this.ctx
    x.strokeStyle = 'rgba(255,255,255,0.85)'
    x.lineWidth = 2
    x.lineCap = 'round'
    x.beginPath()
    x.arc(h.x, h.y, h.r + 6, -Math.PI / 2, -Math.PI / 2 + Math.min(1, h.p) * TAU)
    x.stroke()
    x.lineCap = 'butt'
  }

  /** Números pequeños junto a las células (sus vueltas). */
  private drawLabels(ls: AroLabel[]) {
    const x = this.ctx
    x.font = '500 10px system-ui, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    for (const l of ls) {
      if (l.alpha < 0.01) continue
      if (l.dots) {
        // puntitos de vueltas (●●○○): hasta 4 por fila, la vuelta en la que va y las anteriores, llenas
        const { turns, turn } = l.dots
        const cols = Math.min(4, turns)
        for (let i = 0; i < turns; i++) {
          const row = Math.floor(i / cols)
          const inRow = Math.min(cols, turns - row * cols)
          const px = l.x + ((i % cols) - (inRow - 1) / 2) * 5
          const py = l.y + row * 5 - 1
          x.fillStyle = `rgba(255,255,255,${i <= turn ? Math.min(1, l.alpha * 1.7) : l.alpha * 0.4})`
          x.beginPath()
          x.arc(px, py, 1.6, 0, TAU)
          x.fill()
        }
        continue
      }
      x.fillStyle = `rgba(255,255,255,${l.alpha})`
      x.fillText(l.text, l.x, l.y)
    }
  }

  /**
   * Colonia: un anillo rosa fino alrededor de la célula que suena (usa el contorno del último frame).
   * Con `progress` es un anillo de progreso: la pista tenue y encima lo que se ha llenado, desde arriba
   * y en el sentido de la aguja. En bucle (`null`), el anillo entero, quieto.
   */
  private drawHalo(a: number, progress: number | null | undefined) {
    if (!this.last || !this.ro.length) return
    const x = this.ctx
    const track = new Path2D()
    this.loopPath(track, 1.07, false)
    const rgb = VOICE_RGB_CSS.bd
    x.lineWidth = 2
    if (progress === undefined || progress === null) {
      x.strokeStyle = `rgba(${rgb},${0.5 * a})`
      x.stroke(track)
      return
    }
    x.strokeStyle = `rgba(${rgb},${0.22 * a})`
    x.stroke(track)
    if (progress < 0.002) return
    x.strokeStyle = `rgba(${rgb},${0.95 * a})`
    x.lineWidth = 2.5
    x.lineCap = 'round'
    x.beginPath()
    this.arcPath(1.07, -Math.PI / 2, -Math.PI / 2 + Math.min(1, progress) * TAU)
    x.stroke()
    x.lineCap = 'butt'
  }

  /** El puente de agua: del borde de una gota al de la otra, fino en el centro, con su brillo. */
  private drawBridge(b: AroBridge, f: AroFrame) {
    if (b.t1 - b.t0 < 0.01) return
    const x = this.ctx
    const t = f.wall
    const phi = Math.atan2(b.to.cy - b.from.cy, b.to.cx - b.from.cx)
    const dx = Math.cos(phi)
    const dy = Math.sin(phi)
    const ra = outerRadius(phi, b.from, t)
    const rb = outerRadius(phi + Math.PI, b.to, t)
    const x0 = b.from.cx + dx * ra
    const y0 = b.from.cy + dy * ra
    const len = Math.hypot(b.to.cx - dx * rb - x0, b.to.cy - dy * rb - y0)
    // si las gotas ya se tocan (o se pisan), no hay hueco que salvar
    if (len < 2 || Math.hypot(b.to.cx - b.from.cx, b.to.cy - b.from.cy) < ra + rb) return
    const m = 24
    const left: [number, number][] = []
    const right: [number, number][] = []
    for (let i = 0; i <= m; i++) {
      const s = b.t0 + ((b.t1 - b.t0) * i) / m
      const hw = bridgeHalfWidth(s, b.t0, b.t1, t) * b.from.R
      const cx = x0 + dx * len * s
      const cy = y0 + dy * len * s
      left.push([cx - dy * hw, cy + dx * hw])
      right.push([cx + dy * hw, cy - dx * hw])
    }
    const side = (pts: [number, number][]) => {
      const p = new Path2D()
      pts.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py)))
      return p
    }
    const body = side(left)
    for (let i = m; i >= 0; i--) body.lineTo(right[i]![0], right[i]![1])
    body.closePath()
    const col = VOICE_RGB_CSS.hh
    x.fillStyle = `rgba(${col},0.06)`
    x.fill(body)
    // el brillo corre hacia la célula que entra
    if (b.glow !== null && b.glow <= b.t1 && b.glow >= b.t0) {
      const gx = x0 + dx * len * b.glow
      const gy = y0 + dy * len * b.glow
      const gr = b.from.R * 0.22
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, gr)
      g.addColorStop(0, 'rgba(255,255,255,0.4)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.save()
      x.clip(body)
      x.fillStyle = g
      x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2)
      x.restore()
    }
    x.strokeStyle = `rgba(${col},0.24)`
    x.lineWidth = 1
    x.stroke(side(left))
    x.stroke(side(right))
  }

  private drawFront(f: AroFrame) {
    const x = this.ctx
    const { geo } = f
    this.reduced = f.reduced
    const t = f.reduced ? 0 : f.wall
    const breath = f.reduced ? 0 : BREATH
    this.wob = f.reduced ? INNER_WOBBLE * 0.6 : this.detail < 0.75 ? 0 : INNER_WOBBLE // quieta, pero imperfecta
    const layout = bandLayout(f.weights)
    this.last = { geo, layout, t, dots: f.dots, suggestions: f.suggestions }
    this.weights = f.weights
    this.stepSec = f.stepSec
    const now = performance.now() / 1000
    const frames = Math.min(3, Math.max(1, Math.round((now - (this.lastNow || now - 1 / 60)) * 60)))
    this.lastNow = now

    // empujones del borde (latido del bombo)
    this.bumps = this.bumps.filter((b) => now - b.born < KICK_BUMP_S)
    for (const b of this.bumps) b.a = b.a0 * bumpEnvelope((now - b.born) / KICK_BUMP_S)

    // radio exterior en N ángulos, una vez por frame
    const n = f.contour ? Math.round(f.contour * (this.detail < 0.75 ? 0.6 : 1)) : this.detail < 0.75 ? 72 : 120
    if (this.ro.length !== n) this.ro = new Float32Array(n)
    for (let k = 0; k < n; k++) {
      const th = (k / n) * TAU
      // el estiramiento hacia la otra célula va después de la pared: es agua que sale hacia ella
      this.ro[k] = outerRadius(th, geo, t, breath, this.bumps.length ? bumpAt(th, this.bumps) : 0) + pullAt(th, f.pull)
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
      // carriles que graban (E4.3): si no son todos, los encendidos más brillantes y los apagados más tenues
      const drum = v === 'bd' || v === 'sd' || v === 'hh'
      const edge = f.lanes && drum ? (f.lanes.has(v) ? 0.5 : 0.1) : 0.24
      x.strokeStyle = `rgba(${col},${edge * wt})`
      x.lineWidth = f.lanes && drum && f.lanes.has(v) ? 1.4 : 1
      x.stroke(outer)
    }

    // guías de la melodía: una línea muy tenue en cada nota de la escala, dentro de su franja
    if (f.melGuides?.length && f.weights.mel >= 0.3 && this.detail >= 0.75) {
      const { a, b } = layout.mel
      x.lineWidth = 0.7
      x.strokeStyle = `rgba(${VOICE_RGB_CSS.mel},${0.07 * f.weights.mel})`
      for (const g of f.melGuides) {
        const p = new Path2D()
        this.loopPath(p, a + (b - a) * (MEL_MARGIN + (1 - 2 * MEL_MARGIN) * g), false)
        x.stroke(p)
      }
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

    const head = stepAngle(f.phase * 16)

    // estela de la aguja: un abanico muy tenue detrás de ella (E3.4)
    if (f.playing && !f.reduced && 'createConicGradient' in x) {
      const disc = new Path2D()
      this.loopPath(disc, 1, false)
      this.loopPath(disc, 0, true)
      const g = x.createConicGradient(head - TRAIL_SPAN, geo.cx, geo.cy)
      const k = TRAIL_SPAN / TAU
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(k * 0.999, `rgba(255,255,255,${TRAIL_ALPHA})`)
      g.addColorStop(k, 'rgba(255,255,255,0)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.fill(disc)
    }

    // sugerencias del estilo en las franjas vacías: huecas y muy tenues (E3.3)
    for (const s of f.suggestions) {
      const wt = f.weights[s.voice]
      if (wt < 0.05) continue
      const [px, py] = this.at(stepAngle(s.step), bandMid(s.voice, layout))
      x.strokeStyle = `rgba(${VOICE_RGB_CSS[s.voice]},${0.2 * wt})`
      x.lineWidth = 1
      x.beginPath()
      x.arc(px, py, DOT_R[s.voice] * 0.9, 0, TAU)
      x.stroke()
    }

    // fantasma: un solo círculo hueco donde caerá el golpe que arrastras (E3.3)
    if (this.drag) {
      const d = f.dots.find((p) => p.key === this.drag!.key)
      const band = bandAt(this.drag.u, layout, f.weights)
      const g = d ? ghostTarget(d.voice, this.drag.u, angleStep(this.drag.th), band, f.guide) : null
      if (g) {
        const [px, py] = this.at(stepAngle(g.step), bandMid(g.voice, layout))
        x.strokeStyle = `rgba(${VOICE_RGB_CSS[g.voice]},0.45)`
        x.lineWidth = 1.2
        x.beginPath()
        x.arc(px, py, DOT_R[g.voice] + 1, 0, TAU)
        x.stroke()
      }
    }

    // golpes: puntos; el bajo, rayita con el arco de su duración
    let dragged: { d: AroDot; px: number; py: number; r: number } | null = null
    for (const d of f.dots) {
      const isDrag = this.drag?.key === d.key
      const wt = isDrag ? 1 : f.weights[d.voice]
      if (wt < 0.05) continue
      let th = stepAngle(d.step)
      let u = this.dotU(d, layout)
      // arrastrado: bajo el dedo; recién soltado: muelle hacia su sitio (imán)
      if (isDrag) {
        th = this.drag!.th
        u = this.drag!.u
      } else {
        const sp = this.springs.get(d.key)
        if (sp) {
          for (let i = 0; i < frames; i++) {
            const dth = ((th - sp.th + Math.PI * 3) % TAU) - Math.PI
            sp.vth = (sp.vth + dth * SPRING_K) * SPRING_DAMP
            sp.th += sp.vth
            sp.vu = (sp.vu + (u - sp.u) * SPRING_K) * SPRING_DAMP
            sp.u += sp.vu
          }
          const done = Math.abs(((th - sp.th + Math.PI * 3) % TAU) - Math.PI) < 1e-3 && Math.abs(u - sp.u) < 1e-3
          if (done && Math.abs(sp.vth) < 1e-3 && Math.abs(sp.vu) < 1e-3) this.springs.delete(d.key)
          else {
            th = sp.th
            u = sp.u
          }
        }
      }
      const [px, py] = this.at(th, u)
      const dd = f.playing ? Math.abs(((th - head + Math.PI * 3) % TAU) - Math.PI) : Math.PI
      const near = f.reduced ? 0 : Math.exp(-dd * dd * 30)
      const since = now - (this.flashes.get(d.key) ?? -1e9)
      const fl = since >= 0 ? Math.exp(-since / FLASH_TAU) : 0
      const hl = f.highlight === d.loopId
      const faded = f.highlight !== null && !hl
      const grow = f.reduced ? 0 : near * 2 + fl * 1.5
      const born = this.spawns.get(d.key)
      const spawnK = born === undefined ? 0 : Math.exp(-(now - born) / SPAWN_TAU)
      if (born !== undefined && spawnK < 0.01) this.spawns.delete(d.key)
      const r = (DOT_R[d.voice] + grow) * (hl ? 1.45 : 1) * (isDrag ? 1.8 : 1) * (1 - spawnK * 0.8) * wt
      if (isDrag) dragged = { d, px, py, r }
      const col = VOICE_RGB_CSS[d.voice]
      const alpha = (0.55 + Math.max(near, fl) * 0.45) * (faded ? 0.25 : 1)
      if (d.voice === 'bass' || d.voice === 'mel') {
        // el arco de la duración: tenue en reposo; al sonar se enciende y se apaga a lo largo de la nota
        if (d.dur) {
          const lit = this.arcsLit.get(d.key)
          const p = lit ? (now - lit.t) / Math.max(0.05, lit.sec) : 1
          if (lit && p >= 1) this.arcsLit.delete(d.key)
          const glow = p < 1 ? 1 - p : 0
          const { a0, a1 } = noteArc(angleStep(th), d.dur)
          x.strokeStyle = `rgba(${col},${(0.28 + 0.6 * glow) * (faded ? 0.25 : 1) * (d.muted ? 0.4 : 1) * wt})`
          x.lineWidth = (d.voice === 'mel' ? 3 : 2) + 1.5 * glow
          x.lineCap = 'round'
          x.beginPath()
          this.arcPath(u, a0, a1)
          x.stroke()
          x.lineCap = 'butt'
        }
        if (d.voice === 'bass') {
          x.save()
          x.translate(px, py)
          x.rotate(th) // radial, como en el boceto
          x.fillStyle = `rgba(${col},${d.muted ? alpha * 0.4 : alpha})`
          x.fillRect(-r * 1.5, -r / 2, r * 3, r)
          x.restore()
          continue
        }
        // la melodía: además del arco, un punto en su inicio (abajo)
      }
      x.beginPath()
      x.arc(px, py, r, 0, TAU)
      // silenciado: relleno pero apagado (E3.2); hueco queda solo para el fantasma y las sugerencias
      x.fillStyle = `rgba(${col},${d.muted ? MUTED_ALPHA * (faded ? 0.25 : 1) : alpha})`
      x.fill()
      if (hl) {
        x.strokeStyle = 'rgba(255,255,255,0.9)'
        x.lineWidth = 1.5
        x.beginPath()
        x.arc(px, py, r + 3, 0, TAU)
        x.stroke()
      }
    }
    for (const [k, at] of this.flashes) if (now - at > FLASH_TAU * 6) this.flashes.delete(k)
    // muelles de golpes que ya no existen (p. ej. borrados)
    if (this.springs.size) for (const k of this.springs.keys()) if (!f.dots.some((d) => d.key === k)) this.springs.delete(k)

    // el golpe arrastrado lleva un anillo fino
    if (dragged) {
      x.strokeStyle = `rgba(${VOICE_RGB_CSS[dragged.d.voice]},0.5)`
      x.lineWidth = 1
      x.beginPath()
      x.arc(dragged.px, dragged.py, dragged.r + 6, 0, TAU)
      x.stroke()
    }

    // mantener un hueco de un carril: un arco fino se completa alrededor del dedo (E4.1)
    if (f.hold && f.hold.p > 0.08) {
      const [hx, hy] = toFront(f.hold.x, f.hold.y, f.view ?? FRONT, geo.cx, geo.cy)
      x.strokeStyle = 'rgba(255,255,255,0.75)'
      x.lineWidth = 2
      x.lineCap = 'round'
      x.beginPath()
      x.arc(hx, hy, 22, -Math.PI / 2, -Math.PI / 2 + Math.min(1, f.hold.p) * TAU)
      x.stroke()
      x.lineCap = 'butt'
    }

    // salpicaduras de los golpes borrados
    this.pops = this.pops.filter((p) => now - p.born < POP_S)
    for (const p of this.pops) {
      const k = (now - p.born) / POP_S
      x.strokeStyle = `rgba(${VOICE_RGB_CSS[p.voice]},${(1 - k) * 0.6})`
      x.lineWidth = 1
      x.beginPath()
      x.arc(p.x, p.y, 4 + k * 45, 0, TAU)
      x.stroke()
    }

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
    // un golpe arrastrado al centro se borrará al soltarlo: el borde se pone rosa
    const willDelete = !!this.drag && this.drag.u < 0
    x.strokeStyle = willDelete ? `rgba(${VOICE_RGB_CSS.bd},0.9)` : 'rgba(255,255,255,0.8)'
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

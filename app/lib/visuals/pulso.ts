/**
 * Visualizador «Pulso» (spec 049): vertical 9:16, para un tema oscuro y de golpes secos (el drill). Cinco columnas, una por voz (bombo, bajo, caja, platillo, melodía; los colores de `VOICE_HEX`), cada una con una barra
 * cuya altura es la **energía de esa voz en ese instante**: cada golpe suma su fuerza y se apaga rápido, con una línea clara arriba y un destello seco en el golpe. Una **línea del compás** que se rellena de izquierda a derecha y vuelve a empezar con cada compás (y engorda un poco con el bombo)
 * y un flash blanco breve al cambiar de sección. Puro: dibuja con lo que le dan (un contexto 2D y una línea de tiempo), sin DOM. Todo se precalcula en `makePulso`; el dibujo **no asigna objetos** (los textos se cachean).
 * Reglas de `specs/DISENO.md`: fondo `INK`, un instrumento un color, texto de al menos 11 px reales (`fontPx`), movimiento reducido sin destellos ni flash.
 */
import { fontPx } from '../lab'
import { INK, VOICE_RGB_CSS, type Voice } from '../palette'
import type { FreeLoop } from '../freeLoops'
import { hitLevel, LANES, laneOf, type Timeline } from '../timeline'

/** El lienzo es fijo y se escala con CSS (como los del Laboratorio). */
export const PULSO_W = 540
export const PULSO_H = 960
/** Dos tamaños (spec 050): el **vertical** (9:16, para vídeo e historias) y el **compacto**, para la pantalla de Remixes del Laboratorio (deja sitio al pad de partes). */
export interface PulsoSize {
  w: number
  h: number
}
export const PULSO_VERTICAL: PulsoSize = { w: PULSO_W, h: PULSO_H }
export const PULSO_COMPACT: PulsoSize = { w: PULSO_W, h: 700 }

/** Lo que tarda cada voz en apagarse (s): el platillo, muy seco; el bajo, largo. */
export const TAU: Record<Voice, number> = { hh: 0.07, sd: 0.18, mel: 0.35, bd: 0.3, bass: 0.45 }
/** Con varias notas a la vez (cuerdas y coro) la suma pasaría de 1 y la barra quedaría siempre al tope: se comprime suavemente (1 − e^(−K·x)): 0,8 → 0,72, 2 → 0,96. */
const K = 1.6
export const compress = (x: number): number => 1 - Math.exp(-K * x)
/** Cuánto pesa cada voz en su barra: la melodía suma cuerdas y coro a la vez y se comía el contraste con la batería (en el drop llegaba siempre al tope); la batería y el bajo, a tope. */
export const LANE_GAIN: Record<Voice, number> = { bd: 1, bass: 1, sd: 1, hh: 1, mel: 0.55 }
/** Un golpe se ve como destello este rato (s) */
const FLASH_S = 0.06
/** El flash de cambio de sección dura esto (s) y llega a este brillo */
const SECTION_FLASH_S = 0.25
const SECTION_FLASH_A = 0.16

// la composición (en unidades del lienzo)
const M = 36
const GAP = 14
const COL_W = (PULSO_W - 2 * M - (LANES.length - 1) * GAP) / LANES.length
/** los números de la composición de un tamaño: las columnas arrancan bajo los títulos y dejan abajo sitio al suelo y al pie */
export interface PulsoLayout {
  top: number
  colH: number
  bottom: number
  floorY: number
  footerY: number
}
export function layoutFor(size: PulsoSize): PulsoLayout {
  const top = size.h >= 900 ? 150 : 118
  const colH = size.h - top - 120
  return { top, colH, bottom: top + colH, floorY: top + colH + 24, footerY: size.h - 40 }
}

/** Lo que usa el dibujo de un contexto 2D (para poder probarlo sin DOM). */
export type Ctx2D = Pick<CanvasRenderingContext2D, 'fillStyle' | 'font' | 'globalAlpha' | 'textAlign' | 'textBaseline' | 'fillRect' | 'fillText'>

/** El modo en directo (spec 050): los golpes que llegan del motor, en una cola de tamaño fijo (sin asignar por fotograma), y la energía acumulada de cada carril. */
export interface PulsoLive {
  /** energía de cada carril en el instante `at` */
  e: Float64Array
  at: Float64Array
  /** el último golpe de cada carril, para el destello */
  fS: Float64Array
  fT: Float64Array
  /** cola circular: instante, carril y volumen de cada golpe aún por aplicar */
  qT: Float64Array
  qL: Int8Array
  qS: Float32Array
  head: number
  count: number
}
/** golpes que caben en la cola (los más viejos se pierden si se llena: nunca ocurre a ritmos normales) */
const QUEUE = 512

export interface PulsoScene {
  tl: Timeline
  title: string
  size: PulsoSize
  lay: PulsoLayout
  /** presente solo en modo en directo */
  live: PulsoLive | null
  /** en directo: la parte que suena y desde cuándo (instante de reloj; −1 = ninguna) */
  liveName: string
  liveSince: number
  /** pie de página fijo (en directo) */
  footer: string
  /** energía (0..1) y destello (0..1) de cada carril en el último fotograma, reutilizados */
  energy: Float64Array
  flash: Float64Array
  fill: string[]
  glow: string[]
  sectionLabels: string[]
  // cachés de texto (para no crear cadenas en cada fotograma)
  fontScale: number
  fontStr: string
  timeSec: number
  timeStr: string
}

export function makePulso(tl: Timeline, title: string, size: PulsoSize = PULSO_VERTICAL): PulsoScene {
  const total = fmtTime(tl.duration)
  return {
    tl,
    title,
    size,
    lay: layoutFor(size),
    live: null,
    liveName: '',
    liveSince: -1,
    footer: '',
    energy: new Float64Array(LANES.length),
    flash: new Float64Array(LANES.length),
    fill: LANES.map((v) => `rgba(${VOICE_RGB_CSS[v]},.9)`),
    glow: LANES.map((v) => `rgb(${VOICE_RGB_CSS[v]})`),
    sectionLabels: tl.sections.map((s) => s.name),
    fontScale: -1,
    fontStr: '',
    timeSec: -1,
    timeStr: `0:00 / ${total}`,
  }
}

const EMPTY_TL: Timeline = { bpm: 0, barSeconds: 1, bars: 0, duration: 0, sections: [{ name: '', bar0: 0, bars: 0, t0: 0, t1: 0 }], events: [], lanes: Object.fromEntries(LANES.map((v) => [v, { t: new Float64Array(0), s: new Float32Array(0) }])) as Timeline['lanes'], barEnergy: [] }

/** Una escena en directo (spec 050): no hay línea de tiempo; la imagen sale de los golpes que se le van dando con `pushLive`. */
export function makePulsoLive(title: string, size: PulsoSize = PULSO_COMPACT): PulsoScene {
  const sc = makePulso(EMPTY_TL, title, size)
  sc.live = {
    e: new Float64Array(LANES.length),
    at: new Float64Array(LANES.length),
    fS: new Float64Array(LANES.length),
    fT: new Float64Array(LANES.length).fill(-1e9),
    qT: new Float64Array(QUEUE),
    qL: new Int8Array(QUEUE),
    qS: new Float32Array(QUEUE),
    head: 0,
    count: 0,
  }
  return sc
}

/** Pone un golpe en cola: se aplicará cuando el reloj llegue a `time`. Un carril desconocido se ignora. No asigna. */
export function pushLive(sc: PulsoScene, lane: Voice, strength: number, time: number): void {
  const lv = sc.live
  const i = LANES.indexOf(lane)
  if (!lv || i < 0 || !Number.isFinite(time) || !Number.isFinite(strength)) return
  if (lv.count >= QUEUE) {
    lv.head = (lv.head + 1) % QUEUE
    lv.count--
  }
  const at = (lv.head + lv.count) % QUEUE
  lv.qT[at] = time
  lv.qL[at] = i
  lv.qS[at] = Math.min(1, Math.max(0, strength))
  lv.count++
}

/** La parte que suena cambia en `time` (el flash de sección y el nombre). */
export function setLivePart(sc: PulsoScene, name: string, time: number): void {
  sc.liveName = name
  sc.liveSince = time
}

/** Aplica a la energía los golpes de la cola cuyo instante ya llegó (la cola va casi ordenada; se recorre entera: son pocos). */
function applyLive(sc: PulsoScene, t: number): void {
  const lv = sc.live!
  let kept = 0
  for (let k = 0; k < lv.count; k++) {
    const idx = (lv.head + k) % QUEUE
    const th = lv.qT[idx]!
    if (th <= t) {
      const i = lv.qL[idx]!
      const tau = TAU[LANES[i]!]
      const dt = Math.max(0, th - lv.at[i]!)
      lv.e[i] = lv.e[i]! * Math.exp(-dt / tau) + lv.qS[idx]!
      lv.at[i] = th
      lv.fS[i] = lv.qS[idx]!
      lv.fT[i] = th
    } else {
      // se queda: se compacta hacia el principio de la cola
      const to = (lv.head + kept) % QUEUE
      lv.qT[to] = th
      lv.qL[to] = lv.qL[idx]!
      lv.qS[to] = lv.qS[idx]!
      kept++
    }
  }
  lv.count = kept
}

/** Qué carril es un golpe del motor y cuánto se oye (spec 050). `instrument` es el del evento (`bd`, `sd`, `hh`, `mel`, `voz`, `bass` o `chords`, el fondo del estilo) y `loop` el loop que lo toca, si lo hay. `null` = no se pinta (riser, downlifter). */
export function liveLane(instrument: string | null, loop: Pick<FreeLoop, 'instrument' | 'synth'> | null, strength: number): { lane: Voice; level: number } | null {
  if (instrument === 'bd' || instrument === 'sd' || instrument === 'hh') return { lane: instrument, level: loop ? hitLevel(loop, strength) : Math.min(1, Math.max(0, strength)) }
  if (instrument === 'bass') return { lane: 'bass', level: Math.min(1, Math.max(0.3, strength)) }
  if (instrument === 'chords') return { lane: 'mel', level: Math.min(1, Math.max(0.3, strength)) }
  if (instrument === 'mel' || instrument === 'voz') {
    const l = loop ?? { instrument: 'mel' as const, synth: undefined }
    const lane = laneOf(l)
    return lane ? { lane, level: hitLevel(l, strength) } : null
  }
  return null
}

const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Índice del último elemento de `a` con a[i] ≤ x (o −1). Búsqueda binaria; no asigna. */
export function lastAtOrBefore(a: Float64Array, x: number): number {
  let lo = 0
  let hi = a.length - 1
  let r = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (a[mid]! <= x) {
      r = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return r
}

/** Energía de un carril en `t`: cada golpe anterior suma su volumen y decae con `exp(−Δt/τ)`; solo cuentan los de los últimos 6·τ; la suma se comprime (`compress`: nunca pasa de 1). El destello (0..1) sale del golpe de los últimos `FLASH_S` s. */
export function sampleLane(sc: PulsoScene, i: number, t: number): void {
  const v = LANES[i]!
  const tau = TAU[v]
  if (sc.live) {
    // en directo: la energía acumulada de los golpes ya llegados, decaída hasta ahora (los de la cola se aplican en `drawPulso`)
    const lv = sc.live
    sc.energy[i] = compress(lv.e[i]! * Math.exp(-Math.max(0, t - lv.at[i]!) / tau) * LANE_GAIN[v])
    const dtf = t - lv.fT[i]!
    sc.flash[i] = dtf >= 0 && dtf < FLASH_S ? lv.fS[i]! * (1 - dtf / FLASH_S) : 0
    return
  }
  const lane = sc.tl.lanes[v]
  let e = 0
  let f = 0
  for (let k = lastAtOrBefore(lane.t, t); k >= 0; k--) {
    const dt = t - lane.t[k]!
    if (dt > 6 * tau) break
    const s = lane.s[k]!
    e += s * Math.exp(-dt / tau)
    if (dt < FLASH_S) f = Math.max(f, s * (1 - dt / FLASH_S))
  }
  sc.energy[i] = compress(e * LANE_GAIN[v])
  sc.flash[i] = f
}

/** La sección que suena en `t` (la última cuyo inicio ya pasó). */
export function sectionAt(tl: Timeline, t: number): number {
  let r = 0
  for (let i = 0; i < tl.sections.length; i++) if (tl.sections[i]!.t0 <= t) r = i
  return r
}

export interface PulsoOptions {
  /** escala real del lienzo en pantalla (ancho en px / PULSO_W): para que el texto no baje de 11 px */
  scale: number
  /** `prefers-reduced-motion`: sin destellos ni flash de sección */
  reduced: boolean
  /** en directo: la fase del compás (0..1) que da el reloj del motor; con línea de tiempo se saca del instante */
  phase?: number
}

export function drawPulso(ctx: Ctx2D, sc: PulsoScene, t: number, o: PulsoOptions): void {
  const { w, h } = sc.size
  const { top, colH, bottom, floorY, footerY } = sc.lay
  if (sc.live) applyLive(sc, t)
  ctx.globalAlpha = 1
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, w, h)

  // las columnas
  for (let i = 0; i < LANES.length; i++) {
    sampleLane(sc, i, t)
    const x = M + i * (COL_W + GAP)
    ctx.fillStyle = 'rgba(255,255,255,.05)'
    ctx.fillRect(x, top, COL_W, colH)
    const bar = sc.energy[i]! * colH
    if (bar > 0.5) {
      ctx.fillStyle = sc.fill[i]!
      ctx.fillRect(x, bottom - bar, COL_W, bar)
      ctx.fillStyle = 'rgba(255,255,255,.85)'
      ctx.fillRect(x, bottom - bar - 3, COL_W, 3)
    }
    if (!o.reduced && sc.flash[i]! > 0.02) {
      ctx.globalAlpha = sc.flash[i]! * 0.35
      ctx.fillStyle = sc.glow[i]!
      ctx.fillRect(x - 6, top, COL_W + 12, colH)
      ctx.globalAlpha = 1
    }
  }

  // la línea del compás (spec 050): se rellena de izquierda a derecha con cada compás y vuelve a empezar al pasar al siguiente; cuatro marcas, una por tiempo; engorda un poco con el bombo (el peso)
  const phase = sc.live ? Math.min(1, Math.max(0, o.phase ?? 0)) : (((t / sc.tl.barSeconds) % 1) + 1) % 1
  const lineW = w - 2 * M
  const thick = 6 + sc.energy[0]! * 30
  ctx.fillStyle = 'rgba(255,255,255,.12)'
  ctx.fillRect(M, floorY, lineW, thick)
  ctx.fillStyle = sc.fill[0]!
  ctx.fillRect(M, floorY, lineW * phase, thick)
  ctx.fillStyle = INK
  for (let k = 1; k < 4; k++) ctx.fillRect(M + (lineW * k) / 4 - 1, floorY, 2, thick)

  // el flash de cambio de sección (en directo, el de cambio de parte)
  let name: string
  let since: number
  let first: boolean
  if (sc.live) {
    name = sc.liveName
    since = sc.liveSince
    first = since >= 0
  } else {
    const si = sectionAt(sc.tl, t)
    name = sc.sectionLabels[si] ?? ''
    since = sc.tl.sections[si]!.t0
    first = si > 0
  }
  if (!o.reduced && first) {
    const dt = t - since
    if (dt >= 0 && dt < SECTION_FLASH_S) {
      ctx.globalAlpha = SECTION_FLASH_A * (1 - dt / SECTION_FLASH_S)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
    }
  }

  // los textos (cachés: ni cadenas ni objetos nuevos por fotograma)
  if (sc.fontScale !== o.scale) {
    sc.fontScale = o.scale
    sc.fontStr = `${fontPx(22, o.scale)}px system-ui, sans-serif`
  }
  let foot = sc.footer
  if (!sc.live) {
    const sec = Math.floor(t)
    if (sc.timeSec !== sec) {
      sc.timeSec = sec
      sc.timeStr = `${fmtTime(Math.max(0, t))} / ${fmtTime(sc.tl.duration)}`
    }
    foot = sc.timeStr
  }
  ctx.font = sc.fontStr
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(255,255,255,.6)'
  ctx.fillText(sc.title, M, top - 80)
  ctx.fillStyle = 'rgba(255,255,255,.95)'
  ctx.fillText(name, M, top - 44)
  if (foot) {
    ctx.fillStyle = 'rgba(255,255,255,.4)'
    ctx.fillText(foot, M, footerY)
  }
}

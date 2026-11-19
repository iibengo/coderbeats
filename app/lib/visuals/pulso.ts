/**
 * Visualizador «Pulso» (spec 049): vertical 9:16, para un tema oscuro y de golpes secos (el drill). Cinco columnas, una por voz (bombo, bajo, caja, platillo, melodía; los colores de `VOICE_HEX`), cada una con una barra
 * cuya altura es la **energía de esa voz en ese instante**: cada golpe suma su fuerza y se apaga rápido, con una línea clara arriba y un destello seco en el golpe. Un **suelo** que se ensancha con el bombo (el peso del drop)
 * y un flash blanco breve al cambiar de sección. Puro: dibuja con lo que le dan (un contexto 2D y una línea de tiempo), sin DOM. Todo se precalcula en `makePulso`; el dibujo **no asigna objetos** (los textos se cachean).
 * Reglas de `specs/DISENO.md`: fondo `INK`, un instrumento un color, texto de al menos 11 px reales (`fontPx`), movimiento reducido sin destellos ni flash.
 */
import { fontPx } from '../lab'
import { INK, VOICE_RGB_CSS, type Voice } from '../palette'
import { LANES, type Timeline } from '../timeline'

/** El lienzo es fijo y se escala con CSS (como los del Laboratorio). */
export const PULSO_W = 540
export const PULSO_H = 960

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
const TOP = 150
const COL_H = 690
const BOTTOM = TOP + COL_H
const FLOOR_Y = BOTTOM + 24

/** Lo que usa el dibujo de un contexto 2D (para poder probarlo sin DOM). */
export type Ctx2D = Pick<CanvasRenderingContext2D, 'fillStyle' | 'font' | 'globalAlpha' | 'textAlign' | 'textBaseline' | 'fillRect' | 'fillText'>

export interface PulsoScene {
  tl: Timeline
  title: string
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

export function makePulso(tl: Timeline, title: string): PulsoScene {
  const total = fmtTime(tl.duration)
  return {
    tl,
    title,
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
  const lane = sc.tl.lanes[v]
  const tau = TAU[v]
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
}

export function drawPulso(ctx: Ctx2D, sc: PulsoScene, t: number, o: PulsoOptions): void {
  ctx.globalAlpha = 1
  ctx.fillStyle = INK
  ctx.fillRect(0, 0, PULSO_W, PULSO_H)

  // las columnas
  for (let i = 0; i < LANES.length; i++) {
    sampleLane(sc, i, t)
    const x = M + i * (COL_W + GAP)
    ctx.fillStyle = 'rgba(255,255,255,.05)'
    ctx.fillRect(x, TOP, COL_W, COL_H)
    const h = sc.energy[i]! * COL_H
    if (h > 0.5) {
      ctx.fillStyle = sc.fill[i]!
      ctx.fillRect(x, BOTTOM - h, COL_W, h)
      ctx.fillStyle = 'rgba(255,255,255,.85)'
      ctx.fillRect(x, BOTTOM - h - 3, COL_W, 3)
    }
    if (!o.reduced && sc.flash[i]! > 0.02) {
      ctx.globalAlpha = sc.flash[i]! * 0.35
      ctx.fillStyle = sc.glow[i]!
      ctx.fillRect(x - 6, TOP, COL_W + 12, COL_H)
      ctx.globalAlpha = 1
    }
  }

  // el suelo: se ensancha con el bombo (el peso)
  ctx.fillStyle = sc.fill[0]!
  ctx.fillRect(M, FLOOR_Y, PULSO_W - 2 * M, 4 + sc.energy[0]! * 36)

  // el flash de cambio de sección
  const si = sectionAt(sc.tl, t)
  if (!o.reduced && si > 0) {
    const dt = t - sc.tl.sections[si]!.t0
    if (dt >= 0 && dt < SECTION_FLASH_S) {
      ctx.globalAlpha = SECTION_FLASH_A * (1 - dt / SECTION_FLASH_S)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, PULSO_W, PULSO_H)
      ctx.globalAlpha = 1
    }
  }

  // los textos (cachés: ni cadenas ni objetos nuevos por fotograma)
  if (sc.fontScale !== o.scale) {
    sc.fontScale = o.scale
    sc.fontStr = `${fontPx(22, o.scale)}px system-ui, sans-serif`
  }
  const sec = Math.floor(t)
  if (sc.timeSec !== sec) {
    sc.timeSec = sec
    sc.timeStr = `${fmtTime(Math.max(0, t))} / ${fmtTime(sc.tl.duration)}`
  }
  ctx.font = sc.fontStr
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = 'rgba(255,255,255,.6)'
  ctx.fillText(sc.title, M, 70)
  ctx.fillStyle = 'rgba(255,255,255,.95)'
  ctx.fillText(sc.sectionLabels[si] ?? '', M, 106)
  ctx.fillStyle = 'rgba(255,255,255,.4)'
  ctx.fillText(sc.timeStr, M, PULSO_H - 40)
}

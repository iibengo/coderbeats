/**
 * El final del vídeo de la tarjeta (spec 061, paso 5): la tarjeta se apaga y el diablillo de coderbeats se dibuja como un neón (cabeza con sus cuernos, cascos, ojos y sonrisa) en
 * degradado de lila a rosa; debajo aparece «coderbeats.». Puro: dibuja con un contexto 2D y una función que crea `Path2D` (en los tests, falsos). El icono es `public/brand/diablillo.svg`
 * (v4, aprobada por Ion); aquí van sus trazos y sus largos (medidos con `getTotalLength`) para poder dibujarlos poco a poco.
 */
import { CARD_H, CARD_W, SAFE_BOTTOM, SAFE_TOP } from './cardCanvas'

/** lo que dura la animación (s); empieza en el último compás de la canción y acaba con ella */
export const OUTRO_S = 2.2
/** el lado del icono en el lienzo (px) y su caja en el dibujo original */
export const ICON_PX = 400
const BOX = 512
const LILA = '#B7A6F2'
const ROSA = '#F496BC'

export interface Stroke {
  d: string
  len: number
  /** el ancho en unidades del dibujo */
  w: number
}
export const DEVIL: Record<'contour' | 'cupL' | 'cupR' | 'eyeL' | 'eyeR' | 'smile', Stroke> = {
  contour: { d: 'M183 185 A128 128 0 0 1 329 185 Q346 128 384 100 C402 146 396 190 367 226 A128 128 0 1 1 145 226 C116 190 110 146 128 100 Q166 128 183 185 Z', len: 1165, w: 6 },
  cupL: { d: 'M104 232 A162 162 0 0 0 104 348', len: 119, w: 20 },
  cupR: { d: 'M408 232 A162 162 0 0 1 408 348', len: 119, w: 20 },
  eyeL: { d: 'M204 282 L238 296', len: 37, w: 9 },
  eyeR: { d: 'M308 282 L274 296', len: 37, w: 9 },
  smile: { d: 'M192 332 Q256 400 320 332', len: 150, w: 7 },
}

/** cuándo se dibuja cada parte, en la parte de la animación (0..1) */
export const TIMES = {
  card: [0, 0.28], // la tarjeta se apaga
  contour: [0.28, 0.62],
  cups: [0.5, 0.72],
  eyes: [0.66, 0.8],
  smile: [0.74, 0.88],
  word: [0.8, 1],
} as const satisfies Record<string, readonly [number, number]>

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const easeOut = (x: number) => 1 - (1 - x) ** 3
/** el avance (0..1, suave) de una parte en el instante `u` de la animación */
export const partProgress = (u: number, [a, b]: readonly [number, number]): number => easeOut(clamp01((u - a) / (b - a)))
/** la parte de la animación (0..1) en la que va una canción de `totalBars` compases cuando suena el compás `pos` */
export const outroU = (pos: number, totalBars: number, barSeconds: number): number => {
  const bars = OUTRO_S / barSeconds
  return clamp01((pos - (totalBars - bars)) / bars)
}

/** Dónde va el icono y el nombre: centrados en la zona útil (sin la franja del sticker de Instagram). */
export function outroLayout(): { x: number; y: number; scale: number; wordY: number; wordSize: number } {
  const usable = CARD_H - SAFE_BOTTOM - SAFE_TOP
  const wordSize = 112
  const total = ICON_PX + 60 + wordSize * 0.78
  const y = SAFE_TOP + (usable - total) / 2
  return { x: (CARD_W - ICON_PX) / 2, y, scale: ICON_PX / BOX, wordY: y + ICON_PX + 60 + wordSize * 0.78, wordSize }
}

interface Ctx {
  save(): void
  restore(): void
  translate(x: number, y: number): void
  scale(x: number, y: number): void
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(o: number, c: string): void }
  setLineDash(d: number[]): void
  stroke(p?: unknown): void
  beginPath(): void
  arc(x: number, y: number, r: number, a0: number, a1: number): void
  fill(): void
  fillText(t: string, x: number, y: number): void
  measureText(t: string): { width: number }
  lineDashOffset: number
  lineWidth: number
  lineCap: unknown
  lineJoin: unknown
  strokeStyle: unknown
  fillStyle: unknown
  shadowColor: string
  shadowBlur: number
  globalAlpha: number
  font: string
  textAlign: unknown
  textBaseline: unknown
}

function draw(g: Ctx, mk: (d: string) => unknown, s: Stroke, p: number) {
  if (p <= 0) return
  g.lineWidth = s.w
  g.setLineDash([s.len + 2, s.len + 2])
  g.lineDashOffset = (s.len + 2) * (1 - p)
  g.stroke(mk(s.d))
}

/** Pinta el final en el instante `u` (0..1): el diablillo se dibuja y aparece el nombre. Con `u = 0` no pinta nada. */
export function drawOutro(g: Ctx, mk: (d: string) => unknown, u: number): void {
  const L = outroLayout()
  const pc = partProgress(u, TIMES.contour)
  const pu = partProgress(u, TIMES.cups)
  const pe = partProgress(u, TIMES.eyes)
  const ps = partProgress(u, TIMES.smile)
  const pw = partProgress(u, TIMES.word)
  if (pc > 0 || pu > 0 || pe > 0 || ps > 0) {
    g.save()
    // entra con un pequeño crecimiento desde el centro (de 0,94 a 1)
    const k = 0.94 + 0.06 * partProgress(u, [TIMES.contour[0], TIMES.smile[1]])
    g.translate(L.x + (ICON_PX * (1 - k)) / 2, L.y + (ICON_PX * (1 - k)) / 2)
    g.scale(L.scale * k, L.scale * k)
    const grad = g.createLinearGradient(120, 70, 400, 460)
    grad.addColorStop(0, LILA)
    grad.addColorStop(1, ROSA)
    g.strokeStyle = grad
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.shadowColor = 'rgba(244,150,188,0.85)'
    g.shadowBlur = 26
    draw(g, mk, DEVIL.contour, pc)
    draw(g, mk, DEVIL.cupL, pu)
    draw(g, mk, DEVIL.cupR, pu)
    draw(g, mk, DEVIL.eyeL, pe)
    draw(g, mk, DEVIL.eyeR, pe)
    draw(g, mk, DEVIL.smile, ps)
    g.restore()
  }
  if (pw > 0) {
    g.save()
    g.globalAlpha = pw
    g.font = `600 ${L.wordSize}px Inter, system-ui, sans-serif`
    g.textAlign = 'left'
    g.textBaseline = 'alphabetic'
    const w = g.measureText('coderbeats').width
    const dot = L.wordSize * 0.15
    const x0 = (CARD_W - (w + dot * 2 + 10)) / 2
    g.fillStyle = '#FFFFFF'
    const rise = (1 - pw) * 18 // sube mientras aparece
    g.fillText('coderbeats', x0, L.wordY + rise)
    g.fillStyle = ROSA
    g.beginPath()
    g.arc(x0 + w + 10 + dot, L.wordY + rise - dot, dot, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
}

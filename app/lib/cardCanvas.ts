/**
 * La tarjeta de la historia dibujada en un lienzo de 1080 × 1920 (spec 061, paso 3). Puro: recibe un contexto 2D (o uno falso en los tests). Fondo `#0B0B0F`, tarjeta centrada con las
 * barras del remix en rosa, el título, «firma · estilo · bpm» en mono y «hecha con coderbeats»; **la franja de abajo queda libre** para el sticker de enlace de Instagram.
 */
import { ACCENT } from './palette'

export const CARD_W = 1080
export const CARD_H = 1920
/** la franja de abajo que no se toca (el sticker de enlace de Instagram) y la de arriba (su barra de herramientas) */
export const SAFE_BOTTOM = 350
export const SAFE_TOP = 220
/** las barras del icono del remix (alturas base, 0..100) */
export const BARS = [55, 100, 38, 24, 72] as const

export interface CardLook {
  title: string
  /** «firma · estilo · bpm» (sin firma, sin autor) */
  meta: string
  madeWith: string
  /** la energía de cada barra, 0..1 (el paso 4 la anima con el audio; 0 = quietas) */
  level?: readonly number[]
  /** 0 = nada, 1 = todo negro: el fundido del final */
  fade?: number
}

type Ctx = Pick<CanvasRenderingContext2D, 'fillRect' | 'beginPath' | 'moveTo' | 'arcTo' | 'closePath' | 'fill' | 'stroke' | 'fillText' | 'measureText'> & {
  fillStyle: unknown
  strokeStyle: unknown
  lineWidth: number
  font: string
  textAlign: unknown
  textBaseline: unknown
  globalAlpha: number
}

/** Parte un título en líneas que caben en `maxW` (como mucho `maxLines`; si no cabe, la última acaba en «…»). */
export function wrapTitle(measure: (s: string) => number, text: string, maxW: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (!cur || measure(next) <= maxW) cur = next
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]!
  while (last.length > 1 && measure(`${last}…`) > maxW) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last.trimEnd()}…`
  return kept
}

/** El fundido del final: 0 hasta que faltan `fadeBars` compases, y sube a 1 en el último. */
export function fadeAmount(pos: number, totalBars: number, fadeBars: number): number {
  if (fadeBars <= 0 || pos >= totalBars) return pos >= totalBars ? 1 : 0
  const start = totalBars - fadeBars
  return pos <= start ? 0 : Math.min(1, (pos - start) / fadeBars)
}

/** El avance real (0..1) de la grabación: dónde va la canción respecto a sus compases. */
export const progressOf = (pos: number, totalBars: number): number => (totalBars > 0 ? Math.max(0, Math.min(1, pos / totalBars)) : 0)

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

/** Pinta un fotograma de la tarjeta. */
export function drawCard(g: Ctx, look: CardLook): void {
  g.globalAlpha = 1
  g.fillStyle = '#0B0B0F'
  g.fillRect(0, 0, CARD_W, CARD_H)

  const cardW = 880
  g.font = '600 88px Inter, system-ui, sans-serif'
  const lines = wrapTitle((s) => g.measureText(s).width, look.title, cardW - 120)
  const titleH = lines.length * 104
  const cardH = 150 + 230 + 70 + titleH + 40 + 50 + 120 + 40
  const usable = CARD_H - SAFE_BOTTOM - SAFE_TOP
  const x = (CARD_W - cardW) / 2
  const y = SAFE_TOP + Math.max(0, (usable - cardH) / 2)

  g.fillStyle = 'rgba(255,255,255,0.045)'
  g.strokeStyle = 'rgba(255,255,255,0.10)'
  g.lineWidth = 2
  roundRect(g, x, y, cardW, cardH, 72)
  g.fill()
  g.stroke()

  // las barras del remix, en rosa
  const bw = 56
  const gap = 24
  const total = BARS.length * bw + (BARS.length - 1) * gap
  const bx = (CARD_W - total) / 2
  const base = y + 150 + 200
  g.fillStyle = ACCENT
  BARS.forEach((h, i) => {
    const energy = Math.max(0, Math.min(1, look.level?.[i] ?? 0))
    const bh = Math.max(24, (h / 100) * 200 * (0.85 + 0.3 * energy))
    roundRect(g, bx + i * (bw + gap), base - bh, bw, bh, 14)
    g.fill()
  })

  // el título y la línea en mono
  g.textAlign = 'center'
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#FFFFFF'
  g.font = '600 88px Inter, system-ui, sans-serif'
  let ty = base + 70 + 80
  for (const ln of lines) {
    g.fillText(ln, CARD_W / 2, ty)
    ty += 104
  }
  g.fillStyle = 'rgba(255,255,255,0.62)'
  g.font = '400 36px "JetBrains Mono", ui-monospace, monospace'
  g.fillText(look.meta, CARD_W / 2, ty + 20)
  g.fillStyle = 'rgba(255,255,255,0.40)'
  g.font = '400 30px "JetBrains Mono", ui-monospace, monospace'
  g.fillText(look.madeWith, CARD_W / 2, y + cardH - 56)

  if (look.fade && look.fade > 0) {
    g.globalAlpha = Math.min(1, look.fade)
    g.fillStyle = '#0B0B0F'
    g.fillRect(0, 0, CARD_W, CARD_H)
    g.globalAlpha = 1
  }
}

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CARD_H, CARD_W, SAFE_BOTTOM, SAFE_TOP } from '../../app/lib/cardCanvas'
import { DEVIL, ICON_PX, OUTRO_S, TIMES, drawEndFade, drawOutro, outroLayout, outroU, partProgress } from '../../app/lib/cardOutro'

function fake() {
  const calls: { kind: string; dash?: number[]; offset?: number; text?: string; alpha?: number; x?: number; y?: number }[] = []
  let dash: number[] = []
  const g = {
    fillRect: (x: number, y: number, w: number, h: number) => calls.push({ kind: 'rect', x, y, alpha: g.globalAlpha, text: `${w}x${h}` }),
    save: () => {}, restore: () => {}, translate: () => {}, scale: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    setLineDash: (d: number[]) => { dash = d },
    stroke: () => calls.push({ kind: 'stroke', dash, offset: g.lineDashOffset }),
    beginPath: () => {}, arc: (x: number, y: number) => calls.push({ kind: 'arc', x, y }), fill: () => {},
    fillText: (text: string, x: number, y: number) => calls.push({ kind: 'text', text, x, y, alpha: g.globalAlpha }),
    measureText: (t: string) => ({ width: t.length * 60 }),
    lineDashOffset: 0, lineWidth: 1, lineCap: '', lineJoin: '', strokeStyle: '' as unknown, fillStyle: '' as unknown,
    shadowColor: '', shadowBlur: 0, globalAlpha: 1, font: '', textAlign: '' as unknown, textBaseline: '' as unknown,
  }
  return { g, calls }
}

describe('el final del vídeo: el diablillo y el nombre (spec 061, paso 5)', () => {
  it('antes de empezar no pinta nada, y al acabar está todo: 6 trazos, el nombre y el punto', () => {
    const a = fake()
    drawOutro(a.g, (d) => d, 0)
    expect(a.calls).toEqual([])
    const z = fake()
    drawOutro(z.g, (d) => d, TIMES.contour[0] - 0.01)
    expect(z.calls).toEqual([])
    const b = fake()
    drawOutro(b.g, (d) => d, 1)
    expect(b.calls.filter((c) => c.kind === 'stroke').length).toBe(6)
    expect(b.calls.filter((c) => c.kind === 'text').map((c) => c.text)).toEqual(['coderbeats'])
    expect(b.calls.filter((c) => c.kind === 'arc').length).toBe(1)
    for (const s of b.calls.filter((c) => c.kind === 'stroke')) expect(s.offset).toBeCloseTo(0, 6) // todo dibujado
  })

  it('los trazos se dibujan poco a poco: el contorno va primero y la sonrisa después', () => {
    const mid = fake()
    drawOutro(mid.g, (d) => d, (TIMES.contour[0] + TIMES.contour[1]) / 2)
    const strokes = mid.calls.filter((c) => c.kind === 'stroke')
    expect(strokes.length).toBe(1) // solo el contorno, a medias
    expect(strokes[0]!.offset).toBeGreaterThan(0)
    expect(strokes[0]!.offset).toBeLessThan(DEVIL.contour.len + 2)
    expect(mid.calls.some((c) => c.kind === 'text')).toBe(false)
  })

  it('el avance de cada parte sube sin pasarse, y el nombre entra con fundido', () => {
    expect(partProgress(0, TIMES.word)).toBe(0)
    expect(partProgress(1, TIMES.word)).toBe(1)
    expect(partProgress(0.9, TIMES.word)).toBeGreaterThan(0)
    expect(partProgress(0.9, TIMES.word)).toBeLessThan(1)
    for (let u = 0; u <= 1; u += 0.05) {
      const p = partProgress(u, TIMES.contour)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(1)
    }
    const alpha = fake()
    drawOutro(alpha.g, (d) => d, 0.9)
    const t = alpha.calls.find((c) => c.kind === 'text')!
    expect(t.alpha).toBeGreaterThan(0)
    expect(t.alpha).toBeLessThan(1)
  })

  it('la animación ocupa los últimos OUTRO_S segundos de la canción', () => {
    const bar = 1.8 // s
    const total = 12
    const bars = OUTRO_S / bar
    expect(outroU(total - bars - 0.1, total, bar)).toBe(0)
    expect(outroU(total - bars / 2, total, bar)).toBeCloseTo(0.5, 6)
    expect(outroU(total, total, bar)).toBeCloseTo(1, 6)
    expect(outroU(total + 5, total, bar)).toBe(1)
  })

  it('el icono y el nombre quedan dentro de la zona útil, sin pisar la franja del sticker', () => {
    const L = outroLayout()
    expect(L.y).toBeGreaterThanOrEqual(SAFE_TOP)
    expect(L.x).toBeGreaterThan(0)
    expect(L.x + ICON_PX).toBeLessThanOrEqual(CARD_W)
    expect(L.wordY + 30).toBeLessThanOrEqual(CARD_H - SAFE_BOTTOM) // con la caída de las letras
    const z = fake()
    drawOutro(z.g, (d) => d, 1)
    const t = z.calls.find((c) => c.kind === 'text')!
    expect(t.x).toBeGreaterThan(0)
    expect(t.y!).toBeLessThanOrEqual(CARD_H - SAFE_BOTTOM)
  })

  it('el fundido final llega a oscuro y no pinta nada si no toca', () => {
    const a = fake()
    drawEndFade(a.g, 0)
    drawEndFade(a.g, -1)
    drawEndFade(a.g, Number.NaN)
    expect(a.calls).toEqual([])
    const b = fake()
    drawEndFade(b.g, 0.5)
    expect(b.calls).toEqual([{ kind: 'rect', x: 0, y: 0, alpha: 0.5, text: `${CARD_W}x${CARD_H}` }])
    const c = fake()
    drawEndFade(c.g, 3)
    expect(c.calls[0]!.alpha).toBe(1)
    expect(c.g.globalAlpha).toBe(1) // lo deja como estaba
  })

  it('el dibujo del código es el mismo que el de public/brand/diablillo.svg (el aprobado)', () => {
    const svg = readFileSync('public/brand/diablillo.svg', 'utf8')
    for (const [k, s] of Object.entries(DEVIL)) expect(svg.includes(`d="${s.d}"`), k).toBe(true)
  })
})

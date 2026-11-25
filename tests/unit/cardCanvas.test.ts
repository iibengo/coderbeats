import { describe, expect, it } from 'vitest'
import { BARS, CARD_H, CARD_W, SAFE_BOTTOM, SAFE_TOP, drawCard, fadeAmount, metaSize, progressOf, wrapTitle } from '../../app/lib/cardCanvas'

/** un contexto falso que apunta dónde se pinta cada cosa */
function fake() {
  const drawn: { kind: string; x: number; y: number; top?: number; w?: number; h?: number; text?: string }[] = []
  let path: { x: number; y: number }[] = []
  const g = {
    fillStyle: '' as unknown, strokeStyle: '' as unknown, lineWidth: 1, font: '', textAlign: '' as unknown, textBaseline: '' as unknown, globalAlpha: 1,
    fillRect: (x: number, y: number, w: number, h: number) => drawn.push({ kind: 'rect', x, y, w, h }),
    beginPath: () => { path = [] },
    moveTo: (x: number, y: number) => path.push({ x, y }),
    arcTo: (x: number, y: number, x2: number, y2: number) => path.push({ x, y }, { x: x2, y: y2 }),
    closePath: () => {},
    fill: () => drawn.push({ kind: 'path', x: Math.min(...path.map((p) => p.x)), y: Math.max(...path.map((p) => p.y)), top: Math.min(...path.map((p) => p.y)) }),
    stroke: () => {},
    fillText: (text: string, x: number, y: number) => drawn.push({ kind: 'text', x, y, text }),
    measureText: (s: string) => ({ width: s.length * 40 }) as TextMetrics,
    createRadialGradient: () => ({ addColorStop: () => {} }) as unknown as CanvasGradient,
  }
  return { g, drawn }
}

describe('la tarjeta de la historia (spec 061, paso 3)', () => {
  it('nada se pinta en la franja de abajo (la del sticker de enlace) ni en la de arriba', () => {
    for (const title of ['Lacrimosa (Requiem)', 'Un título muy largo que tiene que partirse en varias líneas para caber en la tarjeta de la historia de hoy']) {
      const { g, drawn } = fake()
      drawCard(g, { title, meta: 'Ion · drill · 145 bpm', madeWith: 'hecha con coderbeats', level: [0.2, 1, 0.5, 0, 0.8] })
      const content = drawn.filter((d) => !(d.kind === 'rect' && d.w === CARD_W && d.h === CARD_H)) // salvo el fondo
      expect(content.length).toBeGreaterThan(8)
      for (const d of content) {
        expect(d.y + (d.kind === 'rect' ? d.h ?? 0 : 0), `${d.kind} ${d.text ?? ''}`).toBeLessThanOrEqual(CARD_H - SAFE_BOTTOM) // también el brillo de detrás cabe entero
        expect(d.y, `${d.kind} ${d.text ?? ''}`).toBeGreaterThanOrEqual(SAFE_TOP - 1)
      }
      expect(drawn.filter((d) => d.kind === 'text').map((d) => d.text)).toContain('hecha con coderbeats')
    }
  })

  it('el brillo de detrás tiene un color por voz y respira con el bajo; la dirección va arriba, pequeña y en mono', () => {
    const grads: string[] = []
    const { g, drawn } = fake()
    ;(g as { createRadialGradient: unknown }).createRadialGradient = () => ({ addColorStop: (_o: number, c: string) => grads.push(c) })
    drawCard(g, { title: 'Wow', meta: 'techno · 132 bpm', madeWith: 'hecha con coderbeats', site: 'coderbeats.vercel.app', glow: 0 })
    const quiet = grads.filter((c) => !c.endsWith(',0)')).map((c) => Number(c.match(/,([\d.]+)\)$/)![1]))
    expect(quiet.length).toBe(5)
    quiet.forEach((a) => expect(a).toBeLessThanOrEqual(0.08)) // poca opacidad
    grads.length = 0
    const loud = fake()
    ;(loud.g as { createRadialGradient: unknown }).createRadialGradient = () => ({ addColorStop: (_o: number, c: string) => grads.push(c) })
    drawCard(loud.g, { title: 'Wow', meta: 'x', madeWith: 'y', glow: 1 })
    const peak = grads.filter((c) => !c.endsWith(',0)')).map((c) => Number(c.match(/,([\d.]+)\)$/)![1]))
    expect(Math.max(...peak)).toBeGreaterThan(Math.max(...quiet)) // con el bajo, respira un poco más
    expect(Math.max(...peak)).toBeLessThanOrEqual(0.13)
    const site = drawn.find((d) => d.text === 'coderbeats.vercel.app')!
    expect(site.y).toBeGreaterThanOrEqual(SAFE_TOP)
    expect(site.y).toBeLessThan(400) // arriba del todo
    expect(drawn.some((d) => d.text === 'coderbeats.vercel.app')).toBe(true)
    expect(fake().drawn.length).toBe(0)
  })

  it('las barras vuelven a su reposo con `rest`', () => {
    const heights = (rest: number) => {
      const { g, drawn } = fake()
      drawCard(g, { title: 'x', meta: 'y', madeWith: 'z', level: [1, 1, 1, 1, 1], rest })
      return drawn.filter((d) => d.kind === 'path').map((d) => d.top)
    }
    expect(heights(0)).not.toEqual(heights(1))
  })

  it('pinta las cinco barras y el título tal cual, centrados', () => {
    const { g, drawn } = fake()
    drawCard(g, { title: 'Wow', meta: 'techno · 132 bpm', madeWith: 'hecha con coderbeats' })
    expect(drawn.filter((d) => d.kind === 'path').length).toBe(BARS.length + 1) // las cinco voces y la tarjeta
    const t = drawn.find((d) => d.text === 'Wow')!
    expect(t.x).toBe(CARD_W / 2)
  })

  it('la línea en mono con una firma larga se encoge para caber con margen', () => {
    const m = (size: number) => 41 * size * 0.6 // 41 caracteres en mono: «iioniias - CafeAndCode · techno · 132 bpm»
    const maxW = 880 - 140
    const size = metaSize(m, maxW)
    expect(size).toBeLessThan(36)
    expect(m(size)).toBeLessThanOrEqual(maxW)
    expect(metaSize(() => 300, maxW)).toBe(36) // si ya cabe, no se toca
    expect(metaSize(() => 99999, maxW)).toBe(22) // nunca por debajo del mínimo
    expect(metaSize(() => 0, maxW)).toBe(36)
  })

  it('el fundido final cubre todo el lienzo y solo cuando se pide', () => {
    const sin = fake()
    drawCard(sin.g, { title: 'x', meta: 'y', madeWith: 'z' })
    const con = fake()
    drawCard(con.g, { title: 'x', meta: 'y', madeWith: 'z', fade: 0.5 })
    expect(con.drawn.filter((d) => d.kind === 'rect').length).toBe(sin.drawn.filter((d) => d.kind === 'rect').length + 1)
  })

  it('un título largo se parte en líneas y, si no cabe, acaba en «…»', () => {
    const m = (s: string) => s.length * 10
    expect(wrapTitle(m, 'Wow', 300)).toEqual(['Wow'])
    expect(wrapTitle(m, 'uno dos tres cuatro cinco seis', 100)).toEqual(['uno dos', 'tres', 'cuatro', 'cinco'].slice(0, 3).map((x, i, a) => (i === 2 ? 'cuatro…' : x)))
    expect(wrapTitle(m, 'a'.repeat(80), 100, 2).length).toBe(1)
    expect(wrapTitle(m, '   ', 100)).toEqual([])
  })

  it('el fundido sube en los últimos compases y el avance es real, entre 0 y 1', () => {
    expect(fadeAmount(0, 8, 0.5)).toBe(0)
    expect(fadeAmount(7.5, 8, 0.5)).toBe(0)
    expect(fadeAmount(7.75, 8, 0.5)).toBeCloseTo(0.5)
    expect(fadeAmount(8, 8, 0.5)).toBe(1)
    expect(fadeAmount(9, 8, 0.5)).toBe(1)
    expect(progressOf(-1, 8)).toBe(0)
    expect(progressOf(4, 8)).toBe(0.5)
    expect(progressOf(10, 8)).toBe(1)
    expect(progressOf(1, 0)).toBe(0)
  })
})

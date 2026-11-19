import { describe, expect, it } from 'vitest'
import { fontPx } from '../../app/lib/lab'
import { INK } from '../../app/lib/palette'
import { songTimeline } from '../../app/lib/timeline'
import { labRemixById } from '../../app/lib/labRemixes'
import { compress, drawPulso, LANE_GAIN, lastAtOrBefore, makePulso, PULSO_H, PULSO_W, sampleLane, sectionAt, TAU, type Ctx2D } from '../../app/lib/visuals/pulso'

/** un contexto falso que apunta lo que se dibuja */
function fake() {
  const ops: { op: string; fill: string; alpha: number; a: number[] }[] = []
  const ctx = {
    fillStyle: '' as string,
    font: '',
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    fillRect(x: number, y: number, w: number, h: number) { ops.push({ op: 'rect', fill: String(this.fillStyle), alpha: this.globalAlpha, a: [x, y, w, h] }) },
    fillText(s: string, x: number, y: number) { ops.push({ op: `text:${s}`, fill: String(this.fillStyle), alpha: this.globalAlpha, a: [x, y] }) },
  }
  return { ctx: ctx as unknown as Ctx2D, ops, raw: ctx }
}
const r = labRemixById('lacrimosa-drill')!
const tl = songTimeline(r.song, r.style)
const sec = (n: string) => tl.sections.find((s) => s.name === n)!

describe('el visualizador «Pulso» (spec 049)', () => {
  it('la búsqueda binaria encuentra el último golpe anterior a un instante', () => {
    const a = Float64Array.from([1, 2, 2.5, 4])
    expect([lastAtOrBefore(a, 0.5), lastAtOrBefore(a, 1), lastAtOrBefore(a, 2.4), lastAtOrBefore(a, 100)]).toEqual([-1, 0, 1, 3])
    expect(lastAtOrBefore(new Float64Array(0), 3)).toBe(-1)
  })
  it('la energía: un golpe suma su fuerza y decae con exp(−Δt/τ); tope 1; antes del primer golpe, 0', () => {
    const one = songTimeline({ version: 1, cells: [{ id: 1, loops: [{ id: 1, instrument: 'sd', bars: 1, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, hits: [{ pos: 0, strength: 0.8 }] }], parts: { bass: false, chords: false }, turns: 1, at: { x: 0, y: 0, depth: 0 } }] as never, order: [1], groups: [], nextGroupId: 1, bpm: 120, nextCellId: 2, nextLoopId: 2 }, 'techno2')
    const sc = makePulso(one, 'x')
    const i = 2 // caja
    sampleLane(sc, i, 0)
    expect(sc.energy[i]).toBeCloseTo(compress(0.8), 6)
    sampleLane(sc, i, TAU.sd)
    expect(sc.energy[i]).toBeCloseTo(compress(0.8 * Math.exp(-1)), 6)
    sampleLane(sc, i, 10 * TAU.sd)
    expect(sc.energy[i]).toBe(0) // pasados 6·τ ya no cuenta
    sampleLane(sc, i, -1)
    expect(sc.energy[i]).toBe(0)
    for (const t of [0, 0.01, 0.5, 1, 2]) { sampleLane(sc, i, t); expect(sc.energy[i]).toBeLessThanOrEqual(1) }
  })
  it('el primer trazo es el fondo negro (INK) del lienzo entero y siempre hay una columna por voz', () => {
    const { ctx, ops } = fake()
    drawPulso(ctx, makePulso(tl, r.title), 1, { scale: 0.67, reduced: false })
    expect(ops[0]).toMatchObject({ op: 'rect', fill: INK, a: [0, 0, PULSO_W, PULSO_H] })
    expect(ops.filter((o) => o.op === 'rect' && o.fill === 'rgba(255,255,255,.05)')).toHaveLength(5)
  })
  it('en el drop las barras del bombo y la caja se levantan; en la intro, ni bombo ni caja', () => {
    const colHeight = (t: number, lane: number) => {
      const sc = makePulso(tl, 'x')
      sampleLane(sc, lane, t)
      return sc.energy[lane]!
    }
    // en el instante de un golpe de bombo del drop
    const bdT = Array.from(tl.lanes.bd.t).find((t) => t >= sec('Drop').t0 + 1)!
    expect(colHeight(bdT + 0.001, 0)).toBeGreaterThan(0.5)
    expect(colHeight(sec('Intro').t0 + 3, 0)).toBe(0)
    expect(colHeight(sec('Intro').t0 + 3, 2)).toBe(0)
  })
  it('el flash de cambio de sección y los destellos solo salen sin movimiento reducido', () => {
    const t = sec('Drop').t0 + 0.05
    const full = fake()
    drawPulso(full.ctx, makePulso(tl, 'x'), t, { scale: 1, reduced: false })
    const quiet = fake()
    drawPulso(quiet.ctx, makePulso(tl, 'x'), t, { scale: 1, reduced: true })
    const flashFull = full.ops.filter((o) => o.op === 'rect' && o.fill === '#fff' && o.a[2] === PULSO_W && o.a[3] === PULSO_H)
    expect(flashFull).toHaveLength(1)
    expect(flashFull[0]!.alpha).toBeGreaterThan(0)
    expect(quiet.ops.filter((o) => o.op === 'rect' && o.fill === '#fff' && o.a[2] === PULSO_W)).toHaveLength(0)
    expect(quiet.ops.filter((o) => o.alpha < 1 && o.alpha > 0).length).toBe(0) // sin destellos ni flash
  })
  it('sectionAt da la sección que suena y los textos llevan el nombre y el tiempo', () => {
    expect(sectionAt(tl, 0)).toBe(0)
    expect(tl.sections[sectionAt(tl, sec('Break').t0 + 1)]!.name).toBe('Break')
    const { ctx, ops } = fake()
    drawPulso(ctx, makePulso(tl, 'Lacrimosa (Requiem)'), sec('Break').t0 + 1, { scale: 1, reduced: false })
    const texts = ops.filter((o) => o.op.startsWith('text:')).map((o) => o.op.slice(5))
    expect(texts[0]).toBe('Lacrimosa (Requiem)')
    expect(texts[1]).toBe('Break')
    expect(texts[2]).toMatch(/^1:\d\d \/ 1:59$/)
  })
  it('el texto no baja de 11 px reales: con el lienzo pequeño en pantalla, la letra del lienzo crece (fontPx)', () => {
    const { ctx, raw } = fake()
    drawPulso(ctx, makePulso(tl, 'x'), 1, { scale: 0.3, reduced: false })
    expect(raw.font).toBe(`${fontPx(22, 0.3)}px system-ui, sans-serif`)
    expect(fontPx(22, 0.3) * 0.3).toBeGreaterThanOrEqual(11)
  })
  it('el dibujo no crea objetos por fotograma: la escena reutiliza sus arrays y cachea los textos', () => {
    const sc = makePulso(tl, 'x')
    const en = sc.energy
    const fl = sc.flash
    const { ctx } = fake()
    drawPulso(ctx, sc, 5, { scale: 1, reduced: false })
    const label = sc.timeStr
    drawPulso(ctx, sc, 5.4, { scale: 1, reduced: false })
    expect(sc.energy).toBe(en)
    expect(sc.flash).toBe(fl)
    expect(sc.timeStr).toBe(label) // el mismo segundo: la misma cadena
  })
})

describe('el peso de cada voz en su barra (spec 049)', () => {
  it('la melodía pesa menos que la batería y el bajo: la misma suma de golpes da una barra más baja', () => {
    expect(LANE_GAIN.mel).toBeLessThan(LANE_GAIN.bd)
    for (const v of ['bd', 'bass', 'sd', 'hh'] as const) expect(LANE_GAIN[v]).toBe(1)
    expect(compress(2 * LANE_GAIN.mel)).toBeLessThan(compress(2))
  })
  it('en el golpe de un drop, la barra del bombo supera a la de la melodía en un instante con bombo, bajo, caja, charles y cuerdas a la vez', () => {
    const t = Array.from(tl.lanes.bd.t).find((x) => x >= sec('Drop').t0 + 1)! + 0.001
    const sc = makePulso(tl, 'x')
    for (let i = 0; i < 5; i++) sampleLane(sc, i, t)
    expect(sc.energy[0]!).toBeGreaterThan(0.5) // el bombo
    expect(sc.energy[4]!).toBeLessThan(1) // la melodía ya no llega siempre al tope
  })
})

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

import { layoutFor, liveLane, makePulsoLive, PULSO_COMPACT, PULSO_VERTICAL, pushLive, setLivePart } from '../../app/lib/visuals/pulso'
import { LANES } from '../../app/lib/timeline'

describe('Pulso en directo (spec 050)', () => {
  const lane = (v: (typeof LANES)[number]) => LANES.indexOf(v)
  it('un golpe en cola no cuenta hasta que llega su instante; luego suma y decae con su τ', () => {
    const sc = makePulsoLive('x')
    const { ctx } = fake()
    pushLive(sc, 'sd', 0.8, 1)
    drawPulso(ctx, sc, 0.5, { scale: 1, reduced: false })
    expect(sc.energy[lane('sd')]).toBe(0) // todavía no ha sonado
    drawPulso(ctx, sc, 1, { scale: 1, reduced: false })
    expect(sc.energy[lane('sd')]).toBeCloseTo(compress(0.8), 6)
    drawPulso(ctx, sc, 1 + TAU.sd, { scale: 1, reduced: false })
    expect(sc.energy[lane('sd')]).toBeCloseTo(compress(0.8 * Math.exp(-1)), 6)
    expect(sc.live!.count).toBe(0) // la cola se vació
  })
  it('golpes que llegan desordenados y en el futuro: se aplican cada uno a su hora, y los que aún no tocan se quedan en la cola', () => {
    const sc = makePulsoLive('x')
    const { ctx } = fake()
    pushLive(sc, 'bd', 1, 2)
    pushLive(sc, 'hh', 1, 1)
    pushLive(sc, 'hh', 1, 3)
    drawPulso(ctx, sc, 1.5, { scale: 1, reduced: false })
    expect(sc.energy[lane('hh')]).toBeGreaterThan(0)
    expect(sc.energy[lane('bd')]).toBe(0)
    expect(sc.live!.count).toBe(2) // el bombo (t=2) y el segundo charles (t=3)
    drawPulso(ctx, sc, 3.01, { scale: 1, reduced: false })
    expect(sc.live!.count).toBe(0)
    expect(sc.energy[lane('hh')]).toBeGreaterThan(0.9 * compress(1)) // el segundo golpe, recién aplicado
  })
  it('la cola es de tamaño fijo: con demasiados golpes se pierden los más viejos y no se rompe nada; los datos raros se ignoran', () => {
    const sc = makePulsoLive('x')
    for (let i = 0; i < 700; i++) pushLive(sc, 'hh', 0.5, 10 + i * 0.001)
    expect(sc.live!.count).toBe(512)
    pushLive(sc, 'nope' as never, 1, 1)
    pushLive(sc, 'bd', Number.NaN, 1)
    pushLive(sc, 'bd', 1, Number.POSITIVE_INFINITY)
    expect(sc.live!.count).toBe(512)
    const before = sc.live!.qT
    pushLive(sc, 'bd', 1, 1)
    expect(sc.live!.qT).toBe(before) // el mismo array: no se crea otro
  })
  it('el cambio de parte: el nombre se ve y el flash blanco dura 0,25 s (y no sale con movimiento reducido)', () => {
    const sc = makePulsoLive('Lacrimosa')
    setLivePart(sc, 'Drop', 5)
    const on = fake()
    drawPulso(on.ctx, sc, 5.05, { scale: 1, reduced: false })
    expect(on.ops.some((o) => o.op === 'text:Drop')).toBe(true)
    expect(on.ops.filter((o) => o.op === 'rect' && o.fill === '#fff' && o.a[2] === PULSO_COMPACT.w && o.a[3] === PULSO_COMPACT.h)).toHaveLength(1)
    const late = fake()
    drawPulso(late.ctx, sc, 5.4, { scale: 1, reduced: false })
    expect(late.ops.filter((o) => o.op === 'rect' && o.fill === '#fff' && o.a[2] === PULSO_COMPACT.w)).toHaveLength(0)
    const quiet = fake()
    drawPulso(quiet.ctx, sc, 5.05, { scale: 1, reduced: true })
    expect(quiet.ops.filter((o) => o.op === 'rect' && o.fill === '#fff' && o.a[2] === PULSO_COMPACT.w)).toHaveLength(0)
  })
  it('qué carril es un golpe del motor y cuánto se oye', () => {
    expect(liveLane('bd', null, 0.7)).toEqual({ lane: 'bd', level: 0.7 })
    expect(liveLane('sd', { instrument: 'sd' }, 0.5)).toEqual({ lane: 'sd', level: 0.5 })
    expect(liveLane('bass', null, 0.1)!.lane).toBe('bass') // el fondo del estilo
    expect(liveLane('chords', null, 0.9)!.lane).toBe('mel')
    expect(liveLane('mel', { instrument: 'mel', synth: 'sub' }, 0.8)!.lane).toBe('bass')
    expect(liveLane('mel', { instrument: 'mel', synth: 'hat' }, 1)!.lane).toBe('hh')
    expect(liveLane('mel', { instrument: 'mel', synth: 'cuerdas' }, 0)).toEqual({ lane: 'mel', level: expect.closeTo(0.33, 6) })
    expect(liveLane('mel', { instrument: 'mel', synth: 'riser' }, 1)).toBeNull()
    expect(liveLane('mel', null, 1)!.lane).toBe('mel')
    expect(liveLane(null, null, 1)).toBeNull()
    expect(liveLane('voz', null, 1)!.lane).toBe('mel')
  })
})

describe('los dos tamaños de Pulso (spec 050)', () => {
  it('la composición cabe en cada tamaño: títulos arriba, columnas, suelo y pie abajo, nada fuera del lienzo', () => {
    for (const size of [PULSO_VERTICAL, PULSO_COMPACT]) {
      const l = layoutFor(size)
      expect(l.top).toBeGreaterThan(80) // sitio para el título y el nombre de la parte
      expect(l.colH).toBeGreaterThan(300)
      expect(l.bottom).toBe(l.top + l.colH)
      expect(l.floorY + 4 + 36).toBeLessThanOrEqual(l.footerY) // el suelo, al crecer, no pisa el pie
      expect(l.footerY).toBeLessThanOrEqual(size.h)
    }
    expect(layoutFor(PULSO_VERTICAL)).toEqual({ top: 150, colH: 690, bottom: 840, floorY: 864, footerY: 920 }) // el de la spec 049, sin cambios
    expect(layoutFor(PULSO_COMPACT).colH).toBeLessThan(layoutFor(PULSO_VERTICAL).colH)
  })
  it('un lienzo compacto se pinta entero (fondo INK del tamaño compacto) y el vertical, como siempre', () => {
    const c = fake()
    drawPulso(c.ctx, makePulso(tl, 'x', PULSO_COMPACT), 1, { scale: 1, reduced: false })
    expect(c.ops[0]).toMatchObject({ op: 'rect', fill: INK, a: [0, 0, PULSO_COMPACT.w, PULSO_COMPACT.h] })
    const v = fake()
    drawPulso(v.ctx, makePulso(tl, 'x'), 1, { scale: 1, reduced: false })
    expect(v.ops[0]).toMatchObject({ a: [0, 0, PULSO_W, PULSO_H] })
  })
})

describe('la línea del compás se rellena (spec 050)', () => {
  const lineW = PULSO_W - 72
  const line = (ops: ReturnType<typeof fake>['ops'], floorY: number) => ops.filter((o) => o.op === 'rect' && o.a[1] === floorY)
  const floorOf = (size = PULSO_VERTICAL) => layoutFor(size).floorY
  it('con línea de tiempo, el relleno sigue la fase del compás: la mitad a mitad de compás, y empieza de nuevo al pasar al siguiente', () => {
    const bs = tl.barSeconds
    const fill = (t: number) => {
      const c = fake()
      drawPulso(c.ctx, makePulso(tl, 'x'), t, { scale: 1, reduced: false })
      return line(c.ops, floorOf()).find((o) => o.fill.startsWith('rgba(245,201,122') && o.a[2] <= lineW + 1e-6 && o.a[2] !== lineW)?.a[2] ?? 0
    }
    expect(fill(bs * 7 + bs * 0.5)).toBeCloseTo(lineW * 0.5, 4)
    expect(fill(bs * 7 + bs * 0.25)).toBeCloseTo(lineW * 0.25, 4)
    expect(fill(bs * 8 + 0.001)).toBeLessThan(lineW * 0.01) // el compás siguiente: vuelve a empezar
    expect(fill(bs * 7 + bs * 0.99)).toBeGreaterThan(lineW * 0.95) // y justo antes, casi llena
  })
  it('en directo, la fase la da el reloj del motor (`phase`) y sin ella (parado) la línea está vacía', () => {
    const run = (phase?: number) => {
      const c = fake()
      drawPulso(c.ctx, makePulsoLive('x'), 1, { scale: 1, reduced: false, phase })
      return line(c.ops, floorOf(PULSO_COMPACT)).find((o) => o.fill.startsWith('rgba(245,201,122'))?.a[2] ?? 0
    }
    expect(run(0.75)).toBeCloseTo(lineW * 0.75, 4)
    expect(run(0)).toBe(0)
    expect(run(undefined)).toBe(0)
    expect(run(5)).toBeCloseTo(lineW, 4) // acotada a 1
    expect(run(-2)).toBe(0)
  })
  it('tres marcas finas separan los cuatro tiempos, y la línea se ve también con movimiento reducido (es un indicador, no un adorno)', () => {
    const c = fake()
    drawPulso(c.ctx, makePulso(tl, 'x'), 3.3, { scale: 1, reduced: true })
    const ticks = line(c.ops, floorOf()).filter((o) => o.fill === INK)
    expect(ticks).toHaveLength(3)
    expect(ticks.map((o) => Math.round(o.a[0] + 1))).toEqual([36 + lineW / 4, 36 + lineW / 2, 36 + (3 * lineW) / 4].map(Math.round))
    expect(line(c.ops, floorOf()).some((o) => o.fill.startsWith('rgba(245,201,122'))).toBe(true)
  })
  it('engorda un poco con el bombo pero cabe sobre el pie', () => {
    const l = layoutFor(PULSO_VERTICAL)
    const c = fake()
    const sc = makePulso(tl, 'x')
    const t = Array.from(tl.lanes.bd.t).find((x) => x >= sec('Drop').t0 + 1)! + 0.001
    drawPulso(c.ctx, sc, t, { scale: 1, reduced: false })
    const track = line(c.ops, l.floorY).find((o) => o.fill === 'rgba(255,255,255,.12)')!
    expect(track.a[3]).toBeGreaterThan(6)
    expect(l.floorY + track.a[3]).toBeLessThanOrEqual(l.footerY)
  })
})

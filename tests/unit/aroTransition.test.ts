import { describe, expect, it } from 'vitest'
import { edgeMarkers, MARKER_PAD } from '../../app/lib/aro/markers'
import { bridgeHalfWidth, gapBetween, NEXT_ALPHA, transitionAt, type CellPlan } from '../../app/lib/aro/transition'
import { DJF_OPEN, SWEEP_DJF, sweepDjf } from '../../app/lib/gestures'

const A = { id: 1, x: 0, y: 0 }
const B = { id: 2, x: 3, y: 0 }
const FAR = { id: 3, x: 9, y: 0 }
/** A suena los compases 4–7; en el 8 entra B; antes sonaba FAR */
const plan: CellPlan = { cur: A, start: 4, end: 8, next: B, prev: FAR }

describe('transición de agua', () => {
  it('lejos de las líneas de compás: cámara en la célula y nada más', () => {
    expect(transitionAt(6, plan)).toEqual({ cam: { x: 0, y: 0 }, ghost: null, bridge: null, pull: 0, thread: null })
  })

  it('en los 2 últimos tiempos crece el puente y lo recorre el brillo; la cámara aún no se mueve', () => {
    const t = transitionAt(7.6, plan)
    expect(t.cam).toEqual({ x: 0, y: 0 })
    expect(t.bridge).toMatchObject({ fromId: 1, toId: 2, t0: 0 })
    expect(t.bridge!.t1).toBeGreaterThan(0)
    expect(t.bridge!.t1).toBeLessThan(1)
    expect(t.bridge!.glow).toBeCloseTo(0.2)
    expect(t.bridge!.glow!).toBeLessThanOrEqual(t.bridge!.t1)
    expect(t.ghost!.id).toBe(2)
    expect(t.ghost!.alpha).toBeLessThan(NEXT_ALPHA)
    expect(t.pull).toBeGreaterThan(0)
  })

  it('la cámara se desliza de 1 tiempo antes de L a 1 tiempo después, y en L va por la mitad', () => {
    expect(transitionAt(7.75, plan).cam.x).toBe(0)
    const before = transitionAt(7.9, plan).cam.x
    expect(before).toBeGreaterThan(0)
    expect(before).toBeLessThan(1.5)
    expect(transitionAt(8, plan).cam.x).toBeCloseTo(1.5)
    // ya suena B (empezó en el 8): la cámara sigue desde la mitad, sin salto
    const after: CellPlan = { cur: B, start: 8, end: 12, next: FAR, prev: A }
    expect(transitionAt(8, after).cam.x).toBeCloseTo(1.5)
    expect(transitionAt(8.1, after).cam.x).toBeGreaterThan(1.5)
    expect(transitionAt(8.25, after).cam).toEqual({ x: 3, y: 0 })
  })

  it('tras L, la anterior se apaga en 1 tiempo y el puente se retrae hacia la nueva', () => {
    const after: CellPlan = { cur: B, start: 8, end: 12, next: FAR, prev: A }
    const t = transitionAt(8.125, after)
    expect(t.ghost).toEqual({ id: 1, alpha: 0.5 })
    expect(t.bridge).toMatchObject({ fromId: 1, toId: 2, t1: 1, glow: null })
    expect(t.bridge!.t0).toBeGreaterThan(0)
    expect(transitionAt(8.3, after).ghost).toBeNull()
  })

  it('si están a más de 3 radios no hay puente: solo viaja la cámara', () => {
    expect(gapBetween(A, B)).toBe(1)
    expect(gapBetween(B, FAR)).toBe(4)
    const far: CellPlan = { cur: B, start: 8, end: 12, next: FAR, prev: A }
    const t = transitionAt(11.9, far)
    expect(t.bridge).toBeNull()
    expect(t.pull).toBe(0)
    expect(t.cam.x).toBeGreaterThan(3)
  })

  it('al arrancar no hay anterior, y con movimiento reducido la cámara corta en L', () => {
    expect(transitionAt(4.1, { ...plan, prev: null }).ghost).toBeNull()
    expect(transitionAt(7.9, plan, true)).toEqual({ cam: { x: 0, y: 0 }, ghost: null, bridge: null, pull: 0, thread: null })
  })

  it('el brillo corre por el hilo hacia la siguiente aunque estén lejos y no haya puente', () => {
    const t = transitionAt(7.75, plan)
    expect(t.thread).toMatchObject({ fromId: 1, toId: 2 })
    expect(t.thread!.glow).toBeCloseTo(0.5)
    expect(transitionAt(6, plan).thread).toBeNull()
    const far: CellPlan = { cur: B, start: 8, end: 12, next: FAR, prev: A }
    const f = transitionAt(11.9, far)
    expect(f.bridge).toBeNull()
    expect(f.thread).toMatchObject({ fromId: 2, toId: 3 })
    expect(f.thread!.glow).toBeCloseTo(0.8)
    // tras la línea ya no corre
    expect(transitionAt(8.5, { cur: B, start: 8, end: 12, next: FAR, prev: A }).thread).toBeNull()
  })

  it('el puente es más fino en el centro y se cierra en el extremo que avanza', () => {
    expect(bridgeHalfWidth(0.5, 0, 1, 0)).toBeLessThan(bridgeHalfWidth(0.02, 0, 1, 0))
    expect(bridgeHalfWidth(0.6, 0, 0.6, 0)).toBe(0)
    expect(bridgeHalfWidth(0.3, 0.3, 1, 0)).toBe(0)
  })
})

describe('barrido de filtro', () => {
  it('sube de 0,5 a 0,62 y no suena con el filtro movido', () => {
    expect(sweepDjf(0, DJF_OPEN)).toBe(DJF_OPEN)
    expect(sweepDjf(0.5, DJF_OPEN)).toBe(0.56)
    expect(sweepDjf(1, DJF_OPEN)).toBe(SWEEP_DJF)
    expect(sweepDjf(1, 0.3)).toBe(0.3)
  })
})

describe('marcadores del borde', () => {
  const free = { x0: 0, y0: 0, x1: 400, y1: 600 }
  it('cada célula sale por el borde en su dirección, dentro del rectángulo', () => {
    const [r, d] = edgeMarkers(free, [{ id: 2, dx: 900, dy: 0 }, { id: 3, dx: 0, dy: 900 }], null)
    expect(r).toMatchObject({ x: 400 - MARKER_PAD, y: 300 })
    expect(d).toMatchObject({ x: 200, y: 600 - MARKER_PAD })
  })
  it('la siguiente en sonar va en rosa y manda sobre las que se le juntan', () => {
    const ms = edgeMarkers(free, [{ id: 2, dx: 900, dy: 0 }, { id: 3, dx: 900, dy: 20 }, { id: 4, dx: 900, dy: -400 }], 3)
    const by = (id: number) => ms.find((m) => m.id === id)!
    expect(by(3)).toMatchObject({ next: true, leader: 3, count: 2 })
    expect(by(2)).toMatchObject({ leader: 3, count: 0, next: false })
    expect(by(4).leader).toBe(4)
  })
  it('sin la siguiente, manda la más cercana', () => {
    const ms = edgeMarkers(free, [{ id: 5, dx: 2000, dy: 0 }, { id: 6, dx: 800, dy: 0 }], null)
    expect(ms.find((m) => m.id === 5)!.leader).toBe(6)
  })
  it('una célula justo en el centro sale hacia la derecha', () => {
    expect(edgeMarkers(free, [{ id: 7, dx: 0, dy: 0 }], null)[0]).toMatchObject({ x: 400 - MARKER_PAD, y: 300 })
  })
})

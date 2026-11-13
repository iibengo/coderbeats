import { describe, expect, it } from 'vitest'
import {
  approachBlend,
  curvePoints,
  threadBend,
  THREAD_HIT,
  segmentDistance,
  threadAt,
  HANDLE_DIST,
  handlePoint,
  spotAt,
  cellProgress,
  lastTurnFill,
  turnIndex,
  pulseScale,
  clampToRect,
  isDoubleTap,
  mapToScreen,
  screenToMap,
  quadAt,
  threadControl,
  threadPairs,
  backToFront,
  depthAlpha,
  depthParallax,
  depthScale,
  boundsCenter,
  clampCam,
  mixCam,
  panBy,
  cellAtPoint,
  colonyCam,
  colonyMinZoom,
  COLONY_ENTER,
  COLONY_MIN_CAP,
  crowdAlpha,
  fitZoom,
  inColony,
  settleZoom,
} from '../../app/lib/aro/colony'

const free = { x0: 8, y0: 52, x1: 382, y1: 700 } // móvil en vertical: 374 × 648
const demo = [0, 1, 2, 3].map((i) => ({ x: i * 3, y: Math.sin(i * 1.3) * 1.2 }))

describe('colonia: modo y ajuste', () => {
  it('colonia por debajo del umbral y con alguna célula (también con una sola, para crear la segunda)', () => {
    expect(inColony(0.39, 4)).toBe(true)
    expect(inColony(0.4, 4)).toBe(false)
    expect(inColony(0.45, 4)).toBe(false)
    expect(inColony(0.2, 1)).toBe(true)
    expect(inColony(0.2, 0)).toBe(false)
  })

  it('el mínimo ajusta todas las células en el rectángulo libre', () => {
    const z = fitZoom(demo, free)
    const R = z * (374 / 2)
    const w = (9 + 2) * R // ancho del conjunto: 9 radios entre centros + 2
    expect(w).toBeLessThanOrEqual(374 * 0.9 + 1e-6)
    expect(w).toBeCloseTo(374 * 0.9, 3)
    expect(colonyMinZoom(demo, free)).toBe(z)
  })

  it('con pocas células cercanas, el mínimo no pasa del tope; con muchas, baja', () => {
    expect(colonyMinZoom([{ x: 0, y: 0 }, { x: 1.5, y: 0 }], free)).toBe(COLONY_MIN_CAP)
    const many = Array.from({ length: 16 }, (_, i) => ({ x: i * 3, y: 0 }))
    expect(colonyMinZoom(many, free)).toBeLessThan(0.1)
    expect(colonyMinZoom(many, free)).toBeGreaterThanOrEqual(0.03)
  })

  it('al soltar entre 0,5 y el umbral vuelve a cerca; por debajo se queda en la colonia', () => {
    expect(settleZoom(0.45, 0.5)).toBe(0.5)
    expect(settleZoom(0.41, 0.5)).toBe(0.5)
    expect(settleZoom(0.39, 0.5)).toBe(0.39)
    expect(settleZoom(0.8, 0.5)).toBe(0.8)
  })
})

describe('colonia: cámara y aparición', () => {
  it('las demás células se funden entre 0,46 y 0,34', () => {
    expect(crowdAlpha(0.5)).toBe(0)
    expect(crowdAlpha(0.46)).toBe(0)
    expect(crowdAlpha(0.34)).toBe(1)
    expect(crowdAlpha(0.2)).toBe(1)
    expect(crowdAlpha(0.4)).toBeGreaterThan(0)
    expect(crowdAlpha(0.4)).toBeLessThan(1)
  })

  it('la cámara sigue a la que suena y, con todo ajustado, está en el centro del conjunto', () => {
    const follow = { x: 6, y: 0 }
    const center = boundsCenter(demo)
    expect(center.x).toBe(4.5)
    expect(colonyCam(follow, center, 0.45, 0.2)).toEqual(follow)
    expect(colonyCam(follow, center, COLONY_ENTER, 0.2)).toEqual(follow)
    expect(colonyCam(follow, center, 0.2, 0.2)).toEqual(center)
    const mid = colonyCam(follow, center, 0.3, 0.2)
    expect(mid.x).toBeLessThan(6)
    expect(mid.x).toBeGreaterThan(4.5)
  })
})

describe('colonia: tocar una célula', () => {
  const discs = [
    { id: 1, x: 100, y: 300, r: 30 },
    { id: 2, x: 190, y: 300, r: 30 },
    { id: 3, x: 300, y: 300, r: 4 },
  ]
  it('elige la célula bajo el dedo; fuera de todas, ninguna', () => {
    expect(cellAtPoint(110, 310, discs)).toBe(1)
    expect(cellAtPoint(195, 295, discs)).toBe(2)
    expect(cellAtPoint(145, 150, discs)).toBeNull()
  })
  it('las muy pequeñas se pueden tocar igual (radio mínimo de 22 px)', () => {
    expect(cellAtPoint(300 + 18, 300, discs)).toBe(3)
    expect(cellAtPoint(300 + 30, 300, discs)).toBeNull()
  })
  it('si dos se pisan, la más cercana al dedo', () => {
    const close = [{ id: 1, x: 100, y: 100, r: 40 }, { id: 2, x: 130, y: 100, r: 40 }]
    expect(cellAtPoint(122, 100, close)).toBe(2)
  })
})

describe('colonia: mover el mapa', () => {
  it('el mapa va con el dedo: arrastrar a la derecha lleva la cámara a la izquierda', () => {
    expect(panBy({ x: 4, y: 1 }, 60, -30, 30)).toEqual({ x: 2, y: 2 })
    expect(panBy({ x: 0, y: 0 }, 10, 10, 0).x).toBeCloseTo(-10) // radio mínimo 1: nunca divide por cero
  })

  it('la cámara no sale del conjunto más 3 radios', () => {
    const pts = [{ x: 0, y: 0 }, { x: 9, y: 2 }]
    expect(clampCam({ x: 40, y: -40 }, pts)).toEqual({ x: 12, y: -3 })
    expect(clampCam({ x: -40, y: 40 }, pts)).toEqual({ x: -3, y: 5 })
    expect(clampCam({ x: 4, y: 1 }, pts)).toEqual({ x: 4, y: 1 })
  })

  it('la mezcla va de la cámara automática a la del dedo, sin saltos', () => {
    expect(mixCam({ x: 0, y: 0 }, { x: 10, y: 4 }, 0)).toEqual({ x: 0, y: 0 })
    expect(mixCam({ x: 0, y: 0 }, { x: 10, y: 4 }, 0.5)).toEqual({ x: 5, y: 2 })
    expect(mixCam({ x: 0, y: 0 }, { x: 10, y: 4 }, 1)).toEqual({ x: 10, y: 4 })
    expect(mixCam({ x: 1, y: 1 }, null, 1)).toEqual({ x: 1, y: 1 })
    expect(approachBlend(0, 1, 0.15)).toBeGreaterThan(0.5)
    expect(approachBlend(0, 1, 0.15)).toBeLessThan(0.7)
    expect(approachBlend(0, 1, 1, true)).toBe(1)
    expect(approachBlend(0.9995, 1, 0.016)).toBe(1)
  })
})

describe('colonia: profundidad', () => {
  it('cerca no cambia nada; en la colonia el fondo llega al 70 %, más tenue y con menos parallax', () => {
    expect([depthScale(1, 0), depthAlpha(1, 0), depthParallax(1, 0)]).toEqual([1, 1, 1])
    expect(depthScale(0, 1)).toBe(1)
    expect(depthScale(1, 1)).toBeCloseTo(0.7)
    expect(depthAlpha(1, 1)).toBeCloseTo(0.65)
    expect(depthParallax(1, 1)).toBeCloseTo(0.65)
    expect(depthScale(0.5, 1)).toBeCloseTo(0.85)
    expect(depthScale(0.5, 0.5)).toBeCloseTo(0.925)
    expect(depthScale(3, 1)).toBeCloseTo(0.7) // la profundidad no pasa de 1
  })

  it('se dibuja del fondo al frente', () => {
    const order = backToFront([{ id: 1, depth: 0 }, { id: 2, depth: 0.6 }, { id: 3, depth: 0.1 }, { id: 4, depth: 0.6 }])
    expect(order.map((c) => c.id)).toEqual([2, 4, 3, 1])
  })

  it('al tocar dos células solapadas se elige la de delante, aunque la de atrás esté más cerca del dedo', () => {
    const discs = [
      { id: 1, x: 100, y: 100, r: 40, depth: 0.6 },
      { id: 2, x: 130, y: 100, r: 40, depth: 0.1 },
    ]
    expect(cellAtPoint(105, 100, discs)).toBe(2)
    expect(cellAtPoint(70, 100, discs)).toBe(1) // solo la de atrás llega hasta ahí
    // a igual profundidad, la más cercana
    expect(cellAtPoint(105, 100, discs.map((d) => ({ ...d, depth: 0 })))).toBe(1)
  })
})

describe('colonia: hilos de orden', () => {
  it('los hilos unen las células consecutivas en el orden en que suenan', () => {
    expect(threadPairs([4, 1, 3, 2], () => true)).toEqual([[4, 1], [1, 3], [3, 2]])
    expect(threadPairs([1], () => true)).toEqual([])
    expect(threadPairs([1, 2, 3], (id) => id !== 2)).toEqual([])
  })

  it('la curva sale de una punta y llega a la otra, y el control se desplaza en perpendicular', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 0 }
    expect(threadControl(a, b, 0)).toEqual({ x: 50, y: 0 })
    const c = threadControl(a, b, 10)
    expect(c.x).toBeCloseTo(50)
    expect(Math.abs(c.y)).toBeCloseTo(10)
    expect(quadAt(a, c, b, 0)).toEqual(a)
    expect(quadAt(a, c, b, 1)).toEqual(b)
    expect(quadAt(a, { x: 50, y: 0 }, b, 0.5)).toEqual({ x: 50, y: 0 })
    expect(threadControl(a, a, 5)).toEqual({ x: 0, y: 0 }) // sin longitud no hay perpendicular, pero tampoco NaN
  })
})

describe('colonia: mover células y doble toque', () => {
  const center = { x: 195, y: 376 }
  const cam = { x: 4.5, y: 0.5 }

  it('del mapa a la pantalla y de vuelta dan el mismo punto, con y sin parallax', () => {
    for (const pf of [1, 0.8, 0.65]) {
      const p = { x: 7.25, y: -1.5 }
      const s = mapToScreen(p, center, 30, cam, pf)
      const back = screenToMap(s, center, 30, cam, pf)
      expect(back.x).toBeCloseTo(p.x)
      expect(back.y).toBeCloseTo(p.y)
    }
    expect(mapToScreen(cam, center, 30, cam)).toEqual(center) // la cámara está en el centro
    expect(mapToScreen({ x: 5.5, y: 0.5 }, center, 30, cam, 0.5)).toEqual({ x: 210, y: 376 }) // el fondo se mueve menos
  })

  it('la célula arrastrada no sale de la zona libre', () => {
    const free = { x0: 8, y0: 52, x1: 382, y1: 700 }
    expect(clampToRect({ x: -50, y: 900 }, free)).toEqual({ x: 8, y: 700 })
    expect(clampToRect({ x: 100, y: 100 }, free)).toEqual({ x: 100, y: 100 })
  })

  it('doble toque: misma célula y a menos de 300 ms', () => {
    expect(isDoubleTap({ id: 2, t: 1000 }, 2, 1200)).toBe(true)
    expect(isDoubleTap({ id: 2, t: 1000 }, 2, 1300)).toBe(false)
    expect(isDoubleTap({ id: 2, t: 1000 }, 3, 1100)).toBe(false)
    expect(isDoubleTap(null, 2, 1100)).toBe(false)
  })
})

describe('colonia: pulso del agua', () => {
  it('el pulso se escala al radio de la célula que suena, sin pasar de 1 ni bajar de 0,15', () => {
    expect(pulseScale(180, 180)).toBe(1)
    expect(pulseScale(400, 180)).toBe(1)
    expect(pulseScale(45, 180)).toBeCloseTo(0.25)
    expect(pulseScale(3, 180)).toBe(0.15)
    expect(pulseScale(10, 0)).toBe(1) // sin radio de referencia no se rompe
  })
})

describe('colonia: cuánto falta para cambiar', () => {
  it('el anillo se llena de 0 a 1 a lo largo de las vueltas y en bucle no avanza', () => {
    expect(cellProgress(8, 8, 16)).toBe(0)
    expect(cellProgress(12, 8, 16)).toBe(0.5)
    expect(cellProgress(16, 8, 16)).toBe(1)
    expect(cellProgress(20, 8, 16)).toBe(1)
    expect(cellProgress(6, 8, 16)).toBe(0)
    expect(cellProgress(12, 8, Infinity)).toBeNull()
  })

  it('los puntitos marcan la vuelta (●●○○ = vuelta 2 de 4)', () => {
    expect(turnIndex(8, 8, 4)).toBe(0)
    expect(turnIndex(9.9, 8, 4)).toBe(1)
    expect(turnIndex(11.2, 8, 4)).toBe(3)
    // en bucle la cuenta da la vuelta
    expect(turnIndex(13, 8, 4)).toBe(1)
  })

  it('el hilo hacia la siguiente se llena solo en la última vuelta', () => {
    expect(lastTurnFill(10, 12)).toBeUndefined() // aún quedan 2 vueltas
    expect(lastTurnFill(11, 12)).toBe(0)
    expect(lastTurnFill(11.5, 12)).toBe(0.5)
    expect(lastTurnFill(12, 12)).toBe(1)
    expect(lastTurnFill(11.5, Infinity)).toBeUndefined() // en bucle no se llena
  })
})

describe('colonia: asa de cada célula', () => {
  it('el asa sale del borde hacia la siguiente célula; la última, hacia la derecha', () => {
    const p = handlePoint({ x: 100, y: 100 }, 20, { x: 200, y: 100 })
    expect(p.x).toBeCloseTo(100 + 20 * HANDLE_DIST)
    expect(p.y).toBeCloseTo(100)
    const down = handlePoint({ x: 100, y: 100 }, 20, { x: 100, y: 500 })
    expect(down.x).toBeCloseTo(100)
    expect(down.y).toBeCloseTo(100 + 20 * HANDLE_DIST)
    expect(handlePoint({ x: 0, y: 0 }, 10, null)).toEqual({ x: 10 * HANDLE_DIST, y: 0 })
    expect(Number.isNaN(handlePoint({ x: 5, y: 5 }, 10, { x: 5, y: 5 }).x)).toBe(false) // sin dirección no hay NaN
  })

  it('se coge el asa o el número más cercano dentro de su zona', () => {
    const spots = [{ id: 1, x: 50, y: 50 }, { id: 2, x: 80, y: 50 }]
    expect(spotAt(52, 51, spots, 18)).toBe(1)
    expect(spotAt(70, 50, spots, 18)).toBe(2) // más cerca del 2
    expect(spotAt(200, 200, spots, 18)).toBeNull()
  })
})

describe('colonia: tocar un hilo', () => {
  const t1 = { fromId: 1, toId: 2, a: { x: 0, y: 0 }, b: { x: 100, y: 0 } }
  const t2 = { fromId: 2, toId: 3, a: { x: 100, y: 50 }, b: { x: 200, y: 50 } }

  it('distancia a un segmento: al lado, y más allá de los extremos hasta el extremo', () => {
    expect(segmentDistance({ x: 50, y: 7 }, t1.a, t1.b)).toBe(7)
    expect(segmentDistance({ x: -10, y: 0 }, t1.a, t1.b)).toBe(10)
    expect(segmentDistance({ x: 130, y: 40 }, t1.a, t1.b)).toBe(50)
    expect(segmentDistance({ x: 3, y: 4 }, t1.a, t1.a)).toBe(5) // segmento sin longitud
  })

  it('el hilo bajo el dedo, a menos de 18 px; si no, ninguno', () => {
    expect(threadAt(50, 8, [t1, t2])).toBe(t1)
    expect(threadAt(50, 17, [t1, t2])).toBe(t1)
    expect(threadAt(150, 44, [t1, t2])).toBe(t2)
    expect(threadAt(50, 19, [t1, t2])).toBeNull()
    expect(threadAt(50, 30, [t1, t2])).toBeNull()
    expect(threadAt(5, 5, [])).toBeNull()
  })

  it('con dos hilos cerca, el más cercano al dedo', () => {
    const near = { fromId: 5, toId: 6, a: { x: 0, y: 10 }, b: { x: 100, y: 10 } }
    expect(threadAt(50, 8, [t1, near])).toBe(near)
    expect(threadAt(50, 2, [t1, near])).toBe(t1)
  })
})

describe('colonia: el hilo se toca por la curva que se dibuja', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 200, y: 0 }

  it('el margen para tocar es de 18 px', () => {
    expect(THREAD_HIT).toBe(18)
  })

  it('la curvatura es la misma para dibujar y para tocar, y pequeña', () => {
    expect(threadBend(200, 0.7, 3.1)).toBe(threadBend(200, 0.7, 3.1))
    for (let t = 0; t < 40; t += 1.7) expect(Math.abs(threadBend(300, 1.1, t))).toBeLessThanOrEqual(16 * 1.5)
    expect(threadBend(0, 0, 0)).toBeCloseTo(0)
  })

  it('un toque justo encima de la curva falla contra la recta pero acierta contra la curva', () => {
    // un hilo muy curvado: el centro de la curva se separa 11 px de la recta
    const ctrl = threadControl(a, b, 22)
    const mid = quadAt(a, ctrl, b, 0.5)
    expect(Math.abs(mid.y)).toBeCloseTo(11)
    const tap = { x: mid.x, y: mid.y }
    const straight = { fromId: 1, toId: 2, a, b }
    // contra la recta (como antes) con un margen corto no se encuentra
    expect(threadAt(tap.x, tap.y, [straight], 8)).toBeNull()
    // contra la curva en tramos, sí
    const segs = curvePoints(a, ctrl, b, 12).slice(1).map((p, i, all) => ({ fromId: 1, toId: 2, a: i === 0 ? a : all[i - 1]!, b: p }))
    expect(threadAt(tap.x, tap.y, segs, 8)).not.toBeNull()
    expect(threadAt(tap.x, tap.y, segs, 8)!.toId).toBe(2)
  })

  it('con el margen de 18 px se acierta al lado de la curva y no a 30 px', () => {
    const ctrl = threadControl(a, b, 22)
    const segs = curvePoints(a, ctrl, b, 12).slice(1).map((p, i, all) => ({ fromId: 1, toId: 2, a: i === 0 ? a : all[i - 1]!, b: p }))
    expect(threadAt(100, 11 + 14, segs)).not.toBeNull()
    expect(threadAt(100, 11 + 30, segs)).toBeNull()
  })

  it('los puntos de la curva empiezan y acaban en los extremos', () => {
    const pts = curvePoints(a, threadControl(a, b, 10), b, 12)
    expect(pts).toHaveLength(13)
    expect(pts[0]).toEqual(a)
    expect(pts[12]!.x).toBeCloseTo(200)
    expect(pts[12]!.y).toBeCloseTo(0)
  })
})

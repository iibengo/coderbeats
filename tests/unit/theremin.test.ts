import { describe, expect, it } from 'vitest'
import { DEFAULT_LISSAJOUS, HYSTERESIS, LIGHT_MAX, lightPush, lissajousOf, lissajousPoints, midiToHz, noteIndexAt } from '../../app/lib/theremin'
import { bandAtY } from '../../app/lib/waterKeys'

const h = (midi: number, pos = 0) => ({ pos, strength: 0.8, midi, dur: 2 })

describe('sintetizador de dedo (spec 015 §12)', () => {
  it('abajo = grave, arriba = agudo, siempre dentro de 0…n-1 y coincide con las franjas del agua', () => {
    expect(noteIndexAt(1, 7)).toBe(0)
    expect(noteIndexAt(0, 7)).toBe(6)
    for (let fy = 0; fy <= 1; fy += 0.01) expect(noteIndexAt(fy, 7)).toBe(bandAtY(fy, 7))
    expect(noteIndexAt(NaN, 7)).toBe(0)
    expect(noteIndexAt(0.5, 0)).toBe(0)
  })
  it('la histéresis: cerca del borde se queda en la nota; lejos, cambia', () => {
    const n = 5
    // franja 2 ocupa pos 2..3; fy = 1 - pos/n
    const fy = (pos: number) => 1 - pos / n
    expect(noteIndexAt(fy(2.5), n, null)).toBe(2)
    expect(noteIndexAt(fy(3 + HYSTERESIS / 2), n, 2)).toBe(2) // un poco pasado el borde: sigue
    expect(noteIndexAt(fy(3 + HYSTERESIS / 2), n, null)).toBe(3) // sin nota previa, cambia
    expect(noteIndexAt(fy(3 + HYSTERESIS * 2), n, 2)).toBe(3) // bastante pasado: cambia
    expect(noteIndexAt(fy(1.9), n, 2)).toBe(2)
    expect(noteIndexAt(fy(0.5), n, 2)).toBe(0)
  })
  it('frecuencias: A4 = 440 y una octava duplica', () => {
    expect(midiToHz(69)).toBeCloseTo(440)
    expect(midiToHz(81)).toBeCloseTo(880)
  })
  it('la curva de luz tiene topes y deja caer los puntos viejos', () => {
    const pts: ReturnType<typeof Array<never>> = []
    const l = pts as unknown as Parameters<typeof lightPush>[0]
    for (let i = 0; i < 200; i++) lightPush(l, { x: i, y: i, t: i * 0.001, h: 0.5 })
    expect(l.length).toBeLessThanOrEqual(LIGHT_MAX)
    lightPush(l, { x: 1, y: 1, t: 10, h: 0.5 })
    expect(l.length).toBe(1)
    lightPush(l, { x: NaN, y: 1, t: 10, h: 0.5 })
    expect(l.length).toBe(1)
  })
  it('Lissajous: determinista, distinta según la melodía y acotada', () => {
    expect(lissajousOf([])).toEqual(DEFAULT_LISSAJOUS)
    const a = lissajousOf([h(60), h(62), h(64)])
    expect(lissajousOf([h(60), h(62), h(64)])).toEqual(a)
    expect(lissajousOf([h(60), h(62), h(64), h(65), h(67)])).not.toEqual(a)
    for (const p of lissajousPoints(a)) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1)
    }
    expect(a.a).toBeGreaterThanOrEqual(1)
    expect(lissajousOf(Array.from({ length: 40 }, (_, i) => h(40 + i))).a).toBe(5)
  })
})

import { emptySong, isSong } from '../../app/lib/cells'
import { withNewGroup } from '../../app/lib/cells'

describe('célula de melodía en lo guardado', () => {
  it('«kind: melodia» es válido y una canción de antes (sin kind) sigue siéndolo; otro valor no', () => {
    const r = withNewGroup(emptySong())!
    const ok = { ...r.song, cells: r.song.cells.map((c) => (c.id === r.id ? { ...c, kind: 'melodia' as const } : c)) }
    expect(isSong(r.song)).toBe(true)
    expect(isSong(ok)).toBe(true)
    expect(isSong(JSON.parse(JSON.stringify(ok)))).toBe(true)
    expect(isSong({ ...ok, cells: ok.cells.map((c) => ({ ...c, kind: 'otra' })) })).toBe(false)
  })
})

import { GHOST_R, GUIDE_FRESH, guideStep, noteY, placeGhost } from '../../app/lib/tuneGuide'
import { curvePoint, deformOffset, nearestParam, paramDist, waveGlow } from '../../app/lib/theremin'

describe('curva viva', () => {
  const p = { a: 3, b: 2, phase: 1 }
  it('girar solo mueve la x: la altura de cada punto no cambia', () => {
    for (let t = 0; t < 6; t += 0.4) expect(curvePoint(p, t, 390, 800, 0).y).toBeCloseTo(curvePoint(p, t, 390, 800, 2.1).y)
  })
  it('sin deformación y sin dedo no se desplaza; con dedo, el punto cercano se acerca a él', () => {
    const pt = curvePoint(p, 1, 390, 800, 0)
    expect(deformOffset(pt, 1, 390, { wobble: 0, k: 0, time: 0, finger: null, pull: 0 })).toEqual({ x: 0, y: 0 })
    const finger = { x: pt.x + 60, y: pt.y }
    const o = deformOffset(pt, 1, 390, { wobble: 0, k: 0, time: 0, finger, pull: 1 })
    expect(o.x).toBeGreaterThan(5)
    expect(o.x).toBeLessThan(60)
    const far = deformOffset({ x: pt.x - 400, y: pt.y }, 1, 390, { wobble: 0, k: 0, time: 0, finger, pull: 1 })
    expect(Math.hypot(far.x, far.y)).toBeLessThan(1)
  })
  it('la deformación por la nota crece con el temblor y es finita', () => {
    const pt = { x: 100, y: 100 }
    const a = deformOffset(pt, 1, 390, { wobble: 1, k: 3, time: 2, finger: null, pull: 0 })
    expect(Math.hypot(a.x, a.y)).toBeGreaterThan(0)
    expect(Number.isFinite(a.x + a.y)).toBe(true)
  })
  it('la onda de color nace donde la nota, se abre por los dos lados y se apaga', () => {
    expect(waveGlow(1, 1, 0.01)).toBeGreaterThan(0.5)
    expect(waveGlow(1, 1, 1)).toBe(0)
    expect(waveGlow(1 + 0.5, 1, 0.12)).toBeCloseTo(waveGlow(1 - 0.5, 1, 0.12))
    expect(waveGlow(4, 1, 0.01)).toBe(0)
    expect(paramDist(0.1, 6.2)).toBeCloseTo(Math.PI * 2 - 6.1)
    const t = nearestParam(p, curvePoint(p, 2, 390, 800, 0), 390, 800, 0)
    expect(paramDist(t, 2)).toBeLessThan(0.1)
  })
})

describe('modo guiado', () => {
  const p = { a: 3, b: 2, phase: 1 }
  it('la nota fantasma queda sobre la curva, a la altura de su franja y lejos de la anterior', () => {
    let prev: { x: number; y: number } | null = null
    for (const idx of [4, 4, 4, 5, 3]) {
      const g = placeGhost(p, 390, 800, idx, 8, prev, 0)
      const onCurve = curvePoint(p, g.t, 390, 800, 0)
      expect(onCurve.x).toBeCloseTo(g.x)
      expect(Math.abs(g.y - noteY(idx, 8, 800))).toBeLessThan(800 / 8)
      if (prev) expect(Math.hypot(g.x - prev.x, g.y - prev.y)).toBeGreaterThanOrEqual(2.5 * GHOST_R - 1)
      prev = g
    }
    expect(noteY(0, 8, 800)).toBeGreaterThan(noteY(7, 8, 800))
  })
  it('llegar a la nota la cuenta una vez; la repetida exige salir de la zona o levantar el dedo; al acabar, done', () => {
    const ghost = { x: 100, y: 100 }
    let s = GUIDE_FRESH
    let r = guideStep(s, 3, { x: 300, y: 300 }, ghost)
    expect(r.hit).toBe(false)
    r = guideStep(r.state, 3, { x: 110, y: 95 }, ghost)
    expect(r.hit).toBe(true)
    expect(r.state.k).toBe(1)
    r = guideStep(r.state, 3, { x: 105, y: 100 }, ghost) // sigue dentro: no vuelve a contar
    expect(r.hit).toBe(false)
    r = guideStep(r.state, 3, null, ghost) // levanta el dedo: se rearma
    r = guideStep(r.state, 3, { x: 100, y: 100 }, ghost)
    expect(r.hit).toBe(true)
    r = guideStep(r.state, 3, { x: 400, y: 100 }, ghost) // sale lejos: se rearma
    r = guideStep(r.state, 3, { x: 100, y: 100 }, ghost)
    expect(r.hit).toBe(true)
    expect(r.state.done).toBe(true)
    expect(guideStep(r.state, 3, { x: 100, y: 100 }, ghost).hit).toBe(false)
  })
})

describe('Lissajous nunca degenera en elipse', () => {
  it('con cualquier melodía de la biblioteca, a ≠ b', async () => {
    const { TUNES, adaptTune } = await import('../../app/lib/tuneLibrary')
    for (const t of TUNES) for (const s of ['hiphop90', 'house', 'dnb', 'dembow', 'techno'] as const) {
      const p = lissajousOf(adaptTune(t, s))
      expect(p.a, `${t.id} ${s}`).not.toBe(p.b)
    }
  })
})

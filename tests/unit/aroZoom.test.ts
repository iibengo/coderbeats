import { describe, expect, it } from 'vitest'
import { outerRadius, pointAt, TAU, wallDistance } from '../../app/lib/aro/shape'
import { clampZoom, dropLayout, freeRect, lerpGeo, pinchZoom, rubber, wheelZoom, zoomLimits, type Insets } from '../../app/lib/aro/zoom'

const phoneInsets: Insets = { top: 52, right: 0, bottom: 138, left: 0 }
const portrait = { w: 390, h: 844 }
const landscape = { w: 844, h: 390 }
const desktop = { w: 1440, h: 900 }

describe('zoomLimits', () => {
  it('en vertical empieza casi tocando los lados, redonda arriba y abajo', () => {
    const free = freeRect(portrait.w, portrait.h, phoneInsets)
    const l = zoomLimits(free)
    const g = dropLayout(portrait.w, portrait.h, phoneInsets, l.initial)
    expect(g.R).toBeLessThan((free.x1 - free.x0) / 2)
    expect(g.R).toBeGreaterThan((free.x1 - free.x0) / 2 - 20)
    // arriba y abajo le sobra sitio: el borde de arriba no se aplasta
    expect(outerRadius(-Math.PI / 2, g, 0, 0)).toBeCloseTo(g.R, 0)
  })
  it('en horizontal y en escritorio empieza pegada arriba y abajo', () => {
    for (const v of [landscape, desktop]) {
      const free = freeRect(v.w, v.h, phoneInsets)
      const g = dropLayout(v.w, v.h, phoneInsets, zoomLimits(free).initial)
      expect(g.R).toBeGreaterThan((free.y1 - free.y0) / 2)
      // pegada: arriba el borde queda a menos de 10 px de la pared
      expect(wallDistance(-Math.PI / 2, g) - outerRadius(-Math.PI / 2, g, 0, 0)).toBeLessThan(10)
    }
  })
  it('el máximo llega al lado largo y el mínimo deja la gota a la mitad', () => {
    const free = freeRect(portrait.w, portrait.h, phoneInsets)
    const l = zoomLimits(free)
    expect(l.max).toBeCloseTo((free.y1 - free.y0) / (free.x1 - free.x0), 5)
    expect(l.min).toBe(0.5)
  })
})

describe('nunca se corta un golpe', () => {
  it('con cualquier zoom y forma de ventana, la gota no sale del rectángulo libre', () => {
    for (const v of [portrait, landscape, desktop]) {
      const free = freeRect(v.w, v.h, phoneInsets)
      const l = zoomLimits(free)
      for (const z of [l.min, l.initial, l.max, rubber(l.max * 3, l)]) {
        const g = dropLayout(v.w, v.h, phoneInsets, z)
        for (let k = 0; k < 180; k++) {
          const [x, y] = pointAt((k / 180) * TAU, 1, g, 2.5)
          expect(x).toBeGreaterThanOrEqual(free.x0)
          expect(x).toBeLessThanOrEqual(free.x1)
          expect(y).toBeGreaterThanOrEqual(free.y0)
          expect(y).toBeLessThanOrEqual(free.y1)
        }
      }
    }
  })
  it('respeta las zonas seguras (muesca en horizontal)', () => {
    const notch: Insets = { top: 20, right: 47, bottom: 100, left: 47 }
    const g = dropLayout(landscape.w, landscape.h, notch, 1.6)
    for (let k = 0; k < 180; k++) expect(pointAt((k / 180) * TAU, 1, g, 0)[0]).toBeGreaterThanOrEqual(47)
  })
})

describe('pellizco continuo', () => {
  const l = { min: 0.5, max: 1.6, initial: 1 }
  it('dentro de los límites sigue la proporción de los dedos', () => {
    expect(pinchZoom(1, 100, 130, l)).toBeCloseTo(1.3)
  })
  it('más allá, sigue moviéndose con resistencia (sin tope duro) y es continuo', () => {
    const a = pinchZoom(1, 100, 200, l)
    const b = pinchZoom(1, 100, 400, l)
    expect(a).toBeGreaterThan(l.max)
    expect(b).toBeGreaterThan(a)
    expect(b - l.max).toBeLessThan((4 - l.max) * 0.5)
    expect(rubber(l.max + 1e-6, l)).toBeCloseTo(l.max, 5)
    const c = pinchZoom(1, 100, 20, l)
    expect(c).toBeLessThan(l.min)
    expect(c).toBeGreaterThan(0.2)
  })
  it('al soltar vuelve a los límites', () => {
    expect(clampZoom(1.9, l)).toBe(1.6)
    expect(clampZoom(0.3, l)).toBe(0.5)
  })
})

describe('rueda', () => {
  const l = { min: 0.5, max: 1.6, initial: 1 }
  it('hacia arriba acerca, hacia abajo aleja, con tope', () => {
    expect(wheelZoom(1, -100, false, l)).toBeGreaterThan(1)
    expect(wheelZoom(1, 100, false, l)).toBeLessThan(1)
    expect(wheelZoom(1.59, -5000, false, l)).toBe(1.6)
  })
  it('el pellizco del trackpad (ctrl) es más sensible por unidad', () => {
    expect(wheelZoom(1, -10, true, l)).toBeGreaterThan(wheelZoom(1, -10, false, l))
  })
})

describe('lerpGeo (girar sin saltos)', () => {
  it('va de una geometría a otra de forma continua', () => {
    const a = dropLayout(portrait.w, portrait.h, phoneInsets, 1)
    const b = dropLayout(landscape.w, landscape.h, phoneInsets, 1)
    expect(lerpGeo(a, b, 0)).toEqual(a)
    expect(lerpGeo(a, b, 1)).toEqual(b)
    const m = lerpGeo(a, b, 0.5)
    expect(m.cx).toBeCloseTo((a.cx + b.cx) / 2)
    expect(m.free.x1).toBeCloseTo((a.free.x1 + b.free.x1) / 2)
  })
})

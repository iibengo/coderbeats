import { describe, expect, it } from 'vitest'
import { fittsDuration, imperfections, minJerk, pause, rng, trajectory } from '../../app/lib/pilot'

describe('piloto: la humanización (spec 009 §5)', () => {
  it('la misma semilla da lo mismo; otra, otra cosa', () => {
    const a = rng(7), b = rng(7), c = rng(8)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(rng(7)()).not.toBe(c())
  })
  it('minJerk empieza en 0, acaba en 1 y es monótona', () => {
    expect(minJerk(0)).toBe(0)
    expect(minJerk(1)).toBe(1)
    let prev = -1
    for (let i = 0; i <= 50; i++) {
      const v = minJerk(i / 50)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
  it('Fitts: más lejos o más pequeño = más lento, siempre dentro de límites', () => {
    expect(fittsDuration(400, 40)).toBeGreaterThan(fittsDuration(50, 40))
    expect(fittsDuration(200, 10)).toBeGreaterThan(fittsDuration(200, 80))
    for (const d of [1, 50, 500, 5000]) expect(fittsDuration(d, 20)).toBeLessThanOrEqual(1.6)
    expect(fittsDuration(0, 40)).toBeGreaterThanOrEqual(0.18)
  })
  it('la trayectoria llega exactamente al blanco, aunque tiemble o pase de largo', () => {
    for (const overshoot of [false, true])
      for (let s = 1; s <= 20; s++) {
        const m = trajectory({ x: 20, y: 700 }, { x: 300, y: 120 }, rng(s), { overshoot })
        const end = m.at(m.duration)
        expect(end.x).toBeCloseTo(300, 5)
        expect(end.y).toBeCloseTo(120, 5)
        expect(m.at(0).x).toBeCloseTo(20, 5)
      }
  })
  it('el movimiento es suave: sin saltos entre fotogramas de 16 ms', () => {
    const m = trajectory({ x: 0, y: 0 }, { x: 300, y: 400 }, rng(3))
    let prev = m.at(0)
    let worst = 0
    for (let t = 0.016; t <= m.duration; t += 0.016) {
      const p = m.at(t)
      worst = Math.max(worst, Math.hypot(p.x - prev.x, p.y - prev.y))
      prev = p
    }
    // 500 px en ≥ 0,4 s con perfil de campana: el pico es unas 2 veces la media (≈ 20 px por fotograma), sin saltos
    expect(worst).toBeLessThan(45)
  })
  it('las pausas están dentro de sus límites y las de sección son más largas', () => {
    const r = rng(1)
    let between = 0, section = 0
    for (let i = 0; i < 200; i++) {
      const b = pause('between', r), s = pause('section', r), h = pause('hover', r)
      expect(b).toBeGreaterThanOrEqual(0.25); expect(b).toBeLessThanOrEqual(0.9)
      expect(s).toBeGreaterThanOrEqual(0.8); expect(s).toBeLessThanOrEqual(1.8)
      expect(h).toBeLessThanOrEqual(0.3)
      between += b; section += s
    }
    expect(section).toBeGreaterThan(between)
  })
  it('el perfil escala las pausas', () => {
    expect(pause('between', rng(5), 'calm')).toBeGreaterThan(pause('between', rng(5), 'lively'))
  })
  it('las imperfecciones son poco frecuentes y recuperables (desvío < 0,6 de la tolerancia)', () => {
    const r = rng(11)
    let offs = 0
    for (let i = 0; i < 1000; i++) {
      const im = imperfections(r, 20)
      if (im.offset) {
        offs++
        expect(Math.abs(im.offset.x)).toBeLessThanOrEqual(12)
        expect(Math.abs(im.offset.y)).toBeLessThanOrEqual(12)
      }
    }
    expect(offs).toBeGreaterThan(50)
    expect(offs).toBeLessThan(200)
  })
  it('misma semilla, mismas imperfecciones', () => {
    expect(imperfections(rng(4), 20)).toEqual(imperfections(rng(4), 20))
  })
})

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

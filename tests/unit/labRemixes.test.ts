import { describe, expect, it } from 'vitest'
import { songBars } from '~/lib/cells'
import { barSeconds, LAB_REMIXES, MAX_LAYERS, partLoops, PART_NAMES, remixSeconds, remixTake, runsOfTake, songFromTake, takePlan, turnChunks, type LabPart } from '~/lib/labRemixes'

const hasDrum = (p: LabPart, inst: 'bd' | 'sd' | 'hh', keys = p.layers.map((l) => l.key)) => p.layers.some((l) => keys.includes(l.key) && l.drums?.[inst])

describe('remixes del Laboratorio: reglas', () => {
  for (const r of LAB_REMIXES) {
    describe(r.title, () => {
      it('tiene las cuatro partes y como mucho 4 capas en cada una', () => {
        for (const n of PART_NAMES) {
          expect(r.parts[n].name).toBe(n)
          expect(r.parts[n].layers.length).toBeGreaterThan(0)
          expect(r.parts[n].layers.length).toBeLessThanOrEqual(MAX_LAYERS)
          expect(new Set(r.parts[n].layers.map((l) => l.key)).size).toBe(r.parts[n].layers.length)
        }
      })
      it('cada parte arranca con capas que suenan solas (bucle propio)', () => {
        for (const n of PART_NAMES) {
          const p = r.parts[n]
          expect(p.start.length).toBeGreaterThan(0)
          for (const k of p.start) expect(p.layers.some((l) => l.key === k)).toBe(true)
          expect(partLoops(p, new Set(p.start), 1, false).loops.length).toBeGreaterThan(0)
        }
      })
      it('contraste: la subida sin bombo y el drop con todo', () => {
        expect(hasDrum(r.parts.Subida, 'bd')).toBe(false)
        const d = r.parts.Drop
        expect(d.start.length).toBe(d.layers.length)
        expect(hasDrum(d, 'bd') && hasDrum(d, 'sd') && hasDrum(d, 'hh')).toBe(true)
        expect(d.layers.some((l) => l.bass) && d.layers.some((l) => l.chords) && d.layers.some((l) => l.key === 'tema')).toBe(true)
        // el drop es lo más lleno
        for (const n of PART_NAMES) expect(d.start.length).toBeGreaterThanOrEqual(r.parts[n].start.length)
      })
      it('el tema se reconoce en los primeros 4 compases (empieza pronto y cabe en 4)', () => {
        for (const n of ['Intro', 'Drop'] as const) {
          const t = r.parts[n].layers.find((l) => l.key === 'tema')!
          const notes = t.mel![0]!.notes
          expect(notes.length).toBeGreaterThanOrEqual(8)
          expect(Math.min(...notes.map((x) => x[0]))).toBeLessThan(16)
          expect(Math.max(...notes.map((x) => x[0]))).toBeLessThan(64)
        }
      })
      it('el remix entero dura entre 45 y 90 s', () => {
        expect(remixSeconds(r.style)).toBeGreaterThanOrEqual(45)
        expect(remixSeconds(r.style)).toBeLessThanOrEqual(90)
      })
    })
  }
})

describe('duración de lo grabado', () => {
  it('máximo 2 min en compases enteros y el final entra ≈ 8 s antes', () => {
    for (const s of ['techno', 'dembow', 'house', 'hiphop90', 'dnb'] as const) {
      const p = takePlan(s)
      expect(p.maxBars * barSeconds(s)).toBeLessThanOrEqual(120.0001)
      expect(p.maxBars * barSeconds(s)).toBeGreaterThan(120 - barSeconds(s))
      const fin = p.finalBars * barSeconds(s)
      expect(fin).toBeGreaterThan(5)
      expect(fin).toBeLessThan(11)
      expect(p.finalStart + p.finalBars).toBe(p.maxBars)
    }
    expect(takePlan('techno')).toEqual({ maxBars: 64, finalBars: 4, finalStart: 60 })
  })
  it('las vueltas se parten en valores válidos y suman lo mismo', () => {
    for (const n of [1, 3, 5, 7, 13, 33, 64]) expect(turnChunks(n).reduce((a, b) => a + b, 0)).toBe(n)
    expect(turnChunks(3)).toEqual([2, 1])
  })
})

describe('canciones', () => {
  const r = LAB_REMIXES[3]!
  it('el remix a su ritmo suma sus compases y empieza en la intro', () => {
    const s = songFromTake(r, remixTake(r))!
    expect(songBars(s)).toBe(32)
    expect(s.cells[0]!.name).toBe('Intro')
    expect(s.cells[s.cells.length - 1]!.name).toBe('Final')
  })
  it('lo actuado conserva los compases exactos, aunque haya muchos cambios', () => {
    const take = Array.from({ length: 60 }, (_, i) => ({ part: (['Intro', 'Drop'] as const)[i % 2]!, on: i % 3 ? ['ritmo', 'bajo'] : ['ritmo'] }))
    const s = songFromTake(r, take)!
    expect(songBars(s)).toBe(60)
    expect(s.cells.length).toBeLessThanOrEqual(16)
  })
  it('solo lleva las capas que sonaban', () => {
    const s = songFromTake(r, [{ part: 'Drop', on: ['bajo'] }, { part: 'Drop', on: ['bajo'] }])!
    expect(s.cells[0]!.loops.length).toBe(0)
    expect(s.cells[0]!.parts).toEqual({ bass: true, chords: false })
  })
  it('tramos iguales seguidos se unen', () => {
    expect(runsOfTake([{ part: 'Intro', on: ['a', 'b'] }, { part: 'Intro', on: ['b', 'a'] }, { part: 'Drop', on: [] }]).map((x) => x.bars)).toEqual([2, 1])
    expect(songFromTake(r, [])).toBeNull()
  })
})

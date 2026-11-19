import { describe, expect, it } from 'vitest'
import { songBars } from '~/lib/cells'
import { barSeconds, finalPartOf, LAB_REMIXES, MAX_LAYERS, MAX_PARTS, partLoops, remixBars, remixSeconds, remixTake, runsOfTake, songFromTake, takePlan, turnChunks, type LabPart } from '~/lib/labRemixes'

const hasDrum = (p: LabPart, inst: 'bd' | 'sd' | 'hh') => p.layers.some((l) => l.drums?.[inst])
const isDrop = (p: LabPart) => /^drop/i.test(p.name)

describe('remixes del Laboratorio: reglas', () => {
  for (const r of LAB_REMIXES) {
    describe(r.title, () => {
      it('tiene entre 3 y 8 partes con nombre único, la primera Intro y la última Final', () => {
        expect(r.parts.length).toBeGreaterThanOrEqual(3)
        expect(r.parts.length).toBeLessThanOrEqual(MAX_PARTS)
        expect(new Set(r.parts.map((p) => p.name)).size).toBe(r.parts.length)
        expect(r.parts[0]!.name).toBe('Intro')
        expect(finalPartOf(r).name).toBe('Final')
      })
      it('como mucho 4 capas por parte, cada parte arranca con capas y suena sola en bucle', () => {
        for (const p of r.parts) {
          expect(p.layers.length).toBeGreaterThan(0)
          expect(p.layers.length).toBeLessThanOrEqual(MAX_LAYERS)
          expect(new Set(p.layers.map((l) => l.key)).size).toBe(p.layers.length)
          expect(p.start).toEqual(p.layers.map((l) => l.key))
          expect(partLoops(p, new Set(p.start), 1, false).loops.length + (p.layers.some((l) => l.bass || l.chords) ? 1 : 0)).toBeGreaterThan(0)
        }
      })
      it('contraste: ninguna subida lleva bombo y los drops llevan todo y son lo más lleno', () => {
        const subidas = r.parts.filter((p) => /^subida/i.test(p.name))
        expect(subidas.length).toBeGreaterThan(0)
        for (const p of subidas) expect(hasDrum(p, 'bd')).toBe(false)
        const drops = r.parts.filter(isDrop)
        expect(drops.length).toBeGreaterThan(0)
        const most = Math.max(...r.parts.map((p) => p.layers.length))
        for (const d of drops) {
          expect(hasDrum(d, 'bd') && hasDrum(d, 'sd') && hasDrum(d, 'hh')).toBe(true)
          // el bajo y los acordes: los del fondo del estilo (`bass`, `chords`) o los propios de la canción (capas `bajo` y `acordes`, spec 028 §5)
          expect(d.layers.some((l) => l.bass || l.key === 'bajo') && d.layers.some((l) => l.chords || l.key === 'acordes') && d.layers.some((l) => l.key === 'tema')).toBe(true)
          expect(d.layers.length).toBe(most)
        }
        // los vecinos no son iguales (contraste claro entre partes)
        for (let i = 1; i < r.parts.length; i++) expect(r.parts[i]!.layers.map((l) => l.key).join()).not.toBe(r.parts[i - 1]!.layers.map((l) => l.key).join())
      })
      it('el tema se reconoce en los primeros 4 compases (empieza pronto y cabe en 4)', () => {
        for (const p of [r.parts[0]!, r.parts.find(isDrop)!]) {
          const notes = p.layers.find((l) => l.key === 'tema')!.mel![0]!.notes
          expect(notes.length).toBeGreaterThanOrEqual(8)
          expect(Math.min(...notes.map((x) => x[0]))).toBeLessThan(16)
          expect(Math.max(...notes.map((x) => x[0]))).toBeLessThan(64)
        }
      })
      it('el remix entero dura entre 45 y 120 s (el objetivo de 1 a 2 minutos de CLAUDE.md) y es una sola canción', () => {
        expect(remixSeconds(r)).toBeGreaterThanOrEqual(45)
        expect(remixSeconds(r)).toBeLessThanOrEqual(120)
        expect(songBars(r.song)).toBe(remixBars(r))
        expect(r.song.cells.length).toBe(r.parts.length)
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
    expect(songBars(s)).toBe(remixBars(r))
    expect(s.cells[0]!.name).toBe('Intro')
    expect(s.cells[s.cells.length - 1]!.name).toBe('Final')
  })
  it('lo actuado conserva los compases exactos, aunque haya muchos cambios', () => {
    const take = Array.from({ length: 60 }, (_, i) => ({ part: (['Intro', 'Drop'] as const)[i % 2]!, on: i % 3 ? ['ritmo', 'bajo'] : ['ritmo'] }))
    const s = songFromTake(r, take)!
    expect(songBars(s)).toBe(60)
    expect(s.cells.length).toBeLessThanOrEqual(16)
  })
  it('solo lleva las capas que sonaban y las partes que ya no existen se ignoran', () => {
    const s = songFromTake(r, [{ part: 'Drop', on: ['bajo'] }, { part: 'Drop', on: ['bajo'] }, { part: 'Inventada', on: [] }])!
    expect(songBars(s)).toBe(2)
    expect(s.cells[0]!.loops.length).toBe(0)
    expect(s.cells[0]!.parts).toEqual({ bass: true, chords: false })
  })
  it('tramos iguales seguidos se unen', () => {
    expect(runsOfTake([{ part: 'Intro', on: ['a', 'b'] }, { part: 'Intro', on: ['b', 'a'] }, { part: 'Drop', on: [] }]).map((x) => x.bars)).toEqual([2, 1])
    expect(songFromTake(r, [])).toBeNull()
  })
})

import { isLabMark } from '~/lib/library'
import { labRemixById, labRemixFromSaved } from '~/lib/labRemixes'
describe('remixes míos (guardados desde el Estudio)', () => {
  const base = labRemixById('sinfonia-40-techno')!
  const saved = { id: 'x1', name: 'Mi remix', style: base.style, kit: base.kit, song: base.song, lab: { remixId: base.id } }
  it('las partes salen de la canción guardada, con la tonalidad del original', () => {
    const r = labRemixFromSaved(saved)!
    expect(r.id).toBe('mio:x1')
    expect(r.parts.map((p) => p.name)).toEqual(base.parts.map((p) => p.name))
    expect(r.key).toBe(base.key)
  })
  it('una canción cualquiera de Mis remixes (sin marca) también se puede actuar', () => {
    const { lab: _l, ...plain } = saved
    expect(labRemixFromSaved(plain)!.parts.length).toBeGreaterThan(0)
  })
  it('sin nada que sonar no es un remix', () => {
    expect(labRemixFromSaved({ ...saved, song: { ...base.song, cells: base.song.cells.map((c) => ({ ...c, loops: [], parts: { bass: false, chords: false } })) } })).toBeNull()
  })
  it('la marca lab solo vale con un id de texto corto', () => {
    expect(isLabMark({ remixId: 'a' })).toBe(true)
    expect(isLabMark({ remixId: '' })).toBe(false)
    expect(isLabMark({ remixId: 'x'.repeat(61) })).toBe(false)
    expect(isLabMark({ remixId: 3 })).toBe(false)
    expect(isLabMark(null)).toBe(false)
    expect(isLabMark({ remixId: '__proto__', constructor: 1 })).toBe(true) // un id de texto vale; solo se usa para buscar en una lista, nunca como clave
  })
})

import { remixBpm } from '~/lib/labRemixes'
describe('el tempo de la canción manda (spec 028 §1)', () => {
  const base = LAB_REMIXES[0]!
  const con = (bpm: number | null) => ({ ...base, song: { ...base.song, bpm } })
  it('sin tempo propio, el del estilo; con él, el de la canción', () => {
    expect(remixBpm(con(null))).toBe(120) // dembow
    expect(remixBpm(con(108))).toBe(108)
  })
  it('un compás a 108 bpm dura 2,22 s (no 2 s, que es el del estilo) y la duración del remix usa ese tempo', () => {
    expect(barSeconds('dembow', 108)).toBeCloseTo(2.2222, 3)
    expect(barSeconds('dembow')).toBeCloseTo(2, 3)
    expect(remixSeconds(con(108))).toBeCloseTo(remixBars(con(108)) * (240 / 108), 3)
  })
  it('lo que se actúa o se escucha conserva el tempo de la canción', () => {
    expect(songFromTake(con(108), remixTake(con(108)))!.bpm).toBe(108)
    expect(songFromTake(con(null), remixTake(con(null)))!.bpm).toBeNull()
  })
  it('el plan de la toma (2 min, final de 8 s) sale con el tempo de la canción', () => {
    const lento = takePlan('dembow', 60)
    const rapido = takePlan('dembow', 120)
    expect(lento.maxBars).toBeLessThan(rapido.maxBars)
    expect(lento.maxBars * 4).toBeLessThanOrEqual(120)
  })
})

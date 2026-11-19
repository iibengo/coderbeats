import { describe, expect, it } from 'vitest'
import { COVER_FLOOR, coverBars, filterRemixes, fmtDuration, matchesQuery, normalizeText, styleChips, styleKey, styleLabel } from '../../app/lib/remixLibrary'
import { LAB_REMIXES, labRemixById, remixSeconds } from '../../app/lib/labRemixes'
import { songTimeline } from '../../app/lib/timeline'
import type { StyleId } from '../../app/lib/types'

const R = (title: string, composer: string, style: StyleId, key = 'Do menor') => ({ title, composer, style, key })

describe('buscar en la biblioteca (spec 051)', () => {
  it('sin acentos, sin mayúsculas y sin espacios de más', () => {
    expect(normalizeText('  Sinfonía   N.º 40 ')).toBe('sinfonia n.o 40')
    expect(normalizeText('Reggaetón')).toBe('reggaeton')
    expect(matchesQuery({ title: 'Sinfonía n.º 40', composer: 'Mozart', style: 'techno2' }, 'sinfonia n.o 40')).toBe(true) // quien escribe «n.o» también la encuentra
  })
  it('todas las palabras tienen que estar, en cualquier orden, en título, compositor, tonalidad o estilo; la vacía coincide con todo', () => {
    const r = R('Lacrimosa (Requiem)', 'Mozart', 'drill', 'Si menor')
    expect(matchesQuery(r, '')).toBe(true)
    expect(matchesQuery(r, '   ')).toBe(true)
    expect(matchesQuery(r, 'lacrimosa')).toBe(true)
    expect(matchesQuery(r, 'MOZART drill')).toBe(true)
    expect(matchesQuery(r, 'drill mozart')).toBe(true) // en cualquier orden
    expect(matchesQuery(r, 'si menor')).toBe(true) // la tonalidad
    expect(matchesQuery(r, 'requi')).toBe(true) // por trozos
    expect(matchesQuery(r, 'mozart techno')).toBe(false) // una palabra que no está: no coincide
    expect(matchesQuery(r, 'beethoven')).toBe(false)
  })
  it('busca por el nombre del estilo que ve la persona, no por su id: «hip hop» encuentra el hiphop90', () => {
    expect(matchesQuery(R('Para Elisa', 'Beethoven', 'hiphop90'), 'hip hop')).toBe(true)
    expect(matchesQuery(R('Habanera', 'Bizet', 'reggaeton'), 'reggaetón')).toBe(true)
    expect(matchesQuery(R('Habanera', 'Bizet', 'reggaeton'), 'reggaeton')).toBe(true)
  })
  it('filtra por búsqueda y por estilo, y mantiene el orden', () => {
    const list = [R('A', 'Mozart', 'techno2'), R('B', 'Mozart', 'drill'), R('C', 'Bizet', 'drill'), R('D', 'Mozart', 'drill')]
    expect(filterRemixes(list, '', 'todos').map((r) => r.title)).toEqual(['A', 'B', 'C', 'D'])
    expect(filterRemixes(list, '', 'drill').map((r) => r.title)).toEqual(['B', 'C', 'D'])
    expect(filterRemixes(list, 'mozart', 'drill').map((r) => r.title)).toEqual(['B', 'D'])
    expect(filterRemixes(list, 'mozart').map((r) => r.title)).toEqual(['A', 'B', 'D'])
    expect(filterRemixes(list, 'nada', 'todos')).toEqual([])
    expect(filterRemixes([], 'x')).toEqual([])
  })
  it('los chips de estilo son los que hay, **sin repetir nombre** (techno y techno2 son los dos «Techno»), en el orden en que aparecen', () => {
    expect(styleChips([R('A', '', 'techno2'), R('B', '', 'drill'), R('C', '', 'techno'), R('D', '', 'dembow'), R('E', '', 'house'), R('F', '', 'house2')])).toEqual([
      { key: 'techno', label: 'Techno' },
      { key: 'drill', label: 'Drill' },
      { key: 'dembow', label: 'Dembow' },
      { key: 'house', label: 'House' },
    ])
    expect(styleChips([])).toEqual([])
    expect(styleLabel('drill')).toBe('Drill')
    expect(styleLabel('hiphop90')).toBe('Hip hop 90')
    expect(styleKey('techno')).toBe(styleKey('techno2')) // el mismo nombre, la misma clave
    expect(styleKey('hiphop90')).toBe('hip hop 90')
  })
  it('un chip «Techno» trae los remixes de los dos techno internos', () => {
    const list = [R('A', '', 'techno'), R('B', '', 'techno2'), R('C', '', 'house2')]
    expect(filterRemixes(list, '', 'techno').map((r) => r.title)).toEqual(['A', 'B'])
  })
  it('con los remixes de verdad: el Lacrimosa aparece buscando «mozart drill» y no buscando «mozart techno»', () => {
    const lac = labRemixById('lacrimosa-drill')!
    expect(filterRemixes(LAB_REMIXES, 'mozart drill').map((r) => r.id)).toContain(lac.id)
    expect(filterRemixes(LAB_REMIXES, 'mozart techno').map((r) => r.id)).not.toContain(lac.id)
    expect(filterRemixes(LAB_REMIXES, '', 'drill').map((r) => r.id)).toContain(lac.id)
    const chips = styleChips(LAB_REMIXES)
    expect(chips.length).toBeGreaterThanOrEqual(4)
    expect(new Set(chips.map((c) => c.label)).size).toBe(chips.length) // ningún nombre repetido
    // cada chip trae al menos un remix, y entre todos cubren todos los remixes
    for (const c of chips) expect(filterRemixes(LAB_REMIXES, '', c.key).length).toBeGreaterThan(0)
    expect(chips.reduce((n, c) => n + filterRemixes(LAB_REMIXES, '', c.key).length, 0)).toBe(LAB_REMIXES.length)
  })
})

describe('la carátula y la duración (spec 051)', () => {
  it('cinco alturas entre el mínimo y 1, con la voz más cargada al tope', () => {
    const lac = labRemixById('lacrimosa-drill')!
    const bars = coverBars(songTimeline(lac.song, lac.style))
    expect(bars).toHaveLength(5)
    for (const b of bars) {
      expect(b).toBeGreaterThanOrEqual(COVER_FLOOR)
      expect(b).toBeLessThanOrEqual(1)
    }
    expect(Math.max(...bars)).toBe(1)
  })
  it('cada remix tiene la suya: no todos los remixes dan la misma carátula', () => {
    const covers = LAB_REMIXES.map((r) => coverBars(songTimeline(r.song, r.style)).map((x) => x.toFixed(2)).join())
    expect(new Set(covers).size).toBeGreaterThan(3)
  })
  it('sin golpes, todas al mínimo; los datos raros no rompen', () => {
    const empty = { lanes: { bd: { t: new Float64Array(0), s: new Float32Array(0) }, bass: { t: new Float64Array(0), s: new Float32Array(0) }, sd: { t: new Float64Array(0), s: new Float32Array(0) }, hh: { t: new Float64Array(0), s: new Float32Array(0) }, mel: { t: new Float64Array(0), s: new Float32Array(0) } } }
    expect(coverBars(empty)).toEqual([COVER_FLOOR, COVER_FLOOR, COVER_FLOOR, COVER_FLOOR, COVER_FLOOR])
  })
  it('la duración, en minutos y segundos', () => {
    expect(fmtDuration(119.17)).toBe('1:59')
    expect(fmtDuration(65)).toBe('1:05')
    expect(fmtDuration(0)).toBe('0:00')
    expect(fmtDuration(Number.NaN)).toBe('0:00')
    expect(fmtDuration(-5)).toBe('0:00')
    expect(fmtDuration(remixSeconds(labRemixById('lacrimosa-drill')!))).toBe('1:59')
  })
})

import { neighborId } from '../../app/lib/remixLibrary'

describe('anterior y siguiente (spec 052)', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('el siguiente y el anterior de un remix, dando la vuelta por los extremos', () => {
    expect(neighborId(list, 'a', 1)).toBe('b')
    expect(neighborId(list, 'b', 1)).toBe('c')
    expect(neighborId(list, 'c', 1)).toBe('a') // del último, al primero
    expect(neighborId(list, 'a', -1)).toBe('c') // del primero, al último
    expect(neighborId(list, 'c', -1)).toBe('b')
  })
  it('con uno o ningún remix no hay otro; si el actual no está, el siguiente es el primero y el anterior el último', () => {
    expect(neighborId([{ id: 'a' }], 'a', 1)).toBeNull()
    expect(neighborId([], 'a', -1)).toBeNull()
    expect(neighborId(list, 'zz', 1)).toBe('a')
    expect(neighborId(list, 'zz', -1)).toBe('c')
    expect(neighborId(list, null, 1)).toBe('a')
  })
  it('con los remixes de verdad recorre los doce y vuelve al principio', () => {
    const seen: string[] = []
    let id: string | null = LAB_REMIXES[0]!.id
    for (let i = 0; i < LAB_REMIXES.length; i++) {
      seen.push(id!)
      id = neighborId(LAB_REMIXES, id, 1)
    }
    expect(new Set(seen).size).toBe(LAB_REMIXES.length)
    expect(id).toBe(LAB_REMIXES[0]!.id)
  })
})

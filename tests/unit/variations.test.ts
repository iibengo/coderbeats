import { describe, expect, it } from 'vitest'
import { isSong, type Cell, type Song } from '../../app/lib/cells'
import { STYLES } from '../../app/lib/constants'
import { MAX_LOOPS } from '../../app/lib/freeLoops'
import { remixById, REMIXES } from '../../app/lib/remixes'
import { STYLE_MUSIC } from '../../app/lib/styles'
import type { StyleId } from '../../app/lib/types'
import { answerPhrase, canVary, varyCell, variationOrder, VARIATION_LABELS, type VariationKind } from '../../app/lib/variations'

const mod = (a: number, n: number) => ((a % n) + n) % n
const KINDS: VariationKind[] = ['more', 'less', 'melody', 'fill', 'same']
const drums = (c: Cell, i: string) => c.loops.find((l) => l.instrument === i)

/** Todas las células de los remixes (con sus estilos): casos reales de partida */
const cases: { style: StyleId; cell: Cell; song: Song; label: string }[] = REMIXES.flatMap((r) => {
  const song = r.build()
  return song.cells.map((cell) => ({ style: r.style, cell, song, label: `${r.id} · ${cell.name}` }))
})
const withCell = (song: Song, cell: Cell): Song => ({ ...song, cells: song.cells.map((c) => (c.id === cell.id ? cell : c)) })

describe('variaciones de una célula (spec 012, §5): puras, del estilo y sin tocar la original', () => {
  it('nunca cambian la célula original, y son deterministas', () => {
    for (const { cell, style, label } of cases) for (const kind of KINDS) for (const seed of [0, 1, 2]) {
      const before = JSON.stringify(cell)
      const a = varyCell(cell, kind, seed, style)
      expect(JSON.stringify(cell), `${label} ${kind}`).toBe(before)
      expect(varyCell(cell, kind, seed, style), `${label} ${kind}/${seed}`).toEqual(a)
      expect(a).not.toBe(cell)
    }
  })
  it('el resultado sigue siendo una célula válida de una canción válida, con ids de loop únicos y como mucho 8 loops', () => {
    for (const { cell, style, song, label } of cases) for (const kind of KINDS) for (const seed of [0, 1, 2]) {
      const v = varyCell(cell, kind, seed, style)
      expect(isSong(withCell(song, v)), `${label} ${kind}/${seed}`).toBe(true)
      expect(new Set(v.loops.map((l) => l.id)).size).toBe(v.loops.length)
      expect(v.loops.length).toBeLessThanOrEqual(MAX_LOOPS)
    }
  })
  it('«igual» es una copia exacta', () => {
    for (const { cell, style } of cases.slice(0, 6)) expect(varyCell(cell, 'same', 0, style)).toEqual(cell)
  })

  describe('+ energía', () => {
    const dembow = remixById('oda-alegria-dembow')!.build()
    const dembowCell = dembow.cells.find((c) => c.name === 'Despierta')! // platillo a corcheas, sin bombo ni caja
    it('el platillo llega a semicorcheas (los que había no se mueven), y bajo y acordes se encienden', () => {
      const v = varyCell(dembowCell, 'more', 0, 'dembow')
      const hh = drums(v, 'hh')!
      expect(hh.hits.map((h) => h.pos)).toEqual(Array.from({ length: 16 }, (_, i) => i))
      for (const h of drums(dembowCell, 'hh')!.hits) expect(hh.hits.some((x) => x.pos === h.pos && x.strength === h.strength)).toBe(true)
      expect(v.parts).toEqual({ bass: true, chords: true })
    })
    it('en dnb (graba cada 2 pasos) no pasa de corcheas', () => {
      const cell: Cell = { id: 1, loops: [{ id: 1, instrument: 'hh', bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 0.8 }, { pos: 8, strength: 0.8 }], muted: false, bornAt: 0, fromTemplate: false }], parts: { bass: false, chords: false }, turns: 4, at: { x: 0, y: 0, depth: 0 } }
      const hh = drums(varyCell(cell, 'more', 0, 'dnb'), 'hh')!
      expect(hh.hits.every((h) => h.pos % STYLES.dnb.quantizeEvery === 0)).toBe(true)
      expect(hh.hits.length).toBe(8)
    })
    it('un golpe extra de caja (semilla par) o de bombo (impar), en un hueco que el estilo pide', () => {
      const cell = cases.find((c) => c.label === 'dies-irae-techno · Hats')!.cell
      const sd0 = drums(cell, 'sd')
      const v0 = varyCell(cell, 'more', 0, 'techno')
      const v1 = varyCell(cell, 'more', 1, 'techno')
      expect(drums(v1, 'bd')!.hits.length).toBeGreaterThan(drums(cell, 'bd')!.hits.length) // bombo extra
      if (sd0) expect(drums(v0, 'sd')!.hits.length).toBeGreaterThan(sd0.hits.length)
      else expect(drums(v0, 'bd')!.hits.length).toBe(drums(cell, 'bd')!.hits.length)
      // el extra cae donde el prior del estilo da peso (no en un paso de peso mínimo)
      const prior = STYLE_MUSIC.techno.priors.bd
      const extra = drums(v1, 'bd')!.hits.map((h) => mod(h.pos, 16)).filter((s) => !drums(cell, 'bd')!.hits.some((h) => mod(h.pos, 16) === s))
      expect(extra.length).toBeGreaterThan(0)
      for (const s of extra) expect(prior[s]).toBeGreaterThanOrEqual(Math.min(...prior))
    })
    it('el filtro (si lo hay) sube', () => {
      const c = cases.find((x) => x.label === 'dies-irae-techno · Build')!.cell
      const v = varyCell(c, 'more', 0, 'techno')
      v.lpf!.forEach((val, i) => expect(val).toBeGreaterThanOrEqual(c.lpf![i]!))
    })
  })

  describe('− energía', () => {
    it('sin bombo, platillo a la mitad, sin bajo, y se conservan la caja (si había bombo), la melodía y los acordes', () => {
      const c = cases.find((x) => x.label === 'dies-irae-techno · DROP')!.cell
      const v = varyCell(c, 'less', 0, 'techno')
      expect(drums(v, 'bd')).toBeUndefined()
      expect(drums(v, 'sd')).toBeDefined()
      expect(drums(v, 'hh')!.hits.length).toBe(Math.ceil(drums(c, 'hh')!.hits.length / 2))
      expect(v.parts.bass).toBe(false)
      expect(v.parts.chords).toBe(c.parts.chords)
      expect(v.loops.find((l) => l.instrument === 'mel')).toEqual(c.loops.find((l) => l.instrument === 'mel'))
    })
    it('una célula ya pelada (sin bombo) pierde también la caja: solo queda la melodía', () => {
      const c = cases.find((x) => x.label === 'dies-irae-techno · Build')!.cell // caja y platillo, sin bombo
      const v = varyCell(c, 'less', 0, 'techno')
      expect(drums(v, 'sd')).toBeUndefined()
      expect(v.loops.some((l) => l.instrument === 'mel')).toBe(true)
    })
  })

  describe('redoble', () => {
    it('un loop de caja de 1 compás pasa a 4 y el último compás acaba en semicorcheas; no toca el resto', () => {
      const c = cases.find((x) => x.label === 'dies-irae-techno · Groove')!.cell
      const v = varyCell(c, 'fill', 0, 'techno')
      const sd = drums(v, 'sd')!
      expect(sd.bars).toBe(4)
      for (const s of [12, 13, 14, 15]) expect(sd.hits.some((h) => h.pos === 48 + s)).toBe(true)
      expect(sd.hits.filter((h) => h.pos < 48).length).toBe(drums(c, 'sd')!.hits.length * 3)
      expect(drums(v, 'bd')).toEqual(drums(c, 'bd'))
    })
    it('sin caja, la crea con la plantilla del estilo; en dnb, en corcheas', () => {
      const cell: Cell = { id: 1, loops: [{ id: 1, instrument: 'bd', bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 0.8 }], muted: false, bornAt: 0, fromTemplate: false }], parts: { bass: false, chords: false }, turns: 4, at: { x: 0, y: 0, depth: 0 } }
      const sd = drums(varyCell(cell, 'fill', 0, 'dnb'), 'sd')!
      expect(sd.hits.some((h) => h.pos === 60 || h.pos === 62)).toBe(true)
      expect(sd.hits.some((h) => h.pos === 61 || h.pos === 63)).toBe(false) // la rejilla de dnb
    })
  })

  describe('variar la melodía', () => {
    const mel = (c: Cell) => c.loops.find((l) => l.instrument === 'mel')!
    const c = cases.find((x) => x.label === 'oda-alegria-dembow · Despierta')!.cell
    it('semilla 0: otro ritmo, las mismas notas en el mismo orden, en la rejilla y sin cruzar compás', () => {
      const v = varyCell(c, 'melody', 0, 'dembow')
      expect(mel(v).hits.map((h) => h.midi)).toEqual(mel(c).hits.map((h) => h.midi).slice(0, mel(v).hits.length))
      expect(mel(v).hits.map((h) => h.pos)).not.toEqual(mel(c).hits.map((h) => h.pos))
      for (const h of mel(v).hits) expect(Math.floor(h.pos / 16)).toBe(Math.floor((h.pos + (h.dur ?? 1) - 1e-9) / 16))
    })
    it('semilla 1: una octava (arriba o abajo, dentro del registro)', () => {
      const v = varyCell(c, 'melody', 1, 'dembow')
      const d = mel(v).hits.map((h, i) => h.midi! - mel(c).hits[i]!.midi!)
      expect(new Set(d).size).toBe(1)
      expect(Math.abs(d[0]!)).toBe(12)
    })
    it('semilla 2: la respuesta, con el mismo ritmo, en la escala y acabando distinto', () => {
      const v = varyCell(c, 'melody', 2, 'dembow')
      expect(mel(v).hits.map((h) => h.pos)).toEqual(mel(c).hits.map((h) => h.pos))
      for (const h of mel(v).hits) expect(STYLE_MUSIC.dembow.scale).toContain(mod(h.midi!, 12))
      const last = (x: Cell) => mod(mel(x).hits[mel(x).hits.length - 1]!.midi!, 12)
      expect(last(v)).not.toBe(last(c))
    })
    it('la respuesta invierte la forma: lo que subía baja', () => {
      const hits = [{ pos: 0, dur: 4, midi: 62, strength: 0.8 }, { pos: 4, dur: 4, midi: 66, strength: 0.8 }, { pos: 8, dur: 4, midi: 69, strength: 0.8 }, { pos: 12, dur: 4, midi: 66, strength: 0.8 }]
      const a = answerPhrase(hits, 'dembow')
      expect(a[1]!.midi!).toBeLessThan(a[0]!.midi!)
      expect(a[2]!.midi!).toBeLessThan(a[1]!.midi!)
    })
    it('una célula sin melodía no cambia al «variar melodía» y no se ofrece', () => {
      const noMel = cases.find((x) => x.label === 'dies-irae-techno · Pulso')!.cell
      expect(varyCell(noMel, 'melody', 0, 'techno')).toEqual(noMel)
      expect(canVary(noMel, 'melody')).toBe(false)
    })
  })

  it('el orden de los chips: lo que más ayuda a avanzar primero, solo lo que tiene sentido', () => {
    const full = cases.find((x) => x.label === 'dies-irae-techno · DROP')!.cell
    const bare = cases.find((x) => x.label === 'dies-irae-techno · Pulso')!.cell
    expect(variationOrder(full)[0]).toBe('less') // llena: el respiro
    expect(variationOrder(bare)[0]).toBe('more')
    expect(variationOrder(bare, true)[0]).toBe('more') // la última de su grupo: hacia el drop
    expect(variationOrder(bare)).not.toContain('melody') // sin melodía no se ofrece
    expect(variationOrder(full).at(-1)).toBe('same')
    for (const k of KINDS) expect(VARIATION_LABELS[k].length).toBeGreaterThan(0)
  })
})

describe('poner una variación en la copia (spec 012, §5.1)', () => {
  it('la copia conserva su id, nombre, vueltas y posición, trae los loops de la variación con ids nuevos y la canción sigue siendo válida; la dada no cambia', async () => {
    const { withCopy } = await import('../../app/lib/cells')
    const { withVariation } = await import('../../app/lib/variations')
    const song = remixById('dies-irae-techno')!.build()
    const src = song.cells.find((c) => c.name === 'Hats')!
    const copied = withCopy(song, src.id, { x: 3, y: 3 })!
    const before = JSON.stringify(copied.song)
    const variant = varyCell(src, 'more', 0, 'techno')
    const next = withVariation(copied.song, copied.id, variant)
    expect(JSON.stringify(copied.song)).toBe(before)
    const cell = next.cells.find((c) => c.id === copied.id)!
    expect(cell.name).toBe(`${src.name} copia`)
    expect(cell.turns).toBe(src.turns)
    expect(cell.at).toEqual({ x: 3, y: 3, depth: src.at.depth })
    expect(cell.parts).toEqual({ bass: true, chords: true })
    expect(cell.loops.length).toBe(variant.loops.length)
    const ids = next.cells.flatMap((c) => c.loops.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length) // ningún id repetido en toda la canción
    expect(next.nextLoopId).toBeGreaterThan(Math.max(...ids))
    expect(isSong(next)).toBe(true)
    // una célula que no existe: la canción no cambia
    expect(withVariation(copied.song, 999, variant)).toBe(copied.song)
  })
})

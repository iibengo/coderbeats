import { describe, expect, it } from 'vitest'
import {
  advance,
  demoSong,
  emptySong,
  fitTurns,
  isSong,
  minTurns,
  nextInOrder,
  songBars,
  songFromLoops,
  storableSong,
  windowAt,
  type Cursor,
  type Song,
} from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { songCode, type SongState } from '../../app/lib/song'
import type { Instrument } from '../../app/lib/types'

let id = 100
const loop = (instrument: Instrument, pos: number[], o: Partial<FreeLoop> = {}): FreeLoop => ({
  id: ++id,
  instrument,
  bars: 1,
  phaseBar: 0,
  hits: pos.map((p) => ({ pos: p, strength: 0.5 })),
  muted: false,
  bornAt: 0,
  fromTemplate: false,
  ...o,
})

const base = (o: Partial<SongState> = {}): SongState => ({
  loops: [],
  style: 'dnb',
  kit: '909',
  background: { mode: 'manual', parts: { bass: false, chords: false } },
  metronome: false,
  fx: { filter: 1, space: 0, warmth: 0 },
  ...o,
})

const withSong = (song: Song, cursor: Cursor, o: Partial<SongState> = {}): SongState =>
  base({ ...o, cells: { list: song.cells, order: song.order, window: windowAt(song, cursor) } })

/** Recorre la canción compás a compás desde el 0 y devuelve qué célula suena en cada uno. */
function timeline(song: Song, bars: number): number[] {
  let c: Cursor = { cellId: song.order[0]!, startBar: 0 }
  const out: number[] = []
  for (let g = 0; g < bars; g++) {
    c = advance(song, c, g)
    out.push(c.cellId)
  }
  return out
}

describe('cells: plan', () => {
  const demo = demoSong('dnb')!

  it('demo de drum and bass: intro 4 · subida 4 · drop 8 · final 2, y vuelve a empezar', () => {
    expect(demo.cells.map((c) => [c.name, c.turns])).toEqual([
      ['intro', 4],
      ['subida', 4],
      ['drop', 8],
      ['final', 2],
    ])
    expect(songBars(demo)).toBe(18)
    const t = timeline(demo, 20)
    expect(t).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 1, 1])
  })

  it('demo: el bajo solo en el drop; acordes en todas; batería según la sección', () => {
    const by = Object.fromEntries(demo.cells.map((c) => [c.name, c]))
    expect(by.subida!.parts).toEqual({ bass: false, chords: true })
    expect(by.drop!.parts).toEqual({ bass: true, chords: true })
    expect(by.subida!.loops.map((l) => l.instrument)).toEqual(['bd', 'sd'])
    expect(by.final!.loops).toEqual([])
    const ids = demo.cells.flatMap((c) => c.loops.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(demo.nextLoopId).toBeGreaterThan(Math.max(...ids))
    expect(isSong(demo)).toBe(true)
  })

  it('nextInOrder: tras la última, la primera', () => {
    expect(nextInOrder(demo, 2)).toBe(3)
    expect(nextInOrder(demo, 4)).toBe(1)
  })

  it('avanza aunque el cursor se haya quedado atrás varios compases', () => {
    expect(advance(demo, { cellId: 1, startBar: 0 }, 9)).toEqual({ cellId: 3, startBar: 8 })
  })

  it('una sola célula: no avanza nunca y su tramo no tiene final', () => {
    const one = emptySong()
    expect(advance(one, { cellId: 1, startBar: 0 }, 50)).toEqual({ cellId: 1, startBar: 0 })
    expect(windowAt(one, { cellId: 1, startBar: 0 })).toEqual([{ cellId: 1, from: 0, to: null }])
  })

  it('windowAt: la célula que suena y la siguiente, acotadas', () => {
    expect(windowAt(demo, { cellId: 3, startBar: 8 })).toEqual([
      { cellId: 3, from: 8, to: 16 },
      { cellId: 4, from: 16, to: 18 },
    ])
    expect(windowAt(demo, { cellId: 4, startBar: 16 })).toEqual([
      { cellId: 4, from: 16, to: 18 },
      { cellId: 1, from: 18, to: 22 },
    ])
  })

  it('vueltas: nunca por debajo del loop más largo', () => {
    expect(minTurns([])).toBe(1)
    expect(minTurns([{ bars: 2 }, { bars: 4 }])).toBe(4)
    expect(fitTurns(1, [{ bars: 4 }])).toBe(4)
    expect(fitTurns(8, [{ bars: 4 }])).toBe(8)
  })
})

describe('cells: persistencia', () => {
  it('migra los loops guardados a una canción de una célula, con su fondo', () => {
    const l = loop('bd', [0], { bars: 2, bornAt: 7, prev: { hits: [], bars: 1, phaseBar: 0 } })
    const s = songFromLoops({ loops: [l], nextId: 3 }, { bass: true, chords: false })
    expect(s.cells).toHaveLength(1)
    expect(s.order).toEqual([1])
    expect(s.cells[0]!.parts).toEqual({ bass: true, chords: false })
    expect(s.cells[0]!.turns).toBe(2)
    expect(s.cells[0]!.loops[0]).not.toHaveProperty('prev')
    expect(s.cells[0]!.loops[0]!.bornAt).toBe(0)
    expect(s.nextLoopId).toBe(l.id + 1)
    expect(isSong(s)).toBe(true)
  })

  it('isSong rechaza formas rotas', () => {
    expect(isSong(null)).toBe(false)
    expect(isSong({ ...emptySong(), order: [9] })).toBe(false)
    expect(isSong({ ...emptySong(), cells: [] })).toBe(false)
    expect(isSong({ ...emptySong(), cells: [{ ...emptySong().cells[0]!, turns: 3 }] })).toBe(false)
  })

  it('storableSong quita versiones previas y nacimientos', () => {
    const s = emptySong()
    s.cells[0]!.loops = [loop('sd', [4], { bornAt: 12, prev: { hits: [], bars: 1, phaseBar: 0 } })]
    const out = storableSong(s).cells[0]!.loops[0]!
    expect(out.bornAt).toBe(0)
    expect(out).not.toHaveProperty('prev')
  })
})

describe('cells: código', () => {
  const demo = demoSong('dnb')!

  it('una canción de una célula da el mismo código que sin células (mostrado y motor)', () => {
    const loops = [loop('bd', [0, 10]), loop('hh', [2, 6])]
    const one: Song = { ...emptySong(), cells: [{ ...emptySong().cells[0]!, loops }] }
    for (const mode of ['display', 'engine'] as const) {
      const plain = songCode(base({ loops }), mode)
      expect(songCode(withSong(one, { cellId: 1, startBar: 0 }, { loops }), mode)).toBe(plain)
    }
  })

  it('motor: solo la célula que suena y la siguiente, cada una acotada a sus compases', () => {
    const code = songCode(withSong(demo, { cellId: 1, startBar: 0 }), 'engine')
    expect(code).toContain('// intro · compases 0–3')
    expect(code).toContain('.filterHaps((h) => h.whole.begin >= 0 && h.whole.begin < 4)')
    expect(code).toContain('// subida · compases 4–7')
    expect(code).toContain('.filterHaps((h) => h.whole.begin >= 4 && h.whole.begin < 8)')
    expect(code).not.toContain('drop')
    // el fondo va siempre en el motor (lo abren y cierran los nodos nativos) y el pulso una vez
    expect(code.match(/color\("pulse"\)/g)).toHaveLength(1)
    expect(code).toContain('.color("bass")')
  })

  it('motor: la célula vacía no añade nada (el final solo lleva fondo)', () => {
    const code = songCode(withSong(demo, { cellId: 4, startBar: 16 }), 'engine')
    expect(code).not.toContain('// final')
    expect(code).toContain('// intro · compases 18–21')
  })

  it('motor: la fase de un loop largo se cuenta desde el inicio de su célula', () => {
    // loop de 2 compases: compás 0 con bombo en 0, compás 1 con bombo en 8
    const l = loop('bd', [0, 24], { bars: 2 })
    const s: Song = {
      ...emptySong(),
      cells: [
        { ...emptySong().cells[0]!, id: 1, loops: [loop('hh', [0])], turns: 1 },
        { ...emptySong().cells[0]!, id: 2, loops: [l], turns: 2 },
      ],
      order: [1, 2],
    }
    // la célula 2 empieza en el compás 5 (impar): su compás 0 tiene que caer en el ciclo 5
    const code = songCode(withSong(s, { cellId: 2, startBar: 5 }), 'engine')
    const line = code.split('\n').find((x) => x.includes('s("<'))!
    // ciclo par (0 mod 2) ← compás 1 del loop; ciclo impar ← compás 0
    expect(line).toContain('s("<[~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~] [bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~]>")')
  })

  it('mostrado: la canción entera con arrange, una sección por célula con su fondo', () => {
    const code = songCode(withSong(demo, { cellId: 1, startBar: 0 }), 'display')
    const lines = code.split('\n')
    expect(lines[0]).toBe('setcpm(174/4)')
    expect(lines).toContain('arrange(')
    expect(code).toContain('// intro · 4 vueltas')
    expect(code).toContain('  [4, stack(')
    expect(code).toContain('// final · 2 vueltas')
    expect(code).toContain('  [2, stack(')
    expect(code).toContain('  [8, stack(')
    // el bajo solo en el drop
    const sections = code.split('  // ').slice(1)
    const withBass = sections.filter((s) => s.includes('.orbit(2)')).map((s) => s.split(' ')[0])
    expect(withBass).toEqual(['drop'])
    // sin ganchos del motor
    expect(code).not.toContain('filterHaps')
    expect(code).not.toContain('color(')
    expect(lines[lines.length - 1]).toBe(')')
  })

  it('mostrado: sin fondo, una sección vacía es silence', () => {
    const code = songCode(withSong(demo, { cellId: 1, startBar: 0 }, { background: { mode: 'off', parts: { bass: false, chords: false } } }), 'display')
    expect(code).toContain('  [2, silence],')
    expect(code).not.toContain('.orbit(2)')
  })
})

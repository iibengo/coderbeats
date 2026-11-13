import { describe, expect, it } from 'vitest'
import {
  advance,
  cellById,
  demoSong,
  emptySong,
  endBar,
  fitTurns,
  groupIdOf,
  groupOn,
  groupSong,
  inParallel,
  isSong,
  MAIN,
  MAX_CELLS,
  minTurns,
  nextDepth,
  nextGroupSpot,
  nextInOrder,
  nextTurns,
  normalizeSong,
  orderOf,
  orderWith,
  songBars,
  songFromLoops,
  stepPlay,
  storableSong,
  stressSong,
  windowAt,
  withCopy,
  withCut,
  withGroupOn,
  withNewCell,
  withNewGroup,
  withOrderAfter,
  withRestoredCell,
  withValidBpm,
  withoutCell,
  type Cursor,
  type Play,
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

describe('cells: bucle y saltos', () => {
  const demo = demoSong('dnb')!
  const ids = demo.order
  const play = (o: Partial<Play> = {}): Play => ({ cursor: { cellId: ids[0]!, startBar: 0 }, loop: false, jump: null, ...o })

  it('en bucle el cursor no avanza nunca y su tramo no tiene final', () => {
    const p = stepPlay(demo, play({ loop: true }), 100)
    expect(p.cursor).toEqual({ cellId: ids[0], startBar: 0 })
    expect(windowAt(demo, p.cursor, { loop: true })).toEqual([{ cellId: ids[0], from: 0, to: null }])
    expect(endBar(demo, p)).toBe(Infinity)
  })

  it('salto a bucle: hasta el compás del salto sigue la célula; desde él, la otra sin final', () => {
    const jump = { cellId: ids[2]!, startBar: 3, loop: true }
    const p = play({ jump })
    expect(windowAt(demo, p.cursor, { jump })).toEqual([
      { cellId: ids[0], from: 0, to: 3 },
      { cellId: ids[2], from: 3, to: null },
    ])
    expect(endBar(demo, p)).toBe(3)
    expect(stepPlay(demo, p, 2)).toBe(p)
    const at = stepPlay(demo, p, 3)
    expect(at).toEqual({ cursor: { cellId: ids[2], startBar: 3 }, loop: true, jump: null })
    expect(stepPlay(demo, at, 40).cursor).toEqual({ cellId: ids[2], startBar: 3 })
  })

  it('el salto gana si cae justo en la línea donde acaba la célula', () => {
    const jump = { cellId: ids[3]!, startBar: 4, loop: true }
    expect(stepPlay(demo, play({ jump }), 4).cursor).toEqual({ cellId: ids[3], startBar: 4 })
  })

  it('seguir: la célula en bucle vuelve a empezar y la canción sigue desde ahí', () => {
    const looping = play({ cursor: { cellId: ids[1]!, startBar: 4 }, loop: true })
    const jump = { cellId: ids[1]!, startBar: 15, loop: false }
    const next = stepPlay(demo, { ...looping, jump }, 15)
    expect(next).toEqual({ cursor: { cellId: ids[1], startBar: 15 }, loop: false, jump: null })
    // le toca terminar sus vueltas desde ahí (4), y luego sigue el drop
    expect(stepPlay(demo, next, 19).cursor).toEqual({ cellId: ids[2], startBar: 19 })
    expect(windowAt(demo, looping.cursor, { jump })[1]).toEqual({ cellId: ids[1], from: 15, to: 19 })
  })

  it('una canción de una célula no cambia con bucle ni saltos', () => {
    const one = emptySong()
    const p: Play = { cursor: { cellId: 1, startBar: 0 }, loop: false, jump: null }
    expect(stepPlay(one, p, 50)).toBe(p)
    expect(windowAt(one, p.cursor, { loop: true })).toEqual(windowAt(one, p.cursor))
    expect(endBar(one, p)).toBe(Infinity)
  })

  it('el código del motor en bucle lleva solo esa célula, sin límite final', () => {
    const code = songCode(withSongLoop(demo, { cellId: ids[2]!, startBar: 8 }), 'engine')
    expect(code).toContain('h.whole.begin >= 8)')
    expect(code).not.toContain('&&')
  })
})

function withSongLoop(song: Song, cursor: Cursor): SongState {
  return base({ cells: { list: song.cells, order: song.order, window: windowAt(song, cursor, { loop: true }) } })
}

describe('cells: canción de prueba', () => {
  const demo = demoSong('dnb')!

  it('duplica la demo hasta 8 y hasta 16 células, con ids únicos', () => {
    for (const n of [8, 16]) {
      const s = stressSong(demo, n)
      expect(s.cells).toHaveLength(n)
      expect(s.order).toEqual(s.cells.map((c) => c.id))
      expect(new Set(s.cells.map((c) => c.id)).size).toBe(n)
      const loopIds = s.cells.flatMap((c) => c.loops.map((l) => l.id))
      expect(new Set(loopIds).size).toBe(loopIds.length)
      expect(Math.max(...loopIds)).toBeLessThan(s.nextLoopId)
      expect(isSong(s)).toBe(true)
      expect(songBars(s)).toBe((songBars(demo) * n) / demo.cells.length)
    }
  })

  it('repite la estructura de la demo y numera las vueltas siguientes', () => {
    const s = stressSong(demo, 8)
    expect(s.cells.map((c) => c.turns)).toEqual([4, 4, 8, 2, 4, 4, 8, 2])
    expect(s.cells.map((c) => c.name)).toEqual(['intro', 'subida', 'drop', 'final', 'intro 2', 'subida 2', 'drop 2', 'final 2'])
    expect(s.cells[6]!.parts).toEqual(demo.cells[2]!.parts)
    expect(s.cells[7]!.at.x).toBe(21)
  })

  it('no pasa de 16 células y no toca la demo original', () => {
    const before = JSON.stringify(demo)
    expect(stressSong(demo, 40).cells).toHaveLength(16)
    expect(stressSong(demo, 0).cells).toHaveLength(1)
    expect(JSON.stringify(demo)).toBe(before)
  })
})

describe('cells: crear y borrar', () => {
  const demo = demoSong('dnb')!

  it('una célula nueva es vacía, va al final del orden y con otra profundidad', () => {
    const r = withNewCell(demo, { x: 12, y: 1 })!
    expect(r.id).toBe(demo.nextCellId)
    expect(r.song.order).toEqual([...demo.order, r.id])
    const c = r.song.cells.at(-1)!
    expect(c.loops).toEqual([])
    expect(c.parts).toEqual({ bass: false, chords: false })
    expect(c.turns).toBe(1)
    expect(c.at).toEqual({ x: 12, y: 1, depth: nextDepth(4) })
    expect(r.song.nextCellId).toBe(demo.nextCellId + 1)
    expect(isSong(r.song)).toBe(true)
    expect(demo.cells).toHaveLength(4) // la original no cambia
  })

  it('con 16 células no se crea otra', () => {
    let s = stressSong(demo, MAX_CELLS)
    expect(withNewCell(s, { x: 0, y: 0 })).toBeNull()
    s = withoutCell(s, 3)
    expect(withNewCell(s, { x: 0, y: 0 })).not.toBeNull()
  })

  it('borrar cierra el hilo: la anterior pasa a la siguiente', () => {
    const s = withoutCell(demo, demo.order[1]!)
    expect(s.cells.map((c) => c.id)).toEqual([demo.order[0], demo.order[2], demo.order[3]])
    expect(s.order).toEqual([demo.order[0], demo.order[2], demo.order[3]])
    expect(nextInOrder(s, demo.order[0]!)).toBe(demo.order[2])
    expect(demo.order).toHaveLength(4)
  })

  it('al deshacer, vuelve entre sus mismos vecinos; si ya no están, a un lado o al final', () => {
    expect(orderWith([1, 3, 4], 2, 1, 3)).toEqual([1, 2, 3, 4])
    expect(orderWith([1, 3, 4], 2, 9, 3)).toEqual([1, 2, 3, 4]) // la anterior ya no está: antes de la siguiente
    expect(orderWith([1, 3, 4], 2, 9, 8)).toEqual([1, 3, 4, 2]) // ninguna sigue: al final
    expect(orderWith([3, 4], 1, null, 3)).toEqual([1, 3, 4]) // era la primera
    expect(orderWith([1, 3], 4, 3, null)).toEqual([1, 3, 4]) // era la última
  })

  it('un salto pendiente funciona aunque la célula del cursor se haya borrado', () => {
    const gone = demo.order[1]!
    const song = withoutCell(demo, gone)
    const jump = { cellId: demo.order[2]!, startBar: 9, loop: false }
    const play: Play = { cursor: { cellId: gone, startBar: 4 }, loop: false, jump }
    // hasta el salto el cursor no se mueve (antes saltaba a la primera)
    expect(stepPlay(song, play, 6)).toBe(play)
    expect(windowAt(song, play.cursor, { jump })).toEqual([
      { cellId: gone, from: 4, to: 9 },
      { cellId: demo.order[2], from: 9, to: 9 + 8 },
    ])
    expect(stepPlay(song, play, 9).cursor).toEqual({ cellId: demo.order[2], startBar: 9 })
  })
})

describe('cells: vueltas con el número', () => {
  it('1 → 2 → 4 → 8 → 16 → 32 → 1 (hasta 32 para melodías largas)', () => {
    expect(nextTurns(1, 1)).toBe(2)
    expect(nextTurns(2, 1)).toBe(4)
    expect(nextTurns(4, 1)).toBe(8)
    expect(nextTurns(8, 1)).toBe(16)
    expect(nextTurns(16, 1)).toBe(32)
    expect(nextTurns(32, 1)).toBe(1)
  })
  it('nunca por debajo del loop más largo', () => {
    expect(nextTurns(4, 4)).toBe(8)
    expect(nextTurns(32, 4)).toBe(4) // da la vuelta, pero no baja de 4
    expect(nextTurns(2, 2)).toBe(4)
    expect(nextTurns(32, 32)).toBe(32)
  })
  it('una canción con vueltas de 16 y 32 vale y suma sus compases', () => {
    const s = emptySong()
    const long = { ...s, cells: [{ ...s.cells[0]!, turns: 32 as const }] }
    expect(isSong(long)).toBe(true)
    expect(songBars(long)).toBe(32)
    expect(isSong({ ...s, cells: [{ ...s.cells[0]!, turns: 3 as never }] })).toBe(false)
  })
})

describe('cells: el tempo guardado', () => {
  it('un tempo roto no descarta la canción: se limpia y vuelve el del estilo', () => {
    const s = emptySong()
    expect(isSong({ ...s, bpm: '130' })).toBe(true)
    expect(withValidBpm({ ...s, bpm: 130 }).bpm).toBe(130)
    expect(withValidBpm({ ...s, bpm: null }).bpm).toBeNull()
    expect(withValidBpm({ ...s, bpm: '130' as unknown as number }).bpm).toBeNull()
    expect(withValidBpm({ ...s, bpm: 9999 }).bpm).toBeNull()
    expect(withValidBpm({ ...s, bpm: 9999 }).cells).toBe(s.cells) // el resto de la canción no se toca
  })
})

describe('grupos de células (enmienda 2, §16)', () => {
  const demo = demoSong('dnb')!
  const [a, b, c, d] = demo.order as [number, number, number, number]
  const withG = (n = 1) => {
    let s = demo
    const ids: { id: number; groupId: number }[] = []
    for (let i = 0; i < n; i++) {
      const r = withNewGroup(s)!
      s = r.song
      ids.push({ id: r.id, groupId: r.groupId })
    }
    return { song: s, ids }
  }

  it('toda célula está en un grupo: la canción (0) o uno en paralelo', () => {
    const { song, ids } = withG()
    expect(groupIdOf(song, a)).toBe(MAIN)
    expect(groupIdOf(song, ids[0]!.id)).toBe(ids[0]!.groupId)
    expect(groupIdOf(song, 999)).toBeNull()
    expect(inParallel(song, a)).toBe(false)
    expect(inParallel(song, ids[0]!.id)).toBe(true)
    expect(orderOf(song, MAIN)).toEqual(demo.order)
    expect(orderOf(song, ids[0]!.groupId)).toEqual([ids[0]!.id])
  })

  it('un grupo nuevo nace apagado, de una célula vacía, encima de la curva y fuera de la canción', () => {
    const { song, ids } = withG()
    const { id, groupId } = ids[0]!
    expect(song.groups).toEqual([{ id: groupId, order: [id], on: false }])
    expect(groupOn(song, groupId)).toBe(false)
    expect(groupOn(song, MAIN)).toBe(true)
    expect(song.order).toEqual(demo.order)
    expect(songBars(song)).toBe(songBars(demo))
    expect(cellById(song, id)!.loops).toEqual([])
    expect(cellById(song, id)!.at.y).toBeLessThan(Math.min(...demo.cells.map((x) => x.at.y)))
    expect(isSong(song)).toBe(true)
  })

  it('los grupos nuevos se colocan uno al lado de otro, y cuentan para las 16 células', () => {
    const { song, ids } = withG(2)
    const p0 = cellById(song, ids[0]!.id)!.at
    const p1 = cellById(song, ids[1]!.id)!.at
    expect(p1.x).toBeCloseTo(p0.x + 3)
    expect(p1.y).toBe(p0.y)
    expect(nextGroupSpot(song).x).toBeCloseTo(p1.x + 3)
    expect(withNewGroup(stressSong(demo, MAX_CELLS))).toBeNull()
  })

  it('encender y apagar cambia solo ese grupo; el principal no se enciende ni se apaga', () => {
    const { song, ids } = withG(2)
    const on = withGroupOn(song, ids[0]!.groupId, true)!
    expect(groupOn(on, ids[0]!.groupId)).toBe(true)
    expect(groupOn(on, ids[1]!.groupId)).toBe(false)
    expect(withGroupOn(on, ids[0]!.groupId, false)!.groups[0]!.on).toBe(false)
    expect(withGroupOn(song, MAIN, false)).toBeNull()
    expect(withGroupOn(song, 99, true)).toBeNull()
  })

  it('el orden de un grupo sirve para el avance de siempre (groupSong)', () => {
    const { song, ids } = withG()
    const g = ids[0]!.groupId
    // un grupo de una célula se repite: no avanza nunca
    const solo = groupSong(song, g)
    expect(solo.order).toEqual([ids[0]!.id])
    expect(stepPlay(solo, { cursor: { cellId: ids[0]!.id, startBar: 4 }, loop: false, jump: null }, 99).cursor).toEqual({ cellId: ids[0]!.id, startBar: 4 })
    // uno de varias avanza por su orden y vuelve a la primera
    const two = withOrderAfter(song, ids[0]!.id, b)!
    const pair = groupSong(two, g)
    expect(pair.order).toEqual([ids[0]!.id, b])
    expect(advance(pair, { cellId: ids[0]!.id, startBar: 0 }, 1).cellId).toBe(b)
    expect(advance(pair, { cellId: b, startBar: 1 }, 1 + cellById(two, b)!.turns).cellId).toBe(ids[0]!.id)
  })

  it('copiar crea un grupo nuevo de una célula, apagado; la canción no cambia', () => {
    const r = withCopy(demo, c, { x: 20, y: 3 })!
    expect(r.song.order).toEqual(demo.order)
    expect(r.song.groups).toEqual([{ id: r.groupId, order: [r.id], on: false }])
    expect(cellById(r.song, r.id)!.turns).toBe(cellById(demo, c)!.turns)
    const ids = r.song.cells.flatMap((x) => x.loops.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(r.song.nextLoopId).toBeGreaterThan(Math.max(...ids))
    expect(withCopy(stressSong(demo, MAX_CELLS), 1, { x: 0, y: 0 })).toBeNull()
  })

  it('juntar: B va justo detrás de A, en el grupo de A (una suelta entra en la canción)', () => {
    const { song, ids } = withG()
    const x = ids[0]!.id
    const hooked = withOrderAfter(song, c, x)!
    expect(hooked.order).toEqual([a, b, c, x, d])
    expect(hooked.groups).toEqual([]) // el grupo de una célula desaparece
    expect(groupIdOf(hooked, x)).toBe(MAIN)
  })

  it('juntar la cola de un grupo con la cabeza de otro junta los dos grupos enteros', () => {
    const { song, ids } = withG(2)
    const [g1, g2] = ids as [{ id: number; groupId: number }, { id: number; groupId: number }]
    const pair = withOrderAfter(song, g1.id, g2.id)! // g2 detrás de g1: un grupo de dos
    expect(pair.groups).toHaveLength(1)
    expect(orderOf(pair, g1.groupId)).toEqual([g1.id, g2.id])
    // y ese grupo (cola g2) sobre la cabeza de otro de la canción… la canción entera tras él
    const merged = withOrderAfter(pair, g2.id, a)!
    expect(merged.order).toEqual([g1.id, g2.id, a, b, c, d]) // el resultado es el principal
    expect(merged.groups).toEqual([])
    expect(groupIdOf(merged, g1.id)).toBe(MAIN)
  })

  it('en cualquier otro caso solo cambia de grupo la célula soltada, y la canción no se queda sin células', () => {
    const { song, ids } = withG()
    const g = ids[0]!
    // b no es la cabeza de la canción: solo b pasa a detrás de la célula del grupo
    const moved = withOrderAfter(song, g.id, b)!
    expect(moved.order).toEqual([a, c, d])
    expect(orderOf(moved, g.groupId)).toEqual([g.id, b])
    // la única célula de la canción no se puede sacar a otro grupo…
    const r1 = withNewGroup(emptySong())!
    const r2 = withNewGroup(r1.song)!
    const pair = withOrderAfter(r2.song, r1.id, r2.id)! // un grupo [r1, r2]
    expect(withOrderAfter(pair, r1.id, 1)).toBeNull() // r1 no es la cola: solo se movería la 1 y la canción se quedaría vacía
    // …salvo que sea juntar los dos grupos enteros (cola sobre cabeza): la canción pasa a llevar el grupo delante
    expect(withOrderAfter(pair, r2.id, 1)!.order).toEqual([r1.id, r2.id, 1])
  })

  it('dentro de un grupo, ordenar es la regla de siempre; sin cambios, null', () => {
    expect(withOrderAfter(demo, a, d)!.order).toEqual([a, d, b, c])
    expect(withOrderAfter(demo, a, b)).toBeNull()
    expect(withOrderAfter(demo, a, a)).toBeNull()
    expect(withOrderAfter(demo, a, 999)).toBeNull()
    expect(demo.order).toEqual([a, b, c, d])
  })

  it('cortar un hilo parte el grupo en dos: lo de detrás, un grupo nuevo apagado; el principal sigue con la primera célula', () => {
    const cut = withCut(demo, c)!
    expect(cut.order).toEqual([a, b])
    expect(cut.groups).toEqual([{ id: demo.nextGroupId, order: [c, d], on: false }])
    expect(groupIdOf(cut, d)).toBe(demo.nextGroupId)
    expect(songBars(cut)).toBe(cellById(demo, a)!.turns + cellById(demo, b)!.turns)
    expect(isSong(cut)).toBe(true)
    // la cabeza de un grupo no tiene hilo que cortar
    expect(withCut(demo, a)).toBeNull()
    expect(withCut(demo, 999)).toBeNull()
  })

  it('cortar un grupo en paralelo conserva su estado en la parte de delante; la de detrás nace apagada', () => {
    const { song, ids } = withG()
    const joined = withGroupOn(withOrderAfter(withOrderAfter(song, ids[0]!.id, b)!, b, c)!, ids[0]!.groupId, true)!
    expect(orderOf(joined, ids[0]!.groupId)).toEqual([ids[0]!.id, b, c])
    const cut = withCut(joined, c)!
    expect(orderOf(cut, ids[0]!.groupId)).toEqual([ids[0]!.id, b])
    expect(groupOn(cut, ids[0]!.groupId)).toBe(true)
    expect(cut.groups.find((g) => g.order.includes(c))).toMatchObject({ on: false })
  })

  it('borrar una célula la saca de su grupo; un grupo sin células desaparece', () => {
    const { song, ids } = withG()
    const gone = withoutCell(song, ids[0]!.id)
    expect(gone.groups).toEqual([])
    expect(gone.cells.some((x) => x.id === ids[0]!.id)).toBe(false)
    expect(withoutCell(demo, b).order).toEqual([a, c, d])
  })

  it('deshacer un borrado: vuelve a su grupo, entre sus mismos vecinos; si el grupo ya no está, apagado y suelto', () => {
    const cell = cellById(demo, b)!
    const gone = withoutCell(demo, b)
    expect(withRestoredCell(gone, cell, MAIN, a, c, true).order).toEqual([a, b, c, d])
    const { song, ids } = withG()
    const lone = cellById(song, ids[0]!.id)!
    const without = withoutCell(song, ids[0]!.id)
    const back = withRestoredCell(without, lone, ids[0]!.groupId, null, null, true)
    expect(back.groups).toEqual([{ id: ids[0]!.groupId, order: [lone.id], on: true }])
    expect(back.nextGroupId).toBeGreaterThan(ids[0]!.groupId)
  })
})

describe('lo guardado antes de los grupos se migra sin perder nada (§16.6)', () => {
  const legacy = (): Song => {
    const s = demoSong('dnb')!
    const free = { ...s.cells[0]!, id: 10, free: true, on: true } as Song['cells'][number]
    const freeOff = { ...s.cells[0]!, id: 11, free: true, on: false } as Song['cells'][number]
    const loose = { ...s.cells[0]!, id: 12 } as Song['cells'][number]
    const { groups: _g, nextGroupId: _n, ...rest } = s
    return { ...rest, cells: [...s.cells, free, freeOff, loose] } as unknown as Song
  }

  it('una libre pasa a ser un grupo de una célula con su estado; una suelta, uno apagado', () => {
    const n = normalizeSong(legacy())
    expect(n.order).toEqual([1, 2, 3, 4])
    expect(n.groups.map((g) => [g.order, g.on])).toEqual([
      [[10], true],
      [[11], false],
      [[12], false],
    ])
    expect(new Set(n.groups.map((g) => g.id)).size).toBe(3)
    expect(n.nextGroupId).toBeGreaterThan(Math.max(...n.groups.map((g) => g.id)))
  })

  it('no pierde células ni toca lo demás, y ya no lleva los marcadores antiguos', () => {
    const raw = legacy()
    const n = normalizeSong(raw)
    expect(n.cells.map((c) => c.id)).toEqual(raw.cells.map((c) => c.id))
    expect(n.cells.every((c) => !('free' in c) && !('on' in c))).toBe(true)
    expect(n.cells[0]!.loops).toEqual(raw.cells[0]!.loops)
    expect(n.nextLoopId).toBe(raw.nextLoopId)
    expect(n.bpm).toBe(raw.bpm)
    expect(isSong(n)).toBe(true)
  })

  it('una canción ya con grupos queda igual (idempotente)', () => {
    const once = normalizeSong(legacy())
    expect(normalizeSong(once)).toEqual(once)
    const plain = demoSong('dnb')!
    expect(normalizeSong(plain)).toEqual(plain)
  })

  it('arregla lo roto: una célula en dos grupos, ids que no existen, grupos vacíos, sin canción', () => {
    const s = demoSong('dnb')!
    const bad = {
      ...s,
      order: [1, 2, 99],
      groups: [
        { id: 5, order: [2, 3], on: true }, // el 2 ya está en la canción
        { id: 6, order: [], on: true }, // vacío
        { id: 5, order: [4], on: false }, // id repetido
      ],
      nextGroupId: 1,
    } as Song
    const n = normalizeSong(bad)
    expect(n.order).toEqual([1, 2])
    expect(n.groups.map((g) => g.order)).toEqual([[3], [4]])
    expect(new Set(n.groups.map((g) => g.id)).size).toBe(2)
    expect(n.groups[0]).toMatchObject({ id: 5, on: true })
    // toda célula en un solo grupo
    const all = [...n.order, ...n.groups.flatMap((g) => g.order)]
    expect(all.sort()).toEqual(n.cells.map((c) => c.id).sort())
    // una canción sin orden usa la primera célula
    expect(normalizeSong({ ...s, order: [] }).order).toEqual([1])
  })
})

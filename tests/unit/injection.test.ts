import { describe, expect, it } from 'vitest'
import { demoSong, emptySong, isFreeLoop, isSong, type Cell, type Song } from '../../app/lib/cells'
import { isSavedSong, makeSaved, parseLibrary, serializeLibrary, emptyLibrary, addSong } from '../../app/lib/library'
import { isStoredPrefs } from '../../app/lib/prefsGuard'
import { safeLabel, safeNum, songCode, type SongState } from '../../app/lib/song'
import type { FreeLoop } from '../../app/lib/freeLoops'

const EVIL = 'x\nhush();fetch("//evil")//'
const loop = (o: Partial<FreeLoop> = {}): FreeLoop => ({
  id: 1,
  instrument: 'bd',
  bars: 1,
  phaseBar: 0,
  hits: [{ pos: 0, strength: 0.5 }],
  muted: false,
  bornAt: 0,
  fromTemplate: false,
  ...o,
})
const song = (cellOver: Partial<Cell> = {}, loopOver: Partial<FreeLoop> = {}): Song => {
  const s = emptySong()
  return { ...s, cells: [{ ...s.cells[0]!, loops: [loop(loopOver)], ...cellOver }] }
}
const state = (song: Song): SongState => ({
  loops: song.cells[0]!.loops,
  style: 'dnb',
  kit: '909',
  background: { mode: 'off', parts: { bass: false, chords: false } },
  metronome: false,
  fx: { filter: 1, space: 0, warmth: 0 },
  cells: { list: song.cells, order: song.order, window: [{ cellId: song.cells[0]!.id, from: 0, to: null }] },
})
/** El código sin las líneas de comentario: lo único que Strudel ejecuta de verdad. */
const codeOnly = (code: string) => code.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const bad = (x: unknown) => expect(x).toBe(false)

describe('isSong estricta (lo que se lee de localStorage)', () => {
  it('acepta lo que genera la app', () => {
    expect(isSong(emptySong())).toBe(true)
    expect(isSong(demoSong('dnb'))).toBe(true)
    expect(isSong(JSON.parse(JSON.stringify(song())))).toBe(true)
  })

  it('rechaza ids, bornAt y fases que no son números', () => {
    bad(isSong(song({}, { id: '1)||alert(1)//' as unknown as number })))
    bad(isSong(song({}, { bornAt: '0) || alert(1) //' as unknown as number })))
    bad(isSong(song({}, { phaseBar: Number.NaN })))
    bad(isSong(song({}, { phaseBar: Infinity })))
  })

  it('rechaza instrumentos y compases fuera de lista', () => {
    bad(isSong(song({}, { instrument: 'bd") .hush("' as never })))
    bad(isSong(song({}, { bars: 3 as never })))
    bad(isSong(song({}, { bars: '1' as never })))
  })

  it('rechaza golpes con posición no numérica y versiones previas mal formadas', () => {
    bad(isSong(song({}, { hits: [{ pos: '0' as never, strength: 1 }] })))
    bad(isSong(song({}, { prev: { hits: [{ pos: 0, strength: 1 }], bars: 8 as never, phaseBar: 0 } })))
  })

  it('rechaza nombres que no son texto, turns, parts y at mal formados', () => {
    bad(isSong(song({ name: { toString: () => EVIL } as never })))
    bad(isSong(song({ turns: 3 as never })))
    bad(isSong(song({ parts: { bass: 1, chords: false } as never })))
    bad(isSong(song({ at: { x: 'a', y: 0, depth: 0 } as never })))
  })

  it('rechaza orden y grupos con ids que no son números', () => {
    bad(isSong({ ...song(), order: ['1'] }))
    bad(isSong({ ...song(), groups: [{ id: 1, order: ['x'], on: true }] }))
    bad(isFreeLoop(null))
  })
})

describe('un nombre malicioso no sale del comentario', () => {
  it('safeLabel quita saltos de línea, comillas, paréntesis de código y límites', () => {
    expect(safeLabel(EVIL)).not.toMatch(/[\n\r"/;]/)
    expect(safeLabel('a b c')).toBe('abc')
    expect(safeLabel('intro 2')).toBe('intro 2')
    expect(safeLabel('x'.repeat(500))).toHaveLength(60)
    expect(safeLabel(42)).toBe('')
  })

  it('songCode (motor y mostrado) con un nombre con \\n no añade ninguna línea de código', () => {
    const s = song({ name: EVIL })
    for (const mode of ['engine', 'display'] as const) {
      const code = songCode(state(s), mode)
      expect(codeOnly(code)).not.toMatch(/hush|evil|fetch/)
      // cada línea con "//" lo tiene como primer carácter no blanco
      for (const line of code.split('\n')) if (line.includes('//') && !line.includes('=>')) expect(line.trim().startsWith('//')).toBe(true)
    }
  })

  it('con varias células y grupos (arrange) tampoco', () => {
    const a = song({ name: EVIL })
    const b = { ...a.cells[0]!, id: 2, name: EVIL }
    const s: Song = { ...a, cells: [...a.cells, b], order: [1, 2], groups: [{ id: 5, order: [2], on: true }], nextCellId: 3 }
    const st = { ...state(s), groups: { list: s.cells, items: [{ id: 5, order: [2], window: [{ cellId: 2, from: 0, to: null }] }] } }
    expect(codeOnly(songCode(st, 'display'))).not.toMatch(/hush|evil|fetch/)
    expect(codeOnly(songCode(st, 'engine'))).not.toMatch(/hush|evil|fetch/)
  })
})

describe('defensa en song.ts aunque la validación fallara', () => {
  it('id, bornAt y fase no numéricos no entran como texto', () => {
    const s = song({}, { id: '1")||evil()//' as never, bornAt: '0)||evil()//' as never, phaseBar: 'x' as never })
    const code = songCode(state(s), 'engine')
    expect(codeOnly(code)).not.toContain('evil')
    expect(code).toContain('.color("l0")')
    expect(code).toContain('h.whole.begin >= 0')
  })

  it('un instrumento raro no se escribe en s("…")', () => {
    const s = song({}, { instrument: 'bd") .hush("' as never })
    expect(songCode(state(s), 'display')).not.toContain('hush')
    expect(songCode(state(s), 'display')).not.toMatch(/s\("[^"]*[a-z]{3,}[^"]*"\)\.bank/)
  })

  it('safeNum', () => {
    expect(safeNum(3)).toBe(3)
    expect(safeNum('3')).toBe(0)
    expect(safeNum(NaN)).toBe(0)
    expect(safeNum(null)).toBe(0)
  })
})

describe('biblioteca y ajustes: claves del prototipo', () => {
  const snap = (o: object = {}) => ({ style: 'dnb' as const, kit: '909' as const, bgMode: 'manual' as const, fx: { filter: 1, space: 0, warmth: 0 }, song: emptySong(), ...o })
  const saved = makeSaved(snap(), 'a', 'A', new Date(2026, 0, 1))

  it('kit y estilo "toString", "constructor" o "__proto__" no valen', () => {
    for (const k of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      bad(isSavedSong({ ...saved, kit: k }))
      bad(isSavedSong({ ...saved, style: k }))
    }
    expect(isSavedSong(saved)).toBe(true)
  })

  it('una canción guardada con un loop malicioso se ve como "no se puede abrir" y se conserva', () => {
    const evilSong = song({}, { bornAt: 'x' as never })
    const entry = { ...saved, id: 'm', song: evilSong }
    const lib = parseLibrary(JSON.stringify({ version: 1, songs: [entry] }))
    expect(lib.entries).toHaveLength(1)
    expect(lib.entries[0]!.saved).toBeNull()
    expect(JSON.parse(serializeLibrary(lib)).songs[0].song.cells[0].loops[0].bornAt).toBe('x')
    expect(serializeLibrary(addSong(emptyLibrary(), saved))).toContain('"a"')
  })

  it('isStoredPrefs', () => {
    const ok = {
      version: 1, kit: '909', style: 'dnb', assist: true, metronome: false, bgMode: 'manual', phraseMode: 'bar',
      repeatMode: 'complete', phraseCloseBeats: 2, maxPhraseBars: 4, fx: { filter: 1, space: 0, warmth: 0 },
    }
    expect(isStoredPrefs(ok)).toBe(true)
    bad(isStoredPrefs({ ...ok, kit: 'toString' }))
    bad(isStoredPrefs({ ...ok, style: '__proto__' }))
    bad(isStoredPrefs({ ...ok, fx: { filter: 5, space: 0, warmth: 0 } }))
    bad(isStoredPrefs({ ...ok, fx: null }))
    bad(isStoredPrefs({ ...ok, bgMode: 'x' }))
    bad(isStoredPrefs(null))
  })
})

import { describe, expect, it } from 'vitest'
import { demoSong, emptySong, withCopy, withGroupOn, withNewGroup } from '../../app/lib/cells'
import {
  addSong,
  autoName,
  cleanName,
  dateText,
  emptyLibrary,
  isSavedSong,
  isUnsaved,
  makeSaved,
  NAME_MAX,
  newId,
  parseLibrary,
  removeSong,
  renameSong,
  replaceSong,
  restoreEntry,
  serializeLibrary,
  sortedEntries,
  summaryText,
  type SongSnapshot,
} from '../../app/lib/library'

const fx = { filter: 1, space: 0.2, warmth: 0 }
const snap = (o: Partial<SongSnapshot> = {}): SongSnapshot => ({ style: 'dnb', kit: 'electro', bgMode: 'manual', fx, song: demoSong('dnb')!, ...o })
const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m)

describe('nombres', () => {
  it('automático: estilo + fecha y hora del dispositivo', () => {
    expect(autoName('dnb', at(21, 30))).toBe('Drum and bass · 14 nov, 21:30')
    expect(autoName('house', new Date(2026, 0, 3, 7, 5))).toBe('House · 3 ene, 07:05')
  })

  it('limpio: sin espacios de más, hasta 60 caracteres; vacío → el de reserva', () => {
    expect(cleanName('  Mi   canción  ', 'x')).toBe('Mi canción')
    expect(cleanName('   ', 'auto')).toBe('auto')
    expect(cleanName('a'.repeat(100), 'x')).toHaveLength(NAME_MAX)
    // el corte a 60 no deja un espacio al final
    expect(cleanName('b'.repeat(59) + '  c', 'x')).toBe('b'.repeat(59))
  })

  it('ids distintos aunque sea el mismo instante', () => {
    const a = newId(1_700_000_000_000, () => 0.1)
    const b = newId(1_700_000_000_000, () => 0.7)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^s[0-9a-z]+$/)
  })
})

describe('validación de una guardada', () => {
  const ok = () => makeSaved(snap(), 'id1', 'Una', at(21))

  it('vale una bien hecha', () => {
    expect(isSavedSong(ok())).toBe(true)
  })

  it('no vale con estilo o kit desconocidos, efectos fuera de 0–1, fondo raro o canción rota', () => {
    expect(isSavedSong({ ...ok(), style: 'polka' })).toBe(false)
    expect(isSavedSong({ ...ok(), kit: 'x' })).toBe(false)
    expect(isSavedSong({ ...ok(), fx: { ...fx, space: 3 } })).toBe(false)
    expect(isSavedSong({ ...ok(), fx: null })).toBe(false)
    expect(isSavedSong({ ...ok(), bgMode: 'mucho' })).toBe(false)
    expect(isSavedSong({ ...ok(), song: { version: 1, cells: [] } })).toBe(false)
    expect(isSavedSong({ ...ok(), id: '' })).toBe(false)
    expect(isSavedSong(null)).toBe(false)
  })
})

describe('guardar', () => {
  it('lo guardado no lleva versiones previas ni nacimientos, y no cambia lo de ahora', () => {
    const song = demoSong('dnb')!
    song.cells[0]!.loops[0]!.bornAt = 77
    song.cells[0]!.loops[0]!.prev = { hits: [], bars: 1, phaseBar: 0 }
    const saved = makeSaved(snap({ song }), 'a', 'N', at(1))
    expect(saved.song.cells[0]!.loops[0]!.bornAt).toBe(0)
    expect(saved.song.cells[0]!.loops[0]!.prev).toBeUndefined()
    expect(song.cells[0]!.loops[0]!.bornAt).toBe(77) // lo de ahora no se toca
  })

  it('con el nombre vacío se pone el automático; con la fecha de guardar', () => {
    const saved = makeSaved(snap(), 'a', '   ', at(21, 30))
    expect(saved.name).toBe('Drum and bass · 14 nov, 21:30')
    expect(saved.savedAt).toBe(at(21, 30).toISOString())
    expect(saved.style).toBe('dnb')
    expect(saved.fx).toEqual(fx)
  })
})

describe('leer y escribir la lista sin perder nada', () => {
  const a = makeSaved(snap(), 'a', 'A', at(10))
  const b = makeSaved(snap({ style: 'house' }), 'b', 'B', at(12))
  const text = () => serializeLibrary(addSong(addSong(emptyLibrary(), a), b))

  it('lo que se escribe se vuelve a leer igual', () => {
    const lib = parseLibrary(text())
    expect(lib.broken).toBe(false)
    expect(lib.entries.map((e) => e.id)).toEqual(['a', 'b'])
    expect(lib.entries.every((e) => e.saved)).toBe(true)
    expect(parseLibrary(serializeLibrary(lib)).entries.map((e) => e.saved)).toEqual(lib.entries.map((e) => e.saved))
  })

  it('sin nada guardado, o con la lista vacía, no pasa nada', () => {
    expect(parseLibrary(null)).toEqual(emptyLibrary())
    expect(parseLibrary('')).toEqual(emptyLibrary())
    expect(parseLibrary('{"version":1,"songs":[]}')).toEqual(emptyLibrary())
  })

  it('un texto roto no se pierde: sale como roto y vacío, para guardar antes una copia', () => {
    for (const bad of ['{"version":1,"songs":[', 'no json', '{"version":2,"songs":[]}', '[]', '{"songs":5}']) {
      expect(parseLibrary(bad)).toEqual({ entries: [], unknown: [], broken: true })
    }
  })

  it('una entrada que no se entiende no se ve, pero se conserva al escribir', () => {
    const weird = { cosa: 'de una versión futura' }
    const raw = JSON.stringify({ version: 1, songs: [JSON.parse(JSON.stringify(a)), weird, 7, null] })
    const lib = parseLibrary(raw)
    expect(lib.entries).toHaveLength(1)
    expect(lib.unknown).toEqual([weird, 7, null])
    const again = JSON.parse(serializeLibrary(addSong(lib, b))) as { songs: unknown[] }
    expect(again.songs).toContainEqual(weird)
    expect(again.songs).toContain(7)
    expect(again.songs).toHaveLength(5)
  })

  it('una guardada con la canción rota sale en la lista como "no se puede abrir" y se conserva entera', () => {
    const broken = { ...JSON.parse(JSON.stringify(a)), id: 'rota', name: 'Rota', song: { version: 1, cells: [] } }
    const lib = parseLibrary(JSON.stringify({ version: 1, songs: [broken] }))
    expect(lib.entries).toHaveLength(1)
    expect(lib.entries[0]).toMatchObject({ id: 'rota', name: 'Rota', saved: null })
    expect(JSON.parse(serializeLibrary(lib)).songs[0]).toEqual(broken)
    // y se puede borrar
    expect(removeSong(lib, 'rota').lib.entries).toHaveLength(0)
    // pero no renombrar
    expect(renameSong(lib, 'rota', 'Otra')).toBe(lib)
  })

  it('un tempo roto no impide abrirla: vuelve el del estilo', () => {
    const odd = JSON.parse(JSON.stringify(a)) as { song: { bpm: unknown } }
    odd.song.bpm = 'mucho'
    const lib = parseLibrary(JSON.stringify({ version: 1, songs: [odd] }))
    expect(lib.entries[0]!.saved!.song.bpm).toBeNull()
  })

  it('dos con el mismo id: la segunda no pisa a la primera, se conserva aparte', () => {
    const lib = parseLibrary(JSON.stringify({ version: 1, songs: [a, a] }))
    expect(lib.entries).toHaveLength(1)
    expect(lib.unknown).toHaveLength(1)
  })
})

describe('operaciones', () => {
  const a = makeSaved(snap(), 'a', 'A', at(10))
  const b = makeSaved(snap(), 'b', 'B', at(12))
  const c = makeSaved(snap(), 'c', 'C', at(11))
  const lib = [a, b, c].reduce(addSong, emptyLibrary())

  it('más reciente primero', () => {
    expect(sortedEntries(lib).map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('renombrar: limpia el nombre y no cambia nada con uno vacío o igual', () => {
    expect(renameSong(lib, 'a', '  Nueva   idea ').entries[0]!.name).toBe('Nueva idea')
    expect(renameSong(lib, 'a', 'Nueva idea').entries[0]!.saved!.name).toBe('Nueva idea')
    expect(renameSong(lib, 'a', '   ')).toBe(lib)
    expect(renameSong(lib, 'a', 'A')).toBe(lib)
    expect(renameSong(lib, 'x', 'Y')).toBe(lib)
  })

  it('guardar cambios sustituye en su sitio, sin duplicar; si ya no estaba, la añade', () => {
    const edited = { ...a, savedAt: at(15).toISOString(), style: 'house' as const }
    const r = replaceSong(lib, edited)
    expect(r.entries.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(r.entries[0]!.saved!.style).toBe('house')
    expect(replaceSong(emptyLibrary(), a).entries).toHaveLength(1)
  })

  it('borrar devuelve lo quitado y su sitio; deshacer lo pone donde estaba', () => {
    const r = removeSong(lib, 'b')
    expect(r.lib.entries.map((e) => e.id)).toEqual(['a', 'c'])
    expect(r.index).toBe(1)
    expect(restoreEntry(r.lib, r.removed!, r.index).entries.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(restoreEntry(r.lib, r.removed!, 99).entries.map((e) => e.id)).toEqual(['a', 'c', 'b'])
    expect(restoreEntry(lib, r.removed!, 0)).toBe(lib) // ya está: no se duplica
    expect(removeSong(lib, 'x')).toEqual({ lib, removed: null, index: -1 })
  })

  it('al borrar no se toca lo que no se entiende', () => {
    const l = { ...lib, unknown: [{ x: 1 }] }
    expect(removeSong(l, 'a').lib.unknown).toEqual([{ x: 1 }])
  })
})

describe('lo que se enseña', () => {
  it('resumen: células, grupos en paralelo, compases y tempo', () => {
    const demo = makeSaved(snap(), 'a', 'A', at(1))
    expect(summaryText(demo)).toBe('Drum and bass · 4 células · 18 compases · 174 bpm')
    const withGroup = withCopy(demoSong('dnb')!, 1, { x: 0, y: 0 })!.song
    expect(summaryText(makeSaved(snap({ song: { ...withGroup, bpm: 160 } }), 'b', 'B', at(1)))).toBe(
      'Drum and bass · 4 células + 1 grupo · 18 compases · 160 bpm',
    )
    expect(summaryText(makeSaved(snap({ style: 'house', song: emptySong() }), 'c', 'C', at(1)))).toBe('House · 1 célula · 1 compases · 124 bpm')
    const two = withNewGroup(withGroupOn(withNewGroup(demoSong('dnb')!)!.song, 1, true) ?? withNewGroup(demoSong('dnb')!)!.song)!
    expect(summaryText(makeSaved(snap({ song: two.song }), 'd', 'D', at(1)))).toContain('+ 2 grupos')
  })

  it('fecha corta, y vacía si no se entiende', () => {
    expect(dateText(at(21, 30).toISOString())).toBe('14 nov, 21:30')
    expect(dateText('ayer')).toBe('')
  })
})

describe('¿está guardado lo de ahora?', () => {
  const now = snap()

  it('vacío: nada que perder', () => {
    expect(isUnsaved(snap({ song: emptySong() }), null)).toBe(false)
  })

  it('sin referencia (nunca guardado ni abierto) y con algo: sin guardar', () => {
    expect(isUnsaved(now, null)).toBe(true)
  })

  it('igual a lo guardado o abierto: guardado, aunque cambien los nacimientos de los loops', () => {
    const saved = makeSaved(now, 'a', 'A', at(1))
    const live = snap()
    live.song.cells[0]!.loops[0]!.bornAt = 42
    expect(isUnsaved(live, saved)).toBe(false)
  })

  it('distinto en la canción, el estilo, el tempo o los efectos: sin guardar', () => {
    const saved = makeSaved(now, 'a', 'A', at(1))
    const edit = snap()
    edit.song.cells[1]!.loops = []
    expect(isUnsaved(edit, saved)).toBe(true)
    expect(isUnsaved(snap({ style: 'house' }), saved)).toBe(true)
    expect(isUnsaved(snap({ song: { ...demoSong('dnb')!, bpm: 150 } }), saved)).toBe(true)
    expect(isUnsaved(snap({ fx: { ...fx, filter: 0.4 } }), saved)).toBe(true)
  })
})

describe('lo guardado antes de los grupos', () => {
  it('al leer la lista, una libre encendida pasa a grupo encendido y la canción no se toca', () => {
    const base = demoSong('dnb')!
    const { groups: _g, nextGroupId: _n, ...rest } = base
    const old = { ...rest, cells: [...base.cells, { ...base.cells[0]!, id: 9, free: true, on: true }] }
    const saved = { ...makeSaved(snap(), 'a', 'A', at(1)), song: old }
    const lib = parseLibrary(JSON.stringify({ version: 1, songs: [saved] }))
    const s = lib.entries[0]!.saved!.song
    expect(s.groups).toEqual([{ id: 1, order: [9], on: true }])
    expect(s.order).toEqual([1, 2, 3, 4])
  })
})

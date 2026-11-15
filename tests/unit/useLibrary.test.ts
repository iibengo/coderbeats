import { beforeEach, describe, expect, it, vi } from 'vitest'
import { demoSong } from '../../app/lib/cells'
import { addSong, emptyLibrary, LIBRARY_BROKEN_KEY, LIBRARY_KEY, makeSaved, parseLibrary, type SongSnapshot } from '../../app/lib/library'
import { FakeStorage } from '../helpers/fakeStorage'

const snap = (): SongSnapshot => ({ style: 'dnb', kit: 'electro', bgMode: 'manual', fx: { filter: 1, space: 0, warmth: 0 }, song: demoSong('dnb')! })
let ls: FakeStorage

/** el estado de `useLibrary` es de módulo: cada test arranca uno nuevo y un almacenamiento de mentira */
async function fresh(preload?: (s: FakeStorage) => void) {
  vi.resetModules()
  ls = new FakeStorage()
  preload?.(ls)
  vi.stubGlobal('localStorage', ls)
  const { useLibrary } = await import('../../app/composables/useLibrary')
  const l = useLibrary()
  l.load()
  return l
}
const one = (id = 'a') => makeSaved(snap(), id, `canción ${id}`, new Date(2026, 10, 14, 10))

beforeEach(() => vi.unstubAllGlobals())

describe('useLibrary: Mis canciones en el navegador (spec 006)', () => {
  it('sin nada guardado, la lista está vacía y leer no escribe nada', async () => {
    const l = await fresh()
    expect(l.lib.value.entries).toEqual([])
    expect(ls.data.size).toBe(0)
  })
  it('guardar escribe la lista y se vuelve a leer igual', async () => {
    const l = await fresh()
    expect(l.persist(addSong(l.lib.value, one('a')))).toBe(true)
    expect(parseLibrary(ls.data.get(LIBRARY_KEY)).entries.map((e) => e.id)).toEqual(['a'])
    const saved = ls.data.get(LIBRARY_KEY)!
    const again = await fresh((s) => s.data.set(LIBRARY_KEY, saved))
    expect(again.lib.value.entries.map((e) => e.id)).toEqual(['a'])
  })
  it('si no se puede escribir, devuelve false, deja el error y no pierde lo que había', async () => {
    const l = await fresh()
    l.persist(addSong(l.lib.value, one('a')))
    ls.failWrites = true
    expect(l.persist(addSong(l.lib.value, one('b')))).toBe(false)
    expect(l.error.value).toMatch(/No se ha podido guardar/)
    expect(l.lib.value.entries.map((e) => e.id)).toEqual(['a'])
    ls.failWrites = false
    expect(l.persist(addSong(l.lib.value, one('b')))).toBe(true)
    expect(l.error.value).toBeNull()
  })
  it('renombrar guarda el nombre; un nombre vacío no cambia nada', async () => {
    const l = await fresh()
    l.persist(addSong(l.lib.value, one('a')))
    expect(l.rename('a', 'Mi tema')).toBe(true)
    expect(parseLibrary(ls.data.get(LIBRARY_KEY)).entries[0]!.name).toBe('Mi tema')
    expect(l.rename('no-existe', 'x')).toBe(true)
  })
  it('borrar saca la canción del disco al momento y «deshacer» la devuelve a su sitio', async () => {
    const l = await fresh()
    let lib = addSong(l.lib.value, one('a'))
    lib = addSong(lib, one('b'))
    l.persist(lib)
    expect(l.remove('a')).toBe(true)
    expect(parseLibrary(ls.data.get(LIBRARY_KEY)).entries.map((e) => e.id)).toEqual(['b'])
    expect(l.removed.value?.entry.id).toBe('a')
    expect(l.undoRemove()).toBe(true)
    expect(parseLibrary(ls.data.get(LIBRARY_KEY)).entries.map((e) => e.id).sort()).toEqual(['a', 'b'])
    expect(l.removed.value).toBeNull()
    expect(l.undoRemove()).toBe(false)
  })
  it('borrar una que no existe no hace nada', async () => {
    const l = await fresh()
    expect(l.remove('zzz')).toBe(false)
  })
  it('una lista rota se guarda aparte antes de escribir encima, y leer nunca borra', async () => {
    const l = await fresh((s) => s.data.set(LIBRARY_KEY, '{esto no es json'))
    expect(l.lib.value.broken).toBe(true)
    expect(ls.data.get(LIBRARY_KEY)).toBe('{esto no es json')
    l.persist(addSong(emptyLibrary(), one('a')))
    expect(ls.data.get(LIBRARY_BROKEN_KEY)).toBe('{esto no es json')
    expect(parseLibrary(ls.data.get(LIBRARY_KEY)).entries.map((e) => e.id)).toEqual(['a'])
  })
  it('de qué guardada viene lo de ahora: se recuerda y se olvida', async () => {
    const l = await fresh()
    l.setCurrent('a')
    expect(l.currentId.value).toBe('a')
    const again = await fresh((s) => s.data.set('coderbeats:library:current', 'a'))
    expect(again.currentId.value).toBe('a')
    again.setCurrent(null)
    expect(ls.data.has('coderbeats:library:current')).toBe(false)
  })
  it('sin almacenamiento, no tira: la lista queda vacía', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', undefined)
    const { useLibrary } = await import('../../app/composables/useLibrary')
    const l = useLibrary()
    l.load()
    expect(l.lib.value.entries).toEqual([])
    expect(l.persist(emptyLibrary())).toBe(false)
  })
})

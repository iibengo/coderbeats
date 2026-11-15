import { nextTick, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptySong, isSong } from '../../app/lib/cells'
import { FakeStorage } from '../helpers/fakeStorage'

const PREFS = 'coderbeats:prefs:v1'
const SONG = 'coderbeats:song:v1'
let ls: FakeStorage

/** los composables de Nuxt usan `watch` y `useAudioEngine` sin importarlos (auto-import): en los tests se ponen a mano */
async function fresh(preload?: (s: FakeStorage) => void) {
  vi.resetModules()
  ls = new FakeStorage()
  preload?.(ls)
  vi.stubGlobal('localStorage', ls)
  const { useAudioEngine } = await import('../../app/composables/useAudioEngine')
  vi.stubGlobal('useAudioEngine', useAudioEngine)
  vi.stubGlobal('watch', watch)
  const { usePrefs } = await import('../../app/composables/usePrefs')
  return { engine: useAudioEngine(), prefs: usePrefs() }
}
beforeEach(() => vi.unstubAllGlobals())

const stored = (o: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: 1, kit: 'electro', style: 'techno', assist: true, metronome: false, bgMode: 'manual', bgManual: { bass: true, chords: false },
    phraseMode: 'bar', repeatMode: 'complete', phraseCloseBeats: 4, maxPhraseBars: 4, fx: { filter: 1, space: 0.3, warmth: 0 }, theme: 'water', completeDefault: true, ...o,
  })

describe('usePrefs: ajustes y canción en el navegador (spec 001 §16.16)', () => {
  it('sin nada guardado no cambia nada ni escribe', async () => {
    const { engine, prefs } = await fresh()
    const style = engine.style.value
    prefs.load()
    expect(engine.style.value).toBe(style)
    expect(ls.data.size).toBe(0)
  })
  it('carga los ajustes guardados en el motor', async () => {
    const { engine, prefs } = await fresh((s) => s.data.set(PREFS, stored({ style: 'dembow', kit: '808', mode: 'componer', suggestions: false, bgManual: { bass: false, chords: true } })))
    prefs.load()
    expect(engine.style.value).toBe('dembow')
    expect(engine.kit.value).toBe('808')
    expect(engine.mode.value).toBe('componer')
    expect(engine.suggestions.value).toBe(false)
    expect(engine.bgManual.value).toEqual({ bass: false, chords: true })
  })
  it('lo que no pasa el guard no se usa (y no se borra)', async () => {
    const bad = JSON.stringify({ version: 1, style: 'no-existe' })
    const { engine, prefs } = await fresh((s) => s.data.set(PREFS, bad))
    const style = engine.style.value
    prefs.load()
    expect(engine.style.value).toBe(style)
    expect(ls.data.get(PREFS)).toBe(bad)
  })
  it('«sugerencias» sin guardar (versiones anteriores) vale encendido', async () => {
    const { engine, prefs } = await fresh((s) => s.data.set(PREFS, stored()))
    engine.suggestions.value = false
    prefs.load()
    expect(engine.suggestions.value).toBe(true)
  })
  it('carga la canción guardada, y si no hay, migra los loops antiguos a una canción de una célula', async () => {
    const song = { ...emptySong(), bpm: 100 }
    const a = await fresh((s) => s.data.set(SONG, JSON.stringify(song)))
    a.engine.setSong(emptySong())
    a.prefs.load()
    expect(a.engine.song.value.bpm).toBe(100)
    const b = await fresh((s) => s.data.set('coderbeats:loops:v1', JSON.stringify({ loops: [], nextId: 5 })))
    b.engine.setSong(emptySong())
    b.prefs.load()
    expect(isSong(b.engine.song.value)).toBe(true)
  })
  it('con loops ya en el motor no pisa la canción con la guardada', async () => {
    const { engine, prefs } = await fresh((s) => s.data.set(SONG, JSON.stringify({ ...emptySong(), bpm: 77 })))
    engine.setSong({ ...emptySong(), bpm: 123 })
    engine.editLoops({ loops: [{ id: 1, instrument: 'bd', bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 1 }], muted: false, bornAt: 0, fromTemplate: false }], nextId: 2 })
    prefs.load()
    expect(engine.song.value.bpm).toBe(123)
  })
  it('startSaving escribe los ajustes y la canción al cambiar algo', async () => {
    const { engine, prefs } = await fresh()
    prefs.startSaving()
    engine.style.value = 'house'
    engine.suggestions.value = false
    await nextTick()
    await nextTick()
    const p = JSON.parse(ls.data.get(PREFS)!)
    expect(p.style).toBe('house')
    expect(p.suggestions).toBe(false)
    expect(p.version).toBe(1)
    engine.setSong({ ...emptySong(), bpm: 111 })
    await nextTick()
    await nextTick()
    expect(isSong(JSON.parse(ls.data.get(SONG)!))).toBe(true)
    expect(JSON.parse(ls.data.get(SONG)!).bpm).toBe(111)
  })
  it('lo escrito se vuelve a leer igual (ida y vuelta)', async () => {
    const a = await fresh()
    a.prefs.startSaving()
    a.engine.style.value = 'dnb'
    a.engine.mode.value = 'componer'
    await nextTick()
    await nextTick()
    const text = ls.data.get(PREFS)!
    const b = await fresh((s) => s.data.set(PREFS, text))
    b.prefs.load()
    expect(b.engine.style.value).toBe('dnb')
    expect(b.engine.mode.value).toBe('componer')
  })
})

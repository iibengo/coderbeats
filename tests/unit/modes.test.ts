import { describe, expect, it } from 'vitest'
import { cellStrip, DEFAULT_MODE, isMode, MODE_HINT, MODES, modeFromSaved } from '../../app/lib/modes'
import { emptySong } from '../../app/lib/cells'
import { REMIXES } from '../../app/lib/remixes'
import { isStoredPrefs } from '../../app/lib/prefsGuard'

const prefs = (o: object = {}) => ({
  version: 1, kit: 'electro', style: 'techno', assist: true, metronome: false, bgMode: 'manual', phraseMode: 'bar', repeatMode: 'complete',
  phraseCloseBeats: 2, maxPhraseBars: 4, fx: { filter: 1, space: 0, warmth: 0 }, theme: 'water', ...o,
})

describe('los modos (spec 011)', () => {
  it('son dos: Jugar y Componer, y Jugar es el de por defecto', () => {
    expect(MODES.map((m) => m.id)).toEqual(['jugar', 'componer'])
    expect(MODES.map((m) => m.label)).toEqual(['Jugar', 'Componer'])
    expect(DEFAULT_MODE).toBe('jugar')
    for (const m of MODES) expect(MODE_HINT[m.id].length).toBeGreaterThan(10)
  })
  it('lo guardado se lee sin tirar: lo raro vuelve a Jugar', () => {
    expect(modeFromSaved('componer')).toBe('componer')
    expect(modeFromSaved('jugar')).toBe('jugar')
    for (const bad of [undefined, null, 3, 'otro', {}, 'toString']) expect(modeFromSaved(bad)).toBe('jugar')
    expect(isMode('componer')).toBe(true)
    expect(isMode('Jugar')).toBe(false)
  })
  it('los ajustes guardados de antes (sin modo) siguen siendo válidos; uno con modo raro, no', () => {
    expect(isStoredPrefs(prefs())).toBe(true) // quien ya usaba la app: se abre en Jugar
    expect(isStoredPrefs(prefs({ mode: 'jugar' }))).toBe(true)
    expect(isStoredPrefs(prefs({ mode: 'componer' }))).toBe(true)
    expect(isStoredPrefs(prefs({ mode: 'escenario' }))).toBe(false)
    expect(isStoredPrefs(prefs({ mode: 3 }))).toBe(false)
  })
})

describe('la tira de células de Jugar (spec 011, §3.6)', () => {
  it('con una sola célula no hay tira (Jugar es la app simple de siempre)', () => {
    expect(cellStrip(emptySong(), 1)).toEqual([])
  })
  it('un tramo por célula de la canción, en su orden, con sus compases y la que se ve marcada', () => {
    const song = { cells: [{ id: 1, name: 'Intro', turns: 4 }, { id: 2, name: ' ', turns: 8 }, { id: 3, turns: 2 }], order: [1, 2, 3] }
    expect(cellStrip(song, 2)).toEqual([
      { id: 1, name: 'Intro', turns: 4, current: false },
      { id: 2, name: 'parte 2', turns: 8, current: true },
      { id: 3, name: 'parte 3', turns: 2, current: false },
    ])
  })
  it('las células de los grupos en paralelo no salen en la tira, y un id suelto no rompe nada', () => {
    const song = { cells: [{ id: 1, name: 'A', turns: 4 }, { id: 2, name: 'B', turns: 4 }, { id: 9, name: 'grupo', turns: 4 }], order: [1, 2, 99] }
    expect(cellStrip(song, 1).map((c) => c.id)).toEqual([1, 2])
  })
  it('todos los remixes dan una tira con una parte por célula de la canción, sin tocar la canción (el modo no cambia los datos)', () => {
    for (const r of REMIXES) {
      const song = r.build()
      const before = JSON.stringify(song)
      const strip = cellStrip(song, song.order[0]!)
      expect(strip.map((c) => c.id), r.id).toEqual(song.order)
      expect(strip.reduce((n, c) => n + c.turns, 0), r.id).toBe(r.info.cells.reduce((n, c) => n + c.turns, 0))
      expect(strip.filter((c) => c.current)).toHaveLength(1)
      expect(JSON.stringify(song)).toBe(before)
    }
  })
})

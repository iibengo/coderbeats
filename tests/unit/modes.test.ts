import { describe, expect, it } from 'vitest'
import { DEFAULT_MODE, isMode, MODE_HINT, MODES, modeFromSaved } from '../../app/lib/modes'
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

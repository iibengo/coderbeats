import { nextTick, ref, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => vi.unstubAllGlobals())

describe('useSuggestions (spec 012 §3): vigila lo que cambia la melodía sugerida', () => {
  it('pide recalcular al cambiar los loops, el modo, el estilo, el tempo, el interruptor o el nº de células; no por otra cosa', async () => {
    vi.resetModules()
    const refresh = vi.fn()
    const engine = {
      loops: ref({ loops: [] }), mode: ref('jugar'), suggestions: ref(true), style: ref('techno'), bpm: ref(128), song: ref({ cells: [{}] }), other: ref(0),
      refreshSuggestion: refresh,
    }
    vi.stubGlobal('useAudioEngine', () => engine)
    vi.stubGlobal('watch', watch)
    const { useSuggestions } = await import('../../app/composables/useSuggestions')
    useSuggestions()
    const cases: [string, () => void][] = [
      ['loops', () => (engine.loops.value = { loops: [] })],
      ['modo', () => (engine.mode.value = 'componer')],
      ['interruptor', () => (engine.suggestions.value = false)],
      ['estilo', () => (engine.style.value = 'house')],
      ['tempo', () => (engine.bpm.value = 120)],
      ['células', () => (engine.song.value = { cells: [{}, {}] })],
    ]
    for (const [name, change] of cases) {
      refresh.mockClear()
      change()
      await nextTick()
      expect(refresh, name).toHaveBeenCalledTimes(1)
    }
    refresh.mockClear()
    engine.other.value++
    await nextTick()
    expect(refresh).not.toHaveBeenCalled()
  })
})

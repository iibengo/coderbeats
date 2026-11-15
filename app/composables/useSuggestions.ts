// La melodía sugerida (spec 012, §3): vigila lo que la cambia y le pide al motor que la recalcule. La decisión es `suggestFor` (lib/suggestion.ts).
import { watch } from 'vue'

export function useSuggestions() {
  const engine = useAudioEngine()
  watch(
    [engine.loops, engine.mode, engine.suggestions, engine.style, engine.bpm, () => engine.song.value.cells.length],
    () => engine.refreshSuggestion(),
    { deep: false },
  )
}

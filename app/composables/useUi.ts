/** La interfaz que se ve (spec 016): portada simple o Estudio; se recuerda por dispositivo, en su propia clave. */
import { reactive } from 'vue'
import { DEFAULT_UI, isUiPrefs, UI_KEY, type UiMode, type UiPrefs } from '~/lib/ui'
import { hasStorage, readJson, writeJson } from '~/lib/storage'

const state = reactive<UiPrefs>({ ...DEFAULT_UI })
let loaded = false

export function useUi() {
  if (!loaded && hasStorage()) {
    loaded = true
    const saved = readJson(UI_KEY, isUiPrefs)
    if (saved) Object.assign(state, saved)
  }
  const save = () => writeJson(UI_KEY, { version: 1, ui: state.ui, syncMelody: state.syncMelody } satisfies UiPrefs)
  return {
    state,
    /** cambiar de interfaz (y recordarlo: quien elige el Estudio vuelve al Estudio) */
    setUi(ui: UiMode) {
      state.ui = ui
      save()
    },
    setSync(on: boolean) {
      state.syncMelody = on
      save()
    },
  }
}

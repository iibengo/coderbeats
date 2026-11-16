// Preferencias del Estudio (spec 020/022): una sola, «controles avanzados». Clave propia (`coderbeats:studio:v2`); nunca toca `coderbeats:ui:v1`.
// Sin la marca, el Estudio se ve simple (crear y editar remixes); con ella, vuelve todo lo que se escondió (nada se borra).
import { readJson, writeText } from '~/lib/storage'

export const STUDIO_KEY = 'coderbeats:studio:v2'
const isPrefs = (x: unknown): x is { advanced: boolean } => !!x && typeof x === 'object' && typeof (x as { advanced?: unknown }).advanced === 'boolean'
const advanced = ref(false)
let loaded = false

export function useStudioPrefs() {
  if (!loaded && import.meta.client) {
    loaded = true
    advanced.value = readJson(STUDIO_KEY, isPrefs)?.advanced ?? false
  }
  return {
    advanced,
    setAdvanced(v: boolean) {
      advanced.value = v
      writeText(STUDIO_KEY, JSON.stringify({ advanced: v }))
    },
  }
}

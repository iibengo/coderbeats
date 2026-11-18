// Preferencias del Estudio (spec 020/022/037/042): «controles avanzados», «nombres de nota» en el Órgano y el compresor «techno» de la salida. Clave propia (`coderbeats:studio:v2`); nunca toca `coderbeats:ui:v1`.
// Sin la marca, el Estudio se ve simple (crear y editar remixes); con ella, vuelve todo lo que se escondió (nada se borra).
import { readJson, writeText } from '~/lib/storage'

export const STUDIO_KEY = 'coderbeats:studio:v2'
const isPrefs = (x: unknown): x is { advanced: boolean; noteNames?: boolean; glue?: boolean } => {
  if (!x || typeof x !== 'object') return false
  const p = x as { advanced?: unknown; noteNames?: unknown; glue?: unknown }
  return typeof p.advanced === 'boolean' && (p.noteNames === undefined || typeof p.noteNames === 'boolean') && (p.glue === undefined || typeof p.glue === 'boolean')
}
const advanced = ref(false)
const noteNames = ref(false)
/** el compresor «techno» de la salida (spec 042): apagado por defecto */
const glue = ref(false)
const persist = () => writeText(STUDIO_KEY, JSON.stringify({ advanced: advanced.value, noteNames: noteNames.value, ...(glue.value ? { glue: true } : {}) }))
let loaded = false

export function useStudioPrefs() {
  if (!loaded && import.meta.client) {
    loaded = true
    const saved = readJson(STUDIO_KEY, isPrefs)
    advanced.value = saved?.advanced ?? false
    noteNames.value = saved?.noteNames ?? false
    glue.value = saved?.glue ?? false
  }
  return {
    advanced,
    noteNames,
    glue,
    setAdvanced(v: boolean) {
      advanced.value = v
      persist()
    },
    setNoteNames(v: boolean) {
      noteNames.value = v
      persist()
    },
    setGlue(v: boolean) {
      glue.value = v
      persist()
    },
  }
}

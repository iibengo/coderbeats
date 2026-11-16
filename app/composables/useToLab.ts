// «▶ Tocar en el Laboratorio» (spec 024 §1): guarda lo que hay en **el mismo remix** (o lo crea una sola vez) y abre Remixes del Laboratorio con él elegido.
// Lo usan el botón de la pantalla principal del Estudio y el panel «Editar parte».
import { addSong, autoName, makeSaved, newId, replaceSong } from '~/lib/library'

export function useToLab() {
  const engine = useAudioEngine()
  const library = useLibrary()
  const error = ref('')
  async function playInLab(): Promise<boolean> {
    library.load()
    const snap = engine.snapshot()
    const cur = library.lib.value.entries.find((e) => e.id === library.currentId.value && e.saved)
    let id: string
    let next
    if (cur?.saved) {
      id = cur.id
      next = replaceSong(library.lib.value, { ...makeSaved(snap, id, cur.name, new Date()), ...(cur.saved.lab ? { lab: cur.saved.lab } : {}) })
    } else {
      id = newId(Date.now())
      next = addSong(library.lib.value, makeSaved(snap, id, autoName(engine.style.value, new Date()), new Date()))
    }
    if (!library.persist(next)) {
      error.value = library.error.value ?? 'No se ha podido guardar.'
      return false
    }
    library.setCurrent(id)
    engine.stop()
    await navigateTo(`/lab?remix=${encodeURIComponent(`mio:${id}`)}`)
    return true
  }
  return { playInLab, error }
}

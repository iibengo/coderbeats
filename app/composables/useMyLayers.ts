// Mis capas del Laboratorio (spec 018): estado compartido entre pantallas, guardado en una clave propia (nunca `coderbeats:ui:v1`). Sin almacenamiento, sigue en memoria.
import { readJson, writeText } from '~/lib/storage'
import { absStep, EMPTY_LAYERS, hasDrums, hasMelody, isMyLayers, melodyFrom, recordNote, type MyDrums, type MyLayers, type Played } from '~/lib/myLayers'
import type { LoopHit } from '~/lib/freeLoops'

export const LAB_KEY = 'coderbeats:lab:v1'
const layers = ref<MyLayers>({ ...EMPTY_LAYERS })
let played: Played[] = []
let loaded = false

function save() {
  writeText(LAB_KEY, JSON.stringify(layers.value))
}
function load() {
  if (loaded) return
  loaded = true
  const v = readJson(LAB_KEY, isMyLayers)
  if (v) layers.value = v
}

export function useMyLayers() {
  load()
  const engine = useAudioEngine()
  return {
    layers,
    hasDrums: computed(() => hasDrums(layers.value)),
    hasMelody: computed(() => hasMelody(layers.value)),
    /** «mi batería»: lo que hay ahora en el Círculo */
    setDrums(d: MyDrums) {
      layers.value = { ...layers.value, drums: { bd: [...d.bd], sd: [...d.sd], hh: [...d.hh] } }
      save()
    },
    /** una nota tocada ahora (Piano o Coro): la melodía es lo último que se tocó, 4 compases */
    noteNow(midi: number) {
      const c = engine.clockNow()
      played = recordNote(played, absStep(c.bar, c.barPhase), midi)
      const hits: LoopHit[] = melodyFrom(played)
      if (hits.length >= 2) {
        layers.value = { ...layers.value, melody: hits }
        save()
      }
    },
    /** al entrar en una pantalla de melodía se empieza una nueva toma (lo guardado sigue hasta que se toque otra cosa) */
    newTake() {
      played = []
    },
  }
}

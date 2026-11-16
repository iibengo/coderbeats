<script setup lang="ts">
// La portada simple (spec 016): elige un estilo → la base suena → la espiral te da la melodía → añades ritmo con la voz o con toques → guardas o compartes. Todo lo demás está en el Estudio.
import { STYLES } from '~/lib/constants'
import { needsPick } from '~/lib/ui'
import { LoopHistory, loopsSignature } from '~/lib/loopHistory'
import { GUARDAR_MS, PORTADA_LINE, portadaStep } from '~/lib/portadaGuide'
import { makeSaved, newId, replaceSong } from '~/lib/library'
import { readText, writeText } from '~/lib/storage'
import type { StyleId } from '~/lib/types'
import ThereminOverlay from './visual/ThereminOverlay.vue'
import VisualStage from './visual/VisualStage.vue'

const emit = defineEmits<{ recalibrate: ['latency' | 'sounds']; estudio: [] }>()
const engine = useAudioEngine()
const { playing, style } = engine
const ui = useUi()
const prefs = usePrefs()
prefs.load()
prefs.startSaving()
useLatencyDefaults()
if (import.meta.dev && import.meta.client) {
  ;(window as unknown as Record<string, unknown>).__engine = engine
  ;(window as unknown as Record<string, unknown>).__stage = () => stage.value
}
// la portada es siempre «Jugar»; el modo que tuviera el Estudio se devuelve al salir (no se pierde)
const prevMode = engine.mode.value
engine.mode.value = 'jugar'
onBeforeUnmount(() => (engine.mode.value = prevMode))

const reduced = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const stage = ref<InstanceType<typeof VisualStage> | null>(null)
// ── deshacer / rehacer lo que haces con los loops (una frase de voz entera, una melodía…) ──
const history = new LoopHistory()
history.record(engine.loops.value)
const canUndo = ref(false)
const canRedo = ref(false)
let applying = false
watch(
  () => engine.loops.value,
  (l) => {
    if (applying) return
    history.record(l)
    canUndo.value = history.canUndo
    canRedo.value = history.canRedo
  },
)
function undo() {
  const prev = history.undo()
  if (prev) apply(prev)
}
function redo() {
  const next = history.redo()
  if (next) apply(next)
}
function apply(state: typeof engine.loops.value) {
  applying = true
  engine.editLoops(state)
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
  setTimeout(() => (applying = false), 0)
}

// ── guardado automático como «Mi canción» (la biblioteca de siempre: se puede renombrar y abrir desde «Mis canciones») ──
const library = useLibrary()
library.load()
const ENTRY_KEY = 'coderbeats:portada:entry:v1'
let entryId = readText(ENTRY_KEY)
const savedFlash = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | undefined
let flashTimer: ReturnType<typeof setTimeout> | undefined
function autosave() {
  const snap = engine.snapshot()
  if (!snap.song.cells.some((c) => c.loops.length)) return
  const id = entryId ?? newId(Date.now())
  const old = library.lib.value.entries.find((e) => e.id === id)
  const saved = makeSaved(snap, id, old?.name ?? 'Mi canción', new Date())
  if (!library.persist(replaceSong(library.lib.value, saved))) return
  entryId = id
  writeText(ENTRY_KEY, id)
  library.setCurrent(id)
  savedFlash.value = true
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (savedFlash.value = false), 1800)
}
watch(
  () => loopsSignature(engine.loops.value) + engine.style.value,
  () => {
    // como mucho 3 s después del primer cambio (no «cuando se calme»: con la voz sonando casi nunca se calma)
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      autosave()
    }, 3000)
  },
)
onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  clearTimeout(flashTimer)
})

// ── compartir en vídeo (la exportación de siempre, con lo mínimo) ──
const videoOpen = ref(false)
const exporter = useVideoExport(() => (stage.value as unknown as { videoSource: () => never } | null)?.videoSource() ?? null, () => Promise.resolve())
if (import.meta.dev && import.meta.client) (window as unknown as Record<string, unknown>).__video = exporter

/** ¿ya se eligió estilo? Con algo hecho o sonando, no se pregunta */
const picked = ref(!needsPick({ loops: engine.loops.value.loops.length, cells: engine.song.value.cells.length, playing: playing.value }))

// ── la guía de los dos primeros minutos: una frase cada vez (se recuerda cuando se acaba) ──
const GUIDE_KEY = 'coderbeats:portada:guide:v1'
const guideDone = ref(readText(GUIDE_KEY) === 'done')
const fingered = ref(engine.loops.value.loops.some((l) => l.instrument === 'mel'))
const hasRhythm = computed(() => engine.loops.value.loops.some((l) => l.instrument !== 'mel' && l.hits.length > 0))
const step = computed(() => portadaStep({ picked: picked.value, fingered: fingered.value || engine.thereminNote.value !== null, rhythm: hasRhythm.value, finished: guideDone.value }))
let guideTimer: ReturnType<typeof setTimeout> | undefined
watch(step, (st) => {
  if (st === 'guardar') guideTimer = setTimeout(endGuide, GUARDAR_MS)
})
watch(() => engine.thereminNote.value, (n) => n !== null && (fingered.value = true))
function endGuide() {
  guideDone.value = true
  writeText(GUIDE_KEY, 'done')
}
onBeforeUnmount(() => clearTimeout(guideTimer))

const spiralEl = ref<InstanceType<typeof ThereminOverlay> | null>(null)
const menuOpen = ref(false)
const libraryOpen = ref(false)
const aboutOpen = ref(false)

const STYLE_CARDS: { id: StyleId; name: string; hint: string }[] = [
  { id: 'hiphop90', name: 'Hip hop', hint: '90 bpm · suave' },
  { id: 'house', name: 'House', hint: '124 bpm · bailable' },
  { id: 'dnb', name: 'Drum and bass', hint: '174 bpm · rápido' },
  { id: 'dembow', name: 'Dembow', hint: '90 bpm · latino' },
  { id: 'techno', name: 'Techno', hint: 'oscuro · hipnótico' },
]
const SHORT: Record<StyleId, string> = { hiphop90: 'hip hop', house: 'house', dnb: 'dnb', dembow: 'dembow', techno: 'techno' }

/** Elegir estilo: empieza a sonar la base (bajo y acordes); si ya se había elegido, cambia de estilo sin perder lo hecho */
async function pick(id: StyleId) {
  if (id !== style.value) await engine.setStyle(id)
  engine.guideBackground()
  picked.value = true
  if (!playing.value) await engine.play()
}
function toEstudio() {
  menuOpen.value = false
  ui.setUi('estudio')
  emit('estudio')
}
</script>

<template>
  <VisualStage ref="stage" simple>
    <!-- estilo: las cinco tarjetas al principio y, después, un selector discreto -->
    <nav v-if="picked" class="absolute flex gap-3 text-xs tracking-wide" style="top: max(0.75rem, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%)" @pointerdown.stop>
      <button v-for="s in Object.values(STYLES)" :key="s.id" class="whitespace-nowrap px-1 py-2 transition-colors" :class="style === s.id ? 'text-white' : 'text-white/35'" @click="pick(s.id as StyleId)">
        {{ SHORT[s.id as StyleId] }}
      </button>
    </nav>

    <button class="absolute flex h-11 w-11 items-center justify-center text-white/50" style="top: max(0.5rem, env(safe-area-inset-top)); right: 0.5rem" aria-label="más" @pointerdown.stop @click="menuOpen = true">
      <svg width="20" height="4" viewBox="0 0 20 4" fill="currentColor" aria-hidden="true"><circle cx="2" cy="2" r="2" /><circle cx="10" cy="2" r="2" /><circle cx="18" cy="2" r="2" /></svg>
    </button>

    <!-- 2 · la espiral: pon el dedo en el agua; las notas del tema vienen a él -->
    <div v-if="picked && (hasRhythm || guideDone || fingered)" class="absolute right-0 left-0" style="top: 56px; bottom: 164px">
      <ThereminOverlay ref="spiralEl" bare @touch="fingered = true" :reduced="reduced" :bar="engine.currentBar.value" />
    </div>

    <!-- 3 · ritmo: tu voz (siempre escuchando) o las tres pastillas -->
    <div v-if="picked" class="absolute right-0 left-0" style="bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 64px)">
      <p v-if="step !== 'hecho' && step !== 'estilo'" data-guide class="mb-1.5 text-center text-sm text-white/70" role="status" aria-live="polite">{{ PORTADA_LINE[step] }}</p>
      <PadsRow />
    </div>

    <!-- 4 · abajo: deshacer, otra melodía, parar / seguir, compartir -->
    <div v-if="picked" class="absolute right-0 left-0 flex items-center justify-between gap-2 px-3" style="bottom: max(0.75rem, env(safe-area-inset-bottom))" @pointerdown.stop>
      <div class="flex w-20 gap-1">
        <button class="h-11 w-11 rounded-full border border-white/20 text-lg text-white disabled:opacity-30" :disabled="!canUndo" aria-label="deshacer lo último que hice" @click="undo">↶</button>
        <button v-if="canRedo" class="h-11 w-11 rounded-full border border-white/20 text-lg text-white" aria-label="volver a poner lo que quité" @click="redo">↷</button>
      </div>
      <button class="flex h-11 items-center justify-center rounded-full border border-white/25 px-4 text-sm text-white" aria-label="otra melodía" @click="spiralEl?.otherTune()">↻ Otra</button>
      <button class="flex h-12 w-12 items-center justify-center rounded-full border border-white/25 text-white" :aria-label="playing ? 'parar' : 'tocar'" @click="playing ? engine.stop() : engine.play()">
        <span v-if="!playing">▶</span>
        <span v-else>■</span>
      </button>
      <div class="flex justify-end">
        <button class="h-11 whitespace-nowrap rounded-full bg-white px-4 text-sm font-medium text-black" aria-label="compartir en vídeo: mi reel" @click="videoOpen = true; endGuide()">🎬 Mi reel</button>
      </div>
    </div>
    <p v-if="savedFlash" class="pointer-events-none absolute left-1/2 -translate-x-1/2 text-xs text-white/50" style="bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 52px)" role="status">● guardado</p>
  </VisualStage>

  <!-- 1 · elige cómo suena -->
  <div v-if="!picked" class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-[#0B0B0F]/85 px-6 backdrop-blur-sm" role="dialog" aria-label="elige cómo suena">
    <h1 class="text-2xl font-medium tracking-tight">Elige cómo suena</h1>
    <ul class="grid w-full max-w-sm gap-3">
      <li v-for="c in STYLE_CARDS" :key="c.id">
        <button class="flex w-full items-baseline justify-between rounded-2xl border border-white/15 px-5 py-4 text-left active:bg-white/10" @click="pick(c.id)">
          <span class="text-lg">{{ c.name }}</span>
          <span class="text-xs text-white/50">{{ c.hint }}</span>
        </button>
      </li>
    </ul>
  </div>

  <!-- ⋯ -->
  <Transition name="sheet">
    <div v-if="menuOpen" class="fixed inset-0 z-30 flex items-end" @pointerdown.self="menuOpen = false">
      <div class="absolute inset-0 bg-black/50" @click="menuOpen = false" />
      <section class="relative w-full rounded-t-2xl border-t border-white/10 bg-[#121217] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm" @pointerdown.stop>
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div class="grid gap-3">
          <button class="rounded-full bg-white py-3 font-medium text-black" @click="toEstudio">Estudio</button>
          <p class="-mt-1 text-xs text-neutral-500">Todo: células, grupos, remixes, efectos… Se recuerda para la próxima vez.</p>
          <label class="flex items-center justify-between rounded-full border border-white/15 px-4 py-3">
            <span>Melodía en el compás <span class="text-xs text-neutral-500">(las notas caen en el tiempo de la base)</span></span>
            <input type="checkbox" :checked="ui.state.syncMelody" @change="ui.setSync(($event.target as HTMLInputElement).checked)" />
          </label>
          <button class="rounded-full border border-white/15 py-3" @click="menuOpen = false; libraryOpen = true">Mis canciones</button>
          <button class="rounded-full border border-white/15 py-3" @click="menuOpen = false; emit('recalibrate', 'sounds')">Afinar a mi voz</button>
          <button class="rounded-full border border-white/15 py-3" @click="aboutOpen = !aboutOpen">Acerca de</button>
          <div v-if="aboutOpen" class="max-h-[40dvh] overflow-y-auto"><AboutPanel /></div>
        </div>
      </section>
    </div>
  </Transition>

  <LibrarySheet v-model:open="libraryOpen" />
  <VideoSheet v-model:open="videoOpen" :exporter="exporter" simple />
  <ConfirmDialog />
</template>

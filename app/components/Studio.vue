<script setup lang="ts">
// Pantalla principal (§16.16): solo el agua, los loops flotando, Play y el estilo.
import { STYLES } from '~/lib/constants'
import { TEMPO_RESET_MS, TEMPO_TAPS } from '~/lib/tempo'
import type { Song } from '~/lib/cells'
import type { KitId, StyleId } from '~/lib/types'
import { readJson } from '~/lib/storage'
import { decodeShare, payloadFromHash } from '~/lib/shareLink'
import ModeSwitch from './ModeSwitch.vue'
import VisualStage from './visual/VisualStage.vue'

const emit = defineEmits<{ recalibrate: ['latency' | 'sounds']; simple: [] }>()
const engine = useAudioEngine()
const { playing, style } = engine
const prefs = usePrefs()
prefs.load()
prefs.startSaving()
useSuggestions()
// (solo desarrollo: para las pruebas con el navegador)
if (import.meta.dev && import.meta.client) {
  ;(window as unknown as Record<string, unknown>).__engine = engine
  ;(window as unknown as Record<string, unknown>).__stage = () => stage.value
}
// piloto automático (spec 009): un dedo fantasma que construye la demo con gestos reales
const pilot = usePilot(() => stage.value as never)
const pilotState = usePilotState()
// exportar vídeo (spec 013)
const videoOpen = ref(false)
const exporter = useVideoExport(() => (stage.value as unknown as { videoSource: () => never } | null)?.videoSource() ?? null, () => startPreview())
if (import.meta.dev && import.meta.client) (window as unknown as Record<string, unknown>).__video = exporter
// tutorial jugando (spec 001 §14.1): mano fantasma y pistas en su momento
const tutorial = useTutorial(() => stage.value as never, (a, b) => pilot.demoHand(a, b))
watchEffect(() => (engine.hideActions.value = !!tutorial.text.value))
/** «👁 Previsualizar»: la canción que hay (o una guardada de Mis canciones) se construye sola; al acabar o parar, todo como estaba. */
function startPreview(t?: { song: Song; style: StyleId; kit: KitId; title?: string }) {
  return pilot.preview(t ?? { song: engine.snapshot().song, style: engine.style.value, kit: engine.kit.value, title: 'Tu canción' })
}
async function startPilot() {
  if ((engine.loops.value.loops.length || engine.multi.value) && !(await askConfirm('El piloto sustituye lo que tienes ahora (guárdalo antes en «Mis canciones» si quieres conservarlo). ¿Seguir?'))) return
  void pilot.start(Date.now() % 1000)
}

// la latencia (calibrada, o 50/180 ms por defecto: spec 001 §17.5)
useLatencyDefaults()

/** Primera vez: sin música, sin loops y sin haber terminado nunca la guía del primer minuto (la guía guarda `done` al acabar) */
const firstPlay = computed(
  () => !playing.value && !engine.multi.value && engine.loops.value.loops.length === 0 && !readJson('coderbeats:guide:v1', (x): x is { done: true } => !!x && (x as { done?: unknown }).done === true),
)
const settingsOpen = ref(false)
const libraryOpen = ref(false)
const remixOpen = ref(false)
const melodyOpen = ref(false)
const stage = ref<InstanceType<typeof VisualStage> | null>(null)
const renderer = computed(() => stage.value?.rendererName ?? '')
const layoutInfo = () => stage.value?.layoutInfo() ?? ''

const STYLE_SHORT: Record<StyleId, string> = { hiphop90: 'hip hop', house: 'house', dnb: 'dnb', dembow: 'dembow', techno: 'techno' }

// tempo fácil (spec 005, §6): tocar el BPM lo enciende ("toca 4 veces"); mantenerlo vuelve al tempo del estilo
const bpmCustom = computed(() => engine.bpm.value !== STYLES[style.value].bpm)
const tapDots = computed(() => '●'.repeat(engine.tempoTap.value.count) + '○'.repeat(Math.max(0, TEMPO_TAPS - engine.tempoTap.value.count)))
let bpmTimer: ReturnType<typeof setTimeout> | null = null
let bpmHeld = false
function bpmDown() {
  bpmHeld = false
  bpmTimer = setTimeout(() => {
    bpmHeld = true
    engine.cancelTempoTap()
    engine.setBpm(null)
    navigator.vibrate?.(12)
  }, TEMPO_RESET_MS)
}
function bpmUp() {
  if (bpmTimer) clearTimeout(bpmTimer)
  bpmTimer = null
  if (!bpmHeld) engine.armTempoTap()
}
function bpmLeave() {
  if (bpmTimer) clearTimeout(bpmTimer)
  bpmTimer = null
}

// móvil en horizontal (spec 003, E2.1): estilo a la izquierda, ⋯ y Play a la derecha.
// En vertical y en escritorio, los mismos estilos de siempre.
const { compact } = useLayoutMode()
const navStyle = computed(() =>
  compact.value
    ? 'position: absolute; top: max(0.5rem, env(safe-area-inset-top)); left: max(0.5rem, env(safe-area-inset-left)); flex-direction: column; align-items: flex-start; gap: 0'
    : 'position: absolute; top: max(0.75rem, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%)',
)
const moreStyle = computed(() =>
  compact.value
    ? 'position: absolute; top: max(0.5rem, env(safe-area-inset-top)); right: calc(env(safe-area-inset-right, 0px) + 26px); width: 44px; height: 44px'
    : 'position: absolute; top: max(0.5rem, env(safe-area-inset-top)); right: 0.5rem; width: 44px; height: 44px',
)
// Mis canciones (spec 006): arriba a la izquierda, frente a ⋯; en horizontal, donde están los estilos, a la izquierda de ⋯
const libraryStyle = computed(() =>
  compact.value
    ? 'position: absolute; top: max(0.5rem, env(safe-area-inset-top)); right: calc(env(safe-area-inset-right, 0px) + 74px); width: 44px; height: 44px'
    : 'position: absolute; top: max(0.5rem, env(safe-area-inset-top)); left: 0.5rem; width: 44px; height: 44px',
)
// Remixes (spec 008): debajo del botón de Mis canciones; en horizontal, a su lado
const remixStyle = computed(() =>
  compact.value
    ? 'position: absolute; top: max(0.5rem, env(safe-area-inset-top)); right: calc(env(safe-area-inset-right, 0px) + 122px); width: 44px; height: 44px'
    : 'position: absolute; top: calc(max(0.5rem, env(safe-area-inset-top)) + 48px); left: 0.5rem; width: 44px; height: 44px',
)
// Editor de melodía (spec 020): al lado de Remixes
const melodyStyle = computed(() =>
  compact.value
    ? 'position: absolute; top: max(0.5rem, env(safe-area-inset-top)); right: calc(env(safe-area-inset-right, 0px) + 170px); width: 44px; height: 44px'
    : 'position: absolute; top: calc(max(0.5rem, env(safe-area-inset-top)) + 96px); left: 0.5rem; width: 44px; height: 44px',
)
// el selector de modo (spec 011): bajo ⋯ en vertical y escritorio; en horizontal, bajo Play
const modeStyle = computed(() =>
  compact.value
    ? 'position: absolute; bottom: max(0.5rem, env(safe-area-inset-bottom)); right: calc(env(safe-area-inset-right, 0px) + 10px)'
    : 'position: absolute; top: calc(max(0.5rem, env(safe-area-inset-top)) + 50px); right: 0.5rem',
)
const playStyle = computed(() =>
  compact.value
    ? 'position: absolute; top: 50%; right: calc(env(safe-area-inset-right, 0px) + 16px); width: 64px; height: 64px; transform: translateY(-50%)'
    : 'position: absolute; bottom: max(1.5rem, env(safe-area-inset-bottom)); left: 50%; width: 64px; height: 64px; transform: translateX(-50%)',
)

// en segundo plano el navegador frena los temporizadores del planificador: se para (§16.12)
function onVisibility() {
  if (document.hidden && playing.value) engine.stop()
  // al volver (tras una llamada o el bloqueo) el audio puede haber quedado parado: se despierta
  else if (!document.hidden) void engine.wake()
}
/** Abrir una canción compartida (`#c=…`): se valida como lo guardado, se pregunta y no se guarda sola; el fragmento se quita de la dirección. */
async function openSharedLink() {
  const payload = payloadFromHash(location.hash)
  if (!payload) return
  history.replaceState(null, '', location.pathname + location.search)
  const saved = await decodeShare(payload)
  if (!saved) return void alert("El enlace de la canción no es válido.")
  if (!(await askConfirm(`Abrir la canción compartida «${saved.name}»? Sustituye lo que tienes ahora (guárdalo antes en «Mis canciones» si quieres conservarlo).`))) return
  await engine.openSaved(saved)
}
onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility)
  void openSharedLink()
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))
</script>

<template>
  <VisualStage ref="stage" @preview="startPreview()">
    <!-- estilo -->
    <nav
      class="flex gap-3 text-xs tracking-wide"
      :style="navStyle"
      @pointerdown.stop
    >
      <button
        v-for="s in Object.values(STYLES)"
        :key="s.id"
        class="px-1 py-2 transition-colors"
        :class="style === s.id ? 'text-white' : 'text-white/35'"
        @click="engine.setStyle(s.id as StyleId)"
      >
        {{ STYLE_SHORT[s.id as StyleId] }}
      </button>
      <button
        class="bpm px-1 py-2 tabular-nums transition-colors"
        :class="engine.tempoTap.value.active ? 'text-[#F496BC]' : bpmCustom ? 'text-white/70' : 'text-white/35'"
        :aria-label="engine.tempoTap.value.active ? 'tempo: toca 4 veces' : `tempo ${engine.bpm.value} bpm: tocar para fijarlo con 4 toques, mantener para volver al del estilo`"
        @pointerdown="bpmDown"
        @pointerup="bpmUp"
        @pointerleave="bpmLeave"
        @pointercancel="bpmLeave"
        @contextmenu.prevent
      >
        <template v-if="engine.tempoTap.value.active">toca 4 veces <span class="tracking-widest">{{ tapDots }}</span></template>
        <template v-else>{{ engine.bpm.value }}</template>
      </button>
    </nav>

    <!-- mis canciones (spec 006) -->
    <button
      class="flex items-center justify-center text-white/50"
      :style="libraryStyle"
      aria-label="mis canciones"
      @pointerdown.stop
      @click="libraryOpen = true"
    >
      <svg width="20" height="16" viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
        <path d="M7 2h12M7 8h12M7 14h12" />
        <circle cx="2" cy="2" r="1" fill="currentColor" stroke="none" />
        <circle cx="2" cy="8" r="1" fill="currentColor" stroke="none" />
        <circle cx="2" cy="14" r="1" fill="currentColor" stroke="none" />
      </svg>
    </button>

    <!-- remixes (spec 008) -->
    <button
      class="flex items-center justify-center text-white/50"
      :style="remixStyle"
      aria-label="remixes"
      @pointerdown.stop
      @click="remixOpen = true"
    >
      <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <circle cx="8" cy="8" r="5.5" />
        <circle cx="14" cy="8" r="5.5" />
      </svg>
    </button>

    <!-- editor de melodía (spec 020) -->
    <button class="flex items-center justify-center text-lg text-white/50" :style="melodyStyle" aria-label="editor de melodía" @pointerdown.stop @click="melodyOpen = true">♪</button>

    <!-- modo (spec 011): Jugar | Componer -->
    <ModeSwitch :model-value="engine.mode.value" :style="modeStyle" @pointerdown.stop @update:model-value="stage?.switchMode($event)" />

    <!-- ajustes -->
    <button
      class="flex items-center justify-center text-white/50"
      :style="moreStyle"
      aria-label="ajustes"
      @pointerdown.stop
      @click="settingsOpen = true"
    >
      <svg width="20" height="4" viewBox="0 0 20 4" fill="currentColor" aria-hidden="true">
        <circle cx="2" cy="2" r="2" />
        <circle cx="10" cy="2" r="2" />
        <circle cx="18" cy="2" r="2" />
      </svg>
    </button>

    <!-- play / stop -->
    <button
      class="flex items-center justify-center rounded-full border border-white/25 text-white transition-[background] active:bg-white/10"
      :class="{ 'play-pulse': firstPlay }"
      :style="playStyle"
      :aria-label="playing ? 'parar' : 'tocar'"
      @pointerdown.stop
      @click="playing ? engine.stop() : engine.play()"
    >
      <svg v-if="!playing" width="18" height="20" viewBox="0 0 18 20" fill="currentColor" aria-hidden="true">
        <path d="M2 1.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 2 1.5Z" />
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <rect width="16" height="16" rx="2" />
      </svg>
    </button>
    <!-- la primera vez, nada más que esto: un latido en Play y dos palabras -->
    <span v-if="firstPlay" class="first-play pointer-events-none absolute left-1/2 -translate-x-1/2 text-sm text-white/70" style="bottom: calc(max(1.5rem, env(safe-area-inset-bottom)) + 84px)" role="status">Dale a ▶</span>
  </VisualStage>

  <LibrarySheet v-model:open="libraryOpen" @preview="(t) => startPreview(t)" />
  <RemixSheet v-model:open="remixOpen" />
  <MelodyEditor v-model:open="melodyOpen" />
  <SettingsSheet v-model:open="settingsOpen" :renderer="renderer" :layout="layoutInfo" @recalibrate="(w) => emit('recalibrate', w)" @simple="emit('simple')" @pilot="startPilot" @preview="startPreview()" @video="videoOpen = true" />
  <VideoSheet v-model:open="videoOpen" :exporter="exporter" />
  <button
    v-if="tutorial.text.value && !pilotState.active && !engine.thereminShown.value"
    class="tutorial-line absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-5 py-2 text-sm text-white/90 backdrop-blur"
    style="bottom: calc(max(0.5rem, env(safe-area-inset-bottom)) + 150px)"
    aria-live="polite"
    aria-label="tutorial: toca para saltarlo"
    @pointerdown.stop
    @click="tutorial.skip()"
  >
    {{ tutorial.text.value.big }}<span v-if="tutorial.text.value.count" class="ml-3 text-xs text-white/50">{{ tutorial.text.value.count }}</span>
  </button>
  <!-- «¿Te afino a tu voz?» (spec 001 §17.4): solo si el modelo por defecto acierta poco -->
  <div v-if="engine.calibNudge.value && !pilotState.active && !engine.thereminShown.value" class="absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white/90 backdrop-blur" style="top: calc(max(0.5rem, env(safe-area-inset-top)) + 100px)" role="status">
    <span class="whitespace-nowrap">¿Te afino a tu voz?</span>
    <button class="rounded-full bg-white px-3 py-1 text-xs font-medium text-black" @pointerdown.stop @click="engine.dismissCalibNudge(); engine.stop(); emit('recalibrate', 'sounds')">Sí</button>
    <button class="whitespace-nowrap px-2 py-1 text-xs text-white/60" @pointerdown.stop @click="engine.dismissCalibNudge()">Ahora no</button>
  </div>
  <!-- sin micro: se toca con el dedo -->
  <p v-if="engine.noMic.value && !pilotState.active && !engine.thereminShown.value" class="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-3 py-1 text-xs text-white/70" style="top: calc(max(0.5rem, env(safe-area-inset-top)) + 100px)" role="status">
    Sin micro · dale a ▶ y toca con el dedo
  </p>
  <ConfirmDialog />
  <PilotLayer :paused="pilotState.paused" @pause="pilot.togglePause()" @skip="pilot.skip()" @stop="pilot.stop('user')" />
</template>

<style scoped>
.play-pulse {
  animation: play-pulse 1.8s ease-in-out infinite;
}
@keyframes play-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(244 150 188 / 0);
  }
  50% {
    box-shadow: 0 0 0 10px rgb(244 150 188 / 0.28);
  }
}
@media (prefers-reduced-motion: reduce) {
  .play-pulse {
    animation: none;
    box-shadow: 0 0 0 6px rgb(244 150 188 / 0.25);
  }
}
</style>

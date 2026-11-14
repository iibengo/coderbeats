<script setup lang="ts">
// Pantalla principal (§16.16): solo el agua, los loops flotando, Play y el estilo.
import { STYLES } from '~/lib/constants'
import { usableLatencyMs } from '~/lib/latency'
import { TEMPO_RESET_MS, TEMPO_TAPS } from '~/lib/tempo'
import type { StyleId } from '~/lib/types'
import VisualStage from './visual/VisualStage.vue'

const emit = defineEmits<{ recalibrate: ['latency' | 'sounds'] }>()
const engine = useAudioEngine()
const { playing, style } = engine
const calibration = useCalibration()
const prefs = usePrefs()
prefs.load()
prefs.startSaving()

// una calibración guardada que salió ≤ 0 (imposible) no se usa; no se borra, y repetirla la sustituye
watchEffect(() => engine.setLatency(usableLatencyMs(calibration.data.value?.latency?.ms) / 1000, calibration.data.value?.latency?.ms))

const settingsOpen = ref(false)
const libraryOpen = ref(false)
const remixOpen = ref(false)
const stage = ref<InstanceType<typeof VisualStage> | null>(null)
const renderer = computed(() => stage.value?.rendererName ?? '')
const layoutInfo = () => stage.value?.layoutInfo() ?? ''

const STYLE_SHORT: Record<StyleId, string> = { hiphop90: 'hip hop', house: 'house', dnb: 'dnb', dembow: 'dembow' }

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
const playStyle = computed(() =>
  compact.value
    ? 'position: absolute; top: 50%; right: calc(env(safe-area-inset-right, 0px) + 16px); width: 64px; height: 64px; transform: translateY(-50%)'
    : 'position: absolute; bottom: max(1.5rem, env(safe-area-inset-bottom)); left: 50%; width: 64px; height: 64px; transform: translateX(-50%)',
)

// en segundo plano el navegador frena los temporizadores del planificador: se para (§16.12)
function onVisibility() {
  if (document.hidden && playing.value) engine.stop()
}
onMounted(() => document.addEventListener('visibilitychange', onVisibility))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))
</script>

<template>
  <VisualStage ref="stage">
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
  </VisualStage>

  <LibrarySheet v-model:open="libraryOpen" />
  <RemixSheet v-model:open="remixOpen" />
  <SettingsSheet v-model:open="settingsOpen" :renderer="renderer" :layout="layoutInfo" @recalibrate="(w) => emit('recalibrate', w)" />
</template>

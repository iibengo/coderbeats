<script setup lang="ts">
// Pantalla principal (§16.16): solo el agua, los loops flotando, Play y el estilo.
import { STYLES } from '~/lib/constants'
import type { StyleId } from '~/lib/types'
import VisualStage from './visual/VisualStage.vue'

const emit = defineEmits<{ recalibrate: ['latency' | 'sounds'] }>()
const engine = useAudioEngine()
const { playing, style } = engine
const calibration = useCalibration()
const prefs = usePrefs()
prefs.load()
prefs.startSaving()

watchEffect(() => engine.setLatency((calibration.data.value?.latency?.ms ?? 0) / 1000))

const settingsOpen = ref(false)
const stage = ref<InstanceType<typeof VisualStage> | null>(null)
const renderer = computed(() => stage.value?.rendererName ?? '')

const STYLE_SHORT: Record<StyleId, string> = { hiphop90: 'hip hop', house: 'house', dnb: 'dnb' }

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
      class="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-1/2 flex -translate-x-1/2 gap-3 text-xs tracking-wide"
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
    </nav>

    <!-- ajustes -->
    <button
      class="absolute top-[max(0.5rem,env(safe-area-inset-top))] right-2 flex h-11 w-11 items-center justify-center text-white/50"
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
      class="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-white/25 text-white transition active:scale-95"
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

  <SettingsSheet v-model:open="settingsOpen" :renderer="renderer" @recalibrate="(w) => emit('recalibrate', w)" />
</template>

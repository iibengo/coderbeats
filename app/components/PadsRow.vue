<script setup lang="ts">
// Tres pastillas (spec 016): bum · pff · ts. Tocarlas suena al instante y entra en el loop igual que un golpe de la voz. Se disparan al **bajar** el dedo (sin esperar al «clic»).
import { VOICE_HEX } from '~/lib/palette'

const engine = useAudioEngine()
const PADS = [
  { id: 'bd', label: 'bum', color: VOICE_HEX.bd },
  { id: 'sd', label: 'pff', color: VOICE_HEX.sd },
  { id: 'hh', label: 'ts', color: VOICE_HEX.hh },
] as const
const lit = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
function hit(id: 'bd' | 'sd' | 'hh') {
  engine.tapPad(id)
  lit.value = id
  clearTimeout(timer)
  timer = setTimeout(() => (lit.value = null), 140)
  navigator.vibrate?.(8)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="grid grid-cols-3 gap-2 px-3" role="group" aria-label="pastillas: bum, pff, ts" @pointerdown.stop>
    <button
      v-for="p in PADS"
      :key="p.id"
      class="pad h-16 rounded-2xl border text-lg font-medium text-white transition-transform"
      :class="{ on: lit === p.id }"
      :style="{ '--c': p.color }"
      :aria-label="p.label"
      @pointerdown.prevent="hit(p.id)"
    >
      {{ p.label }}
    </button>
  </div>
</template>

<style scoped>
.pad {
  touch-action: none;
  user-select: none;
  border-color: color-mix(in srgb, var(--c) 60%, transparent);
  background: color-mix(in srgb, var(--c) 14%, transparent);
}
.pad.on {
  background: color-mix(in srgb, var(--c) 55%, transparent);
  transform: scale(0.97);
}
</style>

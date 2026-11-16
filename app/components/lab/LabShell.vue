<script setup lang="ts">
// Marco común de cada pantalla del laboratorio: volver, estilo, ▶/■ (que para todo) y una frase de cómo se toca.
import { LAB_STYLES } from '~/composables/useLab'
import type { StyleId } from '~/lib/types'

defineProps<{ title: string; phrase: string }>()
const emit = defineEmits<{ back: []; style: [id: StyleId]; play: []; stop: [] }>()
const engine = useAudioEngine()
function toggle() {
  if (engine.playing.value) emit('stop')
  else emit('play')
}
</script>

<template>
  <div class="relative flex h-dvh flex-col overflow-hidden bg-[#0a0a0d] text-white select-none">
    <header class="flex items-center gap-2 px-3 pt-3">
      <button class="rounded-full border border-white/20 px-3 py-1.5 text-sm" aria-label="volver al menú" @click="emit('back')">← Menú</button>
      <h1 class="ml-1 text-base font-medium">{{ title }}</h1>
      <button class="ml-auto grid h-11 w-11 place-items-center rounded-full border border-white/25 text-lg" :aria-label="engine.playing.value ? 'parar todo' : 'tocar'" @click="toggle">
        {{ engine.playing.value ? '■' : '▶' }}
      </button>
    </header>
    <nav class="flex flex-wrap gap-1.5 px-3 pt-2" aria-label="estilo">
      <button
        v-for="s in LAB_STYLES"
        :key="s.id"
        class="rounded-full px-3 py-1 text-sm"
        :class="engine.style.value === s.id ? 'bg-white text-black' : 'border border-white/20 text-white/70'"
        @click="emit('style', s.id)"
      >
        {{ s.label }}
      </button>
    </nav>
    <p class="px-3 pt-2 text-sm text-white/60">{{ phrase }}</p>
    <div class="relative min-h-0 flex-1"><slot /></div>
  </div>
</template>

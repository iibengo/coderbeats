<script setup lang="ts">
// Marco común de cada pantalla del Laboratorio (spec 017): fondo negro, estilo, el escenario cuadrado en la ranura, y debajo ▶/■ (que para todo) con la frase de cómo se toca.
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
  <div class="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col bg-black px-3 pb-6 pt-3 text-white select-none">
    <header class="flex items-center gap-2">
      <button class="rounded-lg border border-white/20 px-3 py-2 text-sm" aria-label="volver al menú" @click="emit('back')">← Menú</button>
      <h1 class="ml-1 text-base font-medium">{{ title }}</h1>
    </header>
    <nav class="mt-3 flex flex-wrap gap-1.5" aria-label="estilo">
      <button
        v-for="s in LAB_STYLES"
        :key="s.id"
        class="rounded-lg px-3 py-1.5 text-sm"
        :class="engine.style.value === s.id ? 'border border-[#F496BC] text-white' : 'border border-white/15 text-white/60'"
        @click="emit('style', s.id)"
      >
        {{ s.label }}
      </button>
    </nav>
    <div class="mt-3"><slot /></div>
    <div class="mt-3 flex items-center gap-3">
      <button class="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/25 text-lg" :aria-label="engine.playing.value ? 'parar todo' : 'tocar'" @click="toggle">{{ engine.playing.value ? '■' : '▶' }}</button>
      <p class="text-sm text-white/60">{{ phrase }}</p>
    </div>
    <slot name="extra" />
  </div>
</template>

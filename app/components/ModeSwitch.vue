<script setup lang="ts">
// Selector de modo (spec 011, §4.1): Jugar | Componer. Siempre visible, siempre en el mismo sitio. Es solo una vista:
// cambiar de modo no corta la música ni toca la canción.
import { MODES, type Mode } from '~/lib/modes'

const props = defineProps<{ modelValue: Mode }>()
const emit = defineEmits<{ 'update:modelValue': [Mode] }>()
</script>

<template>
  <div class="mode-switch flex rounded-full border border-white/10 bg-black/30 p-0.5 text-xs backdrop-blur" role="tablist" aria-label="modo">
    <button
      v-for="m in MODES"
      :key="m.id"
      role="tab"
      :aria-selected="props.modelValue === m.id"
      class="rounded-full px-3 py-1 transition-colors"
      :class="props.modelValue === m.id ? 'bg-white/15 text-white' : 'text-white/45'"
      @click="emit('update:modelValue', m.id)"
    >
      {{ m.label }}
    </button>
  </div>
</template>

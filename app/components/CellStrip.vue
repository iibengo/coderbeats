<script setup lang="ts">
// La tira de células de Jugar (spec 011, §3.6): un tramo por parte de la canción, de ancho proporcional a sus compases;
// el que se ve, iluminado. Tocar un tramo = ir a esa parte (como un toque en la colonia).
import type { StripCell } from '~/lib/modes'

defineProps<{ cells: StripCell[]; looping: number | null }>()
const emit = defineEmits<{ pick: [number] }>()
</script>

<template>
  <div class="cell-strip flex items-center gap-[3px]" role="group" aria-label="partes de la canción">
    <button
      v-for="c in cells"
      :key="c.id"
      class="cell-strip-seg relative flex h-5 items-center"
      :style="{ flex: c.turns, minWidth: '10px' }"
      :aria-label="`${c.name}${c.current ? ' (ahora)' : ''}${looping === c.id ? ', en bucle' : ''}: ir a esta parte`"
      :aria-current="c.current"
      @pointerdown.stop
      @click="emit('pick', c.id)"
    >
      <span class="block h-[5px] w-full rounded-full transition-colors" :class="c.current ? 'bg-[#F496BC]' : looping === c.id ? 'bg-white/60' : 'bg-white/20'" />
    </button>
  </div>
</template>

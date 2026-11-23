<script setup lang="ts">
// La carátula de un remix (spec 051): cinco barritas con los colores de los instrumentos (bombo, bajo, caja, platillo, melodía), quietas. Decorativa.
import { VOICE_HEX } from '~/lib/palette'
import { LANES } from '~/lib/timeline'

withDefaults(defineProps<{ bars: readonly number[]; size?: number }>(), { size: 56 })
</script>

<template>
  <span class="flex shrink-0 items-end justify-center gap-[3px] rounded-xl bg-white/5 p-2" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true" data-cover>
    <span v-for="(h, i) in LANES" :key="h" class="w-[7px] rounded-sm" :style="{ height: `${Math.round((bars[i] ?? 0.2) * 100)}%`, background: VOICE_HEX[h] }" />
  </span>
</template>

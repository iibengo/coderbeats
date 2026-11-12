<script setup lang="ts">
const { level } = useAudioEngine()
const width = computed(() => `${Math.min(100, Math.sqrt(level.value) * 100)}%`)
</script>

<template>
  <div class="h-1 w-full overflow-hidden rounded bg-white/10" aria-hidden="true">
    <div class="h-full bg-white/70 transition-[width] duration-75" :style="{ width }" />
  </div>
</template>

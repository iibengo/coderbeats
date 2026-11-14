<script setup lang="ts">
// La pantalla principal sin el paso del micro (solo en desarrollo): para probar la interfaz (hojas, botones) sin audio.
import Studio from '~/components/Studio.vue'
const engine = useAudioEngine()
onMounted(() => Object.assign(window, { __engine: engine }))
</script>

<template>
  <div class="fixed inset-0 bg-[#0B0B0F]"><Studio /></div>
</template>

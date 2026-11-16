<script setup lang="ts">
/**
 * La entrada de coderbeats (spec 017): el Laboratorio. Un enlace compartido (`/#…`) sigue abriendo el Estudio, que es quien lo lee.
 */
definePageMeta({ ssr: false })
onMounted(() => {
  const hash = window.location.hash
  void navigateTo({ path: hash ? '/estudio' : '/lab', hash }, { replace: true })
})
</script>

<template>
  <div class="min-h-dvh bg-black" />
</template>

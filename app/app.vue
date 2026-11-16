<script setup lang="ts">
// el idioma de la página sigue al de la app (spec 025)
const { locale } = useI18n()
useHead({ htmlAttrs: { lang: locale } })
</script>

<template>
  <div class="min-h-dvh bg-ink font-sans text-neutral-100 antialiased">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<style>
html,
body {
  background: #0b0b0f;
  color-scheme: dark;
}
</style>

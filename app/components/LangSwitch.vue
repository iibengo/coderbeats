<script setup lang="ts">
// Selector de idioma (spec 025): español, inglés y euskera. Cambia al instante, sin recargar; la elección la recuerda el módulo (cookie propia).
// `compact` (el menú del Laboratorio, spec 050): solo las iniciales (ES · EN · EU), más pequeño; el nombre entero queda como etiqueta para lectores de pantalla.
const { locale, locales, setLocale, t } = useI18n()
defineProps<{ dark?: boolean; compact?: boolean }>()
const items = computed(() => (locales.value as { code: 'es' | 'en' | 'eu'; name: string }[]).map((l) => ({ code: l.code, name: l.name })))
</script>

<template>
  <div class="flex items-center gap-1 text-xs" role="group" :aria-label="t('lang.label')" data-lang-switch>
    <button
      v-for="l in items"
      :key="l.code"
      class="rounded-full border"
      :class="[compact ? 'min-h-11 min-w-11 px-3 text-[11px] font-medium tracking-wide' : 'px-3 py-1.5', locale === l.code ? 'border-[#F496BC] text-white' : 'border-white/20 text-white/55']"
      :aria-pressed="locale === l.code"
      :aria-label="compact ? l.name : undefined"
      :data-lang="l.code"
      @click="setLocale(l.code)"
    >{{ compact ? l.code.toUpperCase() : l.name }}</button>
  </div>
</template>

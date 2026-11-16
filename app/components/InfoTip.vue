<script setup lang="ts">
// Una «i» con una explicación corta (spec 025/022): toca para abrirla y vuelve a tocar (o toca fuera) para cerrarla; también sale como `title` con el ratón.
const props = defineProps<{ text: string }>()
const { t } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
function away(e: PointerEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => document.addEventListener('pointerdown', away))
onBeforeUnmount(() => document.removeEventListener('pointerdown', away))
</script>

<template>
  <span ref="root" class="relative inline-flex align-middle">
    <button type="button" class="grid h-6 w-6 place-items-center rounded-full border border-white/25 text-[11px] leading-none text-white/60" :aria-label="t('settings.infoAria')" :aria-expanded="open" :title="props.text" data-info @click.stop.prevent="open = !open">i</button>
    <span v-if="open" role="tooltip" class="absolute left-0 top-full z-30 mt-1 w-60 rounded-lg border border-white/15 bg-[#1b1b22] p-2.5 text-xs leading-relaxed text-neutral-200 shadow-xl" data-info-text>{{ props.text }}</span>
  </span>
</template>

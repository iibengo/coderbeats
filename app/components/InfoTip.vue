<script setup lang="ts">
// Una «i» con una explicación corta (spec 025/022): toca para abrirla y vuelve a tocar (o toca fuera) para cerrarla; también sale como `title` con el ratón.
// El texto se coloca dentro de la ventana (a la derecha o abajo no se corta): fijo, con su posición calculada al abrir, y fuera de la hoja para que no lo recorte su scroll.
const props = defineProps<{ text: string }>()
const { t } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const btn = ref<HTMLElement | null>(null)
const tip = ref<HTMLElement | null>(null)
const pos = ref({ left: 8, top: 8, width: 240 })
const MARGIN = 8
function place() {
  const b = btn.value?.getBoundingClientRect()
  if (!b) return
  const width = Math.min(240, window.innerWidth - MARGIN * 2)
  const left = Math.max(MARGIN, Math.min(b.left, window.innerWidth - width - MARGIN))
  const h = tip.value?.offsetHeight ?? 90
  // abajo del icono; si no cabe, arriba
  const below = b.bottom + 4
  const top = below + h > window.innerHeight - MARGIN ? Math.max(MARGIN, b.top - 4 - h) : below
  pos.value = { left, top, width }
}
async function toggle() {
  open.value = !open.value
  if (open.value) {
    place()
    await nextTick()
    place()
  }
}
function away2(e: PointerEvent) {
  if (open.value && tip.value && !tip.value.contains(e.target as Node) && !root.value?.contains(e.target as Node)) open.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', away2, true)
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', away2, true)
  window.removeEventListener('resize', place)
})
</script>

<template>
  <span ref="root" class="relative inline-flex align-middle">
    <button ref="btn" type="button" class="grid h-6 w-6 place-items-center rounded-full border border-white/25 text-[11px] leading-none text-white/60" :aria-label="t('settings.infoAria')" :aria-expanded="open" :title="props.text" data-info @click.stop.prevent="toggle">i</button>
    <Teleport to="body">
      <span v-if="open" ref="tip" role="tooltip" class="fixed z-[60] rounded-lg border border-white/15 bg-[#1b1b22] p-2.5 text-xs leading-relaxed text-neutral-200 shadow-xl" :style="{ left: pos.left + 'px', top: pos.top + 'px', width: pos.width + 'px' }" data-info-text>{{ props.text }}</span>
    </Teleport>
  </span>
</template>

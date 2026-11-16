<script setup lang="ts">
// Efectos de DJ (como en Capas): mantener y mover = filtro (izquierda-derecha) y eco (arriba); soltar con el filtro cerrado = drop; platillo y subida.
const engine = useAudioEngine()
const { t } = useI18n()
const emit = defineEmits<{ start: [] }>()
const pad = ref<HTMLElement | null>(null)
const held = ref(false)
const fp = ref({ x: 1, y: 1 })
function apply(e: PointerEvent) {
  const r = pad.value!.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  fp.value = { x, y }
  engine.setFx({ filter: x, space: 1 - y })
}
function down(e: PointerEvent) {
  if (!engine.playing.value) return emit('start')
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  held.value = true
  apply(e)
}
function up() {
  if (!held.value) return
  held.value = false
  const closed = fp.value.x < 0.6
  fp.value = { x: 1, y: 1 }
  engine.setFx({ filter: 1, space: 0 })
  if (closed) engine.drop()
}
function shot(kind: 'crash' | 'riser') {
  if (engine.playing.value) engine.fxShot(kind, 2)
}
onBeforeUnmount(() => engine.setFx({ filter: 1, space: 0 }))
</script>

<template>
  <section aria-label="DJ">
    <div class="mb-1 text-xs text-white/40">{{ t('lab.dj.hint') }}</div>
    <div class="flex gap-2">
      <div ref="pad" class="relative h-16 flex-1 touch-none overflow-hidden rounded-lg border border-white/20" @pointerdown.prevent="down" @pointermove.prevent="held && apply($event)" @pointerup="up" @pointercancel="up">
        <div class="absolute inset-y-0 left-0 bg-sky-400/25" :style="{ width: fp.x * 100 + '%' }" />
        <div class="pointer-events-none absolute inset-0 grid place-items-center text-xs text-white/50">{{ held ? t('lab.dj.padHeld', { f: Math.round(fp.x * 100), e: Math.round((1 - fp.y) * 100) }) : t('lab.dj.pad') }}</div>
      </div>
      <button class="rounded-lg border border-white/20 px-3 text-sm" @pointerdown.prevent="shot('crash')">{{ t('lab.dj.crash') }}</button>
      <button class="rounded-lg border border-white/20 px-3 text-sm" @pointerdown.prevent="shot('riser')">{{ t('lab.dj.riser') }}</button>
    </div>
  </section>
</template>

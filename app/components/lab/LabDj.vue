<script setup lang="ts">
// 4 · DJ: suena una canción del estilo; el dedo mueve el filtro y el eco, y hay botones de platillo, subida y drop.
import { useLab } from '~/composables/useLab'

const lab = useLab()
const { engine } = lab
const emit = defineEmits<{ back: [] }>()

const pad = ref<HTMLElement | null>(null)
const f = ref({ x: 1, y: 1 })
const touching = ref(false)
const flash = ref('')
let ft: ReturnType<typeof setTimeout> | undefined

async function setup() {
  await lab.begin()
  engine.setFx({ filter: 1, space: 0 })
  await engine.loadDemo()
  await lab.start()
}
onMounted(setup)
onBeforeUnmount(() => {
  engine.setFx({ filter: 1, space: 0 })
  lab.stopAll()
  clearTimeout(ft)
})
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  await engine.loadDemo()
}
function apply(e: PointerEvent) {
  const r = pad.value!.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  f.value = { x, y }
  // izquierda = filtro cerrado, derecha = abierto; arriba = más eco
  engine.setFx({ filter: x, space: 1 - y })
}
function down(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  touching.value = true
  apply(e)
}
function move(e: PointerEvent) {
  if (touching.value) apply(e)
}
function up() {
  touching.value = false
  f.value = { x: 1, y: 1 }
  engine.setFx({ filter: 1, space: 0 })
}
function shot(kind: 'crash' | 'riser' | 'drop') {
  if (!engine.playing.value) return
  if (kind === 'drop') engine.drop()
  else engine.fxShot(kind, 2)
  flash.value = kind
  clearTimeout(ft)
  ft = setTimeout(() => (flash.value = ''), 500)
  navigator.vibrate?.(12)
}
</script>

<template>
  <LabShell title="DJ" phrase="Arrastra por el cuadro: izquierda-derecha, filtro; arriba, más eco. Abajo, los efectos: platillo, subida y drop." @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="lab.stopAll()">
    <div class="flex h-full flex-col gap-3 p-3">
      <div ref="pad" class="relative min-h-0 flex-1 touch-none overflow-hidden rounded-3xl border border-white/15" :class="{ drop: engine.dropping.value }" @pointerdown.prevent="down" @pointermove.prevent="move" @pointerup="up" @pointercancel="up">
        <div class="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-400/30 to-transparent" :style="{ width: f.x * 100 + '%' }" />
        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-fuchsia-400/20 to-transparent" :style="{ height: (1 - f.y) * 100 + '%' }" />
        <div v-if="touching" class="pointer-events-none absolute h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" :style="{ left: f.x * 100 + '%', top: f.y * 100 + '%', boxShadow: '0 0 44px #8cf' }" />
        <div class="pointer-events-none absolute inset-x-0 top-3 text-center text-sm text-white/50">filtro {{ Math.round(f.x * 100) }}% · eco {{ Math.round((1 - f.y) * 100) }}%</div>
        <div v-if="engine.dropping.value" class="pointer-events-none absolute inset-0 grid place-items-center text-3xl text-white/90">…</div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <button class="fx h-20 rounded-2xl border border-white/20 text-lg" :class="{ hot: flash === 'crash' }" @pointerdown.prevent="shot('crash')">platillo</button>
        <button class="fx h-20 rounded-2xl border border-white/20 text-lg" :class="{ hot: flash === 'riser' }" @pointerdown.prevent="shot('riser')">subida</button>
        <button class="fx h-20 rounded-2xl border border-pink-300/50 text-lg" :class="{ hot: flash === 'drop' }" @pointerdown.prevent="shot('drop')">drop</button>
      </div>
    </div>
  </LabShell>
</template>

<style scoped>
.fx { touch-action: none; background: rgba(255, 255, 255, 0.05); }
.fx.hot { background: rgba(255, 255, 255, 0.35); }
.drop { border-color: #f9a8d4; }
</style>

<script setup lang="ts">
// 2 · Theremín: desliza el dedo y suena continuo, siempre en la escala del estilo. Arriba = agudo, a la derecha = más brillo.
import { demoSteps, useLab } from '~/composables/useLab'
import { STYLE_MUSIC } from '~/lib/styles'
import { scaleNotes } from '~/lib/waterKeys'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()

const notes = computed(() => scaleNotes(style.value))
const area = ref<HTMLElement | null>(null)
const finger = ref<{ x: number; y: number } | null>(null)
const trail = ref<{ x: number; y: number; id: number }[]>([])
let tid = 0
const NAMES = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si']
const current = computed(() => (engine.thereminNote.value === null ? '' : NAMES[engine.thereminNote.value % 12]!))
const idx = computed(() => (engine.thereminNote.value === null ? -1 : notes.value.indexOf(engine.thereminNote.value)))

async function setup() {
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: true, chords: false } })
  await lab.start()
}
onMounted(setup)
onBeforeUnmount(() => {
  engine.thereminStop()
  lab.stopAll()
})
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  await setup()
}
function rel(e: PointerEvent) {
  const r = area.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
}
function down(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  move(e)
}
function move(e: PointerEvent) {
  if (!area.value || !(e.buttons || e.pointerType === 'touch')) return
  const p = rel(e)
  if (engine.thereminMove(p.x, p.y) === null) return
  finger.value = p
  trail.value = [...trail.value.slice(-24), { ...p, id: ++tid }]
}
function up() {
  engine.thereminStop()
  finger.value = null
  setTimeout(() => !finger.value && (trail.value = []), 350)
}
</script>

<template>
  <LabShell title="Theremín" phrase="Desliza el dedo sin levantarlo: suena continuo y siempre en la escala. Arriba, agudo. A la derecha, más brillo." @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="engine.thereminStop(); lab.stopAll()">
    <div ref="area" class="absolute inset-0 touch-none" @pointerdown.prevent="down" @pointermove.prevent="move" @pointerup="up" @pointercancel="up">
      <!-- las notas de la escala: una franja por nota, la grave abajo -->
      <div class="absolute inset-0 flex flex-col-reverse">
        <div
          v-for="(n, i) in notes"
          :key="n"
          class="flex-1 border-t border-white/10 transition-colors"
          :style="{ background: i === idx ? `hsl(${(n % 12) * 30} 80% 60% / 0.28)` : 'transparent' }"
        />
      </div>
      <svg class="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1 1">
        <polyline v-if="trail.length > 1" :points="trail.map((t) => `${t.x},${t.y}`).join(' ')" fill="none" stroke="rgba(200,230,255,0.8)" stroke-width="0.012" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="stroke-width: 4px; filter: drop-shadow(0 0 8px #8cf)" />
      </svg>
      <div v-if="finger" class="pointer-events-none absolute h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 blur-[2px]" :style="{ left: finger.x * 100 + '%', top: finger.y * 100 + '%', boxShadow: '0 0 40px #8cf' }" />
      <div class="pointer-events-none absolute right-4 top-3 text-4xl font-light text-white/80">{{ current }}</div>
      <div class="pointer-events-none absolute bottom-3 left-4 text-xs text-white/40">{{ STYLE_MUSIC[style].synth }}</div>
    </div>
  </LabShell>
</template>

<script setup lang="ts">
// 1 · Piano mágico: cada toque suena la siguiente nota de una melodía de la biblioteca que encaja con el estilo; tú marcas el ritmo.
import { demoSteps, tuneFor, useLab } from '~/composables/useLab'
import { adaptTune, tunesFor } from '~/lib/tuneLibrary'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()

const tuneIdx = ref(0)
const tune = computed(() => tuneFor(style.value, tuneIdx.value))
const hits = computed(() => [...adaptTune(tune.value, style.value)].sort((a, b) => a.pos - b.pos))
const played = ref(0)
const rings = ref<{ id: number; x: number; y: number; c: number }[]>([])
let rid = 0
const counter = computed(() => (played.value === 0 ? 0 : ((played.value - 1) % Math.max(1, hits.value.length)) + 1))
const hasMore = computed(() => tunesFor(style.value).length > 1)

async function setup() {
  played.value = 0
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: true, chords: true } })
  await lab.start()
}
onMounted(setup)
onBeforeUnmount(() => lab.stopAll())
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  tuneIdx.value = 0
  await setup()
}
function tap(e: PointerEvent) {
  const note = hits.value[played.value % Math.max(1, hits.value.length)]
  if (!note || !engine.playing.value) return
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (!engine.tapNote(note.midi, false)) return
  played.value++
  const id = ++rid
  rings.value = [...rings.value.slice(-5), { id, x: e.clientX - r.left, y: e.clientY - r.top, c: note.midi % 12 }]
  setTimeout(() => (rings.value = rings.value.filter((q) => q.id !== id)), 520)
}
function next() {
  tuneIdx.value++
  played.value = 0
}
</script>

<template>
  <LabShell title="Piano mágico" phrase="Toca donde quieras: cada toque suena la siguiente nota. Tú pones el ritmo." @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="lab.stopAll()">
    <div class="absolute inset-0 touch-none" @pointerdown.prevent="tap">
      <span v-for="r in rings" :key="r.id" class="ring" :style="{ left: r.x + 'px', top: r.y + 'px', '--h': r.c * 30 }" />
      <div class="pointer-events-none absolute inset-x-0 top-6 text-center">
        <div class="text-lg text-white/80">{{ tune.name }}</div>
        <div class="text-5xl font-light tabular-nums">{{ counter }}<span class="text-2xl text-white/40"> / {{ hits.length }}</span></div>
      </div>
    </div>
    <button v-if="hasMore" class="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/25 px-4 py-2 text-sm" @click="next">otra melodía ↻</button>
  </LabShell>
</template>

<style scoped>
.ring {
  position: absolute;
  width: 20px;
  height: 20px;
  margin: -10px 0 0 -10px;
  border-radius: 999px;
  border: 2px solid hsl(calc(var(--h) * 1deg) 90% 70%);
  box-shadow: 0 0 24px hsl(calc(var(--h) * 1deg) 90% 60%);
  animation: grow 0.52s ease-out forwards;
  pointer-events: none;
}
@keyframes grow {
  to { transform: scale(7); opacity: 0; }
}
</style>

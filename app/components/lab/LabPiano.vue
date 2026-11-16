<script setup lang="ts">
// 2 · Piano mágico (Magic Piano): tú marcas el ritmo con el dedo y la app pone la nota. La melodía es de la biblioteca y encaja con el estilo.
import { demoSteps, tuneFor, useLab } from '~/composables/useLab'
import { LAB_W } from '~/lib/lab'
import { adaptTune, tunesFor } from '~/lib/tuneLibrary'
import type { StageFrame } from './LabStage.vue'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void } | null>(null)
const PINK = '#F496BC'
const C = LAB_W / 2

const tuneIdx = ref(0)
const tune = computed(() => tuneFor(style.value, tuneIdx.value))
const hits = computed(() => [...adaptTune(tune.value, style.value)].sort((a, b) => a.pos - b.pos))
const played = ref(0)
const hasMore = computed(() => tunesFor(style.value).length > 1)
const nextNote = () => hits.value[played.value % Math.max(1, hits.value.length)]
const angleOf = (midi: number) => ((midi % 12) / 12) * Math.PI * 2 - Math.PI / 2

async function setup() {
  played.value = 0
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: true, chords: false } })
}
onMounted(() => {
  void setup()
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__piano = { played: () => played.value, total: () => hits.value.length }
})
onBeforeUnmount(() => lab.stopAll())
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  tuneIdx.value = 0
  await setup()
}
async function tap(x: number, y: number) {
  if (!engine.playing.value) await lab.start()
  const n = nextNote()
  if (!n || !engine.tapNote(n.midi, false)) return
  played.value++
  stage.value?.ripple(x, y, PINK, 6)
  const a = angleOf(n.midi)
  stage.value?.ripple(C + Math.cos(a) * 170, C + Math.sin(a) * 170, '#fff', 4, 10)
  navigator.vibrate?.(6)
}
// el mando (opcional): cualquier botón o gatillo es un toque
const { connected: padOn } = useGamepad((b) => {
  if (b <= 7) void tap(C + (Math.random() - 0.5) * 300, C + (Math.random() - 0.5) * 300)
})
defineExpose({ tap })
function other() {
  tuneIdx.value++
  played.value = 0
}
function draw(g: CanvasRenderingContext2D, f: StageFrame) {
  g.textAlign = 'center'
  g.fillStyle = 'rgba(255,255,255,.55)'
  g.font = '400 22px system-ui, sans-serif'
  g.fillText(`${tune.value.name} · ${played.value % hits.value.length}/${hits.value.length}`, C, 40)
  // el círculo de las alturas: la siguiente nota, hueca, en su sitio
  g.beginPath()
  g.arc(C, C, 170, 0, 7)
  g.strokeStyle = 'rgba(255,255,255,.08)'
  g.lineWidth = 1
  g.stroke()
  g.beginPath()
  g.arc(C, C, 60 + (f.beat ? 8 : 0), 0, 7)
  g.strokeStyle = PINK
  g.lineWidth = 3
  g.stroke()
  const n = nextNote()
  if (n) {
    const a = angleOf(n.midi)
    g.beginPath()
    g.arc(C + Math.cos(a) * 170, C + Math.sin(a) * 170, 12, 0, 7)
    g.strokeStyle = 'rgba(244,150,188,.7)'
    g.lineWidth = 2
    g.stroke()
  }
  if (!f.playing) {
    g.fillStyle = 'rgba(255,255,255,.4)'
    g.font = '400 24px system-ui, sans-serif'
    g.fillText('toca donde quieras', C, C + 8)
  }
}
</script>

<template>
  <LabShell title="Piano mágico" :phrase="`Toca donde sea: cada toque es la siguiente nota. Tú marcas el ritmo.${padOn ? ' (mando: cualquier botón)' : ''}`" @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="lab.stopAll()">
    <LabStage ref="stage" :draw="draw" @down="tap" />
    <template #extra>
      <button v-if="hasMore" class="mt-4 rounded-lg border border-white/20 px-4 py-2 text-sm" @click="other">otra melodía ↻</button>
    </template>
  </LabShell>
</template>

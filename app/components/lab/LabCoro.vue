<script setup lang="ts">
// 3 · Coro (Bebot, Blob Opera): arrastras una voz y otras dos armonizan solas; la escala está bloqueada, no hay nota mala. Arriba agudo, abajo grave; a la derecha, más brillo.
import { demoSteps, useLab } from '~/composables/useLab'
import { LAB_W } from '~/lib/lab'
import { scaleNotes } from '~/lib/waterKeys'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void } | null>(null)
const W = LAB_W
const COLORS = ['244,150,188', '183,166,242', '140,211,245']

const notes = computed(() => scaleNotes(style.value))
const yOfIdx = (i: number) => W - ((i + 0.5) / Math.max(1, notes.value.length)) * W
/** el rastro: cada punto guarda su x, los tres índices y cuánto queda de él */
let trail: { x: number; ys: number[]; a: number }[] = []
const voice = ref<{ x: number; idx: number[] } | null>(null)

async function setup() {
  engine.choirStop()
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd') }, parts: { bass: true, chords: false } })
}
onMounted(() => {
  void setup()
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__coro = { voice: () => voice.value?.idx ?? null }
})
onBeforeUnmount(() => {
  engine.choirStop()
  lab.stopAll()
})
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  engine.choirStop()
  voice.value = null
  await lab.changeStyle(id)
  await setup()
}
function follow(x: number, y: number) {
  const r = engine.choirMove(x / W, y / W)
  if (!r) return
  voice.value = { x, idx: r.idx }
  trail.push({ x, ys: r.idx.map(yOfIdx), a: 1 })
  if (trail.length > 70) trail.shift()
}
async function down(x: number, y: number) {
  if (!engine.playing.value) await lab.start()
  stage.value?.ripple(x, y, 'rgba(244,150,188,1)', 6)
  follow(x, y)
}
function up() {
  engine.choirStop()
  voice.value = null
}
function draw(g: CanvasRenderingContext2D) {
  notes.value.forEach((_, i) => {
    const y = yOfIdx(i)
    const lit = voice.value?.idx.includes(i)
    g.strokeStyle = lit ? 'rgba(183,166,242,.45)' : 'rgba(183,166,242,.10)'
    g.lineWidth = lit ? 2 : 1
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(W, y)
    g.stroke()
  })
  for (const p of trail) {
    p.a *= 0.965
    p.ys.forEach((y, k) => {
      g.beginPath()
      g.arc(p.x + (k - 0) * 0, y, k === 0 ? 8 : 5, 0, 7)
      g.fillStyle = `rgba(${COLORS[k]},${p.a * (k === 0 ? 0.7 : 0.5)})`
      g.fill()
    })
  }
  trail = trail.filter((p) => p.a > 0.05)
  if (voice.value) {
    voice.value.idx.forEach((i, k) => {
      g.beginPath()
      g.arc(voice.value!.x, yOfIdx(i), k === 0 ? 18 : 12, 0, 7)
      g.fillStyle = `rgba(${COLORS[k]},.95)`
      g.shadowColor = `rgba(${COLORS[k]},1)`
      g.shadowBlur = 24
      g.fill()
      g.shadowBlur = 0
    })
  } else if (!trail.length) {
    g.fillStyle = 'rgba(255,255,255,.4)'
    g.font = '400 24px system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText('arrastra el dedo', W / 2, W / 2)
  }
}
</script>

<template>
  <LabShell title="Coro" phrase="Arrastra el dedo: arriba agudo, abajo grave. Las otras voces armonizan solas." @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="engine.choirStop(); lab.stopAll()">
    <LabStage ref="stage" :needle="false" :draw="draw" @down="down" @move="follow" @up="up" />
  </LabShell>
</template>

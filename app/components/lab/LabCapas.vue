<script setup lang="ts">
// 1 · Capas (Incredibox/Groovepad): tocas los círculos para encender y apagar capas; la base suena al primer toque. Dentro, el panel DJ (mantener = filtro y eco, soltar = drop; platillo y subida).
import { demoSteps, useLab } from '~/composables/useLab'
import { AMBER, LAB_W, LAYERS, type LayerKind } from '~/lib/lab'
import type { StageFrame } from './LabStage.vue'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void } | null>(null)

const COLOR: Record<LayerKind, string> = { bd: AMBER, sd: '#F496BC', hh: '#8ECFF2', bass: '#B7A6F2', chords: '#cfcfd6', mel: '#7fd6c2' }
const C = LAB_W / 2
const POS = LAYERS.map((_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / 6
  return [C + Math.cos(a) * 190, C + Math.sin(a) * 190] as const
})
const isOn = (k: LayerKind): boolean => {
  if (k === 'bass' || k === 'chords') return engine.bgManual.value[k]
  const l = engine.loops.value.loops.find((x) => x.instrument === k)
  return !!l && !l.muted
}

async function setup() {
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: false, chords: false }, melody: 'muted' })
}
onMounted(() => {
  void setup()
  // solo en desarrollo: lo que miran los guiones de prueba
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__capas = { state: () => LAYERS.map((l) => (isOn(l.id) ? 1 : 0)).join(''), playing: () => engine.playing.value }
})
onBeforeUnmount(() => {
  engine.setFx({ filter: 1, space: 0 })
  lab.stopAll()
})
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  await setup()
}
function toggleLayer(k: LayerKind) {
  if (k === 'bass' || k === 'chords') engine.toggleBackgroundPart(k)
  else {
    const l = engine.loops.value.loops.find((x) => x.instrument === k)
    if (l) engine.mute(l.id)
  }
}
async function down(x: number, y: number) {
  if (!engine.playing.value) await lab.start()
  LAYERS.forEach((l, i) => {
    if (Math.hypot(x - POS[i]![0], y - POS[i]![1]) < 55) {
      toggleLayer(l.id)
      stage.value?.ripple(POS[i]![0], POS[i]![1], COLOR[l.id], 4, 44)
      navigator.vibrate?.(8)
    }
  })
}
defineExpose({ toggleLayer })

function draw(g: CanvasRenderingContext2D, f: StageFrame) {
  LAYERS.forEach((l, i) => {
    const [x, y] = POS[i]!
    const on = isOn(l.id)
    g.beginPath()
    g.arc(x, y, 44 + (on && f.beat ? 8 : 0), 0, 7)
    g.fillStyle = on ? COLOR[l.id] : 'rgba(255,255,255,.05)'
    g.globalAlpha = on ? 0.9 : 1
    g.fill()
    g.globalAlpha = 1
    g.strokeStyle = on ? COLOR[l.id] : 'rgba(255,255,255,.2)'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = on ? '#0b0b0d' : 'rgba(255,255,255,.6)'
    g.font = '500 22px system-ui, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(l.label, x, y)
  })
  const n = LAYERS.filter((l) => isOn(l.id)).length
  g.beginPath()
  g.arc(C, C, 30 + n * 8 + (f.beat ? 6 : 0), 0, 7)
  g.fillStyle = n === 6 ? '#F496BC' : 'rgba(244,150,188,.25)'
  g.fill()
}

// ── DJ: mantener el dedo = filtro (izquierda-derecha) y eco (arriba); soltar con el filtro cerrado = drop ──
const pad = ref<HTMLElement | null>(null)
const held = ref(false)
const fp = ref({ x: 1, y: 1 })
function padApply(e: PointerEvent) {
  const r = pad.value!.getBoundingClientRect()
  const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
  fp.value = { x, y }
  engine.setFx({ filter: x, space: 1 - y })
}
async function padDown(e: PointerEvent) {
  if (!engine.playing.value) await lab.start()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  held.value = true
  padApply(e)
}
function padUp() {
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
</script>

<template>
  <LabShell title="Capas" phrase="Toca los círculos para encender y apagar capas. Empieza con el ritmo; el resto lo pones tú." @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="lab.stopAll()">
    <LabStage ref="stage" :rings="[190]" :draw="draw" @down="down" />
    <template #extra>
      <section class="mt-4" aria-label="DJ">
        <div class="mb-1 text-xs text-white/40">DJ · mantén y mueve; suelta con el filtro cerrado y cae el drop</div>
        <div class="flex gap-2">
          <div ref="pad" class="relative h-20 flex-1 touch-none overflow-hidden rounded-lg border border-white/20" @pointerdown.prevent="padDown" @pointermove.prevent="held && padApply($event)" @pointerup="padUp" @pointercancel="padUp">
            <div class="absolute inset-y-0 left-0 bg-sky-400/25" :style="{ width: fp.x * 100 + '%' }" />
            <div class="pointer-events-none absolute inset-0 grid place-items-center text-xs text-white/50">{{ held ? `filtro ${Math.round(fp.x * 100)}% · eco ${Math.round((1 - fp.y) * 100)}%` : 'filtro · eco' }}</div>
          </div>
          <button class="rounded-lg border border-white/20 px-3 text-sm" @pointerdown.prevent="shot('crash')">platillo</button>
          <button class="rounded-lg border border-white/20 px-3 text-sm" @pointerdown.prevent="shot('riser')">subida</button>
        </div>
      </section>
    </template>
  </LabShell>
</template>

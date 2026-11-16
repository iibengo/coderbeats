<script setup lang="ts">
// 1 · Capas (Incredibox/Groovepad): tocas los círculos para encender y apagar capas; la base suena al primer toque. Dentro, el panel DJ (mantener = filtro y eco, soltar = drop; platillo y subida).
import { demoSteps, useLab } from '~/composables/useLab'
import { AMBER, LAB_INSTRUMENTS, LAB_W, LAYERS, drumLoop } from '~/lib/lab'
import type { FreeLoop } from '~/lib/freeLoops'
import type { StageFrame } from './LabStage.vue'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void } | null>(null)

const mine = useMyLayers()
const C = LAB_W / 2

/** un círculo: las capas de la base (bombo, caja, platillo, bajo, acordes, melodía) y, si existen, «mi ritmo» y «mi melodía» (spec 018) */
interface Layer { key: string; label: string; color: string; part?: 'bass' | 'chords'; ids: number[] }
const COLOR: Record<string, string> = { bd: AMBER, sd: '#F496BC', hh: '#8ECFF2', bass: '#B7A6F2', chords: '#cfcfd6', mel: '#7fd6c2', mydrums: '#F5A97A', mymel: '#A6F2C2' }
const BASE_IDS: Record<string, number[]> = { bd: [1], sd: [2], hh: [3], mel: [4] }
const extraIds = ref<{ drums: number[]; melody: number[] }>({ drums: [], melody: [] })
const layers = computed<Layer[]>(() => {
  const out: Layer[] = LAYERS.map((l) => ({ key: l.id, label: l.label, color: COLOR[l.id]!, part: l.id === 'bass' || l.id === 'chords' ? l.id : undefined, ids: BASE_IDS[l.id] ?? [] }))
  if (extraIds.value.drums.length) out.push({ key: 'mydrums', label: 'mi ritmo', color: COLOR.mydrums!, ids: extraIds.value.drums })
  if (extraIds.value.melody.length) out.push({ key: 'mymel', label: 'mi melodía', color: COLOR.mymel!, ids: extraIds.value.melody })
  return out
})
const posOf = (i: number, n: number) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / n
  return [C + Math.cos(a) * 190, C + Math.sin(a) * 190] as const
}
const POS = computed(() => layers.value.map((_, i) => posOf(i, layers.value.length)))
const isOn = (l: Layer): boolean => {
  if (l.part) return engine.bgManual.value[l.part]
  return l.ids.some((id) => {
    const x = engine.loops.value.loops.find((y) => y.id === id)
    return !!x && !x.muted
  })
}

/** las capas propias, tal como están guardadas, como loops apagados (las enciendo yo) */
function extraLoops(): FreeLoop[] {
  const out: FreeLoop[] = []
  const d = mine.layers.value.drums
  if (d) for (const k of LAB_INSTRUMENTS) if (d[k].length) out.push({ ...drumLoop(0, k, []), hits: d[k].map((h) => ({ ...h })), muted: true })
  return out
}
async function setup() {
  const drums = extraLoops()
  const m = mine.layers.value.melody
  const extra: FreeLoop[] = [...drums]
  if (m && m.length >= 2) extra.push({ id: 0, instrument: 'mel', bars: 4, phaseBar: 0, hits: m.map((h) => ({ ...h })), muted: true, bornAt: 0, fromTemplate: false })
  const ids = await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: false, chords: false }, melody: 'muted', extra })
  extraIds.value = { drums: ids.slice(0, drums.length), melody: ids.slice(drums.length) }
}
onMounted(() => {
  void setup()
  // solo en desarrollo: lo que miran los guiones de prueba
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__capas = { state: () => layers.value.map((l) => (isOn(l) ? 1 : 0)).join(''), playing: () => engine.playing.value, count: () => layers.value.length }
})
onBeforeUnmount(() => {
  engine.setFx({ filter: 1, space: 0 })
  lab.stopAll()
})
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  await setup()
}
function toggleLayer(l: Layer) {
  if (l.part) engine.toggleBackgroundPart(l.part)
  else for (const id of l.ids) engine.mute(id)
}
async function down(x: number, y: number) {
  if (!engine.playing.value) await lab.start()
  layers.value.forEach((l, i) => {
    if (Math.hypot(x - POS.value[i]![0], y - POS.value[i]![1]) < 55) {
      toggleLayer(l)
      stage.value?.ripple(POS.value[i]![0], POS.value[i]![1], l.color, 4, 44)
      navigator.vibrate?.(8)
    }
  })
}
// el mando (opcional): A B X Y = bombo, caja, platillo, bajo; LB y RB = acordes y melodía
const PAD_LAYER: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5 }
const { connected: padOn } = useGamepad(async (b) => {
  const i = PAD_LAYER[b]
  const l = i === undefined ? undefined : layers.value[i]
  if (!l || i === undefined) return
  if (!engine.playing.value) await lab.start()
  toggleLayer(l)
  stage.value?.ripple(POS.value[i]![0], POS.value[i]![1], l.color, 4, 44)
})
defineExpose({ toggleLayer })

function draw(g: CanvasRenderingContext2D, f: StageFrame) {
  layers.value.forEach((l, i) => {
    const [x, y] = POS.value[i]!
    const on = isOn(l)
    g.beginPath()
    g.arc(x, y, 44 + (on && f.beat ? 8 : 0), 0, 7)
    g.fillStyle = on ? l.color : 'rgba(255,255,255,.05)'
    g.globalAlpha = on ? 0.9 : 1
    g.fill()
    g.globalAlpha = 1
    g.strokeStyle = on ? l.color : 'rgba(255,255,255,.2)'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = on ? '#0b0b0d' : 'rgba(255,255,255,.6)'
    g.font = `500 ${l.label.length > 8 ? 17 : 22}px system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(l.label, x, y)
  })
  const n = layers.value.filter((l) => isOn(l)).length
  g.beginPath()
  g.arc(C, C, 30 + n * 6 + (f.beat ? 6 : 0), 0, 7)
  g.fillStyle = n === layers.value.length ? '#F496BC' : 'rgba(244,150,188,.25)'
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
  <LabShell title="Capas" :phrase="`Toca los círculos para encender y apagar capas. Empieza con el ritmo; el resto lo pones tú.${padOn ? ' (mando: A B X Y, LB, RB)' : ''}`" @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="lab.stopAll()">
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

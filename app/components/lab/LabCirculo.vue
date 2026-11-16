<script setup lang="ts">
// 4 · Círculo de ritmo (Groove Pizza): tocas los anillos para poner o quitar golpes y cada instrumento forma su figura. Modo «ruedas»: arrastrar alrededor de un anillo cambia cuántos golpes tiene.
import { demoSteps, useLab } from '~/composables/useLab'
import { AMBER, LAB_INSTRUMENTS, LAB_W, STEPS, hitsOf, stepsOf, toggleStep, wheelSteps } from '~/lib/lab'
import type { Instrument } from '~/lib/types'
import type { StageFrame } from './LabStage.vue'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void } | null>(null)
const C = LAB_W / 2
const R = [100, 175, 245] // bombo dentro, platillo fuera
const COLOR: Record<Instrument, string> = { bd: AMBER, sd: '#F496BC', hh: '#8ECFF2' }
const mode = ref<'puntos' | 'ruedas'>('puntos')
const exact = ref(false)

const stepsOfInst = (i: Instrument): number[] => stepsOf(engine.loops.value.loops.find((l) => l.instrument === i)?.hits ?? [])
const setHits = (inst: Instrument, hits: ReturnType<typeof hitsOf>) => {
  const st = engine.loops.value
  engine.editLoops({ ...st, loops: st.loops.map((l) => (l.instrument === inst ? { ...l, hits } : l)) })
}

async function setup() {
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: true, chords: false } })
}
onMounted(() => {
  void setup()
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__circulo = { counts: () => LAB_INSTRUMENTS.map((i) => stepsOfInst(i).length).join(','), steps: (i: Instrument) => stepsOfInst(i) }
})
onBeforeUnmount(() => lab.stopAll())
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  await setup()
}

const ringOf = (d: number) => (d < 140 ? 0 : d < 210 ? 1 : d < 280 ? 2 : -1)
const angleAt = (x: number, y: number) => Math.atan2(y - C, x - C)
let wheel: { ring: number; last: number; acc: number; k0: number } | null = null

async function down(x: number, y: number) {
  if (!engine.playing.value) await lab.start()
  const ring = ringOf(Math.hypot(x - C, y - C))
  if (ring < 0) return
  const inst = LAB_INSTRUMENTS[ring]!
  if (mode.value === 'ruedas') {
    wheel = { ring, last: angleAt(x, y), acc: 0, k0: stepsOfInst(inst).length }
    return
  }
  let a = angleAt(x, y) + Math.PI / 2
  if (a < 0) a += Math.PI * 2
  const step = Math.round((a / (Math.PI * 2)) * STEPS) % STEPS
  setHits(inst, toggleStep(engine.loops.value.loops.find((l) => l.instrument === inst)?.hits ?? [], step))
  stage.value?.ripple(x, y, COLOR[inst], 5, 14)
  navigator.vibrate?.(6)
}
function move(x: number, y: number) {
  if (!wheel) return
  const a = angleAt(x, y)
  let d = a - wheel.last
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  wheel.last = a
  wheel.acc += d
  const inst = LAB_INSTRUMENTS[wheel.ring]!
  const k = Math.max(0, Math.min(STEPS, wheel.k0 + Math.round(wheel.acc / (Math.PI / 8))))
  if (k !== stepsOfInst(inst).length) setHits(inst, hitsOf(wheelSteps(k, exact.value)))
}
function up() {
  wheel = null
}
// al cambiar entre «exacto» y «euclídeo», las ruedas se repartan de nuevo con los golpes que llevan
watch(exact, () => {
  if (mode.value !== 'ruedas') return
  for (const i of LAB_INSTRUMENTS) setHits(i, hitsOf(wheelSteps(stepsOfInst(i).length, exact.value)))
})
function clear() {
  for (const i of LAB_INSTRUMENTS) setHits(i, [])
}
const pt = (step: number, r: number): [number, number] => {
  const a = (step / STEPS) * Math.PI * 2 - Math.PI / 2
  return [C + Math.cos(a) * r, C + Math.sin(a) * r]
}
function poly(g: CanvasRenderingContext2D, inst: Instrument, r: number, f: StageFrame) {
  const col = COLOR[inst]
  const pts = [...stepsOfInst(inst)].sort((a, b) => a - b).map((s) => pt(s, r))
  if (pts.length > 1) {
    g.beginPath()
    pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])))
    g.closePath()
    g.strokeStyle = col
    g.lineWidth = 2
    g.globalAlpha = 0.7
    g.stroke()
    g.globalAlpha = 0.08
    g.fillStyle = col
    g.fill()
    g.globalAlpha = 1
  }
  for (const s of stepsOfInst(inst)) {
    const [x, y] = pt(s, r)
    // el golpe se enciende cuando la aguja pasa por él
    const near = f.playing && Math.abs(((s - f.phase * STEPS + STEPS * 1.5) % STEPS) - STEPS / 2) < 0.7
    g.beginPath()
    g.arc(x, y, near ? 12 : 8, 0, 7)
    g.fillStyle = col
    g.fill()
  }
  if (mode.value === 'ruedas') {
    g.fillStyle = col
    g.font = '500 22px system-ui, sans-serif'
    g.textAlign = 'center'
    g.fillText(String(pts.length), C, C + (LAB_INSTRUMENTS.indexOf(inst) - 1) * 26 + 8)
  }
}
function draw(g: CanvasRenderingContext2D, f: StageFrame) {
  for (let i = 0; i < STEPS; i++) {
    g.fillStyle = 'rgba(255,255,255,.35)'
    for (const r of [R[0]!, R[1]!, R[2]!]) {
      const [x, y] = pt(i, r)
      g.beginPath()
      g.arc(x, y, 3, 0, 7)
      g.fill()
    }
  }
  poly(g, 'hh', R[2]!, f)
  poly(g, 'sd', R[1]!, f)
  poly(g, 'bd', R[0]!, f)
}
</script>

<template>
  <LabShell
    title="Círculo de ritmo"
    :phrase="mode === 'puntos' ? 'Toca los anillos para poner o quitar golpes. Cada instrumento forma su figura.' : 'Arrastra alrededor de un anillo: más vueltas, más golpes, repartidos a partes iguales.'"
    @back="emit('back')"
    @style="pickStyle"
    @play="lab.start()"
    @stop="lab.stopAll()"
  >
    <LabStage ref="stage" :rings="[140, 210, 280]" :draw="draw" @down="down" @move="move" @up="up" />
    <template #extra>
      <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <button class="rounded-lg border px-3 py-1.5" :class="mode === 'puntos' ? 'border-[#F496BC]' : 'border-white/15 text-white/60'" @click="mode = 'puntos'">puntos</button>
        <button class="rounded-lg border px-3 py-1.5" :class="mode === 'ruedas' ? 'border-[#F496BC]' : 'border-white/15 text-white/60'" @click="mode = 'ruedas'">ruedas</button>
        <label v-if="mode === 'ruedas'" class="flex items-center gap-1.5 text-white/60"><input v-model="exact" type="checkbox" /> exacto (3 contra 4)</label>
        <button class="ml-auto rounded-lg border border-white/20 px-3 py-1.5" @click="clear">vaciar</button>
        <button class="rounded-lg border border-white/20 px-3 py-1.5" @click="setup">base</button>
      </div>
    </template>
  </LabShell>
</template>

<script setup lang="ts">
// 5 · Círculo de ritmo: toca el círculo para poner o quitar golpes; cada instrumento forma su polígono de color.
import { demoSteps, useLab } from '~/composables/useLab'
import { hitTestRings, LAB_INSTRUMENTS, pointOfStep, polygonPath, STEPS, stepsOf, toggleStep } from '~/lib/lab'
import { VOICE_HEX } from '~/lib/palette'
import type { Instrument } from '~/lib/types'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()

const RADII = [18, 30, 42] // bombo dentro, platillo fuera
const COLOR: Record<Instrument, string> = { bd: VOICE_HEX.bd, sd: VOICE_HEX.sd, hh: VOICE_HEX.hh }
const NAME: Record<Instrument, string> = { bd: 'bombo', sd: 'caja', hh: 'platillo' }
const svg = ref<SVGSVGElement | null>(null)
const head = ref(0)

const steps = computed(() => {
  const m = {} as Record<Instrument, number[]>
  for (const i of LAB_INSTRUMENTS) m[i] = stepsOf(engine.loops.value.loops.find((l) => l.instrument === i)?.hits ?? [])
  return m
})
const on = (i: Instrument, s: number) => steps.value[i].some((p) => Math.round(p) % STEPS === s)

async function setup() {
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: true, chords: false } })
  await lab.start()
}
let raf = 0
onMounted(() => {
  void setup()
  const tick = () => {
    raf = requestAnimationFrame(tick)
    head.value = engine.playing.value ? engine.clockNow().barPhase : 0
  }
  tick()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  lab.stopAll()
})
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  await setup()
}
function tap(e: PointerEvent) {
  const r = svg.value!.getBoundingClientRect()
  const x = ((e.clientX - r.left) / r.width) * 100
  const y = ((e.clientY - r.top) / r.height) * 100
  const t = hitTestRings(x, y, 50, 50, RADII, 6)
  if (!t) return
  const inst = LAB_INSTRUMENTS[t.ring]!
  const st = engine.loops.value
  engine.editLoops({ ...st, loops: st.loops.map((l) => (l.instrument === inst ? { ...l, hits: toggleStep(l.hits, t.step) } : l)) })
  navigator.vibrate?.(6)
}
function clear() {
  const st = engine.loops.value
  engine.editLoops({ ...st, loops: st.loops.map((l) => ({ ...l, hits: [] })) })
}
const needle = computed(() => pointOfStep(head.value * STEPS, 46, 50, 50))
</script>

<template>
  <LabShell title="Círculo de ritmo" phrase="Toca un punto del círculo para poner o quitar un golpe. Dentro, el bombo; en medio, la caja; fuera, el platillo." @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="lab.stopAll()">
    <div class="flex h-full flex-col items-center justify-center gap-3 p-2">
      <svg ref="svg" viewBox="0 0 100 100" class="aspect-square w-full max-w-[560px] touch-none" @pointerdown.prevent="tap">
        <circle v-for="(r, k) in RADII" :key="'r' + k" cx="50" cy="50" :r="r" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="0.4" />
        <template v-for="(i, k) in LAB_INSTRUMENTS" :key="i">
          <path v-if="steps[i].length > 1" :d="polygonPath(steps[i], RADII[k]!, 50, 50)" :fill="COLOR[i] + '22'" :stroke="COLOR[i]" stroke-width="0.7" stroke-linejoin="round" />
          <circle
            v-for="s in STEPS"
            :key="i + s"
            :cx="pointOfStep(s - 1, RADII[k]!, 50, 50)[0]"
            :cy="pointOfStep(s - 1, RADII[k]!, 50, 50)[1]"
            :r="on(i, s - 1) ? 2.1 : 0.9"
            :fill="on(i, s - 1) ? COLOR[i] : 'rgba(255,255,255,0.3)'"
          />
        </template>
        <line x1="50" y1="50" :x2="needle[0]" :y2="needle[1]" stroke="white" stroke-width="0.9" stroke-linecap="round" style="filter: drop-shadow(0 0 1.6px #9df)" />
        <circle cx="50" cy="50" r="1.6" fill="white" />
      </svg>
      <div class="flex gap-4 text-xs text-white/60">
        <span v-for="i in LAB_INSTRUMENTS" :key="i"><span class="mr-1 inline-block h-2 w-2 rounded-full" :style="{ background: COLOR[i] }" />{{ NAME[i] }}</span>
        <button class="rounded-full border border-white/25 px-3 py-0.5 text-white/80" @click="clear">vaciar</button>
        <button class="rounded-full border border-white/25 px-3 py-0.5 text-white/80" @click="setup">base</button>
      </div>
    </div>
  </LabShell>
</template>

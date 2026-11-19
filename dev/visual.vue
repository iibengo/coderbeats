<script setup lang="ts">
// Visualizador aparte (spec 049): dibuja un remix desde su línea de tiempo (cuándo suena cada golpe), **sin motor de audio y sin sonido**.
// Solo en desarrollo (`nuxt dev`): /visual?r=lacrimosa-drill (el remix, por su id) &t=45 (fija un instante, en pausa).
import { labRemixById, LAB_REMIXES } from '~/lib/labRemixes'
import { songTimeline } from '~/lib/timeline'
import { drawPulso, makePulso, PULSO_H, PULSO_W } from '~/lib/visuals/pulso'

const route = useRoute()
const remix = labRemixById(String(route.query.r ?? 'lacrimosa-drill')) ?? LAB_REMIXES[0]!
const tl = songTimeline(remix.song, remix.style)
const scene = makePulso(tl, remix.title)

const canvas = ref<HTMLCanvasElement | null>(null)
const t = ref(Math.min(tl.duration, Math.max(0, Number(route.query.t ?? 0)) || 0))
const playing = ref(route.query.t === undefined)
let raf = 0
let last = 0
let reduced = false

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const c = canvas.value
  if (!c) return
  if (playing.value) {
    t.value += Math.min(0.1, (now - last) / 1000)
    if (t.value >= tl.duration) t.value = 0
  }
  last = now
  const ctx = c.getContext('2d')
  if (!ctx) return
  drawPulso(ctx, scene, t.value, { scale: c.clientWidth / PULSO_W || 1, reduced })
}

onMounted(() => {
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  last = performance.now()
  raf = requestAnimationFrame(frame)
  ;(window as unknown as Record<string, unknown>).__visual = {
    setTime: (s: number) => (t.value = Math.min(tl.duration, Math.max(0, s))),
    pause: () => (playing.value = false),
    duration: tl.duration,
    sections: tl.sections,
    events: tl.events.length,
    bpm: tl.bpm,
  }
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <main class="flex min-h-screen flex-col items-center gap-3 bg-black p-3 text-white">
    <canvas ref="canvas" :width="PULSO_W" :height="PULSO_H" class="block max-h-[calc(100vh-110px)] w-auto max-w-full touch-none rounded-lg" style="aspect-ratio: 9 / 16" />
    <div class="flex w-full max-w-sm items-center gap-3">
      <button class="h-11 w-11 shrink-0 rounded-full border border-white/30 text-lg" :aria-label="playing ? 'pausa' : 'reproducir'" @click="playing = !playing">{{ playing ? '⏸' : '▶' }}</button>
      <input v-model.number="t" type="range" min="0" :max="tl.duration" step="0.05" class="w-full" aria-label="instante" @input="playing = false" />
    </div>
  </main>
</template>

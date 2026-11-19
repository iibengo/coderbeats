<script setup lang="ts">
// Visualizador aparte (spec 049): dibuja un remix desde su línea de tiempo (cuándo suena cada golpe).
//   · «▶ con sonido»: suena el remix (el motor de siempre) y la imagen **sigue su reloj** (`clockNow`: compás y fase de lo que se oye, ya con la latencia de salida).
//   · El deslizador y `?t=45` miran un instante **sin sonido** (el audio no se puede saltar).
// Solo en desarrollo (`nuxt dev`): /visual?r=lacrimosa-drill (el remix, por su id) &t=45 (fija un instante, en pausa y mudo).
import { labRemixById, LAB_REMIXES, remixTake, songFromTake } from '~/lib/labRemixes'
import { songTimeline } from '~/lib/timeline'
import { drawPulso, makePulso, PULSO_H, PULSO_W } from '~/lib/visuals/pulso'

const route = useRoute()
const remix = labRemixById(String(route.query.r ?? 'lacrimosa-drill')) ?? LAB_REMIXES[0]!
const tl = songTimeline(remix.song, remix.style)
const scene = makePulso(tl, remix.title)

const engine = useAudioEngine()
const lab = useLab()
const canvas = ref<HTMLCanvasElement | null>(null)
const t = ref(Math.min(tl.duration, Math.max(0, Number(route.query.t ?? 0)) || 0))
/** con sonido: la imagen sigue el reloj del motor; parado: el instante que marque el deslizador (sin sonido) */
const mode = ref<'parado' | 'sonido'>('parado')
const playing = computed(() => mode.value !== 'parado')
const starting = ref(false)

async function playWithSound() {
  if (starting.value) return
  starting.value = true
  try {
    // lo mismo que «escuchar el remix original» del Laboratorio
    await lab.begin()
    await lab.changeStyle(remix.style)
    engine.setBpm(remix.song.bpm ?? null)
    engine.setKit(remix.kit)
    const song = songFromTake(remix, remixTake(remix))
    if (!song) return
    engine.stop()
    engine.setSong(song)
    await engine.play()
    t.value = 0
    mode.value = 'sonido'
  } finally {
    starting.value = false
  }
}
function stop() {
  if (mode.value === 'sonido') engine.stop()
  mode.value = 'parado'
}
function toggle() {
  if (mode.value === 'parado') void playWithSound()
  else stop()
}
function scrub() {
  // mirar un instante: se calla (el audio no se puede saltar)
  if (mode.value === 'sonido') engine.stop()
  mode.value = 'parado'
}
let raf = 0
let last = 0
let reduced = false

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  const c = canvas.value
  if (!c) return
  if (mode.value === 'sonido') {
    // el reloj del motor: compás y fase de lo que se oye; si el motor se para o la canción da la vuelta, la imagen también
    if (!engine.playing.value) mode.value = 'parado'
    else {
      const c = engine.clockNow()
      t.value = (((c.bar + c.barPhase) * tl.barSeconds) % tl.duration + tl.duration) % tl.duration
    }
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
    pause: () => stop(),
    mode: () => mode.value,
    time: () => t.value,
    clock: () => engine.clockNow(),
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
      <button class="flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-white/30 px-4 text-sm" :aria-label="playing ? 'parar' : 'reproducir con sonido'" :disabled="starting" @click="toggle">{{ starting ? '…' : playing ? '⏸ parar' : '▶ con sonido' }}</button>
      <input v-model.number="t" type="range" min="0" :max="tl.duration" step="0.05" class="w-full" aria-label="instante (sin sonido)" @input="scrub" />
    </div>
  </main>
</template>

<script setup lang="ts">
// Exportar vídeo (spec 013): elegir qué grabar y el formato; mientras graba, solo una píldora con el tiempo y «■ parar»; al acabar, guardar o compartir.
import { FORMAT_LABEL, formatMB, secondsFor, type VideoFormat, type VideoSize } from '~/lib/videoExport'

const open = defineModel<boolean>('open', { required: true })
/** `simple` (la portada, spec 016): sin opciones, 4 compases en vertical a 720; solo «Grabar», guardar y compartir */
const props = defineProps<{ exporter: ReturnType<typeof useVideoExport>; simple?: boolean }>()
const engine = useAudioEngine()
const state = useVideoState()

const what = ref<'cell' | 'song' | 'preview'>('cell')
const bars = ref(4)
const format = ref<VideoFormat>('vertical')
const size = ref<VideoSize>(720)
const mark = ref(false)
const seconds = computed(() => (what.value === 'preview' ? 90 : what.value === 'song' ? secondsFor(songBarsNow(), engine.bpm.value) : secondsFor(bars.value, engine.bpm.value)))
const songBarsNow = () => engine.snapshot().song.order.reduce((n, id) => n + (engine.song.value.cells.find((c) => c.id === id)?.turns ?? 0), 0)
const supported = import.meta.client ? props.exporter.supported() : true

async function go() {
  open.value = false
  // «Mi reel» (portada): vertical, ≥ 10 s (4 compases, 8 si el tempo es rápido), estilo y BPM arriba y la marca discreta
  const reelBars = engine.bpm.value > 110 ? 8 : 4
  await props.exporter.start(props.simple ? { what: 'cell', bars: reelBars, format: 'vertical', size: 720, fps: 30, mark: true, header: true } : { what: what.value, bars: bars.value, format: format.value, size: size.value, fps: 30, mark: mark.value, header: what.value === 'preview' })
  if (state.phase === 'done' || state.phase === 'error') open.value = true
}
</script>

<template>
  <div v-if="state.phase === 'waiting' || state.phase === 'recording'" class="fixed left-1/2 z-30 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white/90 backdrop-blur" style="top: calc(max(0.5rem, env(safe-area-inset-top)) + 6px)" role="status">
    <span class="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-[#F496BC]" />
    {{ state.phase === 'waiting' ? state.message : `Grabando ${state.elapsed.toFixed(0)}/${state.total.toFixed(0)} s` }}
    <button class="ml-3 underline" aria-label="parar la grabación y guardar lo grabado" @click="props.exporter.stop()">■ parar</button>
  </div>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-20 flex items-end" @pointerdown.self="open = false">
      <div class="absolute inset-0 bg-black/50" @click="open = false" />
      <section class="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#121217] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm" @pointerdown.stop>
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <h2 class="mb-3 text-xs tracking-wide text-neutral-400 uppercase">{{ simple ? 'Mi reel' : 'Exportar vídeo' }}</h2>
        <p v-if="!supported" class="mb-3 text-amber-300">Este navegador no puede grabar vídeo con sonido.</p>
        <template v-else>
          <div v-if="!simple" class="mb-3 grid gap-3">
            <label class="flex items-center justify-between gap-3">Qué grabar
              <select v-model="what" class="rounded-lg border border-white/15 bg-black/30 px-3 py-2"><option value="cell">La célula actual</option><option value="song">La canción completa</option><option value="preview">La previsualización (se construye sola)</option></select>
            </label>
            <label v-if="what === 'cell'" class="flex items-center justify-between gap-3">Compases
              <select v-model.number="bars" class="rounded-lg border border-white/15 bg-black/30 px-3 py-2"><option :value="2">2</option><option :value="4">4</option><option :value="8">8</option></select>
            </label>
            <label class="flex items-center justify-between gap-3">Formato
              <select v-model="format" class="rounded-lg border border-white/15 bg-black/30 px-3 py-2"><option v-for="(l, f) in FORMAT_LABEL" :key="f" :value="f">{{ l }}</option></select>
            </label>
            <label class="flex items-center justify-between gap-3">Calidad
              <select v-model.number="size" class="rounded-lg border border-white/15 bg-black/30 px-3 py-2"><option :value="720">720 (ligero)</option><option :value="1080">1080</option></select>
            </label>
            <label class="flex items-center gap-3"><input v-model="mark" type="checkbox" /> Marca «coderbeats» discreta abajo</label>
          </div>
          <p class="mb-3 text-xs text-neutral-500">≈ {{ seconds.toFixed(0) }} s · ≈ {{ formatMB(props.exporter.estimate(seconds, size)) }} · empieza en la siguiente línea de compás; sale la pantalla sin botones y el audio de la app (no el micro).</p>
          <p v-if="state.phase === 'error'" class="mb-3 text-amber-300" role="alert">{{ state.message }}</p>
          <button class="w-full rounded-full bg-white px-4 py-3 font-medium text-black" @click="go">{{ simple ? '● Grabar mi reel' : '● Grabar' }}</button>
          <div v-if="state.phase === 'done'" class="mt-4 rounded-xl bg-white/5 p-3">
            <p class="mb-2 truncate text-white">{{ state.name }} · {{ formatMB(state.bytes) }}</p>
            <video :src="state.url" controls playsinline class="mb-2 max-h-60 w-full rounded-lg bg-black" />
            <div class="flex gap-2">
              <button class="flex-1 rounded-full border border-white/25 py-2" @click="props.exporter.save(false)">Guardar</button>
              <button class="flex-1 rounded-full border border-white/25 py-2" @click="props.exporter.save(true)">Compartir</button>
            </div>
          </div>
        </template>
      </section>
    </div>
  </Transition>
</template>

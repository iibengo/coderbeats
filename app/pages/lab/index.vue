<script setup lang="ts">
/**
 * Laboratorio de instrumentos: formas de tocar SIN micro, en pantallas pequeñas e independientes sobre el mismo motor.
 * No tocan lo guardado. Entrada: `/lab`.
 */
import { onBeforeUnmount } from 'vue'

definePageMeta({ ssr: false })
useHead({ title: 'Laboratorio · coderbeats' })

type Id = 'piano' | 'theremin' | 'layers' | 'dj' | 'circle'
const SCREENS: { id: Id; title: string; text: string }[] = [
  { id: 'piano', title: '1 · Piano mágico', text: 'cada toque, la siguiente nota de una melodía' },
  { id: 'theremin', title: '2 · Theremín', text: 'desliza el dedo: suena continuo y siempre en la escala' },
  { id: 'layers', title: '3 · Capas', text: 'base entera: enciende y apaga bombo, caja, platillo, bajo, acordes y melodía' },
  { id: 'dj', title: '4 · DJ', text: 'una canción sonando: el dedo mueve filtro y eco; platillo, subida y drop' },
  { id: 'circle', title: '5 · Círculo de ritmo', text: 'toca el círculo para poner y quitar golpes; cada instrumento forma su polígono' },
]
const screen = ref<Id | null>(null)
const engine = useAudioEngine()
const lab = useLab()
const busy = ref(false)
const error = ref('')
async function go(id: Id) {
  busy.value = true
  error.value = ''
  try {
    await lab.begin()
    screen.value = id
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
  }
}
function back() {
  engine.stopAll()
  screen.value = null
}
onBeforeUnmount(() => engine.stopAll())
</script>

<template>
  <LabPiano v-if="screen === 'piano'" @back="back" />
  <LabTheremin v-else-if="screen === 'theremin'" @back="back" />
  <LabLayers v-else-if="screen === 'layers'" @back="back" />
  <LabDj v-else-if="screen === 'dj'" @back="back" />
  <LabCircle v-else-if="screen === 'circle'" @back="back" />
  <main v-else class="mx-auto min-h-dvh max-w-xl bg-[#0a0a0d] px-4 py-8 text-white">
    <h1 class="mt-3 text-3xl font-medium tracking-tight">Laboratorio</h1>
    <p class="mt-1 text-white/60">Formas de tocar sin micro. Elige una; todas suenan con el motor de siempre.</p>
    <ul class="mt-6 grid gap-3">
      <li v-for="s in SCREENS" :key="s.id">
        <button class="w-full rounded-2xl border border-white/15 bg-white/5 p-4 text-left disabled:opacity-50" :disabled="busy" @click="go(s.id)">
          <div class="text-lg">{{ s.title }}</div>
          <div class="text-sm text-white/60">{{ s.text }}</div>
        </button>
      </li>
    </ul>
    <p v-if="error" class="mt-4 text-sm text-red-300">{{ error }}</p>
    <NuxtLink to="/estudio" class="mt-10 block text-center text-xs text-white/35 underline decoration-white/20">Estudio</NuxtLink>
  </main>
</template>

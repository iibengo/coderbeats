<script setup lang="ts">
/**
 * Laboratorio de instrumentos: formas de tocar SIN micro, en pantallas pequeñas e independientes sobre el mismo motor.
 * No tocan lo guardado. Entrada: `/lab`.
 */
import { onBeforeUnmount } from 'vue'

definePageMeta({ ssr: false })
useHead({ title: 'Laboratorio · coderbeats' })

type Id = 'capas' | 'piano' | 'coro' | 'circulo' | 'remixes'
const SCREENS: Id[] = ['capas', 'piano', 'coro', 'circulo', 'remixes']
const { t } = useI18n()
const route = useRoute()
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
// «▶ Tocar en el Laboratorio» desde el Estudio (`?remix=<id>`): directo a Remixes
onMounted(() => {
  if (route.query.remix !== undefined) void go('remixes')
})
</script>

<template>
  <LabCapas v-if="screen === 'capas'" @back="back" />
  <LabPiano v-else-if="screen === 'piano'" @back="back" />
  <LabCoro v-else-if="screen === 'coro'" @back="back" />
  <LabCirculo v-else-if="screen === 'circulo'" @back="back" />
  <LabRemix v-else-if="screen === 'remixes'" @back="back" />
  <main v-else class="mx-auto min-h-dvh max-w-xl bg-black px-4 py-8 text-white">
    <h1 class="mt-3 text-3xl font-medium tracking-tight">{{ t('lab.title') }}</h1>
    <p class="mt-1 text-white/60">{{ t('lab.intro') }}</p>
    <ul class="mt-6 grid gap-3">
      <li v-for="s in SCREENS" :key="s">
        <button class="w-full rounded-2xl border border-white/15 bg-white/5 p-4 text-left disabled:opacity-50" :disabled="busy" @click="go(s)">
          <div class="text-lg">{{ t(`lab.screens.${s}.title`) }}</div>
          <div class="text-sm text-white/60">{{ t(`lab.screens.${s}.text`) }}</div>
        </button>
      </li>
    </ul>
    <p v-if="error" class="mt-4 text-sm text-red-300">{{ error }}</p>
    <NuxtLink to="/estudio" class="mt-10 block text-center text-xs text-white/35 underline decoration-white/20">{{ t('app.estudio') }}</NuxtLink>
    <div class="mt-4 flex justify-center"><LangSwitch dark /></div>
  </main>
</template>

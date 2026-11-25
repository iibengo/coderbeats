<script setup lang="ts">
/**
 * Laboratorio de instrumentos: formas de tocar SIN micro, en pantallas pequeñas e independientes sobre el mismo motor.
 * No tocan lo guardado. Entrada: `/lab`.
 */
import { onBeforeUnmount } from 'vue'
import { ACCENT, VOICE_HEX } from '~/lib/palette'

definePageMeta({ ssr: false })
useHead({ title: 'coderbeats' })

type Id = 'capas' | 'piano' | 'coro' | 'circulo' | 'remixes'
// Remixes va primero (spec 050): es la pantalla más completa y la que invita a empezar
const SCREENS: Id[] = ['remixes', 'capas', 'piano', 'circulo', 'coro']
// el adelanto del Pulso en la tarjeta de Remixes: cinco barras quietas (nada se mueve sin música)
const PULSO_ICON = [55, 100, 38, 24, 72]
// Collage (spec 057): cada tarjeta lleva el color de su instrumento (VOICE_HEX) y un tamaño distinto
const INK = '#0B0B0F'
const TILE: Record<Id, { bg: string; cls: string; text: boolean }> = {
  remixes: { bg: ACCENT, cls: 'col-span-2 row-span-2', text: true },
  capas: { bg: VOICE_HEX.bass, cls: 'row-span-2', text: true },
  piano: { bg: VOICE_HEX.mel, cls: '', text: false },
  circulo: { bg: VOICE_HEX.bd, cls: '', text: false },
  coro: { bg: VOICE_HEX.hh, cls: 'col-span-2', text: true },
}
const { t } = useI18n()
const aboutOpen = ref(false)
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
    <h1 class="mt-3 text-3xl font-medium tracking-tight">coderbeats</h1>
    <p class="mt-3 text-white/60" data-lab-intro>{{ t('lab.intro') }}</p>
    <ul class="mt-6 grid auto-rows-[92px] grid-cols-2 gap-3" data-lab-collage>
      <li v-for="s in SCREENS" :key="s" :class="TILE[s].cls">
        <button
          class="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl p-4 text-left transition active:scale-[.98] disabled:opacity-50 motion-reduce:transition-none"
          :style="{ background: TILE[s].bg, color: INK }"
          :disabled="busy"
          :data-lab-remixes="s === 'remixes' ? '' : undefined"
          @click="go(s)"
        >
          <span class="block min-w-0">
            <span class="block font-medium leading-tight" :class="s === 'remixes' ? 'text-2xl' : 'text-lg'">{{ t(`lab.screens.${s}.title`) }}</span>
            <span v-if="TILE[s].text" class="mt-1 block text-xs leading-snug" :class="s === 'coro' ? 'line-clamp-2 pr-24' : 'line-clamp-3'" style="opacity: .7">{{ t(`lab.screens.${s}.text`) }}</span>
          </span>
          <svg v-if="s === 'remixes'" class="absolute bottom-4 right-4 h-16 w-24" viewBox="0 0 96 64" aria-hidden="true">
            <rect v-for="(h, i) in PULSO_ICON" :key="i" :x="i * 20" :y="64 - h * 0.64" width="14" :height="h * 0.64" rx="3" :fill="INK" />
          </svg>
          <svg v-else-if="s === 'capas'" class="h-10 w-10 self-end" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="4" y="5" width="32" height="8" rx="4" :fill="INK" /><rect x="4" y="16" width="24" height="8" rx="4" :fill="INK" opacity=".7" /><rect x="4" y="27" width="14" height="8" rx="4" :fill="INK" opacity=".45" />
          </svg>
          <svg v-else-if="s === 'piano'" class="absolute bottom-3 right-3 h-9 w-12" viewBox="0 0 48 36" aria-hidden="true">
            <rect x="1" y="1" width="46" height="34" rx="5" fill="none" :stroke="INK" stroke-width="3" />
            <path d="M16 3v30M32 3v30" :stroke="INK" stroke-width="3" /><rect x="11" y="3" width="10" height="16" rx="2" :fill="INK" /><rect x="27" y="3" width="10" height="16" rx="2" :fill="INK" />
          </svg>
          <svg v-else-if="s === 'circulo'" class="absolute bottom-3 right-3 h-10 w-10" viewBox="0 0 40 40" aria-hidden="true">
            <circle cx="20" cy="20" r="17" fill="none" :stroke="INK" stroke-width="3" /><circle cx="20" cy="20" r="9" fill="none" :stroke="INK" stroke-width="3" opacity=".6" />
            <circle cx="20" cy="3" r="3.5" :fill="INK" /><circle cx="37" cy="20" r="3.5" :fill="INK" /><circle cx="20" cy="20" r="3" :fill="INK" />
          </svg>
          <svg v-else class="absolute bottom-3 right-4 h-9 w-20" viewBox="0 0 80 36" aria-hidden="true">
            <circle cx="12" cy="24" r="9" :fill="INK" /><circle cx="40" cy="12" r="9" :fill="INK" opacity=".7" /><circle cx="68" cy="22" r="9" :fill="INK" opacity=".45" />
          </svg>
        </button>
      </li>
    </ul>
    <p v-if="error" class="mt-4 text-sm text-red-300">{{ error }}</p>
    <NuxtLink to="/estudio" class="mt-3 block rounded-2xl border border-white/25 p-4 transition active:scale-[.98] motion-reduce:transition-none" data-lab-estudio>
      <span class="block text-lg font-medium leading-tight">{{ t('app.estudio') }}</span>
      <span class="mt-1 block text-xs leading-snug text-white/60">{{ t('lab.studioText') }}</span>
    </NuxtLink>
    <div class="mt-4 flex justify-center"><LangSwitch dark compact /></div>
    <button class="mx-auto mt-2 block min-h-11 px-4 text-xs text-white/35 underline decoration-white/20" data-lab-about @click="aboutOpen = !aboutOpen">{{ t('app.about') }}</button>
    <Transition name="about">
      <div v-if="aboutOpen" class="fixed inset-0 z-20 flex items-end sm:items-center sm:justify-center" data-lab-about-sheet @keydown.esc="aboutOpen = false">
        <div class="absolute inset-0 bg-black/70" @click="aboutOpen = false" />
        <section role="dialog" aria-modal="true" :aria-label="t('app.about')" class="relative max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#121217] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:rounded-2xl">
          <div class="mb-3 flex items-center justify-between">
            <span class="h-1 w-10 rounded-full bg-white/20" />
            <button class="flex h-11 w-11 items-center justify-center text-white/60" :aria-label="t('start.close')" data-lab-about-close @click="aboutOpen = false">
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg>
            </button>
          </div>
          <AboutPanel />
        </section>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.about-enter-active,
.about-leave-active { transition: opacity 0.2s ease; }
.about-enter-from,
.about-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .about-enter-active,
  .about-leave-active { transition: opacity 0.1s linear; }
}
</style>

<script setup lang="ts">
type Screen = 'start' | 'latency' | 'sounds' | 'studio'

const screen = ref<Screen>('start')
const { data } = useCalibration()
const engine = useAudioEngine()

// sin calibración obligatoria (spec 001 §17): se empieza a tocar al instante con el modelo por defecto; latencia y sonidos son opcionales (⋯ o «¿te afino a tu voz?»)
function afterStart() {
  screen.value = 'studio'
}
function afterSounds() {
  if (data.value) engine.setCalibration(data.value)
  screen.value = 'studio'
}
function afterLatency() {
  screen.value = 'studio'
}
</script>

<template>
  <Studio v-if="screen === 'studio'" @recalibrate="(s) => (screen = s)" />
  <main v-else class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5">
    <header v-if="screen !== 'start'" class="mb-6 text-sm font-medium tracking-tight">coderbeats</header>
    <StartScreen v-if="screen === 'start'" @started="afterStart" />
    <LatencyStep v-else-if="screen === 'latency'" @done="afterLatency" />
    <SoundStep v-else-if="screen === 'sounds'" @done="afterSounds" />
  </main>
</template>

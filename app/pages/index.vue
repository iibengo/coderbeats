<script setup lang="ts">
type Screen = 'start' | 'latency' | 'sounds' | 'studio'

const screen = ref<Screen>('start')
const { hasLatency, hasSamples, data } = useCalibration()
const engine = useAudioEngine()

function afterStart() {
  screen.value = !hasLatency.value ? 'latency' : !hasSamples.value ? 'sounds' : 'studio'
}
function afterSounds() {
  if (data.value) engine.setCalibration(data.value)
  screen.value = 'studio'
}
function afterLatency() {
  screen.value = hasSamples.value ? 'studio' : 'sounds'
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

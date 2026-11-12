<script setup lang="ts">
type Screen = 'start' | 'latency' | 'sounds' | 'studio'

const screen = ref<Screen>('start')
const { hasLatency, hasSamples } = useCalibration()

function afterStart() {
  screen.value = !hasLatency.value ? 'latency' : !hasSamples.value ? 'sounds' : 'studio'
}
function afterLatency() {
  screen.value = hasSamples.value ? 'studio' : 'sounds'
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6">
    <header v-if="screen !== 'start'" class="mb-6 text-sm font-medium tracking-tight">coderbeats</header>
    <StartScreen v-if="screen === 'start'" @started="afterStart" />
    <LatencyStep v-else-if="screen === 'latency'" @done="afterLatency" />
    <SoundStep v-else-if="screen === 'sounds'" @done="screen = 'studio'" />
    <Studio v-else @recalibrate="(s) => (screen = s)" />
  </main>
</template>

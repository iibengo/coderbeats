<script setup lang="ts">
type Screen = 'start' | 'latency' | 'sounds' | 'portada' | 'studio'

const screen = ref<Screen>('start')
const { data } = useCalibration()
const engine = useAudioEngine()
const ui = useUi()
/** a dónde se vuelve tras el inicio y los pasos opcionales: la portada, o el Estudio si es lo que se eligió la última vez (spec 016 §9.5) */
const home = (): Screen => (ui.state.ui === 'estudio' ? 'studio' : 'portada')

// sin calibración obligatoria (spec 001 §17): se empieza a tocar al instante con el modelo por defecto; latencia y sonidos son opcionales (⋯ o «¿te afino a tu voz?»)
function afterStart() {
  screen.value = home()
}
function afterSounds() {
  if (data.value) engine.setCalibration(data.value)
  screen.value = home()
}
function afterLatency() {
  screen.value = home()
}
</script>

<template>
  <Portada v-if="screen === 'portada'" @recalibrate="(s) => (screen = s)" @estudio="screen = 'studio'" />
  <Studio v-else-if="screen === 'studio'" @recalibrate="(s) => (screen = s)" @simple="(ui.setUi('simple'), (screen = 'portada'))" />
  <main v-else class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5">
    <header v-if="screen !== 'start'" class="mb-6 text-sm font-medium tracking-tight">coderbeats</header>
    <StartScreen v-if="screen === 'start'" @started="afterStart" />
    <LatencyStep v-else-if="screen === 'latency'" @done="afterLatency" />
    <SoundStep v-else-if="screen === 'sounds'" @done="afterSounds" />
  </main>
</template>

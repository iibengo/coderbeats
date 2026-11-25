<script setup lang="ts">
type Screen = 'start' | 'latency' | 'sounds' | 'portada' | 'studio'

// si ya hay audio en marcha (venimos del Laboratorio con «Abrir en el Estudio») se entra directo
const screen = ref<Screen>(useAudioEngine().ready.value && useRoute().query.abrir !== undefined ? 'studio' : 'start')
const { data } = useCalibration()
const engine = useAudioEngine()
const route = useRoute()
/**
 * El Estudio (spec 017 §3): la app de antes, congelada. Tras el inicio se vuelve siempre a él. La portada (spec 016) está pausada: solo se abre con `?portada`
 * (los guiones de prueba). La preferencia `coderbeats:ui:v1` ya no manda en el arranque y no se reescribe.
 */
const home = (): Screen => (route.query.portada !== undefined ? 'portada' : 'studio')

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
  <Studio v-else-if="screen === 'studio'" @recalibrate="(s) => (screen = s)" />
  <main v-else class="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5">
    <header v-if="screen !== 'start'" class="mb-6 text-sm font-medium tracking-tight">coderbeats</header>
    <StartScreen v-if="screen === 'start'" @started="afterStart" />
    <LatencyStep v-else-if="screen === 'latency'" @done="afterLatency" />
    <SoundStep v-else-if="screen === 'sounds'" @done="afterSounds" />
  </main>
</template>

<script setup lang="ts">
const emit = defineEmits<{ started: [] }>()
const { start } = useAudioEngine()
const { data } = useCalibration()
const busy = ref(false)
const about = ref(false)
const error = ref<string | null>(null)
const secure = import.meta.client ? window.isSecureContext : true

async function onStart() {
  busy.value = true
  error.value = null
  try {
    await start(data.value)
    emit('started')
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    error.value =
      name === 'NotAllowedError'
        ? 'Permiso de micro denegado. Actívalo en los ajustes del navegador para esta web y vuelve a intentarlo.'
        : name === 'NotFoundError'
          ? 'No se ha encontrado ningún micro.'
          : `No se pudo iniciar el audio: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="flex flex-1 flex-col items-center justify-center gap-8 text-center">
    <div>
      <h1 class="text-4xl font-medium tracking-tight">coderbeats</h1>
      <p class="mt-2 text-neutral-400">Tu beatbox, convertido en batería y en código Strudel.</p>
    </div>
    <button
      class="rounded-full bg-white px-8 py-3 font-medium text-black transition active:scale-[.98] disabled:opacity-50"
      :disabled="busy || !secure"
      @click="onStart"
    >
      {{ busy ? 'Comprobando audio…' : 'Empezar' }}
    </button>
    <p v-if="!secure" class="max-w-sm text-sm text-amber-300">
      El micro solo funciona con HTTPS o en localhost. Abre la web con https://
    </p>
    <p v-if="error" class="max-w-sm text-sm text-red-300">{{ error }}</p>
    <p class="max-w-xs text-xs text-neutral-500">
      Mejor con cascos con cable.
    </p>
    <button class="text-xs text-neutral-500 underline underline-offset-4" @click="about = !about">{{ about ? 'Cerrar' : 'Acerca de' }}</button>
    <div v-if="about" class="max-h-[40dvh] max-w-sm overflow-y-auto text-left"><AboutPanel /></div>
  </section>
</template>

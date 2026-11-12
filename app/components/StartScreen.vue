<script setup lang="ts">
const emit = defineEmits<{ started: [] }>()
const { start } = useAudioEngine()
const busy = ref(false)
const error = ref<string | null>(null)
const secure = import.meta.client ? window.isSecureContext : true

async function onStart() {
  busy.value = true
  error.value = null
  try {
    await start()
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
      {{ busy ? 'Iniciando…' : 'Empezar' }}
    </button>
    <p v-if="!secure" class="max-w-sm text-sm text-amber-300">
      El micro solo funciona con HTTPS o en localhost. Abre la web con https://
    </p>
    <p v-if="error" class="max-w-sm text-sm text-red-300">{{ error }}</p>
    <p class="max-w-xs text-xs text-neutral-500">
      Usa cascos con cable: el Bluetooth añade latencia y el metrónomo no debe entrar por el micro.
    </p>
  </section>
</template>

<script setup lang="ts">
const emit = defineEmits<{ started: [] }>()
const engine = useAudioEngine()
const { t } = useI18n()
const { start } = engine
const { data } = useCalibration()
const busy = ref(false)
const about = ref(false)
const error = ref<string | null>(null)
const secure = import.meta.client ? window.isSecureContext : true

const canSkipMic = ref(false)

async function onStart(noMic = false) {
  busy.value = true
  error.value = null
  try {
    await start(data.value, { noMic })
    // sin micro no hay nada que oír: arranca una demo para tener algo que tocar con el dedo
    if (noMic) await engine.loadDemo()
    emit('started')
  } catch (e) {
    const name = e instanceof DOMException ? e.name : ''
    canSkipMic.value = name === 'NotAllowedError' || name === 'NotFoundError'
    error.value =
      name === 'NotAllowedError'
        ? t('start.denied')
        : name === 'NotFoundError'
          ? t('start.noMic')
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
      <p class="mt-2 text-neutral-400">{{ t('start.tagline') }}</p>
    </div>
    <!-- sin micro por defecto (spec 022): el micro es opcional y se pide solo si lo eliges -->
    <button
      class="rounded-full bg-white px-8 py-3 font-medium text-black transition active:scale-[.98] disabled:opacity-50"
      :disabled="busy"
      @click="onStart(true)"
    >
      {{ busy ? t('start.wait') : t('start.start') }}
    </button>
    <button class="rounded-full border border-white/20 px-5 py-2 text-sm text-white/80" :disabled="busy || !secure" data-start-mic @click="onStart(false)">{{ t('start.mic') }}</button>
    <p v-if="!secure" class="max-w-sm text-sm text-amber-300">{{ t('start.secure') }}</p>
    <p v-if="error" class="max-w-sm text-sm text-red-300">{{ error }}</p>
    <p class="max-w-xs text-xs text-neutral-500">{{ t('start.withMic') }}</p>
    <button class="text-xs text-neutral-500 underline underline-offset-4" @click="about = !about">{{ about ? t('start.close') : t('start.about') }}</button>
    <LangSwitch />
    <div v-if="about" class="max-h-[40dvh] max-w-sm overflow-y-auto text-left"><AboutPanel /></div>
  </section>
</template>

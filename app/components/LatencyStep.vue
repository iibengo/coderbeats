<script setup lang="ts">
import { RECORD_BPM } from '~/lib/constants'
import { measureLatency, type LatencyResult } from '~/lib/latency'
import { detectOnsets } from '~/lib/onsets'

const emit = defineEmits<{ done: [] }>()
const { recordTake, sampleRate } = useAudioEngine()
const { saveLatency, data } = useCalibration()

const running = ref(false)
const beat = ref<number | null>(null)
const result = ref<LatencyResult | null>(null)

async function run() {
  running.value = true
  result.value = null
  try {
    const take = await recordTake({
      bpm: RECORD_BPM,
      countInBeats: 4,
      recordBeats: 4,
      onBeat: (b) => (beat.value = b),
    })
    const onsets = detectOnsets(take.buffer, take.sampleRate).map((o) => o.time)
    result.value = measureLatency(take.clickTimes, onsets)
    if (result.value.valid)
      saveLatency(
        { ms: result.value.latencyMs, spreadMs: result.value.spreadMs, measuredAt: new Date().toISOString() },
        sampleRate(),
      )
  } finally {
    running.value = false
    beat.value = null
  }
}

const label = computed(() => {
  if (beat.value === null) return ''
  return beat.value < 0 ? `${-beat.value}` : '👏'
})
</script>

<template>
  <section class="flex flex-1 flex-col justify-center gap-6">
    <div>
      <p class="text-xs uppercase tracking-widest text-neutral-500">Paso 1 de 2</p>
      <h2 class="mt-1 text-2xl font-medium">Latencia</h2>
      <p class="mt-2 text-neutral-400">
        Con los cascos puestos: escucharás 4 clics de cuenta atrás. Después da
        <strong class="text-white">4 palmadas</strong>, una con cada clic.
      </p>
    </div>

    <div class="flex h-24 items-center justify-center text-6xl font-light tabular-nums">{{ label }}</div>
    <LevelMeter />

    <div v-if="result" class="rounded-lg border border-white/10 p-4 text-sm">
      <template v-if="result.valid">
        <p>
          Latencia: <strong>{{ result.latencyMs.toFixed(0) }} ms</strong>
          <span class="text-neutral-500">
            (media {{ result.meanMs.toFixed(0) }} ms, dispersión {{ result.spreadMs.toFixed(0) }} ms)
          </span>
        </p>
        <p v-if="result.latencyMs > 150" class="mt-2 text-amber-300">
          Es mucha latencia: ¿estás usando cascos Bluetooth? Con cable irá mejor.
        </p>
      </template>
      <p v-else class="text-amber-300">
        {{
          result.reason === 'too-few'
            ? `Solo he oído ${result.matched} palmada(s). Da 4, una con cada clic, y algo más fuerte.`
            : `Las palmadas variaron ${result.spreadMs.toFixed(0)} ms entre sí. Intenta ir más a tiempo.`
        }}
      </p>
    </div>

    <div class="flex gap-3">
      <button
        class="flex-1 rounded-full bg-white py-3 font-medium text-black disabled:opacity-50"
        :disabled="running"
        @click="run"
      >
        {{ running ? 'Escuchando…' : result ? 'Repetir' : 'Empezar' }}
      </button>
      <button
        v-if="data?.latency"
        class="flex-1 rounded-full border border-white/20 py-3 disabled:opacity-50"
        :disabled="running"
        @click="emit('done')"
      >
        Siguiente
      </button>
    </div>
  </section>
</template>

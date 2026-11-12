<script setup lang="ts">
import { analyzeTake, type AnalyzeResult } from '~/lib/analyze'
import { INSTRUMENT_LABELS, KIT_ORDER, KITS, RECORD_BARS, RECORD_BPM, sixteenthSeconds, STYLES } from '~/lib/constants'
import { hitCount } from '~/lib/quantize'
import { generateStrudel } from '~/lib/strudel'
import type { Instrument, StyleId } from '~/lib/types'

const emit = defineEmits<{ recalibrate: ['latency' | 'sounds'] }>()
const engine = useAudioEngine()
const { pattern, playing, currentStep, kit } = engine
const calibration = useCalibration()

const style = ref<StyleId>('hiphop90')
const phase = ref<'idle' | 'warning' | 'recording' | 'analyzing'>('idle')
const beat = ref<number | null>(null)
const lastResult = shallowRef<AnalyzeResult | null>(null)
const message = ref<string | null>(null)
const copied = ref(false)
const hideWarning = ref(false)

const bpm = computed(() => STYLES[style.value].bpm)
const code = computed(() =>
  pattern.value ? generateStrudel(pattern.value, { bpm: bpm.value, bank: KITS[kit.value].strudelBank }) : '',
)
const sampleRateMismatch = computed(
  () => !!calibration.data.value && engine.sampleRate() !== calibration.data.value.sampleRate,
)

watch(bpm, (b) => engine.setBpm(b))

function askRecord() {
  if (hideWarning.value) void record()
  else phase.value = 'warning'
}

async function record() {
  const classifier = calibration.classifier.value
  if (!classifier) return emit('recalibrate', 'sounds')
  engine.stop()
  message.value = null
  phase.value = 'recording'
  try {
    const take = await engine.recordTake({
      bpm: RECORD_BPM,
      countInBeats: 4,
      recordBeats: RECORD_BARS * 4,
      onBeat: (b) => (beat.value = b),
    })
    phase.value = 'analyzing'
    await nextTick()
    const result = analyzeTake(take.buffer, take.sampleRate, classifier, {
      t0: take.t0,
      latency: (calibration.data.value?.latency?.ms ?? 0) / 1000,
      stepSeconds: sixteenthSeconds(RECORD_BPM),
      bars: RECORD_BARS,
    })
    lastResult.value = result
    if (hitCount(result.pattern) === 0) {
      message.value = 'No he detectado ningún golpe. Prueba otra vez, más cerca del micro.'
      return
    }
    engine.setPattern(result.pattern)
    engine.play(bpm.value)
  } finally {
    phase.value = 'idle'
    beat.value = null
  }
}

function togglePlay() {
  if (playing.value) engine.stop()
  else engine.play(bpm.value)
}

async function copy() {
  try {
    await navigator.clipboard.writeText(code.value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = code.value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const cellColor: Record<Instrument, string> = { bd: 'bg-bd', sd: 'bg-sd', hh: 'bg-hh' }
const recordLabel = computed(() => {
  if (beat.value === null) return 'Preparando…'
  if (beat.value < 0) return `${-beat.value}`
  return `Compás ${Math.floor(beat.value / 4) + 1}/${RECORD_BARS} · ${(beat.value % 4) + 1}`
})
</script>

<template>
  <section class="flex flex-1 flex-col gap-5">
    <!-- Kit y estilo -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-1">
        <button
          v-for="k in KIT_ORDER"
          :key="k"
          class="rounded-full px-3 py-1 text-sm"
          :class="kit === k ? 'bg-white text-black' : 'text-neutral-400'"
          @click="engine.setKit(k)"
        >
          {{ KITS[k].label }}
        </button>
      </div>
      <div class="flex gap-1">
        <button
          v-for="s in Object.values(STYLES)"
          :key="s.id"
          class="rounded-full px-3 py-1 text-sm"
          :class="style === s.id ? 'bg-white text-black' : 'text-neutral-400'"
          :disabled="phase !== 'idle'"
          @click="style = s.id"
        >
          {{ s.label }} <span class="opacity-60">{{ s.bpm }}</span>
        </button>
      </div>
    </div>

    <!-- Rejilla 4 × 16 -->
    <div class="space-y-1.5">
      <div v-for="bar in RECORD_BARS" :key="bar" class="grid grid-cols-16 gap-1">
        <div
          v-for="s in 16"
          :key="s"
          class="aspect-square rounded-sm transition-transform duration-100"
          :class="[
            pattern?.steps[(bar - 1) * 16 + s - 1]
              ? cellColor[pattern.steps[(bar - 1) * 16 + s - 1]!]
              : (s - 1) % 4 === 0
                ? 'bg-white/15'
                : 'bg-white/5',
            currentStep === (bar - 1) * 16 + s - 1 ? 'scale-110 ring-1 ring-white' : '',
          ]"
        />
      </div>
      <p class="flex gap-4 pt-1 text-xs text-neutral-500">
        <span v-for="i in ['bd', 'sd', 'hh'] as Instrument[]" :key="i" class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full" :class="cellColor[i]" /> {{ INSTRUMENT_LABELS[i].name }}
        </span>
      </p>
    </div>

    <!-- Grabación -->
    <div v-if="phase === 'warning'" class="rounded-lg border border-white/20 p-4 text-sm">
      <p>🎧 Ponte los cascos (mejor con cable). El metrónomo no debe entrar por el micro.</p>
      <p class="mt-1 text-neutral-400">1 compás de cuenta atrás y 4 de grabación a {{ RECORD_BPM }} BPM.</p>
      <label class="mt-3 flex items-center gap-2 text-neutral-400">
        <input v-model="hideWarning" type="checkbox" /> No volver a mostrar
      </label>
      <div class="mt-3 flex gap-2">
        <button class="flex-1 rounded-full bg-white py-2 font-medium text-black" @click="record">Grabar</button>
        <button class="rounded-full border border-white/20 px-4 py-2" @click="phase = 'idle'">Cancelar</button>
      </div>
    </div>

    <div v-else-if="phase === 'recording' || phase === 'analyzing'" class="space-y-3 text-center">
      <p class="text-4xl font-light tabular-nums">{{ phase === 'analyzing' ? 'Analizando…' : recordLabel }}</p>
      <LevelMeter />
    </div>

    <div v-else class="flex gap-3">
      <button
        class="flex-1 rounded-full py-3 font-medium"
        :class="pattern ? 'border border-white/20' : 'bg-white text-black'"
        @click="askRecord"
      >
        {{ pattern ? 'Regrabar' : '● Grabar' }}
      </button>
      <button
        v-if="pattern"
        class="flex-1 rounded-full bg-white py-3 font-medium text-black"
        @click="togglePlay"
      >
        {{ playing ? '■ Stop' : '▶ Play' }}
      </button>
    </div>

    <p v-if="message" class="text-sm text-amber-300">{{ message }}</p>
    <p v-if="sampleRateMismatch" class="text-xs text-amber-300">
      La frecuencia de muestreo ha cambiado desde la calibración ({{ calibration.data.value?.sampleRate }} →
      {{ engine.sampleRate() }} Hz). Si clasifica mal, recalibra los sonidos.
    </p>

    <!-- Código -->
    <div v-if="code" class="rounded-lg border border-white/10 bg-white/[.03]">
      <div class="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-neutral-500">
        <span>Strudel</span>
        <button class="text-white" @click="copy">{{ copied ? 'Copiado' : 'Copiar' }}</button>
      </div>
      <pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-neutral-300">{{ code }}</pre>
    </div>

    <!-- Diagnóstico (fase A, para ajustar con tu voz) -->
    <details v-if="lastResult" class="text-xs text-neutral-500">
      <summary class="cursor-pointer">
        Diagnóstico: {{ lastResult.onsets.length }} onsets, {{ hitCount(lastResult.pattern) }} en la rejilla,
        {{ lastResult.hits.filter((h) => h.instrument === 'unknown').length }} desconocidos · latencia
        {{ calibration.data.value?.latency?.ms.toFixed(0) ?? 0 }} ms
      </summary>
      <table class="mt-2 w-full tabular-nums">
        <thead>
          <tr class="text-left">
            <th>t (s)</th>
            <th>sonido</th>
            <th>confianza</th>
            <th>fuerza</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(h, i) in lastResult.hits" :key="i">
            <td>{{ h.onset.time.toFixed(3) }}</td>
            <td>{{ h.instrument === 'unknown' ? '?' : INSTRUMENT_LABELS[h.instrument].vocal }}</td>
            <td>{{ (h.confidence * 100).toFixed(0) }} %</td>
            <td>{{ h.onset.strength.toFixed(3) }}</td>
          </tr>
        </tbody>
      </table>
    </details>

    <div class="mt-auto flex gap-4 pt-4 text-xs text-neutral-500">
      <button class="underline-offset-4 hover:underline" @click="emit('recalibrate', 'latency')">Recalibrar latencia</button>
      <button class="underline-offset-4 hover:underline" @click="emit('recalibrate', 'sounds')">Recalibrar sonidos</button>
    </div>
  </section>
</template>

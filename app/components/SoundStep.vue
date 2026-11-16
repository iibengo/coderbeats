<script setup lang="ts">
import { strongestOnset } from '~/lib/analyze'
import { KnnClassifier } from '~/lib/classifier'
import { INSTRUMENT_LABELS, INSTRUMENTS, TAKES_PER_INSTRUMENT } from '~/lib/constants'
import { extractFeatures } from '~/lib/features'
import type { CalibrationSample, Instrument } from '~/lib/types'

const emit = defineEmits<{ done: [] }>()
const { captureWindow, sampleRate } = useAudioEngine()
const { saveSamples } = useCalibration()

const samples = ref<CalibrationSample[]>([])
const current = ref<Instrument>('bd')
const listening = ref(false)
const missed = ref(false)
const accuracy = ref<{ accuracy: number; perInstrument: Record<Instrument, number> } | null>(null)

const countFor = (i: Instrument) => samples.value.filter((s) => s.instrument === i).length
const complete = computed(() => INSTRUMENTS.every((i) => countFor(i) >= TAKES_PER_INSTRUMENT))

async function take() {
  listening.value = true
  missed.value = false
  try {
    const { buffer, sampleRate: sr } = await captureWindow(1.5)
    const onset = strongestOnset(buffer, sr)
    if (!onset) {
      missed.value = true
      return
    }
    samples.value = [
      ...samples.value,
      { instrument: current.value, features: extractFeatures(buffer, sr, onset.time * sr) },
    ]
    if (countFor(current.value) >= TAKES_PER_INSTRUMENT) {
      const next = INSTRUMENTS.find((i) => countFor(i) < TAKES_PER_INSTRUMENT)
      if (next) current.value = next
      else finish()
    }
  } finally {
    listening.value = false
  }
}

function finish() {
  accuracy.value = new KnnClassifier(samples.value).leaveOneOut(samples.value)
}

function redo(i: Instrument) {
  samples.value = samples.value.filter((s) => s.instrument !== i)
  current.value = i
  accuracy.value = null
}

function save() {
  saveSamples(samples.value, sampleRate())
  emit('done')
}

const worst = computed(() => {
  if (!accuracy.value) return null
  return INSTRUMENTS.reduce((a, b) => (accuracy.value!.perInstrument[b] < accuracy.value!.perInstrument[a] ? b : a))
})
const dotColor: Record<Instrument, string> = { bd: 'bg-bd', sd: 'bg-sd', hh: 'bg-hh' }
</script>

<template>
  <section class="flex flex-1 flex-col justify-center gap-6">
    <div>
      <p class="text-xs uppercase tracking-widest text-neutral-500">Paso 2 de 2</p>
      <h2 class="mt-1 text-2xl font-medium">Tus sonidos</h2>
      <p class="mt-2 text-neutral-400">
        Pulsa y haz cada sonido, {{ TAKES_PER_INSTRUMENT }} veces.
      </p>
    </div>

    <ul class="grid grid-cols-3 gap-3">
      <li
        v-for="i in INSTRUMENTS"
        :key="i"
        class="rounded-lg border p-3 text-center"
        :class="i === current && !complete ? 'border-white/60' : 'border-white/10'"
      >
        <p class="text-lg">“{{ INSTRUMENT_LABELS[i].vocal }}”</p>
        <p class="text-xs text-neutral-500">{{ INSTRUMENT_LABELS[i].name }}</p>
        <div class="mt-2 flex justify-center gap-1">
          <span
            v-for="n in TAKES_PER_INSTRUMENT"
            :key="n"
            class="h-2 w-2 rounded-full"
            :class="n <= countFor(i) ? dotColor[i] : 'bg-white/10'"
          />
        </div>
      </li>
    </ul>

    <LevelMeter />

    <template v-if="!complete">
      <p v-if="missed" class="text-sm text-amber-300">No te he oído. Prueba un poco más fuerte o más cerca.</p>
      <button
        class="rounded-full bg-white py-4 text-lg font-medium text-black disabled:opacity-60"
        :disabled="listening"
        @click="take"
      >
        {{ listening ? '¡Ahora!' : `Grabar “${INSTRUMENT_LABELS[current].vocal}” (${countFor(current) + 1}/${TAKES_PER_INSTRUMENT})` }}
      </button>
    </template>

    <div v-else-if="accuracy" class="space-y-4">
      <div class="rounded-lg border border-white/10 p-4 text-sm">
        <p>
          Acierto: <strong>{{ Math.round(accuracy.accuracy * 100) }} %</strong>
        </p>
        <p class="mt-1 text-neutral-500">
          <span v-for="i in INSTRUMENTS" :key="i" class="mr-3">
            {{ INSTRUMENT_LABELS[i].vocal }} {{ Math.round(accuracy.perInstrument[i] * 100) }} %
          </span>
        </p>
        <p v-if="accuracy.accuracy < 0.8 && worst" class="mt-2 text-amber-300">
          “{{ INSTRUMENT_LABELS[worst].vocal }}” se confunde con otro sonido. Exagera la diferencia y repítelo.
        </p>
      </div>
      <div class="flex gap-3">
        <button v-if="worst" class="flex-1 rounded-full border border-white/20 py-3" @click="redo(worst)">
          Repetir “{{ INSTRUMENT_LABELS[worst].vocal }}”
        </button>
        <button class="flex-1 rounded-full bg-white py-3 font-medium text-black" @click="save">Guardar</button>
      </div>
    </div>
  </section>
</template>

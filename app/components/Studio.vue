<script setup lang="ts">
import { INSTRUMENT_LABELS, KIT_ORDER, KITS, STYLES } from '~/lib/constants'
import { clearLoop, hasHitsInBar2, hitTotal, setBars, undoLayer, type LoopBars } from '~/lib/looper'
import { loopToStrudel } from '~/lib/strudel'
import type { Instrument, StyleId } from '~/lib/types'
import { encodeWav } from '~/lib/wav'

const emit = defineEmits<{ recalibrate: ['latency' | 'sounds'] }>()
const engine = useAudioEngine()
const { loop, playing, countingIn, overdub, metronome, currentStep, currentLap, kit, echo, events, lastTake } = engine
const calibration = useCalibration()

const style = ref<StyleId>('hiphop90')
const copied = ref(false)
const isDev = import.meta.dev

const settings = computed(() => ({
  bpm: STYLES[style.value].bpm,
  quantizeEvery: STYLES[style.value].quantizeEvery,
  latency: (calibration.data.value?.latency?.ms ?? 0) / 1000,
}))
const code = computed(() => loopToStrudel(loop.value, { bpm: settings.value.bpm, bank: KITS[kit.value].strudelBank }))
const sampleRateMismatch = computed(
  () => !!calibration.data.value && engine.sampleRate() !== calibration.data.value.sampleRate,
)

// Rejilla: por paso, instrumentos sonando (activos) y pendientes (suenan desde la próxima vuelta)
const cells = computed(() => {
  const total = loop.value.bars * 16
  const out = Array.from({ length: total }, () => ({ active: [] as Instrument[], pending: [] as Instrument[] }))
  for (const l of loop.value.layers)
    for (const h of l.hits) {
      const c = out[h.step]!
      const list = h.activeFromLap <= currentLap.value || !playing.value ? c.active : c.pending
      if (!c.active.includes(h.instrument) && !c.pending.includes(h.instrument)) list.push(h.instrument)
    }
  return out
})

// Destello de las líneas de código que cambian
const flashLines = ref(new Set<number>())
watch(code, (next, prev) => {
  const a = next.split('\n')
  const b = (prev ?? '').split('\n')
  const changed = new Set(a.map((l, i) => (l !== b[i] ? i : -1)).filter((i) => i >= 0))
  flashLines.value = changed
  setTimeout(() => {
    if (flashLines.value === changed) flashLines.value = new Set()
  }, 600)
})

function restartIfPlaying() {
  if (playing.value) {
    const wasOverdub = overdub.value
    engine.play(settings.value)
    overdub.value = wasOverdub
  }
}

watch(style, restartIfPlaying)

function changeBars(bars: LoopBars) {
  if (bars === loop.value.bars) return
  if (bars === 1 && hasHitsInBar2(loop.value) && !confirm('El segundo compás tiene golpes. ¿Descartarlos?')) return
  engine.setLoop(setBars(loop.value, bars))
  restartIfPlaying()
}

function togglePlay() {
  if (playing.value) engine.stop()
  else engine.play(settings.value)
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

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadTake() {
  const t = lastTake.value
  if (!t) return
  const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '')
  download(`coderbeats-${stamp}.take.wav`, encodeWav(t.buffer, t.sampleRate), 'audio/wav')
  const meta = {
    sampleRate: t.sampleRate,
    /** tiempo de contexto de la primera muestra del WAV */
    startTime: t.startTime,
    anchor: t.anchor,
    settings: t.settings,
    style: style.value,
    loop: loop.value,
    events: t.events,
  }
  download(`coderbeats-${stamp}.take.json`, JSON.stringify(meta, null, 2), 'application/json')
}

const fill: Record<Instrument, string> = { bd: 'bg-bd', sd: 'bg-sd', hh: 'bg-hh' }
const outline: Record<Instrument, string> = { bd: 'border-bd', sd: 'border-sd', hh: 'border-hh' }
const resultLabel: Record<string, string> = {
  added: 'añadido',
  duplicate: 'ya estaba',
  replaced: 'sustituye',
  weaker: 'más flojo',
  'out-of-range': 'cuenta atrás',
  echo: 'eco',
  unknown: '?',
  paused: 'sin grabar',
}
</script>

<template>
  <section class="flex flex-1 flex-col gap-4">
    <!-- Kit, estilo y compases -->
    <div class="flex flex-wrap items-center justify-between gap-2">
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
          v-for="b in [1, 2] as LoopBars[]"
          :key="b"
          class="rounded-full px-3 py-1 text-sm disabled:opacity-40"
          :class="loop.bars === b ? 'bg-white text-black' : 'text-neutral-400'"
          :disabled="overdub"
          @click="changeBars(b)"
        >
          {{ b }} {{ b === 1 ? 'compás' : 'compases' }}
        </button>
      </div>
    </div>
    <div class="flex flex-wrap gap-1">
      <button
        v-for="s in Object.values(STYLES)"
        :key="s.id"
        class="rounded-full px-3 py-1 text-sm"
        :class="style === s.id ? 'bg-white text-black' : 'text-neutral-400'"
        @click="style = s.id"
      >
        {{ s.label }} <span class="opacity-60">{{ s.bpm }}</span>
      </button>
    </div>

    <!-- Rejilla en vivo -->
    <div class="space-y-1.5">
      <div v-for="bar in loop.bars" :key="bar" class="grid grid-cols-16 gap-1">
        <div
          v-for="s in 16"
          :key="s"
          class="relative flex aspect-square flex-col gap-px overflow-hidden rounded-sm p-px transition-transform duration-100"
          :class="[
            (s - 1) % 4 === 0 ? 'bg-white/15' : 'bg-white/5',
            playing && currentStep === (bar - 1) * 16 + s - 1 ? 'scale-110 ring-1 ring-white' : '',
          ]"
        >
          <span
            v-for="i in cells[(bar - 1) * 16 + s - 1]!.active"
            :key="'a' + i"
            class="flex-1 rounded-[1px]"
            :class="fill[i]"
          />
          <span
            v-for="i in cells[(bar - 1) * 16 + s - 1]!.pending"
            :key="'p' + i"
            class="flex-1 rounded-[1px] border"
            :class="outline[i]"
          />
        </div>
      </div>
      <p class="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-neutral-500">
        <span v-for="i in ['bd', 'sd', 'hh'] as Instrument[]" :key="i" class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full" :class="fill[i]" /> {{ INSTRUMENT_LABELS[i].name }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full border border-white/60" /> pendiente
        </span>
        <span v-if="playing" class="ml-auto tabular-nums">
          vuelta {{ currentLap + 1 }} · {{ hitTotal(loop) }} golpes · {{ loop.layers.length }} capas
        </span>
      </p>
    </div>

    <!-- Transporte -->
    <div class="grid grid-cols-3 gap-2">
      <button class="rounded-full bg-white py-3 font-medium text-black" @click="togglePlay">
        {{ playing ? '■ Stop' : '▶ Play' }}
      </button>
      <button
        class="rounded-full py-3 font-medium"
        :class="overdub ? 'bg-white/20 text-white ring-1 ring-white' : 'border border-white/30'"
        @click="engine.toggleOverdub(settings)"
      >
        {{ countingIn ? 'Cuenta…' : overdub ? '● Grabando' : '● Grabar' }}
      </button>
      <button
        class="rounded-full border py-3 text-sm"
        :class="metronome ? 'border-white/60' : 'border-white/15 text-neutral-500'"
        @click="metronome = !metronome"
      >
        Metrónomo {{ metronome ? 'sí' : 'no' }}
      </button>
    </div>
    <div class="flex gap-2 text-sm">
      <button
        class="flex-1 rounded-full border border-white/15 py-2 disabled:opacity-40"
        :disabled="!loop.layers.length"
        @click="engine.setLoop(undoLayer(loop))"
      >
        Deshacer capa
      </button>
      <button
        class="flex-1 rounded-full border border-white/15 py-2 disabled:opacity-40"
        :disabled="!loop.layers.length"
        @click="engine.setLoop(clearLoop(loop))"
      >
        Borrar todo
      </button>
    </div>

    <p v-if="echo?.bleed" class="text-xs text-amber-300">
      El micro oye los altavoces ({{ (echo.roundTrip * 1000).toFixed(0) }} ms de ida y vuelta). Usa cascos. Filtro de
      eco activado y metrónomo apagado por defecto.
    </p>
    <p v-if="sampleRateMismatch" class="text-xs text-amber-300">
      La frecuencia de muestreo ha cambiado desde la calibración ({{ calibration.data.value?.sampleRate }} →
      {{ engine.sampleRate() }} Hz). Si clasifica mal, recalibra los sonidos.
    </p>

    <!-- Código en vivo -->
    <div class="rounded-lg border border-white/10 bg-white/[.03]">
      <div class="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-neutral-500">
        <span>Strudel</span>
        <button class="text-white" @click="copy">{{ copied ? 'Copiado' : 'Copiar' }}</button>
      </div>
      <pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-neutral-300"><span
        v-for="(line, i) in code.split('\n')"
        :key="i"
        class="block transition-colors duration-500"
        :class="flashLines.has(i) ? 'bg-white/15 text-white' : ''"
      >{{ line }}</span></pre>
    </div>

    <!-- Diagnóstico -->
    <details class="text-xs text-neutral-500">
      <summary class="cursor-pointer">
        Diagnóstico: {{ events.length }} eventos · latencia {{ (settings.latency * 1000).toFixed(0) }} ms
        <template v-if="events.length">
          · golpe → pantalla {{ (events.reduce((a, e) => a + e.uiMs, 0) / events.length).toFixed(0) }} ms de media
        </template>
      </summary>
      <button v-if="isDev && lastTake" class="mt-2 underline underline-offset-4" @click="downloadTake">
        Descargar toma (WAV + JSON, solo local)
      </button>
      <table class="mt-2 w-full tabular-nums">
        <thead>
          <tr class="text-left">
            <th>t (s)</th>
            <th>sonido</th>
            <th>conf.</th>
            <th>fuerza</th>
            <th>ms</th>
            <th>paso</th>
            <th>resultado</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in events.slice(0, 30)" :key="i">
            <td>{{ e.time.toFixed(3) }}</td>
            <td>{{ e.instrument === 'unknown' ? '?' : INSTRUMENT_LABELS[e.instrument].vocal }}</td>
            <td>{{ (e.confidence * 100).toFixed(0) }}%</td>
            <td>{{ e.strength.toFixed(3) }}</td>
            <td>{{ e.uiMs.toFixed(0) }}</td>
            <td>{{ e.step ?? '' }}</td>
            <td>{{ resultLabel[e.result] }}</td>
          </tr>
        </tbody>
      </table>
    </details>

    <div class="mt-auto flex gap-4 pt-2 text-xs text-neutral-500">
      <button class="underline-offset-4 hover:underline" @click="emit('recalibrate', 'latency')">
        Recalibrar latencia
      </button>
      <button class="underline-offset-4 hover:underline" @click="emit('recalibrate', 'sounds')">
        Recalibrar sonidos
      </button>
    </div>
  </section>
</template>

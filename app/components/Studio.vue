<script setup lang="ts">
// UI PROVISIONAL de la A3.2: funcional, sin diseño. La sustituyen el agua (A3.3) y la UI mínima (A3.4).
import type { BackgroundMode } from '~/lib/background'
import { INSTRUMENT_LABELS, KIT_ORDER, KITS, STYLES } from '~/lib/constants'
import { dragValue, lockAxis, type Axis } from '~/lib/gestures'
import type { LoopLength } from '~/lib/phrases'
import type { Instrument, StyleId } from '~/lib/types'

const emit = defineEmits<{ recalibrate: ['latency' | 'sounds'] }>()
const engine = useAudioEngine()
const {
  playing,
  kit,
  style,
  assist,
  metronome,
  bgMode,
  phraseCloseBeats,
  maxPhraseBars,
  fx,
  loops,
  bgParts,
  currentBar,
  diag,
  dropping,
  echo,
} = engine
const calibration = useCalibration()

watchEffect(() => engine.setLatency((calibration.data.value?.latency?.ms ?? 0) / 1000))

const code = computed(() => engine.displayCode())
const copied = ref(false)
const showSettings = ref(false)

// destello de cada loop cuando suena
const flashing = ref(new Set<number>())
let off: (() => void) | null = null
onMounted(() => {
  off = engine.onVisual((h) => {
    if (h.loopId === null) return
    const id = h.loopId
    flashing.value = new Set(flashing.value).add(id)
    setTimeout(() => {
      const next = new Set(flashing.value)
      next.delete(id)
      flashing.value = next
    }, 110)
  })
})
onBeforeUnmount(() => off?.())

// tocar = silenciar, mantener 600 ms = borrar
const holding = ref<number | null>(null)
let holdTimer: ReturnType<typeof setTimeout> | null = null
let held = false
function loopDown(id: number) {
  held = false
  holding.value = id
  holdTimer = setTimeout(() => {
    held = true
    holding.value = null
    engine.remove(id)
  }, 600)
}
function loopUp(id: number) {
  if (holdTimer) clearTimeout(holdTimer)
  if (holding.value === id && !held) engine.mute(id)
  holding.value = null
}
function loopCancel() {
  if (holdTimer) clearTimeout(holdTimer)
  holding.value = null
}

// zona de gestos: vertical = filtro, horizontal = espacio
const pad = ref<HTMLElement | null>(null)
let g: { x: number; y: number; axis: Axis; filter: number; space: number } | null = null
function padDown(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  g = { x: e.clientX, y: e.clientY, axis: null, filter: fx.filter, space: fx.space }
}
function padMove(e: PointerEvent) {
  if (!g || !pad.value) return
  const dx = e.clientX - g.x
  const dy = e.clientY - g.y
  g.axis ??= lockAxis(dx, dy)
  const r = pad.value.getBoundingClientRect()
  if (g.axis === 'y') engine.setFx({ filter: dragValue(g.filter, 'y', dy, r.height) })
  if (g.axis === 'x') engine.setFx({ space: dragValue(g.space, 'x', dx, r.width) })
}
const padUp = () => (g = null)

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

function recalibrate(what: 'latency' | 'sounds') {
  engine.stop()
  emit('recalibrate', what)
}

const fill: Record<Instrument, string> = { bd: 'bg-bd', sd: 'bg-sd', hh: 'bg-hh' }
const ring: Record<Instrument, string> = { bd: 'border-bd', sd: 'border-sd', hh: 'border-hh' }
const bgLabel: Record<BackgroundMode, string> = { progressive: 'progresivo', full: 'completo', off: 'sin fondo' }
const BG_MODES: BackgroundMode[] = ['progressive', 'full', 'off']
const CLOSE_OPTIONS: (1 | 2 | 4)[] = [1, 2, 4]
const MAX_OPTIONS: LoopLength[] = [1, 2, 4]
const pct = (v: number) => `${Math.round(v * 100)}%`
const inputValue = (e: Event) => (e.target as HTMLInputElement).value
const inputChecked = (e: Event) => (e.target as HTMLInputElement).checked
</script>

<template>
  <section class="flex flex-1 flex-col gap-4">
    <!-- kit y estilo -->
    <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div class="flex gap-1">
        <button
          v-for="k in KIT_ORDER"
          :key="k"
          class="rounded-full px-3 py-1"
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
          class="rounded-full px-3 py-1"
          :class="style === s.id ? 'bg-white text-black' : 'text-neutral-400'"
          @click="engine.setStyle(s.id as StyleId)"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- transporte -->
    <div class="flex items-center gap-2">
      <button
        class="flex-1 rounded-full bg-white py-3 font-medium text-black"
        @click="playing ? engine.stop() : engine.play()"
      >
        {{ playing ? '■ Stop' : '▶ Play' }}
      </button>
      <button
        class="rounded-full border px-4 py-3 text-sm"
        :class="bgMode === 'off' ? 'border-white/15 text-neutral-500' : 'border-white/60'"
        @click="engine.toggleBackground()"
      >
        fondo {{ bgMode === 'off' ? 'no' : 'sí' }}
      </button>
    </div>
    <p class="text-xs text-neutral-500 tabular-nums">
      <template v-if="playing">compás {{ currentBar }} · </template>
      {{ loops.loops.length }}/8 loops · fondo {{ bgLabel[bgMode] }}:
      {{ bgParts.bass ? 'bajo' : '' }}{{ bgParts.chords ? ' + acordes' : '' }}{{ !bgParts.bass && !bgParts.chords ? '—' : '' }}
      <template v-if="playing"> · haz una frase con la boca y calla: nace un loop</template>
    </p>

    <!-- loops -->
    <div class="flex min-h-12 flex-wrap gap-2">
      <button
        v-for="l in loops.loops"
        :key="l.id"
        class="relative flex h-12 min-w-12 items-center gap-2 rounded-full border-2 px-3 text-xs transition-transform select-none"
        :class="[
          l.muted ? `${ring[l.instrument]} opacity-40` : `${fill[l.instrument]} border-transparent text-black`,
          flashing.has(l.id) ? 'scale-110' : '',
          holding === l.id ? 'ring-2 ring-white' : '',
        ]"
        @pointerdown="loopDown(l.id)"
        @pointerup="loopUp(l.id)"
        @pointerleave="loopCancel"
        @contextmenu.prevent
      >
        {{ INSTRUMENT_LABELS[l.instrument].vocal }} · {{ l.bars }}c{{ l.fromTemplate ? ' ★' : '' }}
      </button>
      <p v-if="!loops.loops.length" class="self-center text-xs text-neutral-500">
        Aún no hay loops. Tocar = silenciar · mantener = borrar.
      </p>
    </div>

    <!-- gestos -->
    <div
      ref="pad"
      class="relative flex h-40 touch-none items-center justify-center rounded-lg border border-white/10 bg-white/[.03] text-xs text-neutral-500 select-none"
      @pointerdown="padDown"
      @pointermove="padMove"
      @pointerup="padUp"
      @pointercancel="padUp"
    >
      ↕ filtro {{ pct(fx.filter) }} · ↔ espacio {{ pct(fx.space) }}
      <span v-if="dropping" class="absolute top-2 right-3 text-white">DROP</span>
    </div>

    <!-- ajustes -->
    <button
      class="self-start text-xs text-neutral-400 underline underline-offset-4"
      @click="showSettings = !showSettings"
    >
      {{ showSettings ? 'Ocultar ajustes' : 'Ajustes' }}
    </button>
    <div v-if="showSettings" class="grid gap-3 rounded-lg border border-white/10 p-3 text-sm">
      <label class="flex items-center justify-between">
        Ayuda
        <input type="checkbox" :checked="assist" @change="engine.setAssist(inputChecked($event))" />
      </label>
      <label class="flex items-center justify-between">
        Metrónomo
        <input type="checkbox" :checked="metronome" @change="engine.setMetronome(inputChecked($event))" />
      </label>
      <div class="flex items-center justify-between">
        Fondo
        <span class="flex gap-1">
          <button
            v-for="m in BG_MODES"
            :key="m"
            class="rounded-full px-2 py-0.5 text-xs"
            :class="bgMode === m ? 'bg-white text-black' : 'text-neutral-400'"
            @click="engine.setBackgroundMode(m)"
          >
            {{ bgLabel[m] }}
          </button>
        </span>
      </div>
      <div class="flex items-center justify-between">
        Cierre de frase
        <span class="flex gap-1">
          <button
            v-for="b in CLOSE_OPTIONS"
            :key="b"
            class="rounded-full px-2 py-0.5 text-xs"
            :class="phraseCloseBeats === b ? 'bg-white text-black' : 'text-neutral-400'"
            @click="engine.setPhraseOptions({ closeBeats: b })"
          >
            {{ b === 4 ? '1 compás' : b === 1 ? '1 tiempo' : '2 tiempos' }}
          </button>
        </span>
      </div>
      <div class="flex items-center justify-between">
        Frase máxima
        <span class="flex gap-1">
          <button
            v-for="b in MAX_OPTIONS"
            :key="b"
            class="rounded-full px-2 py-0.5 text-xs"
            :class="maxPhraseBars === b ? 'bg-white text-black' : 'text-neutral-400'"
            @click="engine.setPhraseOptions({ maxBars: b })"
          >
            {{ b }} c.
          </button>
        </span>
      </div>
      <label class="flex items-center justify-between gap-3">
        Calor
        <input
          class="flex-1"
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="fx.warmth"
          @input="engine.setFx({ warmth: Number(inputValue($event)) })"
        />
      </label>
      <div class="flex gap-2">
        <button class="flex-1 rounded-full border border-white/30 py-2 disabled:opacity-40" :disabled="!playing" @click="engine.drop()">
          Drop
        </button>
        <button class="flex-1 rounded-full border border-white/15 py-2" @click="engine.clearAll()">Borrar todo</button>
      </div>
      <div class="flex gap-4 text-xs text-neutral-500">
        <button class="underline underline-offset-4" @click="recalibrate('latency')">Recalibrar latencia</button>
        <button class="underline underline-offset-4" @click="recalibrate('sounds')">Recalibrar sonidos</button>
      </div>
      <p v-if="echo?.bleed" class="text-xs text-amber-300">
        El micro oye los altavoces ({{ (echo.roundTrip * 1000).toFixed(0) }} ms). Usa cascos; filtro de eco activado.
      </p>
    </div>

    <!-- código -->
    <div class="rounded-lg border border-white/10 bg-white/[.03]">
      <div class="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-neutral-500">
        <span>Strudel <span v-if="!assist" class="text-neutral-600">· ritmo exacto con .nudge()</span></span>
        <button class="text-white" @click="copy">{{ copied ? 'Copiado' : 'Copiar' }}</button>
      </div>
      <pre class="overflow-x-auto p-3 font-mono text-xs leading-relaxed text-neutral-300">{{ code }}</pre>
    </div>

    <!-- diagnóstico -->
    <details class="text-xs text-neutral-500">
      <summary class="cursor-pointer">Diagnóstico ({{ diag.length }})</summary>
      <ul class="mt-2 space-y-0.5 font-mono tabular-nums">
        <li v-for="(d, i) in diag.slice(0, 40)" :key="i">
          {{ d.at.toFixed(2) }} · {{ d.kind }} · {{ d.text
          }}<template v-if="d.uiMs !== undefined"> · {{ d.uiMs.toFixed(0) }} ms</template>
        </li>
      </ul>
    </details>
  </section>
</template>

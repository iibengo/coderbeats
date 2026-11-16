<script setup lang="ts">
// 3 · Capas (tipo Incredibox): suena la base entera; toca cada capa para encenderla o apagarla.
import { demoSteps, useLab } from '~/composables/useLab'
import { LAYERS, type LayerKind } from '~/lib/lab'
import { VOICE_HEX } from '~/lib/palette'

const lab = useLab()
const { engine, style } = lab
const emit = defineEmits<{ back: [] }>()

const COLOR: Record<LayerKind, string> = { bd: VOICE_HEX.bd, sd: VOICE_HEX.sd, hh: VOICE_HEX.hh, bass: VOICE_HEX.bass, chords: '#7fd6c2', mel: VOICE_HEX.mel }
const on = (k: LayerKind): boolean => {
  if (k === 'bass' || k === 'chords') return engine.bgManual.value[k]
  const l = engine.loops.value.loops.find((x) => x.instrument === (k === 'mel' ? 'mel' : k))
  return !!l && !l.muted
}
const beat = computed(() => `${(60 / Math.max(40, engine.bpm.value)).toFixed(3)}s`)

async function setup() {
  await lab.scene({ drums: { bd: demoSteps(style.value, 'bd'), sd: demoSteps(style.value, 'sd'), hh: demoSteps(style.value, 'hh') }, parts: { bass: true, chords: true }, melody: true })
  await lab.start()
}
onMounted(setup)
onBeforeUnmount(() => lab.stopAll())
async function pickStyle(id: Parameters<typeof lab.changeStyle>[0]) {
  await lab.changeStyle(id)
  await setup()
}
function toggle(k: LayerKind) {
  if (!engine.playing.value) return
  if (k === 'bass' || k === 'chords') engine.toggleBackgroundPart(k)
  else {
    const l = engine.loops.value.loops.find((x) => x.instrument === k)
    if (l) engine.mute(l.id)
  }
  navigator.vibrate?.(8)
}
</script>

<template>
  <LabShell title="Capas" phrase="Toca una capa para encenderla o apagarla. Empieza con todo y ve quitando y poniendo." @back="emit('back')" @style="pickStyle" @play="lab.start()" @stop="lab.stopAll()">
    <div class="grid h-full grid-cols-2 gap-3 p-3">
      <button
        v-for="l in LAYERS"
        :key="l.id"
        class="layer rounded-3xl border text-xl font-medium"
        :class="{ on: on(l.id) }"
        :style="{ '--c': COLOR[l.id], '--beat': beat }"
        :aria-pressed="on(l.id)"
        @pointerdown.prevent="toggle(l.id)"
      >
        {{ l.label }}
      </button>
    </div>
  </LabShell>
</template>

<style scoped>
.layer {
  touch-action: none;
  border-color: color-mix(in srgb, var(--c) 45%, transparent);
  background: color-mix(in srgb, var(--c) 6%, transparent);
  color: color-mix(in srgb, var(--c) 50%, white 20%);
  opacity: 0.6;
  transition: background 0.15s, opacity 0.15s;
}
.layer.on {
  opacity: 1;
  background: color-mix(in srgb, var(--c) 38%, transparent);
  color: white;
  animation: pulse var(--beat) ease-out infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--c) 70%, transparent); }
  100% { box-shadow: 0 0 0 22px transparent; }
}
</style>

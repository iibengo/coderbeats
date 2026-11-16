<script setup lang="ts">
// Teclado de agua (spec 015, fase 2): se ve dónde tocar (franjas suaves por nota, graves abajo), la onda de color al tocar, el rótulo y, al grabar, la vuelta del compás.
// No recoge toques (pointer-events: none): los gestos siguen en VisualStage, que llama a `hit`.
import { bandAtY, pitchColor, scaleNotes } from '~/lib/waterKeys'
import { VOICE_HEX } from '~/lib/palette'

const props = defineProps<{ reduced: boolean; styleId: import("~/lib/types").StyleId; recording: boolean; bar: number; count: number }>()

const n = computed(() => scaleNotes(props.styleId).length)
/** franjas de arriba (agudas) abajo (graves): su color por altura */
const bands = computed(() => Array.from({ length: n.value }, (_, i) => ({ i, c: pitchColor(1 - (i + 0.5) / n.value) })))
const lit = ref<{ band: number; k: number } | null>(null)
const waves = ref<{ id: number; x: number; y: number; c: string; size: number }[]>([])
let id = 0
let litTimer: ReturnType<typeof setTimeout> | undefined

/** Una nota tocada en (x, y) px del escenario. La onda es mayor cuanto más grave la nota. */
function hit(x: number, y: number, fy: number) {
  const b = bandAtY(fy, n.value)
  const frac = n.value > 1 ? 1 - b / (n.value - 1) : 0.5
  lit.value = { band: b, k: (lit.value?.k ?? 0) + 1 }
  clearTimeout(litTimer)
  litTimer = setTimeout(() => (lit.value = null), 450)
  const wid = ++id
  waves.value = [...waves.value.slice(-5), { id: wid, x, y, c: pitchColor(frac), size: 150 - frac * 70 }]
  setTimeout(() => (waves.value = waves.value.filter((w) => w.id !== wid)), 900)
}
onBeforeUnmount(() => clearTimeout(litTimer))
defineExpose({ hit })
</script>

<template>
  <div class="wk" :data-reduced="reduced" aria-hidden="true">
    <div class="bands">
      <i v-for="b in bands" :key="b.i" :class="{ on: lit?.band === n - 1 - b.i }" :style="{ '--c': b.c, '--a': b.i % 2 ? 0.13 : 0.06 }" />
    </div>
    <span v-for="w in waves" :key="w.id" class="wave" :style="{ left: `${w.x}px`, top: `${w.y}px`, '--c': w.c, '--s': `${w.size}px` }" />
    <div class="tag" :class="{ rec: recording }" role="status">
      <template v-if="recording">● Grabando · compás {{ (bar % 4) + 1 }}/4 · {{ count }} {{ count === 1 ? 'nota' : 'notas' }}</template>
      <template v-else>🎹 Agua · toca el fondo</template>
    </div>
  </div>
</template>

<style scoped>
.wk {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
  overflow: hidden;
}
.bands {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
}
.bands i {
  flex: 1;
  background: linear-gradient(90deg, color-mix(in srgb, var(--c) calc(var(--a) * 100%), transparent), transparent 70%, color-mix(in srgb, var(--c) calc(var(--a) * 100%), transparent));
  transition: background 0.4s ease-out;
}
.bands i.on {
  background: color-mix(in srgb, var(--c) 38%, transparent);
  transition: none;
}
.wave {
  position: absolute;
  width: var(--s);
  height: var(--s);
  margin: calc(var(--s) / -2) 0 0 calc(var(--s) / -2);
  border-radius: 9999px;
  border: 3px solid var(--c);
  background: radial-gradient(circle, color-mix(in srgb, var(--c) 45%, transparent), transparent 70%);
  animation: wk-wave 0.85s ease-out forwards;
}
@keyframes wk-wave {
  from {
    transform: scale(0.15);
    opacity: 0.9;
  }
  to {
    transform: scale(1.6);
    opacity: 0;
  }
}
.wk[data-reduced='true'] .wave {
  border-width: 0;
  animation: wk-fade 0.5s ease-out forwards;
}
@keyframes wk-fade {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 0;
  }
}
.tag {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: calc(max(0.5rem, env(safe-area-inset-top)) + 100px);
  padding: 6px 14px;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.6);
  backdrop-filter: blur(6px);
  color: rgb(255 255 255 / 0.9);
  font-size: 12px;
  white-space: nowrap;
}
.tag.rec {
  background: v-bind('VOICE_HEX.bd');
  color: #0b0b0f;
}
</style>

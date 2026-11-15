<script setup lang="ts">
// Escenario (spec 011 §13.1): toda la pantalla dispara golpes de efecto; cada golpe lanza una onda de color. Zonas: abajo bombo, centro boom, arriba crash, lados barrido.
import { FX_COLOR, FX_LABEL, fxAt, type FxKind, type Rect } from '~/lib/stageFx'

defineProps<{ reduced: boolean }>()
const engine = useAudioEngine()

const stageEl = ref<HTMLElement | null>(null)
const waves = ref<{ id: number; x: number; y: number; color: string; kind: FxKind }[]>([])
let waveId = 0
function stageDown(e: PointerEvent) {
  const el = stageEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const dead: Rect[] = [...el.querySelectorAll<HTMLElement>('[data-stage-btn]')].map((b) => {
    const q = b.getBoundingClientRect()
    return { x: q.x - r.x, y: q.y - r.y, w: q.width, h: q.height }
  })
  const x = e.clientX - r.x
  const y = e.clientY - r.y
  const kind = fxAt(x, y, r.width, r.height, dead)
  if (!kind || !engine.fireFx(kind)) return
  const id = ++waveId
  waves.value = [...waves.value.slice(-5), { id, x, y, color: FX_COLOR[kind], kind }]
  setTimeout(() => (waves.value = waves.value.filter((w) => w.id !== id)), 1100)
}
</script>

<template>
  <div ref="stageEl" class="stage absolute inset-0" :data-reduced="reduced" @pointerdown.stop.prevent="stageDown" @pointermove.stop @pointerup.stop>
    <span v-for="w in waves" :key="w.id" class="stage-wave" :style="{ left: `${w.x}px`, top: `${w.y}px`, '--c': w.color }" />
    <div class="stage-zones" aria-hidden="true">
      <span style="top: 8%">{{ FX_LABEL.crash }}</span>
      <span style="top: 44%">{{ FX_LABEL.boom }}</span>
      <span style="top: 78%">{{ FX_LABEL.bombo }}</span>
      <span class="side" style="left: 1.5%">{{ FX_LABEL.barrido }}</span>
      <span class="side" style="right: 1.5%">{{ FX_LABEL.barrido }}</span>
    </div>
    <div class="stage-bar" style="top: calc(max(0.5rem, env(safe-area-inset-top)) + 100px)">
      <button data-stage-btn class="act-btn" aria-label="salir del Escenario" @click.stop="engine.setStage(false)">✕ Salir</button>
      <button data-stage-btn class="act-btn" :data-on="!!engine.fxRec.value" :aria-label="engine.fxRec.value ? 'terminar y guardar los efectos como capa' : 'grabar efectos: lo que toques pasa a la célula como capa'" @click.stop="engine.toggleFxRec()">{{ engine.fxRec.value ? `■ ${engine.fxRec.value.count} golpes` : '● Grabar efectos' }}</button>
    </div>
  </div>
</template>

<style scoped>
.stage {
  z-index: 20;
  background: rgb(11 11 15 / 0.9);
  touch-action: none;
}
.stage-bar {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 8px;
}
.stage-zones span {
  position: absolute;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 11px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.18);
  pointer-events: none;
}
.stage-zones .side {
  left: auto;
  right: auto;
  top: 50%;
  writing-mode: vertical-rl;
}
.stage-wave {
  position: absolute;
  width: 60px;
  height: 60px;
  margin: -30px 0 0 -30px;
  border-radius: 9999px;
  border: 3px solid var(--c);
  background: radial-gradient(circle, color-mix(in srgb, var(--c) 35%, transparent), transparent 70%);
  opacity: 0.55;
  pointer-events: none;
  animation: stage-wave 1.05s ease-out forwards;
}
@keyframes stage-wave {
  to {
    transform: scale(24);
    opacity: 0;
  }
}
/* movimiento reducido: solo un cambio suave de brillo, sin onda que cruza */
.stage[data-reduced='true'] .stage-wave {
  animation: stage-fade 0.7s ease-out forwards;
  transform: scale(24);
  border-width: 0;
}
@keyframes stage-fade {
  from {
    opacity: 0.25;
  }
  to {
    opacity: 0;
  }
}
.act-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid #f496bc;
  background: rgb(255 255 255 / 0.07);
  color: #f496bc;
  font-size: 12px;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.act-btn[data-on='true'] {
  background: #f496bc;
  color: #0b0b0f;
}
</style>

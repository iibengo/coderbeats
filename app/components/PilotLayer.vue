<script setup lang="ts">
// Capa del piloto automático (spec 009 §6): el dedo fantasma, el bocadillo de la boca, el rótulo y la barra. Encima de todo; solo la barra recibe toques.
const state = usePilotState()
defineProps<{ paused: boolean }>()
const emit = defineEmits<{ pause: []; skip: []; stop: [] }>()
</script>

<template>
  <div v-if="state.active" class="pilot" aria-live="polite">
    <div v-if="state.finger.shown" class="finger" :data-down="state.finger.down" :data-reduced="state.reduced" :style="{ transform: `translate(${state.finger.x - 18}px, ${state.finger.y - 18}px)` }" />
    <div v-if="state.bubble" class="bubble">{{ state.bubble }}</div>
    <div v-if="state.captions && state.caption" class="caption">{{ state.caption }}</div>
    <div class="tag">piloto automático · demo</div>
    <div class="bar" data-pilot-bar>
      <button :aria-label="paused ? 'reanudar el piloto' : 'pausar el piloto'" @click="emit('pause')">{{ paused ? '▶' : '⏸' }}</button>
      <button aria-label="saltar al final: la canción terminada" @click="emit('skip')">⏭</button>
      <button aria-label="detener el piloto y seguir tocando" @click="emit('stop')">✕</button>
    </div>
  </div>
</template>

<style scoped>
.pilot {
  position: fixed;
  inset: 0;
  z-index: 60;
  pointer-events: none;
}
.finger {
  position: absolute;
  left: 0;
  top: 0;
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  border: 2px solid rgb(255 255 255 / 0.75);
  background: radial-gradient(circle, rgb(255 255 255 / 0.4), rgb(255 255 255 / 0.08));
  box-shadow: 0 0 18px rgb(255 255 255 / 0.25);
  transition: scale 0.12s;
}
.finger[data-down='true'] {
  scale: 0.8;
  background: radial-gradient(circle, rgb(244 150 188 / 0.65), rgb(244 150 188 / 0.15));
}
.bubble {
  position: absolute;
  left: 50%;
  bottom: calc(max(0.5rem, env(safe-area-inset-bottom)) + 150px);
  transform: translateX(-50%);
  padding: 6px 16px;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.92);
  color: #0b0b0f;
  font-size: 15px;
  font-weight: 600;
}
.caption {
  position: absolute;
  left: 50%;
  top: calc(max(0.5rem, env(safe-area-inset-top)) + 140px);
  transform: translateX(-50%);
  max-width: 88vw;
  padding: 6px 16px;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.6);
  color: rgb(255 255 255 / 0.9);
  font-size: 13px;
  text-align: center;
}
.tag {
  position: absolute;
  left: 50%;
  top: max(0.25rem, env(safe-area-inset-top));
  transform: translateX(-50%);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgb(255 255 255 / 0.55);
  background: rgb(0 0 0 / 0.4);
  padding: 2px 10px;
  border-radius: 9999px;
}
.bar {
  position: absolute;
  right: max(0.75rem, env(safe-area-inset-right));
  bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 96px);
  display: flex;
  gap: 8px;
  pointer-events: auto;
}
.bar button {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.35);
  background: rgb(0 0 0 / 0.55);
  color: #fff;
  font-size: 15px;
}
</style>

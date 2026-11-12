<script setup lang="ts">
// Anillo de compás (capa común, §16.16): 16 marcas, cabezal que gira una vez por compás y
// los golpes de la frase en curso como puntos de su color, al instante.
import type { Instrument } from '~/lib/types'

const props = defineProps<{
  x: number
  y: number
  r: number
  /** golpes de la frase en curso: paso 0..15 */
  dots: { step: number; instrument: Instrument; key: string }[]
  playing: boolean
}>()

const head = ref<SVGCircleElement | null>(null)
defineExpose({
  /** el cabezal se mueve desde el bucle rAF de la capa común, sin pasar por Vue */
  setPhase(phase: number) {
    if (!head.value) return
    const a = phase * Math.PI * 2 - Math.PI / 2
    head.value.setAttribute('cx', String(props.r + 6 + Math.cos(a) * props.r))
    head.value.setAttribute('cy', String(props.r + 6 + Math.sin(a) * props.r))
  },
})

const size = computed(() => props.r * 2 + 12)
const c = computed(() => props.r + 6)
const at = (step: number, rr: number) => {
  const a = (step / 16) * Math.PI * 2 - Math.PI / 2
  return { x: c.value + Math.cos(a) * rr, y: c.value + Math.sin(a) * rr }
}
const ticks = computed(() =>
  Array.from({ length: 16 }, (_, i) => {
    const beat = i % 4 === 0
    const a = at(i, props.r - (beat ? 7 : 4))
    const b = at(i, props.r + (beat ? 7 : 4))
    return { i, beat, a, b }
  }),
)
const fill: Record<Instrument, string> = { bd: '#F496BC', sd: '#B9A6F2', hh: '#8ECFF2' }
</script>

<template>
  <svg
    class="pointer-events-none absolute"
    :width="size"
    :height="size"
    :style="{ left: `${x - size / 2}px`, top: `${y - size / 2}px` }"
    aria-hidden="true"
  >
    <circle :cx="c" :cy="c" :r="r" fill="none" stroke="white" stroke-opacity="0.08" stroke-width="1" />
    <line
      v-for="t in ticks"
      :key="t.i"
      :x1="t.a.x"
      :y1="t.a.y"
      :x2="t.b.x"
      :y2="t.b.y"
      stroke="white"
      :stroke-opacity="t.beat ? 0.35 : 0.12"
      :stroke-width="t.beat ? 1.5 : 1"
      stroke-linecap="round"
    />
    <g>
      <circle
        v-for="d in dots"
        :key="d.key"
        class="ring-dot"
        :cx="at(d.step, r).x"
        :cy="at(d.step, r).y"
        r="6"
        :fill="fill[d.instrument]"
      />
    </g>
    <circle v-show="playing" ref="head" :cx="c" :cy="c - r" r="3.5" fill="white" />
  </svg>
</template>

<style scoped>
.ring-dot {
  animation: ring-dot-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes ring-dot-in {
  from {
    transform: scale(2.2);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ring-dot {
    animation: none;
  }
}
</style>

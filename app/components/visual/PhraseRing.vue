<script setup lang="ts">
// Anillo de compás = mapa del ritmo (capa común, §16.16, §16.17).
// Tres aros (bombo dentro, caja en medio, platillo fuera). Cada golpe de cada loop es un punto
// pequeño y tenue de su color en su paso; cuando el cabezal pasa y suena, se enciende.
// Los golpes de la frase en curso aparecen al instante, más grandes, en su aro.
import type { Instrument } from '~/lib/types'
import { LANE, stepDistance, type RingDot } from './ring'

const props = defineProps<{
  x: number
  y: number
  r: number
  /** golpes de los loops en el compás que suena */
  dots: RingDot[]
  /** golpes de la frase en curso */
  phraseDots: { key: string; step: number; instrument: Instrument }[]
  /** loop resaltado (al tocar su bola): sus puntos destacan y el resto se apaga */
  highlight: number | null
  playing: boolean
}>()

const pad = 14
const size = computed(() => props.r * 2 + pad * 2)
const c = computed(() => props.r + pad)
const at = (step: number, rr: number) => {
  const a = (step / 16) * Math.PI * 2 - Math.PI / 2
  return { x: c.value + Math.cos(a) * rr, y: c.value + Math.sin(a) * rr }
}
const laneR = (i: Instrument) => props.r * LANE[i]
const ticks = computed(() =>
  Array.from({ length: 16 }, (_, i) => {
    const beat = i % 4 === 0
    const a = at(i, props.r + 6)
    const b = at(i, props.r + (beat ? 13 : 9))
    return { i, beat, a, b }
  }),
)
const fill: Record<Instrument, string> = { bd: '#F496BC', sd: '#B9A6F2', hh: '#8ECFF2' }

// cabezal y encendido: se tocan desde el bucle rAF / eventos, sin pasar por Vue
const head = ref<SVGLineElement | null>(null)
const dotEls = new Map<string, SVGCircleElement>()
const setDot = (key: string) => (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof SVGCircleElement) dotEls.set(key, el)
  else dotEls.delete(key)
}

defineExpose({
  setPhase(phase: number) {
    if (!head.value) return
    const inner = at(phase * 16, props.r * 0.5)
    const outer = at(phase * 16, props.r + 4)
    head.value.setAttribute('x1', String(inner.x))
    head.value.setAttribute('y1', String(inner.y))
    head.value.setAttribute('x2', String(outer.x))
    head.value.setAttribute('y2', String(outer.y))
  },
  /** enciende el punto de un loop en un paso; devuelve su posición (px CSS) para la onda */
  light(loopId: number, step: number): { x: number; y: number } | null {
    const d = props.dots.find((p) => p.loopId === loopId && stepDistance(p.step, step) < 0.5)
    if (!d) return null
    const el = dotEls.get(d.key)
    if (el) {
      el.classList.remove('lit')
      void el.getBoundingClientRect()
      el.classList.add('lit')
    }
    const p = at(d.step, laneR(d.instrument))
    return { x: props.x - c.value + p.x, y: props.y - c.value + p.y }
  },
  /** posición (px CSS) de un paso en el aro de un instrumento */
  pointOf(instrument: Instrument, step: number): { x: number; y: number } {
    const p = at(step, laneR(instrument))
    return { x: props.x - c.value + p.x, y: props.y - c.value + p.y }
  },
})
</script>

<template>
  <svg
    class="pointer-events-none absolute overflow-visible"
    :width="size"
    :height="size"
    :style="{ left: `${x - size / 2}px`, top: `${y - size / 2}px` }"
    aria-hidden="true"
  >
    <!-- aros -->
    <circle v-for="i in ['bd', 'sd', 'hh'] as Instrument[]" :key="i" :cx="c" :cy="c" :r="laneR(i)" fill="none" stroke="white" stroke-opacity="0.05" />
    <!-- marcas de los 16 pasos (las de los tiempos, más marcadas) -->
    <line
      v-for="t in ticks"
      :key="t.i"
      :x1="t.a.x"
      :y1="t.a.y"
      :x2="t.b.x"
      :y2="t.b.y"
      stroke="white"
      :stroke-opacity="t.beat ? 0.4 : 0.12"
      :stroke-width="t.beat ? 1.5 : 1"
      stroke-linecap="round"
    />
    <!-- golpes de los loops -->
    <circle
      v-for="d in dots"
      :key="d.key"
      :ref="setDot(d.key)"
      class="dot"
      :class="{ hl: highlight === d.loopId, faded: highlight !== null && highlight !== d.loopId }"
      :cx="at(d.step, laneR(d.instrument)).x"
      :cy="at(d.step, laneR(d.instrument)).y"
      :r="highlight === d.loopId ? 8 : 5.5"
      :fill="d.muted ? 'transparent' : fill[d.instrument]"
      :stroke="highlight === d.loopId ? 'white' : fill[d.instrument]"
      :stroke-width="d.muted || highlight === d.loopId ? 1.5 : 0"
      :stroke-opacity="d.muted ? 0.7 : 1"
      :fill-opacity="d.muted ? 0 : 0.6"
      :style="{ color: fill[d.instrument] }"
    />
    <!-- frase en curso -->
    <circle
      v-for="d in phraseDots"
      :key="d.key"
      class="phrase-dot"
      :cx="at(d.step, laneR(d.instrument)).x"
      :cy="at(d.step, laneR(d.instrument)).y"
      r="7"
      :fill="fill[d.instrument]"
    />
    <!-- cabezal: cruza los tres aros -->
    <line v-show="playing" ref="head" stroke="white" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round" />
  </svg>
</template>

<style scoped>
.dot {
  transform-box: fill-box;
  transform-origin: center;
  transition:
    opacity 200ms,
    r 200ms;
}
.dot.faded {
  opacity: 0.2;
}
.dot.lit {
  animation: lit 480ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes lit {
  0% {
    fill-opacity: 1;
    transform: scale(2.4);
    filter: drop-shadow(0 0 4px currentColor) drop-shadow(0 0 12px currentColor) brightness(1.6);
  }
  35% {
    fill-opacity: 1;
    filter: drop-shadow(0 0 3px currentColor) drop-shadow(0 0 8px currentColor) brightness(1.3);
  }
  100% {
    transform: scale(1);
  }
}
.phrase-dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: dot-in 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
@keyframes dot-in {
  from {
    transform: scale(2.2);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .dot.lit,
  .phrase-dot {
    animation: none;
  }
  .dot.lit {
    fill-opacity: 1;
  }
}
</style>

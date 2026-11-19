<script setup lang="ts">
// El lienzo «Pulso» del Laboratorio (spec 050): cinco columnas, una por voz. Dibuja la escena que le den:
//  · en directo (actuando): los golpes del motor, con el reloj de lo que se oye (`clockNow().time`);
//  · con línea de tiempo (escuchando): el compás y la fase del motor sobre esa línea de tiempo.
// No recibe toques (en Pulso no se apagan capas: solo se cambia de parte con el pad de debajo).
import { drawPulso, PULSO_COMPACT, type PulsoScene } from '~/lib/visuals/pulso'

const props = defineProps<{ scene: PulsoScene }>()
const engine = useAudioEngine()
const cv = ref<HTMLCanvasElement | null>(null)
let frameHook: (() => void) | null = null
/** Para exportar vídeo (spec 013): el lienzo (sin botones) y el gancho de cada frame, como el de `LabStage`. */
function videoSource() {
  const { w, h } = props.scene.size
  return { water: null, aro: cv.value, width: w, height: h, setHook: (f: (() => void) | null) => (frameHook = f) }
}
// (los toques de `LabRemix` sobre el escenario de círculos no aplican aquí)
defineExpose({ ripple: () => {}, videoSource, C: PULSO_COMPACT.w / 2 })

let raf = 0
let reduced = false
onMounted(() => {
  reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const g = cv.value!.getContext('2d')!
  const tick = () => {
    raf = requestAnimationFrame(tick)
    const sc = props.scene
    const c = engine.clockNow()
    // en directo, el reloj de lo que se oye; con línea de tiempo, el compás y la fase del motor
    const t = sc.live ? c.time : (((c.bar + c.barPhase) * sc.tl.barSeconds) % Math.max(1e-6, sc.tl.duration) + sc.tl.duration) % Math.max(1e-6, sc.tl.duration)
    drawPulso(g, sc, engine.playing.value || sc.live ? t : 0, { scale: (cv.value?.clientWidth || sc.size.w) / sc.size.w, reduced })
    frameHook?.()
  }
  tick()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <canvas ref="cv" :width="scene.size.w" :height="scene.size.h" class="mx-auto block w-full touch-none rounded-2xl" :style="{ aspectRatio: `${scene.size.w} / ${scene.size.h}` }" data-pulso />
</template>

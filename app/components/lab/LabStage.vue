<script setup lang="ts">
// El escenario común del Laboratorio (como el prototipo): cuadrado negro, anillos tenues, la aguja girando con el compás y una onda en cada toque.
// Cada pantalla dibuja lo suyo encima con `draw` y recibe los toques en coordenadas 0..680.
import { LAB_W } from '~/lib/lab'

export interface StageFrame {
  /** 0..1 dentro del compás */
  phase: number
  /** paso 0..15 que suena ahora (−1 parado) */
  step: number
  playing: boolean
  /** acaba de caer un tiempo */
  beat: boolean
  /** segundos */
  t: number
  /** escala real del lienzo: ancho en pantalla / 680 (para que los textos no bajen de 11 px reales, `fontPx`) */
  scale: number
}
const props = withDefaults(defineProps<{ draw?: (g: CanvasRenderingContext2D, f: StageFrame) => void; rings?: number[]; needle?: boolean }>(), { needle: true })
const emit = defineEmits<{ down: [x: number, y: number, e: PointerEvent]; move: [x: number, y: number, e: PointerEvent]; up: [e: PointerEvent] }>()
const engine = useAudioEngine()
const cv = ref<HTMLCanvasElement | null>(null)
const C = LAB_W / 2
interface Ripple { x: number; y: number; r: number; a: number; c: string; grow: number }
let ripples: Ripple[] = []
/** una onda en (x, y) (en unidades del escenario) */
function ripple(x: number, y: number, c: string, grow = 5, r = 24) {
  ripples.push({ x, y, r, a: 1, c, grow })
  if (ripples.length > 14) ripples.shift()
}
let frameHook: (() => void) | null = null
/** Para exportar vídeo (spec 013): el lienzo del escenario (sin botones) y el gancho de cada frame. */
function videoSource() {
  return { water: null, aro: cv.value, width: LAB_W, height: LAB_W, setHook: (f: (() => void) | null) => (frameHook = f) }
}
defineExpose({ ripple, C, videoSource })

function pos(e: PointerEvent): [number, number] {
  const r = cv.value!.getBoundingClientRect()
  return [((e.clientX - r.left) / r.width) * LAB_W, ((e.clientY - r.top) / r.height) * LAB_W]
}
let down = false
function onDown(e: PointerEvent) {
  cv.value!.setPointerCapture(e.pointerId)
  down = true
  emit('down', ...pos(e), e)
}
function onMove(e: PointerEvent) {
  if (down) emit('move', ...pos(e), e)
}
function onUp(e: PointerEvent) {
  if (!down) return
  down = false
  emit('up', e)
}

let raf = 0
onMounted(() => {
  const g = cv.value!.getContext('2d')!
  const t0 = performance.now()
  const tick = () => {
    raf = requestAnimationFrame(tick)
    const playing = engine.playing.value
    const phase = playing ? engine.clockNow().barPhase : 0
    const step = playing ? Math.floor(phase * 16) % 16 : -1
    const f: StageFrame = { phase, step, playing, beat: playing && step % 4 === 0 && (phase * 16) % 1 < 0.6, t: (performance.now() - t0) / 1000, scale: (cv.value?.clientWidth || LAB_W) / LAB_W }
    g.fillStyle = '#0b0b0d'
    g.fillRect(0, 0, LAB_W, LAB_W)
    g.lineWidth = 1
    g.strokeStyle = 'rgba(255,255,255,.08)'
    for (const r of props.rings ?? []) {
      g.beginPath()
      g.arc(C, C, r, 0, 7)
      g.stroke()
    }
    props.draw?.(g, f)
    if (playing && props.needle) {
      const a = phase * Math.PI * 2 - Math.PI / 2
      // estela: un abanico tenue detrás de la aguja
      const grad = g.createConicGradient(a - 0.7, C, C)
      grad.addColorStop(0, 'rgba(255,255,255,0)')
      grad.addColorStop(0.11, 'rgba(255,255,255,.10)')
      grad.addColorStop(0.1115, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.beginPath()
      g.arc(C, C, 320, 0, 7)
      g.fill()
      g.strokeStyle = 'rgba(255,255,255,.75)'
      g.lineWidth = 2.5
      g.lineCap = 'round'
      g.beginPath()
      g.moveTo(C, C)
      g.lineTo(C + Math.cos(a) * 320, C + Math.sin(a) * 320)
      g.stroke()
    }
    for (const r of ripples) {
      r.r += r.grow
      r.a *= 0.93
      g.beginPath()
      g.arc(r.x, r.y, r.r, 0, 7)
      g.strokeStyle = r.c
      g.globalAlpha = r.a
      g.lineWidth = 3
      g.stroke()
      g.globalAlpha = 1
    }
    ripples = ripples.filter((r) => r.a > 0.03)
    frameHook?.()
  }
  tick()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <canvas ref="cv" :width="LAB_W" :height="LAB_W" class="block aspect-square w-full touch-none rounded-2xl" @pointerdown.prevent="onDown" @pointermove.prevent="onMove" @pointerup="onUp" @pointercancel="onUp" />
</template>

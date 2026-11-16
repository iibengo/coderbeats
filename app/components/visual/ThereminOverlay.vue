<script setup lang="ts">
// El sintetizador de dedo (spec 015 §12): al entrar en una célula de melodía, la pantalla entera es el instrumento. Mantener y deslizar suena continuo;
// arriba/abajo = nota de la escala, a los lados = filtro. El dedo deja una curva de luz. «● Grabar» pasa lo tocado a la melodía de la célula.
import { lightAlpha, lightPush, lissajousOf, lissajousPoints, type LightPoint } from '~/lib/theremin'
import { midiName } from '~/lib/noteScore'
import { pitchColor, scaleNotes } from '~/lib/waterKeys'
import type { MelodyHit } from '~/lib/melody'

const props = defineProps<{ reduced: boolean; bar: number }>()
const emit = defineEmits<{ close: [] }>()
const engine = useAudioEngine()
const { style, playing, keysRec, loops } = engine

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const notes = computed(() => scaleNotes(style.value))
const hits = computed<MelodyHit[]>(() => (loops.value.loops.find((l) => l.instrument === 'mel')?.hits ?? []) as MelodyHit[])
const touched = ref(false)
const down = ref(false)
const trail: LightPoint[] = []
let finger = { x: 0, y: 0 }
let raf = 0
let size = { w: 390, h: 844 }

const fy = (y: number) => y / Math.max(1, size.h)
const fx = (x: number) => x / Math.max(1, size.w)
const hOf = (midi: number | null) => {
  const i = midi === null ? -1 : notes.value.indexOf(midi)
  return i < 0 || notes.value.length < 2 ? 0.5 : i / (notes.value.length - 1)
}

function pos(e: PointerEvent) {
  const r = root.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function sound(e: PointerEvent) {
  const p = pos(e)
  finger = p
  const midi = engine.thereminMove(fx(p.x), fy(p.y))
  lightPush(trail, { x: p.x, y: p.y, t: performance.now() / 1000, h: hOf(midi) })
}
function onDown(e: PointerEvent) {
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  } catch {
    /* sin captura */
  }
  touched.value = true
  down.value = true
  sound(e)
}
function onMove(e: PointerEvent) {
  if (down.value) sound(e)
}
function onUp() {
  down.value = false
  engine.thereminStop()
}

function rec() {
  if (!playing.value) {
    void engine.play()
    return
  }
  engine.toggleKeysRec()
}

function draw() {
  raf = requestAnimationFrame(draw)
  const c = canvas.value
  const x = c?.getContext('2d')
  if (!c || !x) return
  const now = performance.now() / 1000
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = size.w
  const h = size.h
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
  }
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  x.clearRect(0, 0, w, h)
  const n = notes.value.length
  // la curva de Lissajous de la melodía, muy suave, en el centro
  const pts = lissajousPoints(lissajousOf(hits.value))
  const R = Math.min(w, h) * 0.32
  x.strokeStyle = 'rgba(255,255,255,0.10)'
  x.lineWidth = 1.5
  x.beginPath()
  pts.forEach((p, i) => (i ? x.lineTo(w / 2 + p.x * R, h / 2 + p.y * R) : x.moveTo(w / 2 + p.x * R, h / 2 + p.y * R)))
  x.stroke()
  // las notas de la escala, muy suaves (la que suena, encendida)
  const cur = engine.thereminNote.value
  x.font = '10px ui-monospace, monospace'
  for (let i = 0; i < n; i++) {
    const y = h * (1 - (i + 0.5) / n)
    const on = notes.value[i] === cur
    x.strokeStyle = on ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.07)'
    x.lineWidth = on ? 1.5 : 1
    x.beginPath()
    x.moveTo(0, y)
    x.lineTo(w, y)
    x.stroke()
    x.fillStyle = on ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)'
    x.fillText(midiName(notes.value[i]!), 8, y - 3)
  }
  // la curva de luz del dedo
  if (!props.reduced) {
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1]!
      const b = trail[i]!
      const al = lightAlpha(b, now)
      if (al <= 0) continue
      x.strokeStyle = pitchColor(b.h)
      x.globalAlpha = al * 0.9
      x.lineWidth = 2 + al * 5
      x.lineCap = 'round'
      x.beginPath()
      x.moveTo(a.x, a.y)
      x.lineTo(b.x, b.y)
      x.stroke()
    }
    x.globalAlpha = 1
  }
  if (down.value) {
    x.fillStyle = pitchColor(hOf(cur))
    x.beginPath()
    x.arc(finger.x, finger.y, 12, 0, Math.PI * 2)
    x.fill()
  }
  // fuera de lo que no se ve
  while (trail.length && now - trail[0]!.t > 1.4) trail.shift()
}

onMounted(() => {
  const r = root.value!.getBoundingClientRect()
  size = { w: r.width || size.w, h: r.height || size.h }
  raf = requestAnimationFrame(draw)
  engine.thereminShown.value = true
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  engine.thereminStop()
  engine.thereminShown.value = false
})
</script>

<template>
  <div ref="root" class="th" @pointerdown.stop="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp">
    <canvas ref="canvas" class="cv" />
    <button class="btn left" aria-label="cerrar el sintetizador" @pointerdown.stop @click="emit('close')">✕</button>
    <button class="btn right" :class="{ rec: !!keysRec }" :aria-label="keysRec ? 'terminar y guardar lo tocado como melodía' : 'grabar lo que toques como melodía'" @pointerdown.stop @click="rec">
      {{ keysRec ? `■ ${keysRec.count} notas` : playing ? '● Grabar' : '▶ para grabar' }}
    </button>
    <p v-if="keysRec" class="tag rec" role="status">● Grabando · compás {{ (bar % 4) + 1 }}/4</p>
    <p v-else-if="!touched" class="tag" role="status">Desliza el dedo</p>
  </div>
</template>

<style scoped>
.th {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: rgba(8, 8, 14, 0.95);
  touch-action: none;
  user-select: none;
}
.cv {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.btn {
  position: absolute;
  top: max(0.75rem, env(safe-area-inset-top));
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.5);
  padding: 0.4rem 0.9rem;
  font-size: 0.8rem;
  color: #fff;
}
.left { left: 0.75rem; }
.right { right: 0.75rem; }
.rec { border-color: #fb7185; color: #fecdd3; }
.tag {
  position: absolute;
  left: 50%;
  top: 38%;
  transform: translateX(-50%);
  font-size: 1.05rem;
  color: rgba(255, 255, 255, 0.75);
  pointer-events: none;
}
.tag.rec { top: max(0.9rem, env(safe-area-inset-top)); font-size: 0.8rem; color: #fecdd3; }
</style>

<script setup lang="ts">
// El fluido del agua (spec 015, fase 2): estela del dedo y venas por los hilos. Un canvas propio, sin recoger toques; solo se limpia/dibuja si hay algo.
// Lo llama VisualStage una vez por frame (`frame`) y el vigilante de frames decide si está encendido.
import { trailAlpha, trailPush, type TrailPoint, type VeinDot } from '~/lib/flow'
import { VOICE_RGB_CSS } from '~/lib/palette'

const el = ref<HTMLCanvasElement | null>(null)
let g: CanvasRenderingContext2D | null = null
let w = 0
let h = 0
let dirty = false
const trails = new Map<number, TrailPoint[]>()

function fit(width: number, height: number) {
  const c = el.value
  if (!c) return
  const d = Math.min(2, window.devicePixelRatio || 1) > 1 ? 1.5 : 1
  const pw = Math.round(width * d)
  const ph = Math.round(height * d)
  if (c.width !== pw || c.height !== ph) {
    c.width = pw
    c.height = ph
    g = null
  }
  g ??= c.getContext('2d')
  g?.setTransform(d, 0, 0, d, 0, 0)
  w = width
  h = height
}

/** Un frame: `now` (s), los dedos puestos, y las partículas de las venas ya en pantalla (o nada). Con `on` falso solo limpia lo que quedara. */
function frame(now: number, width: number, height: number, fingers: readonly { id: number; x: number; y: number }[], veins: readonly VeinDot[], on: boolean) {
  const c = el.value
  if (!c) return
  const live = new Set<number>()
  if (on) for (const f of fingers) {
    live.add(f.id)
    let tr = trails.get(f.id)
    if (!tr) trails.set(f.id, (tr = []))
    trailPush(tr, f.x, f.y, now)
  }
  for (const [id, tr] of trails) {
    if (!live.has(id)) {
      while (tr.length && now - tr[0]!.t > 0.55) tr.shift()
      if (!tr.length) trails.delete(id)
    }
  }
  const has = (on && veins.length > 0) || [...trails.values()].some((t) => t.length > 1)
  if (!has && !dirty) return
  fit(width, height)
  if (!g) return
  g.clearRect(0, 0, w, h)
  dirty = false
  if (!has) return
  g.lineCap = 'round'
  // estela: tramos cortos con la opacidad de su punto, más fina hacia la cola
  g.strokeStyle = `rgb(${VOICE_RGB_CSS.sd})`
  for (const tr of trails.values()) {
    for (let i = 1; i < tr.length; i++) {
      const a = trailAlpha(tr[i]!, now)
      if (a <= 0.02) continue
      g.globalAlpha = a * 0.55
      g.lineWidth = 2 + 6 * a
      g.beginPath()
      g.moveTo(tr[i - 1]!.x, tr[i - 1]!.y)
      g.lineTo(tr[i]!.x, tr[i]!.y)
      g.stroke()
      dirty = true
    }
  }
  // venas: puntitos rosa que corren por los hilos
  if (on && veins.length) {
    g.fillStyle = `rgb(${VOICE_RGB_CSS.bd})`
    for (const v of veins) {
      g.globalAlpha = 0.15 + 0.55 * v.a
      g.beginPath()
      g.arc(v.x, v.y, 2.2 + 1.8 * v.a, 0, Math.PI * 2)
      g.fill()
    }
    dirty = true
  }
  g.globalAlpha = 1
}
defineExpose({ frame })
</script>

<template>
  <canvas ref="el" aria-hidden="true" style="position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none" />
</template>

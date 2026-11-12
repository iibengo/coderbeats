<script setup lang="ts">
// Capa visual común (§16.14, §16.16): canvas del tema, anillo de compás, loops flotantes
// (tocar = silenciar, mantener = borrar), gestos sobre el agua y bucle rAF único.
import { spawnPoint, stepDrift, type Body, type DriftBounds } from '~/lib/drift'
import { dragValue, lockAxis, type Axis } from '~/lib/gestures'
import { STYLES } from '~/lib/constants'
import type { Instrument } from '~/lib/types'
import { themeById, DEFAULT_THEME } from '~/themes'
import type { VisualTheme } from '~/themes/types'
import PhraseRing from './PhraseRing.vue'

const props = withDefaults(defineProps<{ themeId?: string }>(), { themeId: DEFAULT_THEME })
const engine = useAudioEngine()
const { loops, playing, phrase, fx, bgParts, style } = engine

const root = ref<HTMLElement | null>(null)
const canvasHost = ref<HTMLElement | null>(null)
const ring = ref<InstanceType<typeof PhraseRing> | null>(null)
const view = reactive({ w: 390, h: 844 })
const reduced = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const rendererName = ref('')

// ── geometría ───────────────────────────────────────────────────────────────────
const ringGeo = computed(() => ({ x: view.w / 2, y: view.h * 0.42, r: Math.min(view.w * 0.3, view.h * 0.19) }))
const bounds = computed<DriftBounds>(() => ({
  w: view.w,
  h: view.h,
  margin: 16,
  avoid: [
    { x: ringGeo.value.x, y: ringGeo.value.y, r: ringGeo.value.r + 22 },
    { x: view.w / 2, y: view.h - 64, r: 52 }, // Play
    { x: view.w / 2, y: 28, r: 40 }, // estilo
    { x: view.w - 28, y: 28, r: 26 }, // ⋯
  ],
}))
const loopSize = (hits: number) => 26 + Math.min(14, hits * 1.5)

// ── loops flotantes (posición fuera de la reactividad; se escribe en el DOM en cada frame) ──
const bodies = new Map<number, Body>()
const falls = new Map<number, { t0: number; t1: number; fromX: number; fromY: number }>()
const els = new Map<number, HTMLElement>()
const setEl = (id: number) => (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof HTMLElement) els.set(id, el)
  else els.delete(id)
}

function ensureBody(id: number, hits: number) {
  const r = loopSize(hits) / 2
  const b = bodies.get(id)
  if (b) {
    b.r = r
    return b
  }
  const p = spawnPoint([...bodies.values()], bounds.value, r)
  const nb: Body = { id, x: p.x, y: p.y, vx: 0, vy: 0, r }
  bodies.set(id, nb)
  return nb
}

watch(
  () => loops.value.loops,
  (ls) => {
    const ids = new Set(ls.map((l) => l.id))
    for (const id of [...bodies.keys()]) if (!ids.has(id)) bodies.delete(id)
    for (const l of ls) ensureBody(l.id, l.hits.length)
  },
  { immediate: true },
)

// ── tema ─────────────────────────────────────────────────────────────────────────
let theme: VisualTheme | null = null
let canvas: HTMLCanvasElement | null = null
const dpr = () => Math.min(2, window.devicePixelRatio || 1)

function mountTheme() {
  const entry = themeById(props.themeId)
  const tryMount = (t: VisualTheme): boolean => {
    canvas?.remove()
    canvas = document.createElement('canvas')
    canvas.className = 'absolute inset-0 h-full w-full'
    canvasHost.value!.appendChild(canvas)
    try {
      t.mount(canvas, { dpr: dpr(), reducedMotion: reduced })
      t.resize(view.w, view.h, dpr())
      theme = t
      rendererName.value = t.renderer()
      return true
    } catch (e) {
      console.warn('[visual] el tema falló al montarse, uso el respaldo', e)
      t.dispose()
      return false
    }
  }
  if (!tryMount(entry.create({ reducedMotion: reduced }))) tryMount(entry.create({ reducedMotion: true }))
}

// ── eventos del motor → tema ─────────────────────────────────────────────────────
let offVisual: (() => void) | null = null
function onEngineVisual(h: Parameters<Parameters<typeof engine.onVisual>[0]>[0]) {
  if (!theme || !h.instrument) return
  const g = ringGeo.value
  if (h.kind === 'heard') {
    const a = ((h.step ?? 0) / 16) * Math.PI * 2 - Math.PI / 2
    theme.hit({ kind: 'heard', time: h.time, loopId: null, instrument: h.instrument, x: g.x + Math.cos(a) * g.r, y: g.y + Math.sin(a) * g.r, strength: h.strength })
    return
  }
  if (h.kind === 'birth' && h.loopId !== null) {
    const id = h.loopId
    const b = bodies.get(id) ?? ensureBody(id, 4)
    const now = engine.clockNow().time
    const fallSec = Math.max(0.22, Math.min(0.6, h.time - now))
    const t0 = performance.now() / 1000
    falls.set(id, { t0, t1: t0 + fallSec, fromX: g.x, fromY: g.y })
    setTimeout(() => {
      falls.delete(id)
      const nb = bodies.get(id) ?? b
      theme?.birth({ time: h.time, loopId: id, instrument: h.instrument as Instrument, x: nb.x, y: nb.y })
    }, fallSec * 1000)
    return
  }
  if (h.kind === 'hit') {
    if (h.loopId === null) return // el fondo no suelta gotas: el agua es de tu voz
    const b = bodies.get(h.loopId)
    if (!b || falls.has(h.loopId)) return
    theme.hit({ kind: 'hit', time: h.time, loopId: h.loopId, instrument: h.instrument, x: b.x, y: b.y, strength: h.strength })
    const el = els.get(h.loopId)
    if (el && !reduced) {
      el.dataset.pulse = String(performance.now())
    }
  }
}

// ── bucle rAF ────────────────────────────────────────────────────────────────────
let raf = 0
let lastBeat = -1
let lastT = 0
let simT = 0
const frameMs: number[] = []
let quality = 1

function tick() {
  raf = requestAnimationFrame(tick)
  const t = performance.now() / 1000
  const dt = lastT ? Math.min(0.05, t - lastT) : 1 / 60
  lastT = t
  const clock = engine.clockNow()
  const g = ringGeo.value

  // pulso: un evento por tiempo, más fuerte en el 1
  if (playing.value && theme) {
    const beatAbs = clock.bar * 4 + Math.floor(clock.barPhase * 4)
    if (beatAbs !== lastBeat) {
      if (lastBeat !== -1) {
        const beat = ((beatAbs % 4) + 4) % 4
        theme.beat({ time: clock.time, beat, downbeat: beat === 0, x: g.x, y: g.y })
      }
      lastBeat = beatAbs
    }
    ring.value?.setPhase(clock.barPhase)
  } else lastBeat = -1

  // deriva de los loops
  if (!reduced) {
    simT += dt
    const next = stepDrift([...bodies.values()], dt, simT, bounds.value)
    for (const b of next) bodies.set(b.id, b)
  }
  const nowMs = performance.now()
  for (const [id, el] of els) {
    const b = bodies.get(id)
    if (!b) continue
    let x = b.x
    let y = b.y
    let scale = 1
    let opacity = ''
    const f = falls.get(id)
    if (f) {
      const k = Math.min(1, Math.max(0, (t - f.t0) / (f.t1 - f.t0)))
      const e = k * k // cae acelerando
      x = f.fromX + (b.x - f.fromX) * e
      y = f.fromY + (b.y - f.fromY) * e
      scale = 1.5 - 0.5 * e
      opacity = String(0.4 + 0.6 * k)
    } else {
      const since = nowMs - Number(el.dataset.pulse ?? 0)
      if (since < 140) scale = 1 + 0.18 * (1 - since / 140)
    }
    el.style.transform = `translate(${x - b.r}px, ${y - b.r}px) scale(${scale})`
    el.style.opacity = opacity
  }

  // dibujo del tema, con vigilancia del tiempo de frame (§16.14)
  if (theme) {
    const t0 = performance.now()
    theme.frame({
      time: clock.time,
      playing: playing.value,
      bar: clock.bar,
      barPhase: clock.barPhase,
      bpm: STYLES[style.value].bpm,
      loops: loops.value.loops.map((l) => {
        const b = bodies.get(l.id)
        return { id: l.id, instrument: l.instrument, muted: l.muted, x: b?.x ?? 0, y: b?.y ?? 0, size: (b?.r ?? 14) * 2 }
      }),
      fx: { ...fx },
      background: { ...bgParts.value },
      reducedMotion: reduced,
    })
    frameMs.push(performance.now() - t0)
    if (frameMs.length >= 120) {
      const p95 = [...frameMs].sort((a, b) => a - b)[Math.floor(frameMs.length * 0.95)]!
      frameMs.length = 0
      if (p95 > 14 && quality > 0.5 && theme.setQuality) {
        quality -= 0.15
        theme.setQuality(quality)
        rendererName.value = theme.renderer()
      }
    }
  }
}

function measure() {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  view.w = r.width
  view.h = r.height
  theme?.resize(view.w, view.h, dpr())
}

let ro: ResizeObserver | null = null
onMounted(() => {
  measure()
  mountTheme()
  offVisual = engine.onVisual(onEngineVisual)
  ro = new ResizeObserver(measure)
  ro.observe(root.value!)
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  offVisual?.()
  ro?.disconnect()
  theme?.dispose()
})

// ── interacción: loops ───────────────────────────────────────────────────────────
const holding = ref<number | null>(null)
let holdTimer: ReturnType<typeof setTimeout> | null = null
let held = false
function loopDown(e: PointerEvent, id: number) {
  e.stopPropagation()
  held = false
  holding.value = id
  holdTimer = setTimeout(() => {
    held = true
    holding.value = null
    engine.remove(id)
  }, 600)
}
function loopUp(id: number) {
  if (holdTimer) clearTimeout(holdTimer)
  if (holding.value === id && !held) engine.mute(id)
  holding.value = null
}
function loopCancel() {
  if (holdTimer) clearTimeout(holdTimer)
  holding.value = null
}

// ── interacción: gestos sobre el agua (vertical = filtro, horizontal = espacio) y 2 dedos = fondo ──
const pointers = new Map<number, { x: number; y: number; t: number }>()
const drag = ref<{ axis: Axis; x0: number; y0: number; filter: number; space: number; x: number; y: number } | null>(null)
let twoFinger: { t: number; moved: boolean } | null = null

function waterDown(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() })
  if (pointers.size === 2) {
    twoFinger = { t: performance.now(), moved: false }
    drag.value = null
    return
  }
  drag.value = { axis: null, x0: e.clientX, y0: e.clientY, filter: fx.filter, space: fx.space, x: e.clientX, y: e.clientY }
}
function waterMove(e: PointerEvent) {
  const p = pointers.get(e.pointerId)
  if (p && twoFinger && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) twoFinger.moved = true
  const d = drag.value
  if (!d || pointers.size !== 1) return
  d.x = e.clientX
  d.y = e.clientY
  const dx = e.clientX - d.x0
  const dy = e.clientY - d.y0
  d.axis ??= lockAxis(dx, dy)
  if (d.axis === 'y') engine.setFx({ filter: dragValue(d.filter, 'y', dy, view.h) })
  if (d.axis === 'x') engine.setFx({ space: dragValue(d.space, 'x', dx, view.w) })
}
function waterUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (twoFinger && pointers.size === 0) {
    if (!twoFinger.moved && performance.now() - twoFinger.t < 400) engine.toggleBackground()
    twoFinger = null
  }
  if (pointers.size === 0) drag.value = null
}

const ringDots = computed(() =>
  (phrase.value?.hits ?? []).map((h, i) => ({
    step: ((Math.round(h.globalStep) % 16) + 16) % 16,
    instrument: h.instrument,
    key: `${Math.round(h.globalStep)}-${h.instrument}-${i}`,
  })),
)
const fill: Record<Instrument, string> = { bd: '#F496BC', sd: '#B9A6F2', hh: '#8ECFF2' }
defineExpose({ rendererName })
</script>

<template>
  <div
    ref="root"
    class="fixed inset-0 touch-none overflow-hidden bg-ink select-none"
    @pointerdown="waterDown"
    @pointermove="waterMove"
    @pointerup="waterUp"
    @pointercancel="waterUp"
  >
    <div ref="canvasHost" class="absolute inset-0" />

    <PhraseRing ref="ring" :x="ringGeo.x" :y="ringGeo.y" :r="ringGeo.r" :dots="ringDots" :playing="playing" />

    <!-- guía fina del gesto -->
    <div
      v-if="drag?.axis === 'y'"
      class="pointer-events-none absolute top-0 bottom-0 w-px bg-white/20"
      :style="{ left: `${drag.x}px` }"
    />
    <div
      v-if="drag?.axis === 'x'"
      class="pointer-events-none absolute right-0 left-0 h-px bg-white/20"
      :style="{ top: `${drag.y}px` }"
    />

    <!-- loops flotantes -->
    <button
      v-for="l in loops.loops"
      :key="l.id"
      :ref="setEl(l.id)"
      class="loop absolute top-0 left-0 rounded-full will-change-transform"
      :class="l.muted ? 'border-2 bg-transparent' : ''"
      :style="{
        width: `${loopSize(l.hits.length)}px`,
        height: `${loopSize(l.hits.length)}px`,
        background: l.muted ? 'transparent' : fill[l.instrument],
        borderColor: fill[l.instrument],
        opacity: l.muted ? 0.45 : 1,
        boxShadow: l.muted ? 'none' : `0 0 18px ${fill[l.instrument]}55`,
      }"
      :aria-label="`loop ${l.instrument}${l.muted ? ' silenciado' : ''}`"
      @pointerdown="loopDown($event, l.id)"
      @pointerup.stop="loopUp(l.id)"
      @pointerleave="loopCancel"
      @contextmenu.prevent
    >
      <span v-if="holding === l.id" class="hold-ring absolute -inset-1.5 rounded-full" />
    </button>

    <slot />
  </div>
</template>

<style scoped>
.hold-ring {
  border: 2px solid white;
  clip-path: inset(0 0 0 0);
  animation: hold 600ms linear forwards;
  mask: conic-gradient(#000 var(--p, 0%), transparent 0);
}
@property --p {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}
@keyframes hold {
  to {
    --p: 100%;
  }
}
</style>

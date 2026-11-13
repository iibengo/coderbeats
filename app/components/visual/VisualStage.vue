<script setup lang="ts">
// Capa visual común (§16.14, §16.16, §16.17; spec 003): canvas del tema, el aro (gota con una
// franja por instrumento), loops flotantes (tocar = silenciar, mantener = borrar), bolas del
// fondo manual, gestos sobre el agua y bucle rAF único.
import { allWeights, stepWeights, type Weights } from '~/lib/aro/bands'
import type { DropGeo } from '~/lib/aro/shape'
import type { Part } from '~/lib/background'
import { notesInBar } from '~/lib/bass'
import { STYLES } from '~/lib/constants'
import { spawnPoint, stepDrift, type Body, type DriftBounds } from '~/lib/drift'
import { loopBarAt } from '~/lib/freeLoops'
import { dragValue, lockAxis, type Axis } from '~/lib/gestures'
import { VOICE_HEX } from '~/lib/palette'
import { STYLE_MUSIC } from '~/lib/styles'
import type { Instrument } from '~/lib/types'
import { DEFAULT_THEME, themeById } from '~/themes'
import type { VisualTheme } from '~/themes/types'
import { AroCanvas, type AroDot, type AroFrame } from './AroCanvas'

const props = withDefaults(defineProps<{ themeId?: string }>(), { themeId: DEFAULT_THEME })
const engine = useAudioEngine()
const { loops, playing, phrase, fx, bgParts, bgMode, bgManual, style, currentBar } = engine

const root = ref<HTMLElement | null>(null)
const canvasHost = ref<HTMLElement | null>(null)
const aroEl = ref<HTMLCanvasElement | null>(null)
let aro: AroCanvas | null = null
const view = reactive({ w: 390, h: 844 })
const reduced = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const rendererName = ref('')

// ── geometría (todo centrado en la ventana, también en escritorio) ───────────────
const PLAY_FROM_BOTTOM = 56 // centro del botón Play desde abajo (px)
/** zona de arriba (estilo y ⋯) y de abajo (Play y bolas del fondo) que la gota no pisa (E1.8) */
const TOP_UI = 52
const BOTTOM_UI = PLAY_FROM_BOTTOM + 52
const ringGeo = computed(() => {
  const r = Math.max(70, Math.min(view.w * 0.3, view.h * 0.22, 260))
  return { x: view.w / 2, y: Math.min(view.h * 0.43, view.h - PLAY_FROM_BOTTOM - 120 - r), r }
})
/** geometría de la gota (spec 003): mismo centro y tamaño que el anillo; zoom en la fase 4 */
const dropGeo = computed<DropGeo>(() => ({
  cx: ringGeo.value.x,
  cy: ringGeo.value.y,
  R: ringGeo.value.r,
  core: Math.max(16, Math.min(24, ringGeo.value.r * 0.18)),
  free: { x0: 0, y0: TOP_UI, x1: view.w, y1: view.h - BOTTOM_UI },
}))
const bgBalls = computed(() => {
  const y = view.h - PLAY_FROM_BOTTOM
  return [
    { part: 'bass' as Part, label: 'bajo', x: view.w / 2 - 96, y },
    { part: 'chords' as Part, label: 'acordes', x: view.w / 2 + 96, y },
  ]
})
const bounds = computed<DriftBounds>(() => ({
  w: view.w,
  h: view.h,
  margin: 16,
  avoid: [
    { x: ringGeo.value.x, y: ringGeo.value.y, r: ringGeo.value.r * 1.04 + 26 },
    { x: view.w / 2, y: view.h - PLAY_FROM_BOTTOM, r: 52 }, // Play
    ...bgBalls.value.map((b) => ({ x: b.x, y: b.y, r: 40 })),
    { x: view.w / 2, y: 28, r: 40 }, // estilo
    { x: view.w - 28, y: 28, r: 26 }, // ⋯
  ],
  // los loops flotan alrededor del anillo (§16.18)
  orbit: { x: ringGeo.value.x, y: ringGeo.value.y, r: ringGeo.value.r + 36, band: Math.max(70, ringGeo.value.r * 0.55) },
}))
const loopSize = (hits: number) => 26 + Math.min(14, hits * 1.5)

// ── aro: golpes de cada loop en el compás que suena ─────────────────────────────
const ringDots = computed<AroDot[]>(() => {
  const g = playing.value ? currentBar.value : 0
  const out: AroDot[] = []
  for (const l of loops.value.loops) {
    const bar = loopBarAt(l, g)
    for (const h of l.hits) {
      if (h.pos < bar * 16 - 0.5 || h.pos >= bar * 16 + 15.5) continue
      const step = h.pos - bar * 16
      out.push({ key: `${l.id}-${Math.round(h.pos * 100)}`, loopId: l.id, step, voice: l.instrument, muted: l.muted })
    }
  }
  // el bajo del fondo: sus notas del compás que suena (rayitas; spec 003 §3)
  for (const n of notesInBar(STYLE_MUSIC[style.value].background.bass, g))
    out.push({ key: `bass-${n.pos}`, loopId: -1, step: n.pos, voice: 'bass', muted: false })
  return out
})
const phraseDots = computed(() =>
  (phrase.value?.hits ?? []).map((h, i) => ({
    key: `${Math.round(h.globalStep)}-${h.instrument}-${i}`,
    step: ((h.globalStep % 16) + 16) % 16,
    voice: h.instrument,
  })),
)
/** compás que suena del loop más largo (puntitos junto al centro, E1.1) */
const barsInfo = computed(() => {
  const longest = loops.value.loops.reduce((m, l) => Math.max(m, l.bars), 1)
  if (longest < 2) return null
  return { current: loopBarAt({ bars: longest as 1 | 2 | 4, phaseBar: 0 }, playing.value ? currentBar.value : 0), total: longest }
})
/** franjas que deberían verse: el bajo si suena o está pedido; la melodía, cuando exista (E1.3) */
const targetWeights = computed<Weights>(() => {
  const bass = bgParts.value.bass || (bgMode.value === 'manual' && bgManual.value.bass)
  return { ...allWeights(1), bass: bass ? 1 : 0, mel: 0 }
})
let weights: Weights = { ...allWeights(1), bass: 0, mel: 0 }

// ── loops flotantes (posición fuera de la reactividad; se escribe en el DOM en cada frame) ──
const bodies = new Map<number, Body>()
const falls = new Map<number, { t0: number; t1: number; fromX: number; fromY: number }>()
const els = new Map<number, HTMLElement>()
const setEl = (id: number) => (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof HTMLElement) els.set(id, el)
  else els.delete(id)
}
const ballEls = new Map<Part, HTMLElement>()
const setBall = (p: Part) => (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof HTMLElement) ballEls.set(p, el)
  else ballEls.delete(p)
}
/** Latido de una bola al sonar (§16.17, punto 5): el bombo, el más fuerte; el platillo, el más ligero. */
const PULSE_AMP: Record<Instrument | 'bass' | 'chords', number> = { bd: 0.3, sd: 0.25, hh: 0.2, bass: 0.18, chords: 0.14 }
const PULSE_MS = 220
const pulse = (el: HTMLElement | undefined, instrument: keyof typeof PULSE_AMP) => {
  if (!el) return
  el.dataset.pulse = String(performance.now())
  el.dataset.amp = String(PULSE_AMP[instrument])
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
    // estilos en línea: no dependen de que una clase CSS esté generada
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' })
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

// ── eventos del motor → anillo, bolas y tema ────────────────────────────────────
let offVisual: (() => void) | null = null
function onEngineVisual(h: Parameters<Parameters<typeof engine.onVisual>[0]>[0]) {
  if (!theme || !h.instrument) return
  const g = ringGeo.value
  if (h.kind === 'heard' && h.instrument !== 'bass' && h.instrument !== 'chords') {
    const p = aro?.pointOf(h.instrument, h.step ?? 0) ?? { x: g.x, y: g.y }
    theme.hit({ kind: 'heard', time: h.time, loopId: null, instrument: h.instrument, x: p.x, y: p.y, strength: h.strength })
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
  if (h.kind !== 'hit') return
  // fondo: la bola late; el bajo, además, suena en su franja del aro si se oye
  if (h.instrument === 'bass' || h.instrument === 'chords') {
    if (h.instrument === 'bass' && bgParts.value.bass) aro?.lightVoice('bass', h.step ?? 0)
    const ball = bgBalls.value.find((b) => b.part === h.instrument)
    pulse(ballEls.get(h.instrument), h.instrument)
    if (ball) theme.hit({ kind: 'hit', time: h.time, loopId: null, instrument: h.instrument, x: ball.x, y: ball.y, strength: 0.3 })
    return
  }
  if (h.loopId === null || falls.has(h.loopId)) return
  // loop: la bola late y brilla y suelta su onda clara; su punto del aro se enciende
  // (sin onda del agua en el aro: la gota tiene las suyas, spec 003 E1.9)
  const strength = 0.6 + 0.4 * h.strength // la mezcla baja la ganancia con muchos loops: la onda no debe desaparecer
  const b = bodies.get(h.loopId)
  if (b) theme.hit({ kind: 'hit', time: h.time, loopId: h.loopId, instrument: h.instrument, x: b.x, y: b.y, strength })
  aro?.light(h.loopId, h.step ?? 0)
  pulse(els.get(h.loopId), h.instrument)
}

// ── bucle rAF ────────────────────────────────────────────────────────────────────
let raf = 0
let lastBeat = -1
let lastT = 0
let simT = 0
const frameMs: number[] = []
let quality = 1
let aroDetail = 1

/** 0..1: cuánto late ahora (subida rápida de 40 ms y vuelta suave). */
function pulseK(el: HTMLElement, nowMs: number): number {
  const since = nowMs - Number(el.dataset.pulse ?? -1e9)
  if (since < 0 || since > PULSE_MS) return 0
  if (since < 40) return since / 40
  const k = 1 - (since - 40) / (PULSE_MS - 40)
  return k * k
}
const pulseScale = (el: HTMLElement, nowMs: number): number =>
  reduced ? 1 : 1 + Number(el.dataset.amp ?? 0.2) * pulseK(el, nowMs)

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
    } else scale = pulseScale(el, nowMs)
    el.style.transform = `translate(${x - b.r}px, ${y - b.r}px) scale(${scale})`
    el.style.opacity = opacity
    // brillo al latir
    const k = pulseK(el, nowMs)
    el.style.filter = k > 0 ? `brightness(${1 + 0.6 * k})` : ''
    // en reposo, el brillo base (color al 33 %); al latir, crece y se satura
    const glow = el.dataset.glow
    el.style.boxShadow = glow ? `0 0 ${18 + 34 * k}px ${glow}${k > 0.05 ? '' : '55'}` : 'none'
  }
  for (const el of ballEls.values()) el.style.transform = `translate(-50%, -50%) scale(${pulseScale(el, nowMs)})`

  // dibujo del tema y del aro, con vigilancia del tiempo de frame de los dos (§16.14, E1.7)
  const t0 = performance.now()
  if (theme) {
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
  }
  if (aro) {
    weights = stepWeights(weights, targetWeights.value, dt, reduced)
    const f: AroFrame = {
      wall: t,
      geo: dropGeo.value,
      weights,
      playing: playing.value,
      phase: clock.barPhase,
      dots: ringDots.value,
      phraseDots: phraseDots.value,
      highlight: highlight.value,
      bars: barsInfo.value,
      reduced,
    }
    aro.draw(f)
  }
  frameMs.push(performance.now() - t0)
  if (frameMs.length >= 120) {
    const p95 = [...frameMs].sort((a, b) => a - b)[Math.floor(frameMs.length * 0.95)]!
    frameMs.length = 0
    if (p95 > 14) {
      // primero baja el agua; si no basta, el detalle del aro
      if (theme?.setQuality && quality > 0.5) {
        quality -= 0.15
        theme.setQuality(quality)
        rendererName.value = theme.renderer()
      } else if (aro && aroDetail > 0.5) {
        aroDetail = 0.5
        aro.setDetail(aroDetail)
      }
    }
  }
}

function measure() {
  // la ventana manda: el escenario siempre es exactamente la ventana visible
  view.w = window.innerWidth
  view.h = window.innerHeight
  theme?.resize(view.w, view.h, dpr())
  aro?.resize(view.w, view.h, dpr())
}

// mientras se ve el escenario, el documento no hace scroll
let savedOverflow: [string, string] = ['', '']
onMounted(() => {
  savedOverflow = [document.documentElement.style.overflow, document.body.style.overflow]
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
  window.scrollTo(0, 0)
  if (aroEl.value) {
    try {
      aro = new AroCanvas(aroEl.value)
    } catch (e) {
      console.warn('[visual] sin Canvas 2D para el aro', e)
    }
  }
  measure()
  mountTheme()
  offVisual = engine.onVisual(onEngineVisual)
  window.addEventListener('resize', measure)
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  offVisual?.()
  window.removeEventListener('resize', measure)
  theme?.dispose()
  document.documentElement.style.overflow = savedOverflow[0]
  document.body.style.overflow = savedOverflow[1]
})

// ── interacción: loops ───────────────────────────────────────────────────────────
/** loop resaltado en el anillo al tocar su bola (§16.18) */
const highlight = ref<number | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | null = null
function showHighlight(id: number) {
  highlight.value = id
  if (highlightTimer) clearTimeout(highlightTimer)
}
function hideHighlightSoon() {
  if (highlightTimer) clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => (highlight.value = null), 1500)
}
const holding = ref<number | null>(null)
let holdTimer: ReturnType<typeof setTimeout> | null = null
let held = false
function loopDown(e: PointerEvent, id: number) {
  e.stopPropagation()
  held = false
  holding.value = id
  showHighlight(id)
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
  hideHighlightSoon()
}
function loopCancel() {
  if (holdTimer) clearTimeout(holdTimer)
  holding.value = null
  hideHighlightSoon()
}

/** estado de cada bola del fondo: apagada, pendiente (entra en el siguiente compás), sonando, saliendo */
function ballState(p: Part): 'off' | 'pending' | 'on' | 'leaving' {
  const want = bgManual.value[p]
  const sounding = bgParts.value[p]
  if (want && sounding) return 'on'
  if (want) return 'pending'
  return sounding ? 'leaving' : 'off'
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

const fill: Record<Instrument, string> = { bd: VOICE_HEX.bd, sd: VOICE_HEX.sd, hh: VOICE_HEX.hh }
/** medidas reales de la ventana, para el diagnóstico (§16.18) */
const layoutInfo = () => {
  const r = root.value?.getBoundingClientRect()
  return [
    `ventana ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}`,
    `escenario ${r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}` : '—'}`,
    `documento ${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight}`,
    `aro (${Math.round(ringGeo.value.x)}, ${Math.round(ringGeo.value.y)}) r ${Math.round(ringGeo.value.r)} detalle ${aroDetail}`,
    `latencia de salida ${Math.round(engine.outputLatency() * 1000)} ms`,
  ].join(' · ')
}
defineExpose({ rendererName, layoutInfo })
</script>

<template>
  <div
    ref="root"
    class="touch-none bg-ink select-none"
    style="position: fixed; inset: 0; overflow: hidden"
    @pointerdown="waterDown"
    @pointermove="waterMove"
    @pointerup="waterUp"
    @pointercancel="waterUp"
  >
    <div ref="canvasHost" style="position: absolute; inset: 0" />

    <!-- el aro (spec 003): fase 1 sin interacción -->
    <canvas
      ref="aroEl"
      aria-hidden="true"
      style="position: absolute; inset: 0; width: 100%; height: 100%; display: block; pointer-events: none"
    />

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

    <!-- bolas del fondo (modo manual, §16.17) -->
    <template v-if="bgMode === 'manual'">
      <button
        v-for="b in bgBalls"
        :key="b.part"
        :ref="setBall(b.part)"
        class="bg-ball absolute rounded-full"
        :data-state="ballState(b.part)"
        :style="{ left: `${b.x}px`, top: `${b.y}px` }"
        :aria-label="`${b.label}: ${ballState(b.part) === 'off' ? 'apagado' : 'encendido'}`"
        @pointerdown.stop
        @click="engine.toggleBackgroundPart(b.part)"
      >
        <span class="bg-ball-label">{{ b.label }}</span>
      </button>
    </template>

    <!-- loops flotantes -->
    <button
      v-for="l in loops.loops"
      :key="l.id"
      :ref="setEl(l.id)"
      class="absolute top-0 left-0 rounded-full will-change-transform"
      :style="{
        width: `${loopSize(l.hits.length)}px`,
        height: `${loopSize(l.hits.length)}px`,
        background: l.muted ? 'transparent' : fill[l.instrument],
        border: `2px solid ${fill[l.instrument]}`,
        opacity: l.muted ? 0.45 : 1,
      }"
      data-loop
      :data-glow="l.muted ? '' : fill[l.instrument]"
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
.bg-ball {
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  border: 1.5px solid rgb(255 255 255 / 0.18);
  background: rgb(255 255 255 / 0.04);
  transition:
    background 300ms,
    border-color 300ms,
    box-shadow 300ms;
}
.bg-ball[data-state='pending'] {
  border-color: rgb(255 255 255 / 0.6);
  animation: pending 900ms ease-in-out infinite;
}
.bg-ball[data-state='on'] {
  background: rgb(255 255 255 / 0.85);
  border-color: white;
  box-shadow: 0 0 22px rgb(255 255 255 / 0.35);
}
.bg-ball[data-state='leaving'] {
  background: rgb(255 255 255 / 0.3);
  border-color: rgb(255 255 255 / 0.3);
}
.bg-ball-label {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: rgb(255 255 255 / 0.35);
  pointer-events: none;
  white-space: nowrap;
}
@keyframes pending {
  50% {
    border-color: rgb(255 255 255 / 0.2);
  }
}
.hold-ring {
  border: 2px solid white;
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
@media (prefers-reduced-motion: reduce) {
  .bg-ball[data-state='pending'] {
    animation: none;
  }
}
</style>

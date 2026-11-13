<script setup lang="ts">
// Capa visual común (§16.14, §16.16, §16.17; spec 003): canvas del tema, el aro (gota con una
// franja por instrumento, que se toca con un dedo), fila de bolas de los loops (tocar = silenciar,
// mantener = borrar), bolas del fondo manual, gestos de dos dedos (filtro, espacio, fondo) y
// bucle rAF único.
import { allWeights, stepWeights, type Weights } from '~/lib/aro/bands'
import type { DropGeo } from '~/lib/aro/shape'
import { clampZoom, dropLayout, freeRect, lerpGeo, pinchZoom, wheelZoom, zoomLimits, type Insets } from '~/lib/aro/zoom'
import type { Part } from '~/lib/background'
import { notesInBar } from '~/lib/bass'
import { STYLES } from '~/lib/constants'
import { loopBarAt } from '~/lib/freeLoops'
import { dragValue, lockAxis, type Axis } from '~/lib/gestures'
import { addHit, moveBassNote, moveHit, removeHit, type EditOptions } from '~/lib/loopEdit'
import { VOICE_HEX, type Voice } from '~/lib/palette'
import { INSTRUMENTS } from '~/lib/constants'
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
/** fila de bolas de los loops: encima de Play (E1.1) */
const ROW_FROM_BOTTOM = PLAY_FROM_BOTTOM + 62
const BALL = 22
const BALL_GAP = 36
/** zona de arriba (estilo y ⋯) y de abajo (fila de bolas, Play y fondo) que la gota no pisa (E1.8) */
const TOP_UI = 52
const BOTTOM_UI = ROW_FROM_BOTTOM + 20
/** zonas seguras del sistema (muesca, barra de inicio), medidas con env(safe-area-inset-*) */
const safe = reactive({ top: 0, right: 0, bottom: 0, left: 0 })
const safeProbe = ref<HTMLElement | null>(null)
const insets = computed<Insets>(() => ({
  top: Math.max(TOP_UI, safe.top + 44),
  right: safe.right + 8,
  bottom: BOTTOM_UI + safe.bottom,
  left: safe.left + 8,
}))
const limits = computed(() => zoomLimits(freeRect(view.w, view.h, insets.value)))

// ── zoom (fase 4) ────────────────────────────────────────────────────────────────
// Se guarda relativo al zoom inicial de la forma de ventana: al girar el móvil se conserva la
// sensación (en horizontal sigue pegada arriba y abajo).
const ZOOM_KEY = 'coderbeats:aro:v1'
let zoomRel = 1
/** zoom en vivo durante un pellizco (con resistencia más allá de los límites), o null */
let pinchLive: number | null = null
const zoomNow = () => pinchLive ?? clampZoom(limits.value.initial * zoomRel, limits.value)
function setZoom(z: number) {
  zoomRel = clampZoom(z, limits.value) / limits.value.initial
  try {
    localStorage.setItem(ZOOM_KEY, JSON.stringify({ zoomRel }))
  } catch {
    // sin almacenamiento: solo para esta sesión
  }
}
function loadZoom() {
  try {
    const v = JSON.parse(localStorage.getItem(ZOOM_KEY) ?? 'null') as { zoomRel?: number } | null
    if (v && typeof v.zoomRel === 'number' && Number.isFinite(v.zoomRel)) zoomRel = v.zoomRel
  } catch {
    // sin almacenamiento o dato roto: zoom inicial
  }
}
/** geometría de la gota que se dibuja: se acerca a la de destino en cada frame (sin saltos) */
let geo: DropGeo | null = null
const targetGeo = () => dropLayout(view.w, view.h, insets.value, zoomNow())
const bgBalls = computed(() => {
  const y = view.h - PLAY_FROM_BOTTOM
  return [
    { part: 'bass' as Part, label: 'bajo', x: view.w / 2 - 96, y },
    { part: 'chords' as Part, label: 'acordes', x: view.w / 2 + 96, y },
  ]
})
/** posición de cada bola en la fila, por orden de instrumento (bombo, caja, platillo) */
const rowSlots = computed(() => {
  const order = [...loops.value.loops].sort(
    (a, b) => INSTRUMENTS.indexOf(a.instrument) - INSTRUMENTS.indexOf(b.instrument) || a.id - b.id,
  )
  const y = view.h - ROW_FROM_BOTTOM
  const x0 = view.w / 2 - ((order.length - 1) * BALL_GAP) / 2
  return new Map(order.map((l, i) => [l.id, { x: x0 + i * BALL_GAP, y }]))
})

// ── aro: golpes de cada loop en el compás que se ve ─────────────────────────────
/** compás congelado mientras se arrastra un golpe (E1.1): se edita el compás que se ve */
const editBar = ref<number | null>(null)
const shownBar = () => editBar.value ?? (playing.value ? currentBar.value : 0)
const dotKey = (loopId: number, pos: number) => (loopId < 0 ? `bass-${pos}` : `${loopId}-${Math.round(pos * 100)}`)
const ringDots = computed<AroDot[]>(() => {
  const g = shownBar()
  const out: AroDot[] = []
  for (const l of loops.value.loops) {
    const bar = loopBarAt(l, g)
    for (const h of l.hits) {
      if (h.pos < bar * 16 - 0.5 || h.pos >= bar * 16 + 15.5) continue
      const step = h.pos - bar * 16
      out.push({ key: dotKey(l.id, h.pos), loopId: l.id, step, pos: h.pos, voice: l.instrument, muted: l.muted })
    }
  }
  // el bajo del fondo (o el editado): sus notas del compás que se ve (rayitas; spec 003 §3)
  const bass = engine.bassPattern()
  const bar = ((g % bass.bars) + bass.bars) % bass.bars
  for (const n of notesInBar(bass, g)) {
    const pos = bar * 16 + n.pos
    out.push({ key: dotKey(-1, pos), loopId: -1, step: n.pos, pos, voice: 'bass', muted: false })
  }
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

// ── bolas de los loops (posición fuera de la reactividad; se escribe en el DOM en cada frame) ──
interface Body {
  id: number
  x: number
  y: number
  r: number
}
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

function ensureBody(id: number) {
  const b = bodies.get(id)
  if (b) return b
  const p = rowSlots.value.get(id) ?? { x: view.w / 2, y: view.h - ROW_FROM_BOTTOM }
  const nb: Body = { id, x: p.x, y: p.y, r: BALL / 2 }
  bodies.set(id, nb)
  return nb
}

watch(
  () => loops.value.loops,
  (ls) => {
    const ids = new Set(ls.map((l) => l.id))
    for (const id of [...bodies.keys()]) if (!ids.has(id)) bodies.delete(id)
    for (const l of ls) ensureBody(l.id)
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
  const gg = geo ?? targetGeo()
  const g = { x: gg.cx, y: gg.cy }
  if (h.kind === 'heard' && h.instrument !== 'bass' && h.instrument !== 'chords') {
    const p = aro?.pointOf(h.instrument, h.step ?? 0) ?? { x: g.x, y: g.y }
    theme.hit({ kind: 'heard', time: h.time, loopId: null, instrument: h.instrument, x: p.x, y: p.y, strength: h.strength })
    return
  }
  if (h.kind === 'birth' && h.loopId !== null) {
    const id = h.loopId
    const b = bodies.get(id) ?? ensureBody(id)
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
  // la gota sigue al zoom y a la ventana con suavidad; durante un pellizco, al instante
  const target = targetGeo()
  geo = !geo || reduced || pinchLive !== null ? target : lerpGeo(geo, target, 1 - Math.exp(-dt / 0.12))
  const g = { x: geo.cx, y: geo.cy }

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

  // bolas quietas en su fila (E1.1); al nacer o desaparecer una, las demás se recolocan con suavidad
  const follow = reduced ? 1 : 1 - Math.exp(-dt / 0.15)
  for (const b of bodies.values()) {
    const slot = rowSlots.value.get(b.id)
    if (!slot) continue
    b.x += (slot.x - b.x) * follow
    b.y += (slot.y - b.y) * follow
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
    el.style.boxShadow = glow ? `0 0 ${8 + 18 * k}px ${glow}${k > 0.05 ? '' : '55'}` : 'none'
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
      geo: geo!,
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
  if (safeProbe.value) {
    const cs = getComputedStyle(safeProbe.value)
    safe.top = parseFloat(cs.paddingTop) || 0
    safe.right = parseFloat(cs.paddingRight) || 0
    safe.bottom = parseFloat(cs.paddingBottom) || 0
    safe.left = parseFloat(cs.paddingLeft) || 0
  }
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
  loadZoom()
  measure()
  mountTheme()
  offVisual = engine.onVisual(onEngineVisual)
  window.addEventListener('resize', measure)
  document.addEventListener('gesturestart', noSafariZoom)
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  offVisual?.()
  window.removeEventListener('resize', measure)
  document.removeEventListener('gesturestart', noSafariZoom)
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

// ── interacción: gestos (spec 003, E1.5) ────────────────────────────────────────
// · un dedo: siempre el aro (arrastrar un golpe; tocar una franja vacía crea uno; al centro, se borra)
// · dos dedos juntos: filtro (vertical) y espacio (horizontal), en cualquier sitio
// · pellizcar: zoom (fase 4) · tocar con dos dedos sin moverlos: fondo sí / no
// · ratón: dentro de la gota, el aro; fuera, filtro y espacio; la rueda, zoom (fase 4)
const MOVE_PX = 12
const TAP_MS = 400
const pointers = new Map<number, { x: number; y: number; x0: number; y0: number }>()
/** guía fina del gesto de filtro / espacio */
const drag = ref<{ axis: Axis; x: number; y: number } | null>(null)

type Gesture =
  | { kind: 'aro-drag'; id: number; dot: AroDot }
  | { kind: 'aro-tap'; id: number; x0: number; y0: number; t: number; moved: boolean }
  | { kind: 'fx'; id: number; x0: number; y0: number; filter: number; space: number; axis: Axis }
  | {
      kind: 'two'
      t: number
      c0: { x: number; y: number }
      d0: number
      mode: null | 'pan' | 'pinch'
      axis: Axis
      filter: number
      space: number
      /** zoom al empezar (para el pellizco) */
      z0: number
    }
let gesture: Gesture | null = null

const isDrum = (v: Voice | null): v is Instrument => v === 'bd' || v === 'sd' || v === 'hh'
const editOptions = (): EditOptions => ({ assist: engine.assist.value, quantizeEvery: STYLES[style.value].quantizeEvery })

function twoPoints() {
  const [a, b] = [...pointers.values()]
  return { c: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 }, d: Math.hypot(a!.x - b!.x, a!.y - b!.y) }
}

/** El golpe vuelve a su sitio con rebote (soltado donde no puede ir). */
function bounceBack(dot: AroDot, x: number, y: number) {
  const w = aro?.where(x, y)
  if (w) aro?.settle(dot.key, w.th, w.u)
  else aro?.setDrag(null)
}

function cancelAroDrag() {
  if (gesture?.kind !== 'aro-drag') return
  const p = pointers.get(gesture.id)
  bounceBack(gesture.dot, p?.x ?? 0, p?.y ?? 0)
  editBar.value = null
}

/** Soltar un golpe (E1.4). */
function dropDot(dot: AroDot, x: number, y: number) {
  if (!aro) return
  const w = aro.where(x, y)
  const o = editOptions()
  const g = shownBar()
  // el bajo se mueve solo en el tiempo y no sale de su franja
  if (dot.loopId < 0) {
    if (w.voice !== 'bass') return bounceBack(dot, x, y)
    const r = moveBassNote(engine.bassPattern(), dot.pos, w.step, o)
    if (!r) return bounceBack(dot, x, y)
    engine.setBass(r.pattern)
    aro.settle(dotKey(-1, r.pos), w.th, w.u)
    return
  }
  // al centro: se borra con una salpicadura
  if (w.u < 0) {
    aro.setDrag(null)
    aro.splash(x, y, dot.voice)
    engine.editLoops(removeHit(loops.value, dot.loopId, dot.pos))
    return
  }
  // fuera de la gota: a la franja de fuera (platillo); solo entre baterías
  const target = w.u >= 1 ? 'hh' : w.voice
  if (!isDrum(target) || !isDrum(dot.voice)) return bounceBack(dot, x, y)
  const r = moveHit(loops.value, dot.loopId, dot.pos, target, w.step, g, o)
  if (!r) return bounceBack(dot, x, y)
  engine.editLoops(r.state)
  aro.settle(dotKey(r.hit.loopId, r.hit.pos), w.th, Math.min(1, w.u))
}

/** Tocar una franja vacía de batería: crea un golpe ahí, ya imantado. */
function tapCreate(x: number, y: number) {
  if (!aro) return
  const w = aro.where(x, y)
  if (!isDrum(w.voice)) return
  const r = addHit(loops.value, w.voice, w.step, shownBar(), editOptions())
  if (!r) return
  engine.editLoops(r.state)
  aro.spawn(dotKey(r.hit.loopId, r.hit.pos), w.th)
}

function onDown(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
  const mouse = e.pointerType === 'mouse'
  if (!mouse && pointers.size === 2) {
    // entra el segundo dedo: lo que hiciera el primero se deshace
    cancelAroDrag()
    const { c, d } = twoPoints()
    gesture = { kind: 'two', t: performance.now(), c0: c, d0: d, mode: null, axis: null, filter: fx.filter, space: fx.space, z0: zoomNow() }
    return
  }
  if (pointers.size !== 1) return
  const x = e.clientX
  const y = e.clientY
  const dot = aro?.pick(x, y)
  if (dot) {
    editBar.value = shownBar()
    gesture = { kind: 'aro-drag', id: e.pointerId, dot }
    aro!.setDrag(dot.key, x, y)
    return
  }
  const w = aro?.where(x, y)
  const inside = !!w && w.u <= 1
  if (inside) gesture = { kind: 'aro-tap', id: e.pointerId, x0: x, y0: y, t: performance.now(), moved: false }
  else if (mouse) gesture = { kind: 'fx', id: e.pointerId, x0: x, y0: y, filter: fx.filter, space: fx.space, axis: null }
  else gesture = null
}

function onMove(e: PointerEvent) {
  const p = pointers.get(e.pointerId)
  if (!p) return
  p.x = e.clientX
  p.y = e.clientY
  const gs = gesture
  if (!gs) return
  if (gs.kind === 'aro-drag' && gs.id === e.pointerId) aro?.setDrag(gs.dot.key, p.x, p.y)
  else if (gs.kind === 'aro-tap' && gs.id === e.pointerId) {
    if (Math.hypot(p.x - gs.x0, p.y - gs.y0) > MOVE_PX) gs.moved = true
  } else if (gs.kind === 'fx' && gs.id === e.pointerId) {
    const dx = p.x - gs.x0
    const dy = p.y - gs.y0
    gs.axis ??= lockAxis(dx, dy)
    applyFx(gs.axis, gs.filter, gs.space, dx, dy, p.x, p.y)
  } else if (gs.kind === 'two' && pointers.size === 2) {
    const { c, d } = twoPoints()
    const dcx = c.x - gs.c0.x
    const dcy = c.y - gs.c0.y
    const dd = d - gs.d0
    // arrastre o pellizco: se decide tras 12 px, para todo el gesto
    if (!gs.mode && Math.max(Math.hypot(dcx, dcy), Math.abs(dd)) > MOVE_PX)
      gs.mode = Math.abs(dd) > Math.hypot(dcx, dcy) ? 'pinch' : 'pan'
    if (gs.mode === 'pan') {
      gs.axis ??= lockAxis(dcx, dcy)
      applyFx(gs.axis, gs.filter, gs.space, dcx, dcy, c.x, c.y)
    }
    // pellizco: zoom continuo, con resistencia más allá de los límites (al soltar, vuelve)
    if (gs.mode === 'pinch') pinchLive = pinchZoom(gs.z0, gs.d0, d, limits.value)
  }
}

/** Fin de un pellizco: el zoom vuelve a los límites con suavidad y se guarda. */
function endPinch() {
  if (pinchLive === null) return
  const z = pinchLive
  pinchLive = null
  setZoom(z)
}

/** Rueda (o pellizco del trackpad): zoom (E1.5). */
function onWheel(e: WheelEvent) {
  e.preventDefault()
  setZoom(wheelZoom(zoomNow(), e.deltaY, e.ctrlKey, limits.value))
}

function applyFx(axis: Axis, filter: number, space: number, dx: number, dy: number, x: number, y: number) {
  if (!axis) return
  drag.value = { axis, x, y }
  if (axis === 'y') engine.setFx({ filter: dragValue(filter, 'y', dy, view.h) })
  else engine.setFx({ space: dragValue(space, 'x', dx, view.w) })
}

function onUp(e: PointerEvent, cancelled = false) {
  const p = pointers.get(e.pointerId)
  const gs = gesture
  if (gs?.kind === 'aro-drag' && gs.id === e.pointerId) {
    if (cancelled || !p) cancelAroDrag()
    else dropDot(gs.dot, p.x, p.y)
    editBar.value = null
    gesture = null
  } else if (gs?.kind === 'aro-tap' && gs.id === e.pointerId) {
    if (!cancelled && p && !gs.moved && performance.now() - gs.t < 500) tapCreate(p.x, p.y)
    gesture = null
  } else if (gs?.kind === 'fx' && gs.id === e.pointerId) gesture = null
  pointers.delete(e.pointerId)
  // al levantar un dedo del pellizco, termina
  if (gs?.kind === 'two' && gs.mode === 'pinch') endPinch()
  if (gs?.kind === 'two' && pointers.size === 0) {
    if (!cancelled && !gs.mode && performance.now() - gs.t < TAP_MS) engine.toggleBackground()
    gesture = null
  }
  if (pointers.size === 0) drag.value = null
}

/** iOS: sin el zoom propio de Safari con dos dedos (E1.5) */
const noSafariZoom = (e: Event) => e.preventDefault()

const fill: Record<Instrument, string> = { bd: VOICE_HEX.bd, sd: VOICE_HEX.sd, hh: VOICE_HEX.hh }
/** medidas reales de la ventana, para el diagnóstico (§16.18) */
const layoutInfo = () => {
  const r = root.value?.getBoundingClientRect()
  return [
    `ventana ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}`,
    `escenario ${r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}` : '—'}`,
    `documento ${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight}`,
    `aro (${Math.round(geo?.cx ?? 0)}, ${Math.round(geo?.cy ?? 0)}) r ${Math.round(geo?.R ?? 0)} zoom ${zoomNow().toFixed(2)} (${limits.value.min}–${limits.value.max.toFixed(2)}) detalle ${aroDetail}`,
    `zonas seguras ${safe.top}/${safe.right}/${safe.bottom}/${safe.left}`,
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
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp($event)"
    @pointercancel="onUp($event, true)"
    @wheel="onWheel"
  >
    <div ref="canvasHost" style="position: absolute; inset: 0" />
    <!-- mide las zonas seguras del sistema (muesca, barra de inicio) -->
    <div
      ref="safeProbe"
      aria-hidden="true"
      style="position: absolute; visibility: hidden; pointer-events: none; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)"
    />

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

    <!-- bolas de los loops: pequeñas y quietas, en fila (spec 003, E1.1) -->
    <button
      v-for="l in loops.loops"
      :key="l.id"
      :ref="setEl(l.id)"
      class="loop-ball absolute top-0 left-0 rounded-full will-change-transform"
      :style="{
        width: `${BALL}px`,
        height: `${BALL}px`,
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
/* zona de toque de 40 px aunque la bola mida 22 */
.loop-ball::after {
  content: '';
  position: absolute;
  inset: -9px;
  border-radius: 9999px;
}
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

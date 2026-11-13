<script setup lang="ts">
// Capa visual común (§16.14, §16.16, §16.17; spec 003): canvas del tema, el aro (gota con una
// franja por instrumento, que se toca con un dedo), fila de bolas de los loops (tocar = silenciar,
// mantener = borrar), bolas del fondo manual, gestos de dos dedos (filtro, espacio, fondo) y
// bucle rAF único.
import { allWeights, stepWeights, type Weights } from '~/lib/aro/bands'
import { stepAngle, type DropGeo } from '~/lib/aro/shape'
import { dropAction } from '~/lib/aro/drop'
import { suggestions } from '~/lib/aro/guide'
import {
  approachBlend,
  backToFront,
  boundsCenter,
  cellAtPoint,
  cellProgress,
  clampCam,
  clampToRect,
  colonyCam,
  colonyMinZoom,
  crowdAlpha,
  DOUBLE_TAP_MS,
  depthAlpha,
  depthParallax,
  depthScale,
  HANDLE_HIT,
  HANDLE_MIN_R,
  handlePoint,
  inColony,
  isDoubleTap,
  lastTurnFill,
  mapToScreen,
  mixCam,
  panBy,
  pulseScale as beatScale,
  screenToMap,
  settleZoom,
  spotAt,
  threadPairs,
  turnIndex,
  type Disc,
  type Point,
} from '~/lib/aro/colony'
import { Drift, GLIDE_TAU, glideEnd, linkedIds, releaseVelocity, type Sample } from '~/lib/aro/drift'
import { edgeMarkers } from '~/lib/aro/markers'
import { transitionAt } from '~/lib/aro/transition'
import { clampZoom, contourPoints, dropLayout, freeRect, lerpGeo, moveGeo, pinchZoom, scaleGeo, stretchOf, wheelZoom, zoomLimits, type Insets } from '~/lib/aro/zoom'
import type { Part } from '~/lib/background'
import { notesInBar } from '~/lib/bass'
import { STYLES } from '~/lib/constants'
import { fitTurns, type Cell } from '~/lib/cells'
import { loopBarAt, type FreeLoop } from '~/lib/freeLoops'
import { dragValue, lockAxis, type Axis } from '~/lib/gestures'
import { allArmed } from '~/lib/lanes'
import { approachTilt, followBase, parallaxOffset, tiltTarget, toFront, type AroView, type Tilt } from '~/lib/aro/view'
import { addHit, moveHit, removeHit, type EditOptions } from '~/lib/loopEdit'
import { STYLE_MUSIC } from '~/lib/styles'
import { VOICE_HEX, type Voice } from '~/lib/palette'
import { INSTRUMENTS } from '~/lib/constants'
import type { Instrument } from '~/lib/types'
import { DEFAULT_THEME, themeById } from '~/themes'
import type { VisualTheme } from '~/themes/types'
import { AroCanvas, type AroDot, type AroFrame } from './AroCanvas'

const props = withDefaults(defineProps<{ themeId?: string }>(), { themeId: DEFAULT_THEME })
const engine = useAudioEngine()
const { loops, playing, phrase, fx, bgParts, bgMode, bgManual, style, currentBar, looping } = engine

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
/** móvil en horizontal (E2.1): controles a los lados y la gota de arriba abajo */
const { compact } = useLayoutMode()
/** ancho de cada columna lateral en horizontal (px) */
const SIDE = 88
const insets = computed<Insets>(() =>
  compact.value
    ? { top: safe.top + 8, right: safe.right + SIDE, bottom: safe.bottom + 8, left: safe.left + SIDE }
    : { top: Math.max(TOP_UI, safe.top + 44), right: safe.right + 8, bottom: BOTTOM_UI + safe.bottom, left: safe.left + 8 },
)
const limits = computed(() => zoomLimits(freeRect(view.w, view.h, insets.value), compact.value))
/** posiciones de las células en el mapa; con varias, el zoom baja hasta la colonia (spec 005, §7) */
const cellPoints = computed(() => engine.song.value.cells.map((c) => c.at))
const fullLimits = computed(() => {
  const l = limits.value
  if (cellPoints.value.length < 1) return l
  return { ...l, min: Math.min(l.min, colonyMinZoom(cellPoints.value, freeRect(view.w, view.h, insets.value))) }
})
/** gestos de colonia (zoom alejado); la interfaz de cerca (bolas, chapa, marcadores) se oculta */
const colony = ref(false)
/** centro de las columnas laterales en horizontal (Play, bajo y acordes a la derecha; estilo y bolas a la izquierda) */
const sideX = computed(() => ({ left: safe.left + 40, right: view.w - safe.right - 48 }))

// ── zoom (fase 4) ────────────────────────────────────────────────────────────────
// Se guarda relativo al zoom inicial de la forma de ventana: al girar el móvil se conserva la
// sensación (en horizontal sigue pegada arriba y abajo).
const ZOOM_KEY = 'coderbeats:aro:v1'
let zoomRel = 1
/** último zoom de cerca: al tocar una célula en la colonia se vuelve a él, y es el único que se guarda */
let nearRel = 1
let settleTimer: ReturnType<typeof setTimeout> | null = null
/** zoom en vivo durante un pellizco (con resistencia más allá de los límites), o null */
let pinchLive: number | null = null
const zoomNow = () => pinchLive ?? clampZoom(limits.value.initial * zoomRel, fullLimits.value)
function setZoom(z: number) {
  zoomRel = clampZoom(z, fullLimits.value) / limits.value.initial
  // el zoom de la colonia no se guarda (spec 005, decisión 13): solo el de cerca
  if (zoomRel * limits.value.initial < limits.value.min - 1e-6) return
  nearRel = zoomRel
  try {
    localStorage.setItem(ZOOM_KEY, JSON.stringify({ zoomRel }))
  } catch {
    // sin almacenamiento: solo para esta sesión
  }
}
function loadZoom() {
  try {
    const v = JSON.parse(localStorage.getItem(ZOOM_KEY) ?? 'null') as { zoomRel?: number } | null
    if (v && typeof v.zoomRel === 'number' && Number.isFinite(v.zoomRel)) nearRel = zoomRel = v.zoomRel
  } catch {
    // sin almacenamiento o dato roto: zoom inicial
  }
}
/** geometría de la gota que se dibuja: se acerca a la de destino en cada frame (sin saltos) */
let geo: DropGeo | null = null
const targetGeo = () => dropLayout(view.w, view.h, insets.value, zoomNow())
const bgBalls = computed(() => {
  if (compact.value) {
    const x = sideX.value.right
    return [
      { part: 'bass' as Part, label: 'bajo', x, y: view.h / 2 - 84 },
      { part: 'chords' as Part, label: 'acordes', x, y: view.h / 2 + 84 },
    ]
  }
  const y = view.h - PLAY_FROM_BOTTOM
  return [
    { part: 'bass' as Part, label: 'bajo', x: view.w / 2 - 96, y },
    { part: 'chords' as Part, label: 'acordes', x: view.w / 2 + 96, y },
  ]
})
/** "∞ ▶ seguir canción": junto a Play, donde estaría la bola de acordes (que en la colonia se oculta) */
const releaseStyle = computed(() => {
  const x = compact.value ? sideX.value.right - 40 : view.w / 2 + 112
  const y = compact.value ? view.h / 2 + 84 : view.h - PLAY_FROM_BOTTOM
  return { left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)' }
})
/** "↶ deshacer": a la altura de la fila de bolas; en la colonia, a la izquierda de "◎ centrar" si está */
const undoStyle = computed(() => {
  const shift = colony.value && panned.value ? 56 : 0
  const x = compact.value ? sideX.value.left : view.w / 2 - shift
  // cerca, un poco por encima de las bolas para no taparlas
  const y = compact.value ? view.h / 2 + 44 : view.h - ROW_FROM_BOTTOM - (colony.value ? 0 : 40)
  return { left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)' }
})
/** "◎ centrar": donde estaría la fila de bolas (que en la colonia se oculta) */
const followStyle = computed(() => {
  const x = compact.value ? sideX.value.left : view.w / 2 + (engine.undoInfo.value ? 62 : 0)
  const y = compact.value ? view.h / 2 : view.h - ROW_FROM_BOTTOM
  return { left: `${x}px`, top: `${y}px`, transform: 'translate(-50%, -50%)' }
})
/** posición de cada bola en la fila, por orden de instrumento (bombo, caja, platillo) */
const rowSlots = computed(() => {
  const order = [...loops.value.loops].sort(
    (a, b) => INSTRUMENTS.indexOf(a.instrument) - INSTRUMENTS.indexOf(b.instrument) || a.id - b.id,
  )
  if (compact.value) {
    // en horizontal, en columna a la izquierda, debajo del estilo
    const top = safe.top + 120
    const bottom = view.h - safe.bottom - 12
    const gap = order.length > 1 ? Math.min(BALL_GAP, (bottom - top) / (order.length - 1)) : 0
    const y0 = (top + bottom) / 2 - ((order.length - 1) * gap) / 2
    return new Map(order.map((l, i) => [l.id, { x: sideX.value.left, y: y0 + i * gap }]))
  }
  const y = view.h - ROW_FROM_BOTTOM
  const x0 = view.w / 2 - ((order.length - 1) * BALL_GAP) / 2
  return new Map(order.map((l, i) => [l.id, { x: x0 + i * BALL_GAP, y }]))
})

// ── aro: golpes de cada loop en el compás que se ve ─────────────────────────────
/** compás congelado mientras se arrastra un golpe (E1.1): se edita el compás que se ve */
const editBar = ref<number | null>(null)
const shownBar = () => editBar.value ?? (playing.value ? currentBar.value : 0)
const dotKey = (loopId: number, pos: number) => (loopId < 0 ? `bass-${pos}` : `${loopId}-${Math.round(pos * 100)}`)
/** Golpes de unos loops (y las notas del bajo) en el compás `g` de su célula. */
function dotsOf(ls: readonly FreeLoop[], g: number): AroDot[] {
  const out: AroDot[] = []
  for (const l of ls) {
    const bar = loopBarAt(l, g)
    for (const h of l.hits) {
      if (h.pos < bar * 16 - 0.5 || h.pos >= bar * 16 + 15.5) continue
      const step = h.pos - bar * 16
      out.push({ key: dotKey(l.id, h.pos), loopId: l.id, step, pos: h.pos, voice: l.instrument, muted: l.muted })
    }
  }
  // el bajo del fondo: sus notas del compás que se ve (rayita y arco; solo se ve, E1.4)
  const bass = STYLE_MUSIC[style.value].background.bass
  const bar = ((g % bass.bars) + bass.bars) % bass.bars
  for (const n of notesInBar(bass, g)) {
    const pos = bar * 16 + n.pos
    out.push({ key: dotKey(-1, pos), loopId: -1, step: n.pos, pos, dur: n.dur, voice: 'bass', muted: false })
  }
  return out
}
/** golpes del compás 0 de cada célula de fondo: no cambian entre frames, así que se calculan una vez por loops y estilo */
const crowdDotsCache = new Map<number, { loops: readonly FreeLoop[]; style: string; dots: AroDot[] }>()
function crowdDots(c: Cell): AroDot[] {
  const hit = crowdDotsCache.get(c.id)
  if (hit && hit.loops === c.loops && hit.style === style.value) return hit.dots
  const dots = dotsOf(c.loops, 0)
  crowdDotsCache.set(c.id, { loops: c.loops, style: style.value, dots })
  return dots
}
const ringDots = computed<AroDot[]>(() => dotsOf(loops.value.loops, shownBar()))
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
/** sugerencias del estilo en las franjas de batería sin golpes en el compás que se ve (E3.3) */
const guideSuggestions = computed(() =>
  suggestions(style.value, new Set(ringDots.value.map((d) => d.voice)), {
    assist: engine.assist.value,
    quantizeEvery: STYLES[style.value].quantizeEvery,
  }),
)
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
      if (!colony.value) theme?.birth({ time: h.time, loopId: id, instrument: h.instrument as Instrument, x: nb.x, y: nb.y })
    }, fallSec * 1000)
    return
  }
  if (h.kind !== 'hit') return
  // fondo: la bola late; el bajo, además, suena en su franja del aro si se oye
  if (h.instrument === 'bass' || h.instrument === 'chords') {
    if (h.instrument === 'bass' && bgParts.value.bass) aro?.lightVoice('bass', h.step ?? 0)
    const ball = bgBalls.value.find((b) => b.part === h.instrument)
    pulse(ballEls.get(h.instrument), h.instrument)
    // las bolas se ocultan en la colonia: sin su agua
    if (ball && !colony.value) theme.hit({ kind: 'hit', time: h.time, loopId: null, instrument: h.instrument, x: ball.x, y: ball.y, strength: 0.3 })
    return
  }
  if (h.loopId === null || falls.has(h.loopId)) return
  // loop: la bola late y brilla y suelta su onda clara; su punto del aro se enciende
  // (sin onda del agua en el aro: la gota tiene las suyas, spec 003 E1.9)
  const strength = 0.6 + 0.4 * h.strength // la mezcla baja la ganancia con muchos loops: la onda no debe desaparecer
  const b = bodies.get(h.loopId)
  if (b && !colony.value) theme.hit({ kind: 'hit', time: h.time, loopId: h.loopId, instrument: h.instrument, x: b.x, y: b.y, strength })
  aro?.light(h.loopId, h.step ?? 0)
  pulse(els.get(h.loopId), h.instrument)
}

// ── se toca en 2D, se mira en 3D (E3.5, E3.6) ─────────────────────────────────────
const motion = useAroMotion()
let lastTouch = performance.now()
let aroView: AroView = { sy: 1, ox: 0, oy: 0 }
let tiltBase: Tilt | null = null
/** cualquier toque (también en bolas y botones) pone el aro de frente */
function touched() {
  lastTouch = performance.now()
}
/** al soltar el dedo: además, el primer toque tras abrir la app pide el permiso del giroscopio (iOS) */
function released() {
  touched()
  motion.onUserGesture()
}
function stepView(dt: number): AroView {
  const sinceS = (performance.now() - lastTouch) / 1000
  const sy = approachTilt(aroView.sy, tiltTarget(sinceS, pointers.size > 0, reduced), dt)
  let ox = 0
  let oy = 0
  const r = motion.reading()
  if (motion.enabled.value && r && !reduced) {
    tiltBase = followBase(tiltBase, r, dt)
    ;({ ox, oy } = parallaxOffset(r, tiltBase))
  } else tiltBase = null
  // el desplazamiento se suaviza un poco (el sensor tiembla)
  const k = 1 - Math.exp(-dt / 0.08)
  return { sy, ox: aroView.ox + (ox - aroView.ox) * k, oy: aroView.oy + (oy - aroView.oy) * k }
}

// ── transición de agua entre células (spec 005, §5.2) ────────────────────────────
/** estiramiento máximo de la gota hacia la siguiente (fracción del radio) */
const PULL_MAX = 0.06
/** con movimiento reducido: la cámara corta y la célula nueva aparece con un fundido de 0,2 s */
const CUT_FADE_MS = 200
let cutAt = -1e9
watch(engine.viewCellId, () => (cutAt = performance.now()))

/**
 * Cámara y transición para este frame: dónde se dibuja la célula que suena y, si toca, la otra
 * gota, el puente y el estiramiento. Las células están en el mapa en radios de gota (§5.1).
 */
/**
 * Cámara del dedo (spec 005, §7.1): al arrastrar el mapa la cámara deja de seguir y aparece "◎ centrar".
 * `panBlend` mezcla la cámara automática (0) con la del dedo (1) para que no haya saltos.
 */
const panned = ref(false)
let manualCam: Point | null = null
let panBlend = 0
/** cámara que se dibujó en el último frame: de ahí parte el arrastre */
let lastCam: Point = { x: 0, y: 0 }

/** ¿se ve alguna parte de esta gota? (con holgura por el estiramiento y los empujones del borde) */
const onScreen = (g: DropGeo): boolean => {
  const m = g.R * 1.3 + 8
  return g.cx + m > 0 && g.cx - m < view.w && g.cy + m > 0 && g.cy - m < view.h
}

/**
 * Mover una célula (§7.1): mientras se arrastra, la célula sigue al dedo (`dragCell`, en el mapa) sin
 * tocar la canción; al soltar se guarda. Se recalcula cada frame desde el dedo, así sigue bajo él
 * aunque la cámara se mueva.
 */
let dragState: { id: number; px: number; py: number; grab: Point } | null = null
let dragCell: { id: number; x: number; y: number } | null = null
/** últimas posiciones de la célula arrastrada (en el mapa): de ellas sale la velocidad al soltar */
const dragTrail: Sample[] = []
/** física sutil (§7.1): las unidas por hilo se dejan llevar, las cercanas se apartan, la movida se desliza al soltar */
const drift = new Drift()
/** tras soltar, la cámara se acerca a la nueva si cambia (la célula movida, o el centro del conjunto) en vez de saltar */
let camSmooth: Point | null = null
let camEaseUntil = 0
const CAM_EASE_MS = 700
/** el hilo que se estira desde el asa de una célula (la 3.3): copia en agua vacía, orden sobre otra célula */
let threadState: { id: number; px: number; py: number } | null = null

/** células recién creadas (id → cuándo): caen como una gota al aparecer */
const spawns = new Map<number, number>()
const SPAWN_MS = 450
function spawnState(id: number): { s: number; a: number } {
  const t0 = spawns.get(id)
  if (t0 === undefined || reduced) return { s: 1, a: 1 }
  const e = Math.min(1, (performance.now() - t0) / SPAWN_MS)
  if (e >= 1) spawns.delete(id)
  return { s: 1 + (1 - e) ** 2 * 0.9, a: e }
}
/** último toque en el agua, para que un doble toque no cree dos células */
let lastWater: { x: number; y: number; t: number } | null = null
/** mantener una célula este tiempo la borra (ms) */
const COLONY_HOLD_MS = 600
/** último toque sobre una célula, para el doble toque */
let lastTap: { id: number; t: number } | null = null

/** células tocables de la colonia en este frame (centros y radio en px, sin la inclinación) */
/** la célula que suena, tal como se dibujó en el último frame: de ahí sale el pulso del agua en la colonia */
let curShown: DropGeo | null = null

let colonyPick: {
  discs: Disc[]
  cy: number
  free: DropGeo['free']
  /** punto del mapa bajo un punto de frente de la pantalla, para una célula a esa profundidad */
  toMap: (fx: number, fy: number, depth: number) => Point
  /** lo contrario: dónde cae un punto del mapa en la pantalla (de frente) */
  toScreen: (p: Point, depth: number) => Point
  /** el asa de cada célula (de frente), para cogerla */
  handles: { id: number; x: number; y: number }[]
} | null = null

function cellScene(
  base: DropGeo,
  pos: number,
  zEff: number,
  dt: number,
): Pick<AroFrame, 'geo' | 'ghost' | 'bridge' | 'pull' | 'alpha' | 'crowd' | 'halo' | 'threads' | 'labels' | 'progress' | 'handles' | 'threadDrag'> & { plan: ReturnType<typeof engine.cellPlan>; cam: { x: number; y: number } } {
  const alpha = reduced && playing.value ? Math.min(1, (performance.now() - cutAt) / CUT_FADE_MS) : 1
  const plan = engine.cellPlan()
  const all = engine.song.value.cells
  const here = all.find((c) => c.id === engine.viewCellId.value)
  const spot = (c: Cell) => ({ id: c.id, x: c.at.x, y: c.at.y })
  const tr = plan
    ? transitionAt(pos, { cur: spot(plan.cur), start: plan.start, end: plan.end, next: spot(plan.next), prev: plan.prev && spot(plan.prev) }, reduced)
    : null
  // en la colonia la cámara pasa de la célula que suena al centro del conjunto (§7.1)
  const follow = tr?.cam ?? { x: here?.at.x ?? 0, y: here?.at.y ?? 0 }
  const auto = cellPoints.value.length > 1 ? colonyCam(follow, boundsCenter(cellPoints.value), zEff, fullLimits.value.min) : follow
  let cam = mixCam(auto, manualCam, panBlend)
  // tras mover una célula cambia el centro del conjunto (y quizá la célula que sigue la cámara): se acerca, no salta
  if (!reduced && camSmooth && performance.now() < camEaseUntil) {
    const ke = 1 - Math.exp(-dt / 0.15)
    cam = { x: camSmooth.x + (cam.x - camSmooth.x) * ke, y: camSmooth.y + (cam.y - camSmooth.y) * ke }
  }
  camSmooth = cam
  lastCam = cam
  // profundidad (§7.2): al alejar, las del fondo se ven más pequeñas, más tenues y se mueven menos con el mapa
  const k = all.length > 0 ? crowdAlpha(zEff) : 0
  const pfOf = (depth: number) => (reduced ? 1 : depthParallax(depth, k)) // con movimiento reducido, sin parallax
  const toMap = (fx: number, fy: number, depth: number): Point => screenToMap({ x: fx, y: fy }, { x: base.cx, y: base.cy }, base.R, cam, pfOf(depth))
  // la célula que se arrastra sigue al dedo (se recalcula cada frame, aunque la cámara se mueva)
  dragCell = null
  if (dragState && colonyPick) {
    const dc = all.find((c) => c.id === dragState!.id)
    if (dc) {
      const [fx, fy] = toFront(dragState.px, dragState.py, aroView, 0, colonyPick.cy)
      const f = clampToRect({ x: fx, y: fy }, base.free)
      const m = toMap(f.x, f.y, dc.at.depth)
      dragCell = { id: dc.id, x: m.x + dragState.grab.x, y: m.y + dragState.grab.y }
      dragTrail.push({ t: performance.now(), x: dragCell.x, y: dragCell.y })
      if (dragTrail.length > 12) dragTrail.shift()
    }
  }
  const atOf = (c: Cell) => (dragCell && dragCell.id === c.id ? dragCell : c.at)
  const place = (c: Cell) => {
    const pf = pfOf(c.at.depth)
    const at = atOf(c)
    // la física solo se ve en la colonia
    const o = drift.offset(c.id)
    return scaleGeo(moveGeo(base, (at.x + o.x * k - cam.x) * base.R * pf, (at.y + o.y * k - cam.y) * base.R * pf), depthScale(c.at.depth, k) * spawnState(c.id).s)
  }
  const toScreen = (p: Point, depth: number): Point => mapToScreen(p, { x: base.cx, y: base.cy }, base.R, cam, pfOf(depth))
  const weightsOf = (c: Cell) => ({ ...allWeights(1), bass: c.parts.bass && bgMode.value !== 'off' ? 1 : 0, mel: 0 })
  const curCell = plan?.cur ?? here
  const geo = curCell ? place(curCell) : base
  curShown = geo

  // las demás células, pequeñas y quietas (solo se miran), mientras se aleja el zoom; del fondo al frente
  const skip = new Set([curCell?.id, tr?.ghost?.id])
  const placed = new Map(all.map((c) => [c.id, place(c)]))
  const crowd =
    k > 0.01
      ? backToFront(
          all
            // las que quedan fuera de la pantalla no se dibujan
            .filter((c) => !skip.has(c.id) && onScreen(placed.get(c.id)!))
            .map((c) => ({ c, id: c.id, depth: c.at.depth })),
        ).map(({ c }) => ({
          geo: placed.get(c.id)!,
          weights: weightsOf(c),
          dots: crowdDots(c),
          alpha: k * 0.85 * depthAlpha(c.at.depth, k) * spawnState(c.id).a,
        }))
      : undefined
  colonyPick = colony.value
    ? {
        discs: all.map((c) => ({ id: c.id, x: placed.get(c.id)!.cx, y: placed.get(c.id)!.cy, r: placed.get(c.id)!.R, depth: c.at.depth })),
        cy: geo.cy,
        free: base.free,
        toMap,
        toScreen,
        handles: [],
      }
    : null
  // asas (§7.1): un puntito en el borde de cada célula de la canción, hacia la siguiente; solo con radio suficiente
  const order = engine.song.value.order
  const handles: { id: number; x: number; y: number; alpha: number }[] = []
  if (k > 0.01)
    for (const c of all) {
      const g = placed.get(c.id)!
      if (g.R < HANDLE_MIN_R) continue
      const nextId = order[order.indexOf(c.id) + 1]
      const ng = nextId !== undefined ? placed.get(nextId) : undefined
      const p = handlePoint({ x: g.cx, y: g.cy }, g.R, ng ? { x: ng.cx, y: ng.cy } : null)
      handles.push({ id: c.id, x: p.x, y: p.y, alpha: k * depthAlpha(c.at.depth, k) })
    }
  if (colonyPick) colonyPick.handles = handles
  // el hilo que se estira desde un asa hasta el dedo
  let threadDrag: AroFrame['threadDrag'] = null
  if (threadState && colonyPick) {
    const h = handles.find((x) => x.id === threadState!.id)
    if (h) {
      const [fx, fy] = toFront(threadState.px, threadState.py, aroView, 0, colonyPick.cy)
      const to = clampToRect({ x: fx, y: fy }, base.free)
      const targetId = cellAtPoint(to.x, to.y, colonyPick.discs.filter((d) => d.id !== threadState!.id))
      const td = targetId !== null ? colonyPick.discs.find((d) => d.id === targetId) : undefined
      threadDrag = { from: { x: h.x, y: h.y }, to, target: td ? { x: td.x, y: td.y, r: td.r } : null, ghostR: td ? null : placed.get(threadState.id)!.R }
    }
  }
  const live = !!plan && playing.value
  const halo = live ? k : 0
  // cuánto falta para cambiar (§7.2): el anillo de la que suena se llena con sus vueltas; en bucle no avanza
  const looped = !!plan && !Number.isFinite(plan.end)
  const progress = live && plan ? cellProgress(pos, plan.start, plan.end) : undefined

  // hilos de orden (§7.2): entre las consecutivas, tenues; por el de la que suena corre el brillo de la transición
  const byId = new Map(all.map((c) => [c.id, c]))
  const threads =
    k > 0.01
      ? threadPairs(order, (id) => byId.has(id)).map(([a, b]) => ({
          from: placed.get(a)!,
          to: placed.get(b)!,
          alpha: k * Math.min(depthAlpha(byId.get(a)!.at.depth, k), depthAlpha(byId.get(b)!.at.depth, k)),
          glow: tr?.thread && tr.thread.fromId === a && tr.thread.toId === b ? tr.thread.glow : null,
          // en la última vuelta, el hilo hacia la siguiente se va llenando
          fill: live && plan && plan.cur.id === a && plan.next.id === b ? lastTurnFill(pos, plan.end) : undefined,
        }))
      : undefined
  // número de vueltas junto a cada célula, pequeño y tenue; la que se ve cuenta con lo que cabe en sus loops
  const labels =
    k > 0.01
      ? all.map((c) => {
          const g = placed.get(c.id)!
          const turns = c.id === engine.viewCellId.value ? fitTurns(c.turns, loops.value.loops) : c.turns
          const base = { x: g.cx, y: g.cy + g.R + 11, text: String(turns), alpha: 0.5 * k * depthAlpha(c.at.depth, k) }
          // en la que suena, puntitos de vueltas (●●○○) en vez del número; en bucle, ∞
          if (live && plan && c.id === plan.cur.id)
            return looped
              ? { ...base, text: '∞', alpha: 0.8 * k }
              : { ...base, alpha: 0.7 * k, dots: { turns: plan.cur.turns, turn: turnIndex(pos, plan.start, plan.cur.turns) } }
          return base
        })
      : undefined

  if (!plan || !tr) return { geo, alpha, plan, cam, crowd, halo, threads, labels, progress, handles, threadDrag }
  const cellOf = (id: number) => (id === plan.cur.id ? plan.cur : id === plan.next.id ? plan.next : plan.prev!)
  let ghost: AroFrame['ghost'] = null
  if (tr.ghost) {
    const c = cellOf(tr.ghost.id)
    ghost = {
      geo: place(c),
      weights: weightsOf(c),
      // la que entra, en su primer compás; la que se apaga, en el último que sonó
      dots: dotsOf(c.loops, c.id === plan.next.id ? 0 : c.turns - 1),
      alpha: tr.ghost.alpha,
    }
  }
  const bridge = tr.bridge && { from: place(cellOf(tr.bridge.fromId)), to: place(cellOf(tr.bridge.toId)), t0: tr.bridge.t0, t1: tr.bridge.t1, glow: tr.bridge.glow }
  const pull =
    tr.pull > 0
      ? { th: Math.atan2(plan.next.at.y - plan.cur.at.y, plan.next.at.x - plan.cur.at.x), a: tr.pull * PULL_MAX * base.R }
      : null
  return { geo, ghost, bridge, pull, alpha, plan, cam, crowd, halo, threads, labels, progress, handles, threadDrag }
}

// ── chapa de vueltas y marcadores del borde (spec 005, §5.3 y §6) ────────────────
/** chapa: gotita pegada al borde, arriba, donde empieza la aguja */
const chapaEl = ref<HTMLElement | null>(null)
const chapa = ref({ show: false, turn: 0, turns: 1, loop: false })
function updateChapa(plan: ReturnType<typeof engine.cellPlan>, pos: number) {
  const edge = plan && aro?.edgePoint(-Math.PI / 2)
  if (!plan || !edge || !chapaEl.value) {
    if (chapa.value.show) chapa.value = { ...chapa.value, show: false }
    return
  }
  const turns = plan.cur.turns
  const k = Math.floor(pos - plan.start)
  const turn = plan.loop ? ((k % turns) + turns) % turns : Math.min(turns - 1, Math.max(0, k))
  const c = chapa.value
  if (!c.show || c.turn !== turn || c.turns !== turns || c.loop !== plan.loop) chapa.value = { show: true, turn, turns, loop: plan.loop }
  // pegada al borde por fuera, sin tapar golpes; nunca bajo la muesca
  const y = Math.max(edge.y - 17, safe.top + 18)
  chapaEl.value.style.transform = `translate(${edge.x}px, ${y}px) translate(-50%, -50%)`
}

/** una célula por marcador; solo las que no se ven (todas menos la que se ve) */
const markerCells = computed(() => (engine.multi.value && !colony.value ? engine.song.value.cells.filter((c) => c.id !== engine.viewCellId.value) : []))
const markerEls = new Map<number, HTMLElement>()
const setMarker = (id: number) => (el: Element | ComponentPublicInstance | null) => {
  if (el instanceof HTMLElement) markerEls.set(id, el)
  else markerEls.delete(id)
}
function updateMarkers(base: DropGeo, cam: { x: number; y: number }, nextId: number | null) {
  if (!markerCells.value.length) return
  const items = markerCells.value.map((c) => ({ id: c.id, dx: (c.at.x - cam.x) * base.R, dy: (c.at.y - cam.y) * base.R }))
  for (const m of edgeMarkers(base.free, items, nextId)) {
    const el = markerEls.get(m.id)
    if (!el) continue
    const lead = m.leader === m.id
    el.style.display = lead ? '' : 'none'
    el.dataset.next = String(m.next)
    el.style.transform = `translate(${m.x}px, ${m.y}px) translate(-50%, -50%) scale(${m.count > 1 ? 1.3 : 1})`
  }
}

// ── bucle rAF ────────────────────────────────────────────────────────────────────
let raf = 0
let lastBeat = -1
let lastT = 0
const frameMs: number[] = []
let quality = 1
let aroDetail = 1
/** detalle de las células de fondo en la colonia (0 completo … 2 solo silueta); baja antes que el agua y el aro (§7.2) */
let crowdLevel: 0 | 1 | 2 = 0
/** frames de la ventana de medida en los que se dibujó la colonia */
let crowdFrames = 0

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
        // en la colonia, el pulso sale de la célula que suena, a su escala (el aro grande ya no se ve)
        const cell = colony.value ? curShown : null
        const nearR = limits.value.initial * (Math.min(geo.free.x1 - geo.free.x0, geo.free.y1 - geo.free.y0) / 2)
        theme.beat({
          time: clock.time,
          beat,
          downbeat: beat === 0,
          x: cell ? cell.cx : g.x,
          y: cell ? cell.cy : g.y,
          ...(cell ? { scale: beatScale(cell.R, nearR) } : {}),
        })
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
    const zEff = geo!.R / (Math.min(geo!.free.x1 - geo!.free.x0, geo!.free.y1 - geo!.free.y0) / 2)
    const isColony = inColony(zoomNow(), cellPoints.value.length)
    if (isColony !== colony.value) {
      colony.value = isColony
      // al volver a cerca, la cámara vuelve a seguir a la que suena
      if (!isColony) panned.value = false
    }
    panBlend = approachBlend(panBlend, panned.value && isColony ? 1 : 0, dt, reduced)
    const song = engine.song.value
    const dc = dragCell
    drift.step(
      dt,
      song.cells,
      dc ? { id: dc.id, x: dc.x, y: dc.y, from: song.cells.find((c) => c.id === dc.id)?.at ?? dc } : null,
      dc ? linkedIds(song.order, dc.id) : [],
      reduced,
    )
    const { plan, cam, ...scene } = cellScene(geo!, clock.bar + clock.barPhase, zEff, dt)
    updateMarkers(geo!, cam, plan ? plan.next.id : null)
    const f: AroFrame = {
      wall: t,
      ...scene,
      weights,
      playing: playing.value,
      phase: clock.barPhase,
      dots: ringDots.value,
      phraseDots: phraseDots.value,
      highlight: highlight.value,
      bars: barsInfo.value,
      reduced,
      stepSec: 60 / STYLES[style.value].bpm / 4,
      lanes: allArmed(engine.lanes.value) ? null : engine.lanes.value,
      hold: holdProgress(),
      holdRing: colonyHold(),
      view: (aroView = stepView(dt)),
      crowdDetail: crowdLevel,
      guide: { assist: engine.assist.value, quantizeEvery: STYLES[style.value].quantizeEvery },
      suggestions: guideSuggestions.value,
      // en horizontal, más puntos en el contorno cuanto más se estira (E2.1)
      ...(compact.value ? { contour: contourPoints(stretchOf(scene.geo)) } : {}),
    }
    if (scene.crowd) crowdFrames++
    aro.draw(f)
    updateChapa(colony.value ? null : plan, clock.bar + clock.barPhase)
  }
  frameMs.push(performance.now() - t0)
  if (frameMs.length >= 120) {
    const p95 = [...frameMs].sort((a, b) => a - b)[Math.floor(frameMs.length * 0.95)]!
    frameMs.length = 0
    const inColonyMostly = crowdFrames >= 60
    crowdFrames = 0
    if (p95 > 14) {
      // primero el detalle de las células de fondo (si es lo que se estaba dibujando); luego el agua; luego el aro
      if (inColonyMostly && crowdLevel < 2) {
        crowdLevel = (crowdLevel + 1) as 1 | 2
      } else if (theme?.setQuality && quality > 0.5) {
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
/** mantener un hueco de un carril este tiempo lo enciende o lo apaga (E4.1); antes, es un toque */
const HOLD_MS = 500
const pointers = new Map<number, { x: number; y: number; x0: number; y0: number }>()
/** guía fina del gesto de filtro / espacio */
const drag = ref<{ axis: Axis; x: number; y: number } | null>(null)

type Gesture =
  | { kind: 'aro-drag'; id: number; dot: AroDot }
  | { kind: 'colony'; id: number; x0: number; y0: number; t: number; moved: boolean; lx: number; ly: number; cellId: number | null; grab: Point; held: boolean; handleId: number | null }
  | {
      kind: 'aro-tap'
      id: number
      x0: number
      y0: number
      t: number
      moved: boolean
      /** carril de batería bajo el dedo (mantener lo enciende o apaga, E4.1) */
      lane: Instrument | null
      /** ya se cumplió el tiempo de mantener: al soltar no se crea nada */
      held: boolean
    }
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
  const act = dropAction(dot.voice, w.u, w.voice)
  if (act.kind === 'bounce') return bounceBack(dot, x, y)
  // al centro: se borra con una salpicadura
  if (act.kind === 'delete') {
    aro.setDrag(null)
    aro.splash(x, y, dot.voice)
    engine.editLoops(removeHit(loops.value, dot.loopId, dot.pos))
    return
  }
  // el bajo no se edita (E1.4): no se puede coger, pero por si acaso vuelve a su sitio
  if (dot.loopId < 0) return bounceBack(dot, x, y)
  const r = moveHit(loops.value, dot.loopId, dot.pos, act.to as Instrument, w.step, shownBar(), o)
  if (!r) return bounceBack(dot, x, y)
  engine.editLoops(r.state)
  aro.settle(dotKey(r.hit.loopId, r.hit.pos), w.th, Math.min(1, w.u))
}

/** Tocar una franja vacía de batería: crea un golpe ahí, ya imantado. */
function tapCreate(x: number, y: number) {
  if (!aro) return
  // tocar una sugerencia del estilo pone ese golpe, en su paso exacto (E3.3)
  const sug = aro.pickSuggestion(x, y)
  const w = aro.where(x, y)
  const voice = sug?.voice ?? w.voice
  if (!isDrum(voice)) return
  const r = addHit(loops.value, voice, sug?.step ?? w.step, shownBar(), editOptions())
  if (!r) return
  engine.editLoops(r.state)
  aro.spawn(dotKey(r.hit.loopId, r.hit.pos), sug ? stepAngle(sug.step) : w.th)
}

// ── bucle al tocar el aro (spec 005, §4.1) ───────────────────────────────────────
// Tocar el aro de la célula que suena la deja en bucle. Un instante después de apoyar el dedo, y
// solo si sigue siendo uno (con dos dedos es filtro, espacio o zoom); si lo sueltas antes, al soltar.
const LOOP_DELAY_MS = 120
let loopTimer: ReturnType<typeof setTimeout> | null = null
function disarmLoop() {
  if (loopTimer) clearTimeout(loopTimer)
  loopTimer = null
}
function armLoop() {
  disarmLoop()
  loopTimer = setTimeout(() => {
    loopTimer = null
    if (pointers.size === 1) engine.loopHere()
  }, LOOP_DELAY_MS)
}
function loopNow() {
  if (!loopTimer) return
  disarmLoop()
  engine.loopHere()
}

function onDown(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY })
  const mouse = e.pointerType === 'mouse'
  if (!mouse && pointers.size === 2) {
    // entra el segundo dedo: lo que hiciera el primero se deshace
    disarmLoop()
    endCellDrag(false)
    endThread(false)
    cancelAroDrag()
    const { c, d } = twoPoints()
    gesture = { kind: 'two', t: performance.now(), c0: c, d0: d, mode: null, axis: null, filter: fx.filter, space: fx.space, z0: zoomNow() }
    return
  }
  if (pointers.size !== 1) return
  const x = e.clientX
  const y = e.clientY
  // colonia (zoom alejado): un dedo no toca el aro, toca células (spec 005, §7.1)
  if (colony.value) {
    // el asa tiene prioridad sobre el cuerpo de la célula
    const handleId = handleUnder(x, y)
    const cellId = handleId === null ? cellUnder(x, y) : null
    gesture = { kind: 'colony', id: e.pointerId, x0: x, y0: y, t: performance.now(), moved: false, lx: x, ly: y, cellId, grab: grabOffset(cellId, x, y), held: false, handleId }
    return
  }
  const dot = aro?.pick(x, y)
  if (dot) {
    editBar.value = shownBar()
    armLoop()
    gesture = { kind: 'aro-drag', id: e.pointerId, dot }
    aro!.setDrag(dot.key, x, y)
    return
  }
  const w = aro?.where(x, y)
  const inside = !!w && w.u <= 1
  if (inside) {
    const lane = w && isDrum(w.voice) ? w.voice : null
    gesture = { kind: 'aro-tap', id: e.pointerId, x0: x, y0: y, t: performance.now(), moved: false, lane, held: false }
    armLoop()
  }
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
  } else if (gs.kind === 'colony' && gs.id === e.pointerId) {
    if (Math.hypot(p.x - gs.x0, p.y - gs.y0) > MOVE_PX) gs.moved = true
    // arrastrar agua mueve el mapa; arrastrar una célula la mueve a ella (el asa, con el hilo, es de la 3.3)
    if (gs.moved) {
      if (gs.handleId !== null) threadState = { id: gs.handleId, px: p.x, py: p.y }
      else if (gs.cellId === null) panMap(p.x - gs.lx, p.y - gs.ly)
      else {
        if (!dragState) dragTrail.length = 0
        dragState = { id: gs.cellId, px: p.x, py: p.y, grab: gs.grab }
      }
    }
    gs.lx = p.x
    gs.ly = p.y
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
    // los dos dedos no tienen filtro ni espacio en la colonia (se usan de cerca)
    if (gs.mode === 'pan' && !colony.value) {
      gs.axis ??= lockAxis(dcx, dcy)
      applyFx(gs.axis, gs.filter, gs.space, dcx, dcy, c.x, c.y)
    }
    // pellizco: zoom continuo, con resistencia más allá de los límites (al soltar, vuelve)
    if (gs.mode === 'pinch') pinchLive = pinchZoom(gs.z0, gs.d0, d, fullLimits.value)
  }
}

/** Mueve el mapa con el dedo; el primer movimiento parte de la cámara que se ve y la deja de seguir. */
function panMap(dx: number, dy: number) {
  if (!panned.value || !manualCam) {
    manualCam = { ...lastCam }
    panned.value = true
    panBlend = 1
  }
  // el aro puede estar inclinado: en vertical, el movimiento se mide de frente
  manualCam = clampCam(panBy(manualCam, dx, dy / aroView.sy, geo?.R ?? 1), cellPoints.value)
}

/** Célula bajo un punto de la pantalla en la colonia, o null. */
function cellUnder(x: number, y: number): number | null {
  const pk = colonyPick
  if (!pk) return null
  const [fx, fy] = toFront(x, y, aroView, 0, pk.cy)
  return cellAtPoint(fx, fy, pk.discs)
}

/** Diferencia (en el mapa) entre el centro de la célula y el punto donde se apoyó el dedo: así no salta al agarrarla. */
function grabOffset(id: number | null, x: number, y: number): Point {
  const pk = colonyPick
  const cell = id === null ? undefined : engine.song.value.cells.find((c) => c.id === id)
  if (!pk || !cell) return { x: 0, y: 0 }
  const [fx, fy] = toFront(x, y, aroView, 0, pk.cy)
  const m = pk.toMap(fx, fy, cell.at.depth)
  return { x: cell.at.x - m.x, y: cell.at.y - m.y }
}

/**
 * Suelta la célula que se arrastraba: se guarda su sitio final (o se deja donde estaba, si se cancela).
 * Con la velocidad del dedo, sigue deslizándose y se frena sola; su sitio final se guarda ya (sin la
 * inercia no habría diferencia) y lo que se ve es el camino hasta él. Con movimiento reducido, sin inercia.
 */
function endCellDrag(commit: boolean) {
  if (!dragState) return
  const moved = dragCell
  const trail = dragTrail.slice()
  dragState = null
  dragCell = null
  dragTrail.length = 0
  if (!commit || !moved) return
  camEaseUntil = performance.now() + CAM_EASE_MS
  const cell = engine.song.value.cells.find((c) => c.id === moved.id)
  const pk = colonyPick
  let final: Point = { x: moved.x, y: moved.y }
  let v: Point = { x: 0, y: 0 }
  if (!reduced && cell && pk) {
    const v0 = releaseVelocity(trail, performance.now())
    if (v0.x || v0.y) {
      // la inercia no la saca de la zona libre: si el final cae fuera, se queda en el borde
      const end = glideEnd(final, v0)
      const s = clampToRect(pk.toScreen(end, cell.at.depth), pk.free)
      final = pk.toMap(s.x, s.y, cell.at.depth)
      v = { x: (final.x - moved.x) / GLIDE_TAU, y: (final.y - moved.y) / GLIDE_TAU }
    }
  }
  engine.moveCell(moved.id, final.x, final.y)
  if (v.x || v.y) drift.glide(moved.id, { x: moved.x - final.x, y: moved.y - final.y }, v)
}

/** Asa bajo un punto de la pantalla en la colonia, o null. */
function handleUnder(x: number, y: number): number | null {
  const pk = colonyPick
  if (!pk) return null
  const [fx, fy] = toFront(x, y, aroView, 0, pk.cy)
  return spotAt(fx, fy, pk.handles, HANDLE_HIT)
}

/**
 * Suelta el hilo del asa (§7.1): sobre agua vacía, copia la célula allí (justo después de la original en
 * el orden); sobre otra célula, esa pasa a sonar justo después; sobre la misma, nada.
 */
function endThread(commit: boolean) {
  const ts = threadState
  threadState = null
  const pk = colonyPick
  if (!ts || !commit || !pk) return
  const [fx, fy] = toFront(ts.px, ts.py, aroView, 0, pk.cy)
  const f = clampToRect({ x: fx, y: fy }, pk.free)
  const src = pk.discs.find((d) => d.id === ts.id)
  const targetId = cellAtPoint(f.x, f.y, pk.discs)
  if (targetId === ts.id || !src) return
  if (targetId !== null) return engine.orderAfter(ts.id, targetId)
  const m = pk.toMap(f.x, f.y, src.depth ?? 0)
  const id = engine.copyCell(ts.id, { x: m.x, y: m.y })
  if (id === null) return
  spawns.set(id, performance.now())
  camEaseUntil = performance.now() + CAM_EASE_MS
}

/**
 * Mantener una célula pulsada (§7.1): el anillo se completa alrededor de ella y, a los 0,6 s, se borra
 * (con "↶ deshacer"). Se llama en cada frame; moverse antes cancela el borrado.
 */
function colonyHold(): { x: number; y: number; r: number; p: number } | null {
  const gs = gesture
  if (gs?.kind !== 'colony' || gs.cellId === null || gs.handleId !== null || gs.moved || gs.held || !colonyPick) return null
  const d = colonyPick.discs.find((c) => c.id === gs.cellId)
  if (!d) return null
  const p = (performance.now() - gs.t) / COLONY_HOLD_MS
  if (p >= 1) {
    gs.held = true
    navigator.vibrate?.(12)
    lastTap = null
    camEaseUntil = performance.now() + CAM_EASE_MS
    engine.removeCell(gs.cellId)
    return null
  }
  return { x: d.x, y: d.y, r: Math.max(d.r, 12), p }
}

/** Tocar agua vacía en la colonia: célula nueva, que cae como una gota donde tocas (§7.1). */
function tapWater(x: number, y: number) {
  const pk = colonyPick
  if (!pk) return
  const now = performance.now()
  // un doble toque en el agua no crea dos células
  if (lastWater && now - lastWater.t < DOUBLE_TAP_MS && Math.hypot(x - lastWater.x, y - lastWater.y) < 40) {
    lastWater = null
    return
  }
  lastWater = { x, y, t: now }
  const depth = engine.nextCellDepth()
  const [fx, fy] = toFront(x, y, aroView, 0, pk.cy)
  const f = clampToRect({ x: fx, y: fy }, pk.free)
  const m = pk.toMap(f.x, f.y, depth)
  const id = engine.addCell({ x: m.x, y: m.y, depth })
  if (id === null) return
  spawns.set(id, now)
  camEaseUntil = now + CAM_EASE_MS
}

/**
 * Tocar una célula en la colonia (§7.1): el primer toque actúa al momento (salta a ella en la siguiente
 * línea de compás y queda en bucle, sin acercar); el segundo, a menos de 300 ms sobre la misma, solo
 * entra: el zoom vuelve a cerca, a la célula.
 */
function tapCell(id: number) {
  const now = performance.now()
  if (isDoubleTap(lastTap, id, now)) {
    lastTap = null
    zoomRel = nearRel
    panned.value = false
    return
  }
  lastTap = { id, t: now }
  // tocar otra vez la que está en bucle lo suelta: la canción sigue (§4.1)
  if (engine.loopTarget.value === id) engine.resume()
  else engine.travelTo(id)
}

/** Fin de un pellizco: el zoom vuelve a los límites con suavidad y se guarda. */
function endPinch() {
  if (pinchLive === null) return
  const z = pinchLive
  pinchLive = null
  setZoom(settleZoom(z, limits.value.min))
}

/** Rueda (o pellizco del trackpad): zoom (E1.5). */
function onWheel(e: WheelEvent) {
  e.preventDefault()
  touched()
  setZoom(wheelZoom(zoomNow(), e.deltaY, e.ctrlKey, fullLimits.value))
  // entre el mínimo de la gota y el umbral de la colonia, al parar la rueda vuelve a cerca
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    settleTimer = null
    setZoom(settleZoom(zoomNow(), limits.value.min))
  }, 250)
}

/**
 * Mantener pulsado un hueco de un carril (E4.1): progreso 0..1 para el arco; al llegar a 1, el
 * carril se enciende o se apaga (una vez por gesto). Se llama en cada frame.
 */
function holdProgress(): { x: number; y: number; p: number } | null {
  const gs = gesture
  if (gs?.kind !== 'aro-tap' || !gs.lane || gs.moved || gs.held) return null
  const p = (performance.now() - gs.t) / HOLD_MS
  if (p >= 1) {
    gs.held = true
    engine.toggleLane(gs.lane)
    navigator.vibrate?.(12)
    return null
  }
  return { x: gs.x0, y: gs.y0, p }
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
  if ((gs?.kind === 'aro-drag' || gs?.kind === 'aro-tap') && gs.id === e.pointerId) {
    if (cancelled || pointers.size > 1) disarmLoop()
    else loopNow()
  }
  if (gs?.kind === 'aro-drag' && gs.id === e.pointerId) {
    if (cancelled || !p) cancelAroDrag()
    else dropDot(gs.dot, p.x, p.y)
    editBar.value = null
    gesture = null
  } else if (gs?.kind === 'aro-tap' && gs.id === e.pointerId) {
    if (!cancelled && p && !gs.moved && !gs.held && performance.now() - gs.t < HOLD_MS) tapCreate(p.x, p.y)
    gesture = null
  } else if (gs?.kind === 'colony' && gs.id === e.pointerId) {
    if (dragState) endCellDrag(!cancelled)
    else if (threadState) endThread(!cancelled)
    else if (!cancelled && !gs.moved && !gs.held && performance.now() - gs.t < TAP_MS) {
      // tocar el asa cuenta como tocar su célula
      if (gs.handleId !== null) tapCell(gs.handleId)
      else if (gs.cellId !== null) tapCell(gs.cellId)
      else tapWater(gs.x0, gs.y0)
    }
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
    `aro (${Math.round(geo?.cx ?? 0)}, ${Math.round(geo?.cy ?? 0)}) r ${Math.round(geo?.R ?? 0)} zoom ${zoomNow().toFixed(2)} (${limits.value.min}–${limits.value.max.toFixed(2)}) detalle ${aroDetail} · colonia ${crowdLevel} (${cellPoints.value.length} células)`,
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
    @pointerdown.capture="touched"
    @pointerup.capture="released"
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

    <!-- marcadores del borde (spec 005, §5.3): cada célula que no se ve; tocar uno viaja a ella, en bucle -->
    <button
      v-for="c in markerCells"
      :key="c.id"
      :ref="setMarker(c.id)"
      class="marker absolute top-0 left-0 rounded-full"
      :aria-label="`ir a la célula ${c.name ?? c.id}`"
      @pointerdown.stop
      @click="engine.travelTo(c.id)"
    />

    <!-- chapa de vueltas (spec 005, §6): vuelta en la que va; tocarla deja la célula en bucle, y en bucle sigue la canción -->
    <button
      v-show="chapa.show"
      ref="chapaEl"
      class="chapa absolute top-0 left-0"
      :data-loop="chapa.loop"
      :aria-label="chapa.loop ? 'seguir con la canción' : `vuelta ${chapa.turn + 1} de ${chapa.turns}: tocar para dejarla en bucle`"
      @pointerdown.stop
      @click="chapa.loop ? engine.resume() : engine.loopHere()"
    >
      <template v-if="chapa.loop">
        <span class="chapa-inf">∞</span>
        <span>▶ seguir</span>
      </template>
      <span v-else class="chapa-dots" :style="{ '--cols': Math.min(4, chapa.turns) }">
        <i v-for="i in chapa.turns" :key="i" :class="{ on: i - 1 <= chapa.turn }" />
      </span>
    </button>

    <!-- colonia: tras mover el mapa, "◎ centrar" devuelve la cámara a la célula que suena (spec 005, §7.1) -->
    <button
      v-if="colony && panned"
      class="follow-btn absolute"
      :style="followStyle"
      aria-label="centrar la cámara en la célula que suena"
      @pointerdown.stop
      @click="panned = false"
    >
      ◎ centrar
    </button>

    <!-- deshacer lo último que se borró (una célula o "Borrar todo"), unos 8 s (spec 005, §7.1) -->
    <button
      v-if="engine.undoInfo.value"
      class="undo-btn absolute"
      :style="undoStyle"
      aria-label="deshacer el último borrado"
      @pointerdown.stop
      @click="engine.undo()"
    >
      ↶ deshacer
    </button>

    <!-- colonia: mientras hay bucle, soltarlo desde aquí (la chapa de vueltas no se ve alejado) -->
    <button
      v-if="colony && looping"
      class="release-btn absolute"
      :style="releaseStyle"
      aria-label="seguir con la canción: soltar el bucle"
      @pointerdown.stop
      @click="engine.resume()"
    >
      <span class="chapa-inf">∞</span> ▶ seguir canción
    </button>

    <!-- bolas del fondo (modo manual, §16.17) -->
    <template v-if="bgMode === 'manual' && !colony">
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
      v-show="!colony"
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
/* marcador del borde: puntito de 8 px con zona de toque de 40 */
.marker {
  width: 8px;
  height: 8px;
  background: rgb(255 255 255 / 0.35);
  will-change: transform;
}
.marker::after {
  content: '';
  position: absolute;
  inset: -16px;
  border-radius: 9999px;
}
.marker[data-next='true'] {
  background: #f496bc;
  box-shadow: 0 0 10px rgb(244 150 188 / 0.6);
}
/* "◎ centrar" de la colonia */
.follow-btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 9999px;
  border: 1px solid #f496bc;
  background: rgb(255 255 255 / 0.07);
  color: #f496bc;
  font-size: 12px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.undo-btn {
  height: 30px;
  padding: 0 14px;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.4);
  background: rgb(255 255 255 / 0.09);
  color: rgb(255 255 255 / 0.9);
  font-size: 12px;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.undo-btn::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 9999px;
}
.release-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border-radius: 9999px;
  border: 1px solid #f496bc;
  background: rgb(255 255 255 / 0.07);
  color: #f496bc;
  font-size: 12px;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
.release-btn::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 9999px;
}
.follow-btn::after {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 9999px;
}
/* chapa de vueltas: gotita pegada al borde, arriba */
.chapa {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 44px;
  height: 26px;
  padding: 0 10px;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.3);
  background: rgb(255 255 255 / 0.07);
  color: rgb(255 255 255 / 0.8);
  font-size: 11px;
  letter-spacing: 0.04em;
  white-space: nowrap;
  will-change: transform;
}
.chapa::after {
  content: '';
  position: absolute;
  inset: -9px;
  border-radius: 9999px;
}
.chapa[data-loop='true'] {
  border-color: #f496bc;
  color: #f496bc;
}
.chapa-inf {
  font-size: 13px;
  line-height: 1;
}
.chapa-dots {
  display: grid;
  grid-template-columns: repeat(var(--cols, 4), 6px);
  gap: 4px;
}
.chapa-dots i {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.6);
}
.chapa-dots i.on {
  background: rgb(255 255 255 / 0.9);
}
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

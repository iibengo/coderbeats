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
  curvePoints,
  cellProgress,
  clampCam,
  clampToRect,
  colonyCam,
  colonyMinZoom,
  COLONY_ENTER,
  crowdAlpha,
  DOUBLE_TAP_MS,
  depthAlpha,
  depthParallax,
  depthScale,
  HANDLE_HIT,
  HANDLE_MIN_R,
  LABEL_HIT,
  handlePoint,
  isDoubleTap,
  lastTurnFill,
  mapToScreen,
  mixCam,
  panBy,
  pulseScale as beatScale,
  screenToMap,
  spotAt,
  threadAt,
  threadBend,
  threadControl,
  threadPairs,
  turnIndex,
  type Disc,
  type Point,
  type ThreadSeg,
} from '~/lib/aro/colony'
import { Drift, GLIDE_TAU, glideEnd, linkedIds, releaseVelocity, type Sample } from '~/lib/aro/drift'
import { readJson, writeJson } from '~/lib/storage'
import { cellStrip, MODE_HINT, type Mode } from '~/lib/modes'
import { VARIATION_LABELS } from '~/lib/variations'
import { allLanesFilled, rewardFrame } from '~/lib/reward'
import { advanceGuide, GUIDE_DONE, GUIDE_START, guideLine, guideVisible, type GuideState } from '~/lib/firstMinute'
import CellStrip from '../CellStrip.vue'
import { edgeMarkers } from '~/lib/aro/markers'
import { transitionAt } from '~/lib/aro/transition'
import { clampZoom, contourPoints, dropLayout, freeRect, lerpGeo, moveGeo, pinchZoom, scaleGeo, stretchOf, wheelZoom, zoomLimits, type Insets } from '~/lib/aro/zoom'
import type { Part } from '~/lib/background'
import { notesInBar } from '~/lib/bass'
import { STYLES } from '~/lib/constants'
import { fitTurns, groupIdOf, groupTriggers, MAIN, orderOf, type Cell } from '~/lib/cells'
import { loopBarAt, type FreeLoop } from '~/lib/freeLoops'
import { describeImageDelay } from '~/lib/imageDelay'
import { dragValue, lockAxis, type Axis } from '~/lib/gestures'
import { allArmed } from '~/lib/lanes'
import { approachTilt, followBase, parallaxOffset, tiltTarget, toFront, toScreen as frontToScreen, type AroView, type Tilt } from '~/lib/aro/view'
import { addHit, moveHit, removeHit, type EditOptions } from '~/lib/loopEdit'
import { moveMelNote, resizeMelNote, snapMelMidi, snapMelStep, type MelEditOptions } from '~/lib/melodyEdit'
import { STYLE_MUSIC } from '~/lib/styles'
import { fitToScale, fracToMidi, midiToFrac, rangeOf, scaleNotes } from '~/lib/melodyView'
import { VOICE_HEX, type Voice } from '~/lib/palette'
import { INSTRUMENTS } from '~/lib/constants'
import type { Instrument } from '~/lib/types'
import type { LoopInstrument } from '~/lib/freeLoops'
import { DEFAULT_THEME, themeById } from '~/themes'
import type { VisualTheme } from '~/themes/types'
import { AroCanvas, type AroDot, type AroFrame } from './AroCanvas'
import MelodyOrgan from './MelodyOrgan.vue'
import { governorStep, initialGovernor } from '~/lib/frameGovernor'
import StageOverlay from './StageOverlay.vue'
import WaterKeysOverlay from './WaterKeysOverlay.vue'

const props = withDefaults(defineProps<{ themeId?: string }>(), { themeId: DEFAULT_THEME })
const emit = defineEmits<{ preview: [] }>()
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
/** la fila de acciones va entre Play y la fila de bolas */
const ACTIONS_FROM_BOTTOM = PLAY_FROM_BOTTOM + 52
const ROW_FROM_BOTTOM = PLAY_FROM_BOTTOM + 90
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
/**
 * El modo (spec 011) decide qué tramo del zoom vale: **Jugar** = solo «de cerca» (la gota; sin mapa) y **Componer** = solo el mapa (la colonia).
 * Pellizcar más allá del tramo, o el selector, cambian de modo.
 */
const mode = engine.mode
/** cuánto se suaviza el agua en Jugar (spec 011, §12.1): ondas, estela y destellos al 55–70 %; Componer, como siempre */
const CALM_JUGAR = 0.45
const soft = () => (mode.value === 'jugar' ? 1 - CALM_JUGAR : 1)
const zoomBounds = computed(() => (mode.value === 'jugar' ? limits.value : { ...limits.value, min: fullLimits.value.min, max: COLONY_ENTER - 0.01 }))
/** gestos de colonia (el mapa); la interfaz de cerca (bolas, chapa, marcadores) se oculta */
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
/** zoom efectivo del frame anterior: para saber si se está alejando */
let lastZEff = 1
let settleTimer: ReturnType<typeof setTimeout> | null = null
/** zoom en vivo durante un pellizco (con resistencia más allá de los límites), o null */
let pinchLive: number | null = null
const zoomNow = () => pinchLive ?? clampZoom(limits.value.initial * zoomRel, zoomBounds.value)
function setZoom(z: number) {
  zoomRel = clampZoom(z, zoomBounds.value) / limits.value.initial
  // el zoom de la colonia no se guarda (spec 005, decisión 13): solo el de cerca
  if (mode.value !== 'jugar' || zoomRel * limits.value.initial < limits.value.min - 1e-6) return
  nearRel = zoomRel
  // sin almacenamiento: solo para esta sesión
  writeJson(ZOOM_KEY, { zoomRel })
}
function loadZoom() {
  // sin almacenamiento o dato roto: zoom inicial
  const v = readJson(ZOOM_KEY, (x): x is { zoomRel: number } => !!x && typeof (x as { zoomRel?: unknown }).zoomRel === 'number' && Number.isFinite((x as { zoomRel: number }).zoomRel))
  if (v) nearRel = zoomRel = v.zoomRel
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
/** "◎ Volver a la canción": tras mover el mapa en la colonia, o con la vista fuera de lo que suena (enmienda 3) */
const showFollow = computed(() => (colony.value && panned.value) || engine.viewAway.value)
/** la célula que se está editando (spec 011, §3.4): la que se ve cuando no es la que suena */
const editingName = computed(() => {
  const c = engine.song.value.cells.find((x) => x.id === engine.viewCellId.value)
  return c?.name?.trim() || `célula ${engine.viewCellId.value}`
})
/** la tira de células de Jugar: solo si hay más de una parte */
const strip = computed(() => (mode.value === 'jugar' ? cellStrip(engine.song.value, engine.viewCellId.value) : []))
const stripStyle = computed(() =>
  compact.value
    ? 'bottom: max(0.5rem, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); width: min(40vw, 220px)'
    : 'top: calc(max(0.5rem, env(safe-area-inset-top)) + 100px); left: 50%; transform: translateX(-50%); width: min(60vw, 260px)',
)
function pickStrip(id: number) {
  // como un toque en la colonia: ir a esa parte (salta en la siguiente línea de compás y queda en bucle); otro toque suelta el bucle
  if (engine.loopTarget.value === id) engine.resume()
  else engine.travelTo(id)
}
/**
 * La zona de acciones (spec 005, §19): un solo sitio, encima de Play (en horizontal, una columna a su izquierda).
 * Orden fijo: sonido (soltar bucle, apagar extras), cámara (volver a la canción) y deshacer.
 */
const actionsStyle = computed(() =>
  compact.value
    ? { right: `${view.w - sideX.value.right + 40}px`, top: '50%', transform: 'translateY(-50%)', flexDirection: 'column' as const, alignItems: 'flex-end' }
    : { left: '0', right: '0', bottom: `${ACTIONS_FROM_BOTTOM + 60}px`, justifyContent: 'center' },
)
const hasActions = computed(() => engine.playing.value || !!engine.proposal.value || looping.value || engine.extrasOn.value || showFollow.value || !!engine.undoInfo.value)
/** posición de cada bola en la fila, por orden de instrumento (bombo, caja, platillo, melodía) */
const rowSlots = computed(() => {
  const rank = (i: LoopInstrument) => (i === 'mel' ? INSTRUMENTS.length : i === 'voz' ? INSTRUMENTS.length + 1 : INSTRUMENTS.indexOf(i))
  const order = [...loops.value.loops].sort((a, b) => rank(a.instrument) - rank(b.instrument) || a.id - b.id)
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
    const range = l.instrument === 'mel' ? rangeOf(l.synth ?? STYLE_MUSIC[style.value].synth) : null
    for (const h of l.hits) {
      if (h.pos < bar * 16 - 0.5 || h.pos >= bar * 16 + 15.5) continue
      const step = h.pos - bar * 16
      const dot: AroDot = { key: dotKey(l.id, h.pos), loopId: l.id, step, pos: h.pos, voice: l.instrument === 'voz' ? 'mel' : l.instrument, muted: l.muted }
      // la melodía: arco con su duración, a la altura de su nota (spec 002, F2)
      if (range && h.midi !== undefined) {
        dot.midi = h.midi
        dot.dur = h.dur
        dot.frac = midiToFrac(h.midi, range)
      }
      out.push(dot)
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
/** lo que se va tocando en el agua se ve ya en la franja de melodía del aro (un loop provisional con id −2, que no se puede coger) */
const KEYS_LIVE_ID = -2
const ringDots = computed<AroDot[]>(() => {
  const ls = engine.keysRec.value && engine.keysHits.value.length
    ? [...loops.value.loops.filter((l) => l.instrument !== 'mel'), { id: KEYS_LIVE_ID, instrument: 'mel', bars: 4, phaseBar: 0, hits: engine.keysHits.value, muted: false, bornAt: 0, fromTemplate: false } as FreeLoop]
    : loops.value.loops
  return dotsOf(ls, shownBar())
})
const keysOv = ref<InstanceType<typeof WaterKeysOverlay> | null>(null)
function keyTouch(x: number, y: number) {
  if (engine.keysPlay(x / view.w, y / view.h)) keysOv.value?.hit(x, y, y / view.h)
}
function keyDrag(x: number, y: number) {
  if (engine.keysPlay(x / view.w, y / view.h, true)) keysOv.value?.hit(x, y, y / view.h)
}
const phraseDots = computed(() =>
  (phrase.value?.hits ?? []).filter((h) => h.instrument !== 'mel').map((h, i) => ({
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
  // la melodía: visible si está activada (para poder tocarla) o si la célula que se ve ya tiene una
  const mel = engine.melodyOn.value || loops.value.loops.some((l) => l.instrument === 'mel')
  return { ...allWeights(1), bass: bass ? 1 : 0, mel: mel ? 1 : 0 }
})
let weights: Weights = { ...allWeights(1), bass: 0, mel: 0 }
/** el punto de tu voz en vivo: su altura en el registro y si encaja en la escala (spec 002, F2) */
function liveDot(): { frac: number; fit: boolean } | null {
  const midi = engine.livePitch()
  if (midi === null) return null
  const range = rangeOf(loops.value.loops.find((l) => l.instrument === 'mel')?.synth ?? STYLE_MUSIC[style.value].synth)
  return { frac: midiToFrac(midi, range), fit: fitToScale(midi, style.value).fit }
}
/** guías de la franja de la melodía: las notas de la escala del estilo en el registro de su sinte */
const melGuides = computed(() => {
  const range = rangeOf(loops.value.loops.find((l) => l.instrument === 'mel')?.synth ?? STYLE_MUSIC[style.value].synth)
  return scaleNotes(style.value, range).map((m) => midiToFrac(m, range))
})

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
const PULSE_AMP: Record<LoopInstrument | 'bass' | 'chords', number> = { bd: 0.3, sd: 0.25, hh: 0.2, mel: 0.16, bass: 0.18, chords: 0.14, voz: 0.16 }
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
    guideHeard++
    const p = aro?.pointOf(h.instrument === 'voz' ? 'mel' : h.instrument, h.step ?? 0) ?? { x: g.x, y: g.y }
    theme.hit({ kind: 'heard', time: h.time, loopId: null, instrument: h.instrument, x: p.x, y: p.y, strength: h.strength * soft() })
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
    if (ball && !colony.value) theme.hit({ kind: 'hit', time: h.time, loopId: null, instrument: h.instrument, x: ball.x, y: ball.y, strength: 0.3 * soft() })
    return
  }
  if (h.loopId === null || falls.has(h.loopId)) return
  // loop: la bola late y brilla y suelta su onda clara; su punto del aro se enciende
  // (sin onda del agua en el aro: la gota tiene las suyas, spec 003 E1.9)
  const strength = 0.6 + 0.4 * h.strength // la mezcla baja la ganancia con muchos loops: la onda no debe desaparecer
  const b = bodies.get(h.loopId)
  if (b && !colony.value) theme.hit({ kind: 'hit', time: h.time, loopId: h.loopId, instrument: h.instrument, x: b.x, y: b.y, strength: strength * soft() })
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
/** desde cuándo está quieta la célula arrastrada (< 12 px): mantener 0,8 s sobre otra la funde (spec 005 §21) */
let dragStill: { t: number; x: number; y: number } | null = null
const MERGE_HOLD_MS = 800
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
  /** el número de cada célula (de frente): tocarlo cambia sus vueltas */
  labels: { id: number; x: number; y: number }[]
  /** los hilos de orden (de frente): tocar uno lo corta (enmienda 1, §15.4) */
  threads: ThreadSeg[]
} | null = null

function cellScene(
  base: DropGeo,
  pos: number,
  zEff: number,
  dt: number,
  wall: number,
): Pick<AroFrame, 'geo' | 'ghost' | 'bridge' | 'pull' | 'alpha' | 'crowd' | 'halo' | 'threads' | 'labels' | 'progress' | 'handles' | 'threadDrag' | 'groupRing'> & { plan: ReturnType<typeof engine.cellPlan>; cam: { x: number; y: number } } {
  const alphaBase = reduced && playing.value ? Math.min(1, (performance.now() - cutAt) / CUT_FADE_MS) : 1
  const plan = engine.cellPlan()
  const all = engine.song.value.cells
  // las sueltas (fuera del orden: sin hilos y sin sonar) se ven tenues en la colonia (enmienda 1, §15.1)
  const orderIds = engine.song.value.order
  // los grupos (§16): la canción y los que suenan a la vez; de cada célula, el suyo
  // «suena» = encendido con la marca o por el disparador de una célula de la canción (§22)
  const running = new Set((playing.value ? engine.groupHeads() : []).map((h) => h.gid))
  const groupList = [{ gid: MAIN, order: orderIds, on: true }, ...engine.song.value.groups.map((g) => ({ gid: g.id, order: g.order, on: g.on || running.has(g.id) }))]
  const groupOfId = new Map<number, (typeof groupList)[number]>()
  for (const g of groupList) for (const cid of g.order) groupOfId.set(cid, g)
  // dónde va cada grupo en paralelo que suena: su célula actual, para su anillo y sus puntitos
  const headBy = new Map((playing.value ? engine.groupHeads() : []).map((h) => [h.cellId, h]))
  // con una célula de un grupo a la vista no hay plan de la canción: su progreso se sigue dibujando en su célula
  const songHead = playing.value && !plan ? engine.songHead() : null
  const headProgress = (h: { start: number; end: number }, turns: number): number =>
    Number.isFinite(h.end) ? (cellProgress(pos, h.start, h.end) ?? 0) : ((((pos - h.start) % turns) + turns) % turns) / turns
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
      if (!dragStill || Math.hypot(dragCell.x - dragStill.x, dragCell.y - dragStill.y) * base.R > 12) dragStill = { t: performance.now(), x: dragCell.x, y: dragCell.y }
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
  // las células de un grupo apagado se ven tenues (aparcadas); las de la canción y las de los grupos que suenan, enteras
  const looseMul = (id: number) => {
    const g = groupOfId.get(id)
    return !g || g.gid === MAIN || g.on ? 1 : 1 - 0.5 * k
  }
  const weightsOf = (c: Cell) => ({ ...allWeights(1), bass: c.parts.bass && bgMode.value !== 'off' ? 1 : 0, mel: c.loops.some((l) => l.instrument === 'mel') ? 1 : 0 })
  const curCell = plan?.cur ?? here
  const geo = curCell ? place(curCell) : base
  const alpha = alphaBase * (curCell ? looseMul(curCell.id) : 1)
  const curGroup = curCell ? groupOfId.get(curCell.id) : undefined
  const curHead = curCell ? headBy.get(curCell.id) : undefined
  const groupRing =
    curCell && curGroup && curGroup.gid !== MAIN && k > 0.01
      ? curGroup.on && curHead
        ? { mode: 'on' as const, progress: headProgress(curHead, curCell.turns) }
        : { mode: curGroup.on ? ('on' as const) : ('off' as const), progress: null }
      : null
  // el pulso de la colonia sale de la que suena de verdad: si se mira otra (fijada o de un grupo), no late como si sonara
  curShown = plan ? geo : null

  // las demás células, pequeñas y quietas (solo se miran), mientras se aleja el zoom; del fondo al frente
  const skip = new Set([curCell?.id, tr?.ghost?.id])
  const placed = new Map(all.map((c) => [c.id, place(c)]))
  if (!plan) {
    const soundingId = songHead?.cellId ?? headBy.keys().next().value
    curShown = soundingId !== undefined ? (placed.get(soundingId) ?? null) : null
  }
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
          ...(songHead && c.id === songHead.cellId
            ? { ring: 'on' as const, ringProgress: headProgress(songHead, c.turns) }
            : groupOfId.get(c.id)?.gid !== MAIN && groupOfId.get(c.id)
            ? groupOfId.get(c.id)!.on
              ? headBy.get(c.id)
                ? { ring: 'on' as const, ringProgress: headProgress(headBy.get(c.id)!, c.turns) }
                : {}
              : { ring: 'off' as const }
            : {}),
          alpha: k * 0.85 * depthAlpha(c.at.depth, k) * spawnState(c.id).a * looseMul(c.id),
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
        threads: [],
        labels: all.map((c) => ({ id: c.id, x: placed.get(c.id)!.cx, y: placed.get(c.id)!.cy + placed.get(c.id)!.R + 11 })),
      }
    : null
  // asas (§7.1): un puntito en el borde de cada célula, hacia la siguiente de su grupo; solo con radio suficiente
  const handles: { id: number; x: number; y: number; alpha: number }[] = []
  if (k > 0.01)
    for (const c of all) {
      const g = placed.get(c.id)!
      if (g.R < HANDLE_MIN_R) continue
      const ord = groupOfId.get(c.id)?.order ?? []
      const nextId = ord[ord.indexOf(c.id) + 1]
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
  // el hilo pulsado ahora mismo (sin soltar ni mover): se ve cuál se va a cortar
  const hotTo = gesture?.kind === 'colony' && !gesture.moved ? gesture.threadTo : null
  const byId = new Map(all.map((c) => [c.id, c]))
  const threads =
    k > 0.01
      ? groupList.flatMap((g) =>
          threadPairs(g.order, (id) => byId.has(id)).map(([a, b]) => ({
            from: placed.get(a)!,
            to: placed.get(b)!,
            alpha: k * Math.min(depthAlpha(byId.get(a)!.at.depth, k), depthAlpha(byId.get(b)!.at.depth, k)) * (g.on ? 1 : 0.5),
            glow: g.gid === MAIN && tr?.thread && tr.thread.fromId === a && tr.thread.toId === b ? tr.thread.glow : null,
            hot: hotTo !== null && b === hotTo,
            cool: g.gid !== MAIN,
            // en la última vuelta, el hilo hacia la siguiente se va llenando (el de la canción)
            fill: g.gid === MAIN && live && plan && plan.cur.id === a && plan.next.id === b ? lastTurnFill(pos, plan.end) : undefined,
          })),
        )
      : undefined
  // los hilos se pueden tocar para cortarlos: la misma curva que se dibuja (se mece), en tramos cortos
  if (colonyPick) {
    const tw = reduced ? 0 : wall
    colonyPick.threads = groupList.flatMap((g) => threadPairs(g.order, (id) => byId.has(id))).flatMap(([a, b]) => {
      const ga = placed.get(a)!
      const gb = placed.get(b)!
      const dx = gb.cx - ga.cx
      const dy = gb.cy - ga.cy
      const d = Math.hypot(dx, dy)
      if (d < ga.R + gb.R + 4) return []
      const ux = dx / d
      const uy = dy / d
      const pa = { x: ga.cx + ux * ga.R, y: ga.cy + uy * ga.R }
      const pb = { x: gb.cx - ux * gb.R, y: gb.cy - uy * gb.R }
      const ctrl = threadControl(pa, pb, threadBend(Math.hypot(pb.x - pa.x, pb.y - pa.y), Math.atan2(dy, dx), tw))
      const pts = curvePoints(pa, ctrl, pb, 12)
      return pts.slice(1).map((p, i) => ({ fromId: a, toId: b, a: pts[i]!, b: p }))
    })
  }

  // número de vueltas junto a cada célula, pequeño y tenue; la que se ve cuenta con lo que cabe en sus loops
  const labels =
    k > 0.01
      ? all.map((c) => {
          const g = placed.get(c.id)!
          const turns = c.id === engine.viewCellId.value ? fitTurns(c.turns, loops.value.loops) : c.turns
          const trig = groupTriggers(engine.song.value, c.id)
          const mark = `${trig.on.length ? '▶' : ''}${trig.off.length ? '■' : ''}`
          const base = { x: g.cx, y: g.cy + g.R + 11, text: String(turns), alpha: 0.5 * k * depthAlpha(c.at.depth, k) * looseMul(c.id), ...(mark ? { mark } : {}) }
          // la que suena (en la canción o en un grupo), puntitos de vueltas (●●○○) en vez del número; con más de 8, "5/16"
          const sounding = (start: number, n: number) => {
            const turn = turnIndex(pos, start, n)
            return n > 8 ? { ...base, alpha: 0.7 * k, text: `${turn + 1}/${n}` } : { ...base, alpha: 0.7 * k, dots: { turns: n, turn } }
          }
          if (songHead && c.id === songHead.cellId) return sounding(songHead.start, c.turns)
          if (live && plan && c.id === plan.cur.id) return looped ? { ...base, text: '∞', alpha: 0.8 * k } : sounding(plan.start, plan.cur.turns)
          const head = headBy.get(c.id)
          if (head && groupOfId.get(c.id)?.gid !== MAIN) return sounding(head.start, c.turns)
          return base
        })
      : undefined

  if (!plan || !tr) return { geo, alpha, plan, cam, crowd, halo, threads, labels, progress, handles, threadDrag, groupRing }
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
  return { geo, ghost, bridge, pull, alpha, plan, cam, crowd, halo, threads, labels, progress, handles, threadDrag, groupRing }
}

// ── chapa de vueltas y marcadores del borde (spec 005, §5.3 y §6) ────────────────
/** chapa: gotita pegada al borde, arriba, donde empieza la aguja */
const chapaEl = ref<HTMLElement | null>(null)
const chapa = ref({ show: false, turn: 0, turns: 1, loop: false, free: false, on: false })
function updateChapa(plan: ReturnType<typeof engine.cellPlan>, pos: number, near: boolean) {
  const edge = aro?.edgePoint(-Math.PI / 2)
  // una célula de un grupo a la vista (§16.4): en vez de las vueltas, el interruptor del grupo
  const freeView = near && engine.viewIsFree.value ? engine.song.value.cells.find((c) => c.id === engine.viewCellId.value) : undefined
  if (!edge || !chapaEl.value || (!plan && !freeView)) {
    if (chapa.value.show) chapa.value = { ...chapa.value, show: false }
    return
  }
  const c = chapa.value
  if (freeView) {
    const on = engine.viewGroupOn.value
    if (!c.show || !c.free || c.on !== on) chapa.value = { show: true, turn: 0, turns: 1, loop: false, free: true, on }
  } else if (plan) {
    const turns = plan.cur.turns
    const k = Math.floor(pos - plan.start)
    const turn = plan.loop ? ((k % turns) + turns) % turns : Math.min(turns - 1, Math.max(0, k))
    if (!c.show || c.free || c.turn !== turn || c.turns !== turns || c.loop !== plan.loop) chapa.value = { show: true, turn, turns, loop: plan.loop, free: false, on: false }
  }
  // pegada al borde por fuera, sin tapar golpes; nunca bajo la muesca
  const y = Math.max(edge.y - 17, safe.top + 18)
  chapaEl.value.style.transform = `translate(${edge.x}px, ${y}px) translate(-50%, -50%)`
}

/** una célula por marcador; solo las que no se ven (todas menos la que se ve) */
// (sustituidos por la tira de células de Jugar, spec 011: en la gota ya no hay marcadores de las demás células)
const markerCells = computed((): Cell[] => [])
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
/**
 * Reposo (auditoría M1): sin sonar y sin que nadie toque nada ni cambie nada durante unos segundos, se dibuja
 * a ~20 fps en vez de a 60 (menos batería). Cualquier toque, tecla, rueda, cambio de la canción o de lo que
 * suena lo despierta al instante.
 */
const IDLE_AFTER_MS = 3000
const IDLE_FRAME_MS = 40
let lastActivity = performance.now()
let lastFrameAt = 0
const wake = () => (lastActivity = performance.now())
const WAKE_EVENTS = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'] as const
watch([playing, engine.song, loops, bgParts, bgMode, style, engine.viewCellId, looping], wake)
watch(fx, wake, { deep: true })
let lastBeat = -1
let lastT = 0
const frameMs: number[] = []
/** al final de cada frame, tras dibujar el agua y el aro (el vídeo copia ahí los lienzos: un lienzo WebGL solo se puede copiar justo después de pintarlo) */
let frameHook: (() => void) | null = null
let quality = 1
let governor = initialGovernor()
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
  const frameNow = performance.now()
  // en reposo se salta de cada tres frames dos (el navegador sigue a 60: el trabajo va a ~20)
  if (!playing.value && frameNow - lastActivity > IDLE_AFTER_MS && frameNow - lastFrameAt < IDLE_FRAME_MS - 3) return
  lastFrameAt = frameNow
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
      if (lastBeat !== -1 && !(colony.value && !curShown)) {
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
          scale: (cell ? beatScale(cell.R, nearR) : 1) * soft(),
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
      bpm: engine.bpm.value,
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
    // el primer minuto guiado (spec 011, §12.2): en Jugar y sin loops; solo mira, no toca la canción
    if (guide.value.step !== 'done' && mode.value === 'jugar') {
      const ls = engine.loops.value.loops
      guideTo(advanceGuide(guide.value, { bar: Math.floor(clock.bar), playing: playing.value, drumLoops: ls.filter((l) => l.instrument !== 'mel').length, melLoops: ls.filter((l) => l.instrument === 'mel').length, heard: guideHeard }))
    }
    // al arrancar en Componer (preferencia guardada), el mapa se ajusta a todas las células (spec 011)
    if (fitPending && view.w > 0) {
      fitPending = false
      if (mode.value === 'componer') zoomRel = fullLimits.value.min / limits.value.initial
    }
    const isColony = mode.value === 'componer' && cellPoints.value.length >= 1
    if (isColony !== colony.value) {
      colony.value = isColony
      // al volver a cerca, la cámara vuelve a seguir a la que suena
      if (!isColony) panned.value = false
    }
    // al alejar el zoom y asomar las demás células se suelta lo que se miraba: entrar es solo acercar, y la vista vuelve sola
    // a la canción (si no, la célula de la que sales sigue con el foco y parece la que suena)
    if (zEff < lastZEff - 1e-4 && crowdAlpha(zEff) > 0.01 && engine.viewAway.value) engine.followSong()
    lastZEff = zEff
    panBlend = approachBlend(panBlend, panned.value && isColony ? 1 : 0, dt, reduced)
    const song = engine.song.value
    const dc = dragCell
    drift.step(
      dt,
      song.cells,
      dc ? { id: dc.id, x: dc.x, y: dc.y, from: song.cells.find((c) => c.id === dc.id)?.at ?? dc } : null,
      dc ? linkedIds(orderOf(song, groupIdOf(song, dc.id) ?? MAIN), dc.id) : [],
      reduced,
    )
    const { plan, cam, ...scene } = cellScene(geo!, clock.bar + clock.barPhase, zEff, dt, t)
    updateMarkers(geo!, cam, plan ? plan.next.id : null)
    const f: AroFrame = {
      wall: t,
      ...scene,
      weights,
      playing: playing.value,
      calm: CALM_JUGAR * (mode.value === 'jugar' ? 1 : 0),
      reward: updateReward(clock.bar + clock.barPhase),
      // la que se mira sin sonar (fijada, o de un grupo apagado) no lleva aguja ni estela, ni lejos ni cerca
      idle: playing.value && !plan && !engine.groupHeads().some((h) => h.cellId === engine.viewCellId.value),
      phase: clock.barPhase,
      dots: ringDots.value,
      live: liveDot(),
      melGhost: melGhost(),
      melSuggest: suggestDots(clock.bar),
      melGuides: melGuides.value,
      phraseDots: phraseDots.value,
      highlight: highlight.value,
      bars: barsInfo.value,
      reduced,
      stepSec: 60 / engine.bpm.value / 4,
      lanes: allArmed(engine.lanes.value) ? null : engine.lanes.value,
      hold: holdProgress(),
      holdRing: colonyHold(),
      proposalRing: proposalRing(),
      voices: voiceWaves(clock.bar),
      view: (aroView = stepView(dt)),
      crowdDetail: crowdLevel,
      guide: { assist: engine.assist.value, quantizeEvery: STYLES[style.value].quantizeEvery },
      suggestions: guideSuggestions.value,
      // en horizontal, más puntos en el contorno cuanto más se estira (E2.1)
      ...(compact.value ? { contour: contourPoints(stretchOf(scene.geo)) } : {}),
    }
    if (scene.crowd) crowdFrames++
    aro.draw(f)
    updateChapa(colony.value ? null : plan, clock.bar + clock.barPhase, !colony.value)
  }
  frameHook?.()
  frameMs.push(performance.now() - t0)
  if (frameMs.length >= 120) {
    const p95 = [...frameMs].sort((a, b) => a - b)[Math.floor(frameMs.length * 0.95)]!
    frameMs.length = 0
    const inColonyMostly = crowdFrames >= 60
    crowdFrames = 0
    // el vigilante (lib/frameGovernor): baja el detalle si va lento y, desde ahora, también lo vuelve a subir si va sobrado
    const was = governor
    governor = governorStep(governor, p95, { inColony: inColonyMostly, canQuality: !!theme?.setQuality, canAro: !!aro })
    if (governor.crowd !== was.crowd) crowdLevel = governor.crowd
    if (governor.quality !== was.quality && theme?.setQuality) {
      quality = governor.quality
      theme.setQuality(quality)
      rendererName.value = theme.renderer()
    }
    if (governor.aro !== was.aro && aro) {
      aroDetail = governor.aro
      aro.setDetail(aroDetail)
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
  for (const e of WAKE_EVENTS) window.addEventListener(e, wake, { passive: true, capture: true })
  document.addEventListener('gesturestart', noSafariZoom)
  wake()
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  offVisual?.()
  window.removeEventListener('resize', measure)
  for (const e of WAKE_EVENTS) window.removeEventListener(e, wake, { capture: true })
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
  /** estirar o encoger el arco de una nota de la melodía, desde su extremo final (spec 002, F2) */
  | { kind: 'aro-stretch'; id: number; dot: AroDot }
  /** el final de una nota toca el inicio de la siguiente: según hacia dónde se arrastre, se estira la una o se mueve la otra */
  | { kind: 'aro-pending'; id: number; x0: number; y0: number; dot: AroDot; stretch: AroDot }
  | { kind: 'colony'; id: number; x0: number; y0: number; t: number; moved: boolean; lx: number; ly: number; cellId: number | null; grab: Point; held: boolean; handleId: number | null; labelId: number | null; threadTo: number | null }
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
  | { kind: 'keys'; id: number }
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
const melOptions = (): MelEditOptions => ({ assist: engine.assist.value, style: style.value })
/** registro (MIDI) de la melodía de un loop: el de su sinte */
const melRangeOf = (loopId: number) => rangeOf(loops.value.loops.find((l) => l.id === loopId)?.synth ?? STYLE_MUSIC[style.value].synth)
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
  if (gesture?.kind === 'aro-pending') {
    editBar.value = null
    return
  }
  if (gesture?.kind === 'aro-stretch') {
    aro?.setStretch(null)
    editBar.value = null
    return
  }
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
  // una nota de la melodía: cambia de momento y de altura dentro de su franja (spec 002, F2)
  if (dot.voice === 'mel' && act.kind === 'move') {
    const frac = aro.melFracAt(w.u)
    if (frac === null) return bounceBack(dot, x, y)
    const r = moveMelNote(loops.value, dot.loopId, dot.pos, w.step, fracToMidi(frac, melRangeOf(dot.loopId)), shownBar(), melOptions())
    if (!r) return bounceBack(dot, x, y)
    engine.editLoops(r.state)
    aro.settle(dotKey(r.hit.loopId, r.hit.pos), w.th, Math.min(1, w.u))
    return
  }
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

/**
 * Dos cosas bajo el dedo (el final de una nota y el inicio de la siguiente): al empezar a moverse, hacia atrás por el
 * arco encoge la nota anterior y cualquier otra cosa mueve la que empieza ahí.
 */
function resolvePending(gs: Extract<Gesture, { kind: 'aro-pending' }>, x: number, y: number) {
  const dx = x - gs.x0
  const dy = y - gs.y0
  if (Math.hypot(dx, dy) < 6) return
  const c = aro?.centerPx()
  let toStretch = false
  if (c) {
    const rx = gs.x0 - c.x
    const ry = gs.y0 - c.y
    const r = Math.hypot(rx, ry) || 1
    const ur = { x: rx / r, y: ry / r }
    // tangente en el sentido del tiempo (el ángulo crece con el paso)
    const tang = dx * -ur.y + dy * ur.x
    const rad = dx * ur.x + dy * ur.y
    toStretch = tang < 0 && Math.abs(tang) > Math.abs(rad)
  }
  if (toStretch) {
    gesture = { kind: 'aro-stretch', id: gs.id, dot: gs.stretch }
    aro?.setStretch(gs.stretch.key, aro.where(x, y).th)
  } else {
    gesture = { kind: 'aro-drag', id: gs.id, dot: gs.dot }
    aro?.setDrag(gs.dot.key, x, y)
  }
}

/** Soltar el extremo de un arco de melodía: la nota dura hasta ahí (a la rejilla). */
function dropStretch(dot: AroDot, x: number, y: number) {
  if (!aro) return
  aro.setStretch(null)
  const w = aro.where(x, y)
  // de la nota hasta el dedo, hacia delante en el compás (el extremo no puede quedar detrás del inicio)
  const dur = (((w.step - dot.step) % 16) + 16) % 16
  if (dur < 0.1) return
  const r = resizeMelNote(loops.value, dot.loopId, dot.pos, dur, melOptions())
  if (r) engine.editLoops(r.state)
}

/** Dónde dibujar el anillo a trazos de la copia con una variación propuesta (spec 012, §5): solo en Componer. */
function proposalRing(): { x: number; y: number; r: number } | null {
  const p = engine.proposal.value
  if (!p || !colony.value || !colonyPick) return null
  const d = colonyPick.discs.find((c) => c.id === p.cellId)
  return d ? { x: d.x, y: d.y, r: d.r } : null
}

/** La melodía sugerida (spec 012): las notas del compás que suena, para dibujarlas en fantasma en la franja de la melodía. */
function suggestDots(bar: number): { step: number; frac: number; dur: number }[] | null {
  const sg = engine.suggestion.value
  if (!sg || mode.value !== 'jugar') return null
  const b = ((Math.floor(bar) % 4) + 4) % 4
  const range = rangeOf(sg.synth)
  return sg.hits.filter((h) => h.pos >= b * 16 && h.pos < b * 16 + 16).map((h) => ({ step: h.pos - b * 16, frac: midiToFrac(h.midi, range), dur: h.dur }))
}

/** Dónde caería la nota de la melodía que se arrastra: el paso y la nota de la escala ya imantados (el fantasma). */
function melGhost(): { step: number; frac: number } | null {
  const gs = gesture
  if (gs?.kind !== 'aro-drag' || gs.dot.voice !== 'mel' || !aro) return null
  const p = pointers.get(gs.id)
  if (!p) return null
  const w = aro.where(p.x, p.y)
  const frac = aro.melFracAt(w.u)
  if (frac === null || w.voice !== 'mel') return null
  const range = melRangeOf(gs.dot.loopId)
  const o = melOptions()
  return { step: snapMelStep(w.step, o), frac: midiToFrac(snapMelMidi(fracToMidi(frac, range), o), range) }
}

/** El órgano de la melodía (spec 002, F2): se abre a pantalla completa desde el punto donde se tocó su franja. */
const organ = ref<{ x: number; y: number } | null>(null)

/** Tocar una franja vacía de batería: crea un golpe ahí, ya imantado. */
function tapCreate(x: number, y: number) {
  if (!aro) return
  // tocar la franja de la melodía la abre como un órgano (spec 002, F2)
  if (aro.where(x, y).voice === 'mel' && !aro.pickSuggestion(x, y)) {
    // con una melodía sugerida a la vista, tocar la franja la acepta (spec 012); si no, se abre el órgano
    if (engine.suggestion.value && engine.acceptSuggestion()) return
    organ.value = { x, y }
    return
  }
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
  // tempo fácil encendido: cualquier toque en el escenario cuenta como uno de los cuatro (spec 005, §6)
  if (engine.tempoTap.value.active) {
    engine.tapTempo()
    return
  }
  // (un puntero sintético, el del piloto automático, no se puede capturar: no pasa nada, el gesto sigue)
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    /* sin captura */
  }
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
    // y el número (sus vueltas), sobre el cuerpo
    const labelId = handleId === null ? labelUnder(x, y) : null
    const cellId = handleId === null && labelId === null ? cellUnder(x, y) : null
    // y, si no hay nada de eso, un hilo (tocarlo lo corta)
    const threadTo = handleId === null && labelId === null && cellId === null ? threadUnder(x, y) : null
    gesture = { kind: 'colony', id: e.pointerId, x0: x, y0: y, t: performance.now(), moved: false, lx: x, ly: y, cellId, grab: grabOffset(cellId, x, y), held: false, handleId, labelId, threadTo }
    return
  }
  // el extremo de un arco de melodía: estirar o encoger su duración (spec 002, F2)
  const edit = aro?.pickEdit(x, y)
  if (edit?.kind === 'stretch') {
    editBar.value = shownBar()
    armLoop()
    gesture = { kind: 'aro-stretch', id: e.pointerId, dot: edit.dot }
    aro!.setStretch(edit.dot.key, aro!.where(x, y).th)
    return
  }
  if (edit?.kind === 'pending') {
    editBar.value = shownBar()
    armLoop()
    gesture = { kind: 'aro-pending', id: e.pointerId, x0: x, y0: y, dot: edit.dot, stretch: edit.stretch }
    return
  }
  const picked = aro?.pick(x, y)
  const dot = edit?.kind === 'move' ? edit.dot : picked && picked.loopId !== KEYS_LIVE_ID ? picked : null
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
  else if (engine.keysOn.value && mode.value === 'jugar' && !colony.value) {
    // teclado de agua (spec 015): un dedo fuera del aro toca notas de la escala del estilo
    gesture = { kind: 'keys', id: e.pointerId }
    keyTouch(x, y)
  } else if (mouse) gesture = { kind: 'fx', id: e.pointerId, x0: x, y0: y, filter: fx.filter, space: fx.space, axis: null }
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
  else if (gs.kind === 'aro-stretch' && gs.id === e.pointerId) aro?.setStretch(gs.dot.key, aro.where(p.x, p.y).th)
  else if (gs.kind === 'aro-pending' && gs.id === e.pointerId) resolvePending(gs, p.x, p.y)
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
        if (engine.proposal.value?.cellId === gs.cellId) engine.acceptProposal() // moverla = aceptarla (nunca se pierde nada)
        dragState = { id: gs.cellId, px: p.x, py: p.y, grab: gs.grab }
      }
    }
    gs.lx = p.x
    gs.ly = p.y
  } else if (gs.kind === 'keys' && gs.id === e.pointerId) {
    keyDrag(p.x, p.y)
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
    if (gs.mode === 'pinch') pinchLive = pinchZoom(gs.z0, gs.d0, d, zoomBounds.value)
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
  const still = dragStill
  dragStill = null
  // fundir (spec 005 §21): soltar tras mantener quieta ≥ 0,8 s la célula cubriendo más de la mitad de otra
  if (commit && moved && still && performance.now() - still.t >= MERGE_HOLD_MS && colonyPick) {
    // se mide en el mapa, con la posición de reposo de las demás (las cercanas se apartan al acercarse: lo que cuenta es dónde están)
    const over = engine.song.value.cells.find((c) => c.id !== moved.id && Math.hypot(c.at.x - moved.x, c.at.y - moved.y) < 0.75)
    if (over && engine.mergeCellsInto(moved.id, over.id)) return
  }
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

/** Hilo bajo un punto de la pantalla en la colonia: devuelve la célula a la que lleva, o null. */
function threadUnder(x: number, y: number): number | null {
  const pk = colonyPick
  if (!pk) return null
  const [fx, fy] = toFront(x, y, aroView, 0, pk.cy)
  return threadAt(fx, fy, pk.threads)?.toId ?? null
}

/** Número de vueltas bajo un punto de la pantalla en la colonia, o null. */
function labelUnder(x: number, y: number): number | null {
  const pk = colonyPick
  if (!pk) return null
  const [fx, fy] = toFront(x, y, aroView, 0, pk.cy)
  return spotAt(fx, fy, pk.labels, LABEL_HIT)
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
  // tocar la copia con una variación propuesta = aceptarla (spec 012, §5)
  if (engine.proposal.value?.cellId === id) {
    engine.acceptProposal()
    return
  }
  const now = performance.now()
  if (isDoubleTap(lastTap, id, now)) {
    lastTap = null
    if (tapTimer) clearTimeout(tapTimer)
    tapTimer = null
    // el doble toque entra a editarla sin cambiar lo que suena (enmienda 3): el primer toque no llegó a hacer nada
    engine.enterCell(id)
    // entrar a editar una célula = pasar a Jugar con ella en la gota (spec 011, §3.4): la vista se queda en ella
    switchMode('jugar', { keepView: true })
    zoomRel = nearRel
    panned.value = false
    return
  }
  lastTap = { id, t: now }
  // el toque espera lo que dura un doble toque para saber si lo es; el cambio cae en una línea de compás, así que no se nota
  if (tapTimer) clearTimeout(tapTimer)
  tapTimer = setTimeout(() => {
    tapTimer = null
    singleTapCell(id)
  }, DOUBLE_TAP_MS)
}
let tapTimer: ReturnType<typeof setTimeout> | null = null

/** Un toque en una célula: que suene (§4.1 y §16.4). */
function singleTapCell(id: number) {
  const inGroup = engine.groupOf(id) !== MAIN
  // una célula de un grupo en paralelo (§16.4): apagado, lo enciende por ella; encendido, en la que suena lo apaga y en otra salta
  if (inGroup) return engine.tapGroupCell(id)
  // tocar otra vez la que está en bucle lo suelta: la canción sigue (§4.1)
  if (engine.loopTarget.value === id) engine.resume()
  else engine.travelTo(id)
}

/** cuánto hay que pasarse del tope (fracción del límite) para que el pellizco cambie de modo, y la rueda acumulada que hace lo mismo */
const PUSH_FRAC = 0.9
const WHEEL_PUSH = 220
let wheelPush = 0
let fitPending = true

/** El aviso de la primera vez (por dispositivo) al pasar a cada modo con el pellizco (spec 011, §4.2). */
const HINT_KEY = 'coderbeats:mode-hints:v1'
const modeHint = ref('')

// ── el primer minuto guiado (spec 011, §12.2): solo texto, una frase a la vez; se ve una vez por dispositivo ──
const GUIDE_KEY = 'coderbeats:guide:v1'
const guideDone = () => !!readJson(GUIDE_KEY, (x): x is { done: true } => !!x && (x as { done?: unknown }).done === true)
const guide = ref<GuideState>(guideDone() ? GUIDE_DONE : GUIDE_START)
/** golpes que el micro ha oído desde que empezó la guía */
let guideHeard = 0
// con el piloto automático en marcha, la guía no habla ni toca el fondo (el piloto lo hace todo)
const pilotState = usePilotState()
const guideText = computed(() => (!pilotState.active && mode.value === 'jugar' && guideVisible(guide.value) ? guideLine(guide.value.step, engine.melodyOn.value, !!engine.suggestion.value) : ''))
function guideTo(next: GuideState) {
  if (next === guide.value) return
  const was = guide.value.step
  guide.value = next
  if (was === 'wait' && next.step === 'listen') {
    guideHeard = 0
    if (!pilotState.active) engine.guideBackground() // «Escucha»: suena el fondo y la gota espera
  }
  if (next.step === 'done') writeJson(GUIDE_KEY, { done: true })
}
// ── la recompensa (spec 011, §12.3): con todos los carriles llenos, el disco se enciende una vuelta; una vez por canción y sesión ──
let rewardArmed = true
/** compás (con fracción) en el que empieza el destello: la línea de compás siguiente, para que la luz parta con la aguja; null = no hay */
let rewardStart: number | null = null
function updateReward(pos: number): { sweep: number; glow: number } | null {
  if (mode.value !== 'jugar' || !playing.value) {
    // si se para o se cambia de modo a medias, el destello no se ve y se podrá ganar otra vez
    if (rewardStart !== null) rewardArmed = true
    rewardStart = null
    return null
  }
  const ls = engine.loops.value.loops
  if (ls.length === 0) rewardArmed = true // canción vacía o nueva: puede volver a ganarse
  if (rewardArmed && rewardStart === null && playing.value && allLanesFilled(ls, engine.melodyOn.value)) {
    rewardArmed = false
    rewardStart = Math.ceil(pos)
  }
  if (rewardStart === null) return null
  const f = rewardFrame(pos - rewardStart)
  if (!f && pos - rewardStart > 1) rewardStart = null
  return f
}

/** un toque en la frase la salta */
const skipGuide = () => guideTo(GUIDE_DONE)
watch(engine.guideNonce, () => {
  try {
    localStorage.removeItem(GUIDE_KEY)
  } catch {
    /* sin almacenamiento: solo esta sesión */
  }
  guide.value = GUIDE_START
})
let hintTimer: ReturnType<typeof setTimeout> | null = null
function showModeHint(m: Mode) {
  const seen = readJson(HINT_KEY, (x): x is Mode[] => Array.isArray(x)) ?? []
  if (seen.includes(m)) return
  writeJson(HINT_KEY, [...seen, m])
  modeHint.value = MODE_HINT[m]
  if (hintTimer) clearTimeout(hintTimer)
  hintTimer = setTimeout(() => (modeHint.value = ''), 3500)
}

/**
 * Cambia de modo (spec 011): el selector y el pellizco. La música sigue; solo cambia lo que se ve y se toca. Al pasar a Jugar la gota vuelve
 * a seguir a la canción, salvo si se entra a editar una célula (`keepView`: doble toque en Componer). `hint`: avisa la primera vez.
 */
function switchMode(m: Mode, o: { keepView?: boolean; hint?: boolean } = {}) {
  if (mode.value === m) return
  engine.setMode(m)
  panned.value = false
  if (m === 'componer') zoomRel = fullLimits.value.min / limits.value.initial
  else {
    zoomRel = nearRel
    if (!o.keepView) engine.followSong()
  }
  if (o.hint) showModeHint(m)
}

/** Fin de un pellizco: el zoom vuelve a los límites con suavidad y se guarda. */
function endPinch() {
  if (pinchLive === null) return
  const z = pinchLive
  pinchLive = null
  // pellizcar más allá del tramo del modo cambia de modo (spec 011, §4.2): alejar desde Jugar = Componer; acercar desde Componer = Jugar
  const b = zoomBounds.value
  if (mode.value === 'jugar' && cellPoints.value.length >= 1 && z < b.min * PUSH_FRAC) return switchMode('componer', { hint: true })
  if (mode.value === 'componer' && z > b.max / PUSH_FRAC) return switchMode('jugar', { hint: true })
  setZoom(z)
}

/** Rueda (o pellizco del trackpad): zoom (E1.5). */
function onWheel(e: WheelEvent) {
  e.preventDefault()
  touched()
  const b = zoomBounds.value
  const before = zoomNow()
  setZoom(wheelZoom(before, e.deltaY, e.ctrlKey, b))
  // seguir empujando la rueda contra el tope del modo (≈ dos vueltas de rueda) cambia de modo (spec 011, §4.2)
  const out = e.deltaY > 0
  const atEdge = out ? before <= b.min + 1e-3 && mode.value === 'jugar' : before >= b.max - 1e-3 && mode.value === 'componer'
  if (atEdge) {
    wheelPush += Math.abs(e.deltaY)
    if (wheelPush > WHEEL_PUSH && (mode.value !== 'jugar' || cellPoints.value.length >= 1)) {
      wheelPush = 0
      return switchMode(mode.value === 'jugar' ? 'componer' : 'jugar', { hint: true })
    }
  } else wheelPush = 0
  if (settleTimer) clearTimeout(settleTimer)
  settleTimer = setTimeout(() => {
    settleTimer = null
    wheelPush = 0
  }, 400)
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
  if ((gs?.kind === 'aro-drag' || gs?.kind === 'aro-tap' || gs?.kind === 'aro-stretch' || gs?.kind === 'aro-pending') && gs.id === e.pointerId) {
    if (cancelled || pointers.size > 1) disarmLoop()
    else loopNow()
  }
  if (gs?.kind === 'aro-drag' && gs.id === e.pointerId) {
    if (cancelled || !p) cancelAroDrag()
    else dropDot(gs.dot, p.x, p.y)
    editBar.value = null
    gesture = null
  } else if (gs?.kind === 'aro-pending' && gs.id === e.pointerId) {
    // lo tocó sin arrastrar: no cambia nada
    editBar.value = null
    gesture = null
  } else if (gs?.kind === 'aro-stretch' && gs.id === e.pointerId) {
    if (cancelled || !p) cancelAroDrag()
    else dropStretch(gs.dot, p.x, p.y)
    editBar.value = null
    gesture = null
  } else if (gs?.kind === 'aro-tap' && gs.id === e.pointerId) {
    if (!cancelled && p && !gs.moved && !gs.held && performance.now() - gs.t < HOLD_MS) tapCreate(p.x, p.y)
    gesture = null
  } else if (gs?.kind === 'colony' && gs.id === e.pointerId) {
    if (dragState) endCellDrag(!cancelled)
    else if (threadState) endThread(!cancelled)
    else if (!cancelled && !gs.moved && !gs.held && performance.now() - gs.t < TAP_MS) {
      // tocar el asa cuenta como tocar su célula; tocar el número cambia sus vueltas
      if (gs.labelId !== null) engine.cycleTurns(gs.labelId)
      else if (gs.handleId !== null) tapCell(gs.handleId)
      else if (gs.cellId !== null) tapCell(gs.cellId)
      else if (gs.threadTo !== null) engine.detachCell(gs.threadTo)
      else tapWater(gs.x0, gs.y0)
    }
    gesture = null
  } else if ((gs?.kind === 'fx' || gs?.kind === 'keys') && gs.id === e.pointerId) gesture = null
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

/** las ondas de las tomas de voz de la célula que se ve (su envolvente, calculada una vez al nacer) */
function voiceWaves(bar: number): { env: Float32Array; bars: number; bar: number; muted: boolean }[] {
  const out: { env: Float32Array; bars: number; bar: number; muted: boolean }[] = []
  for (const l of loops.value.loops) {
    const env = l.instrument === 'voz' && l.voice ? engine.voiceEnv.value[l.voice.audio] : undefined
    if (env) out.push({ env, bars: l.bars, bar: bar - l.phaseBar, muted: l.muted })
  }
  return out
}

const fill: Record<LoopInstrument, string> = { bd: VOICE_HEX.bd, sd: VOICE_HEX.sd, hh: VOICE_HEX.hh, mel: VOICE_HEX.mel, voz: VOICE_HEX.mel }
/** medidas reales de la ventana, para el diagnóstico (§16.18) */
const layoutInfo = () => {
  const r = root.value?.getBoundingClientRect()
  return [
    `ventana ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}`,
    `escenario ${r ? `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}×${Math.round(r.height)}` : '—'}`,
    `documento ${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight}`,
    `aro (${Math.round(geo?.cx ?? 0)}, ${Math.round(geo?.cy ?? 0)}) r ${Math.round(geo?.R ?? 0)} zoom ${zoomNow().toFixed(2)} (${limits.value.min}–${limits.value.max.toFixed(2)}) detalle ${aroDetail} · colonia ${crowdLevel} (${cellPoints.value.length} células)`,
    `zonas seguras ${safe.top}/${safe.right}/${safe.bottom}/${safe.left}`,
    describeImageDelay({
      auto: engine.imageAuto.value,
      fineMs: engine.imageFineMs.value,
      roundTripMs: engine.roundTripMs.value,
      reportedOutputMs: engine.reportedOutputLatency() * 1000,
      savedRoundTripMs: engine.savedLatencyMs.value,
    }),
  ].join(' · ')
}
/** Para el piloto: dónde está el asa de una célula en la pantalla y un sitio de agua vacía donde soltarla (solo en la colonia). */
function colonyPoints(): { cell: (id: number) => { x: number; y: number } | null; handle: (id: number) => { x: number; y: number } | null; water: () => { x: number; y: number } | null } {
  const pk = colonyPick
  const sc = (x: number, y: number) => (pk ? frontToScreen(x, y, aroView, 0, pk.cy) : [x, y])
  return {
    cell: (id) => {
      const d = pk?.discs.find((q) => q.id === id)
      if (!d) return null
      const [x, y] = sc(d.x, d.y)
      return { x: x!, y: y! }
    },
    handle: (id) => {
      const h = pk?.handles.find((q) => q.id === id)
      if (!h) return null
      const [x, y] = sc(h.x, h.y)
      return { x: x!, y: y! }
    },
    water: () => {
      if (!pk) return null
      const f = pk.free
      let best: { x: number; y: number; d: number } | null = null
      for (let i = 1; i < 12; i++)
        for (let j = 1; j < 12; j++) {
          // sitio cómodo: en el centro y en la mitad de abajo (lejos de los bordes y de la cabecera)
          const x = f.x0 + ((f.x1 - f.x0) * (0.25 + (0.5 * i) / 12))
          const y = f.y0 + ((f.y1 - f.y0) * (0.5 + (0.4 * j) / 12))
          const d = Math.min(...pk.discs.map((c) => Math.hypot(c.x - x, c.y - y) - c.r), 1e9)
          if (!best || d > best.d) best = { x, y, d }
        }
      if (!best) return null
      const [x, y] = sc(best.x, best.y)
      return { x: x!, y: y! }
    },
  }
}
/** Para exportar vídeo (spec 013): los lienzos de la escena (agua y aro, sin botones) y el gancho de cada frame. */
function videoSource() {
  return {
    water: canvasHost.value?.querySelector('canvas') ?? null,
    aro: aroEl.value ?? null,
    width: view.w,
    height: view.h,
    setHook: (f: (() => void) | null) => {
      frameHook = f
    },
  }
}
defineExpose({ videoSource, colonyPoints, pointOf: (voice: Voice, step: number) => aro?.pointOf(voice, step) ?? null, rootEl: () => root.value, switchMode, openOrgan: (x: number, y: number) => (organ.value = { x, y }), organOpen: () => !!organ.value, rendererName, layoutInfo, debugDots: () => aro?.debugDots() ?? [], aroWhere: (x: number, y: number) => aro?.where(x, y) })
</script>

<template>
  <div
    ref="root"
    class="touch-none bg-ink select-none"
    :data-pilot="pilotState.active"
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

    <!-- tira de células de Jugar (spec 011, §3.6) -->
    <CellStrip v-if="strip.length" class="absolute" :style="stripStyle" :cells="strip" :looping="engine.loopTarget.value" @pick="pickStrip" />

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
      :data-loop="chapa.free ? chapa.on : chapa.loop"
      :aria-label="
        chapa.free
          ? chapa.on ? 'grupo encendido: tocar para apagarlo' : 'grupo apagado: tocar para encenderlo'
          : chapa.loop ? 'en bucle' : `vuelta ${chapa.turn + 1} de ${chapa.turns}: tocar para dejarla en bucle`
      "
      @pointerdown.stop
      @click="chapa.free ? engine.toggleGroup(engine.viewGroup.value) : chapa.loop ? undefined : engine.loopHere()"
    >
      <template v-if="chapa.free">
        <span class="chapa-inf">{{ chapa.on ? '●' : '○' }}</span>
        <span>grupo · {{ chapa.on ? 'suena' : 'apagado' }}</span>
      </template>
      <template v-else-if="chapa.loop">
        <span class="chapa-inf">∞</span>
      </template>
      <span v-else-if="chapa.turns > 8" class="chapa-num">{{ chapa.turn + 1 }}/{{ chapa.turns }}</span>
      <span v-else class="chapa-dots" :style="{ '--cols': Math.min(4, chapa.turns) }">
        <i v-for="i in chapa.turns" :key="i" :class="{ on: i - 1 <= chapa.turn }" />
      </span>
    </button>

    <!-- zona de acciones (spec 005, §19): un solo sitio, en orden fijo, solo lo que tiene sentido ahora -->
    <div v-if="hasActions && !engine.stageOn.value" class="actions absolute" :style="actionsStyle" @pointerdown.stop>
      <button v-if="looping" class="act-btn" aria-label="soltar el bucle: la canción sigue" @click="engine.resume()">
        <span class="chapa-inf">∞</span> Soltar bucle
      </button>
      <button v-if="engine.extrasOn.value" class="act-btn" aria-label="apagar los grupos que suenan a la vez que la canción" @click="engine.stopExtras()">
        Apagar extras
      </button>
      <button v-if="showFollow" class="act-btn" aria-label="volver a la célula que suena en la canción (dejar de editar)" @click="((panned = false), engine.followSong())">
        <template v-if="colony">◎ Centrar</template>
        <template v-else>Editando · {{ editingName }} ▶ Seguir la canción</template>
      </button>
      <template v-if="engine.proposal.value">
        <button
          v-for="k in engine.proposal.value.kinds"
          :key="k"
          class="act-btn"
          :data-on="engine.proposal.value.kind === k"
          :aria-label="`variación: ${VARIATION_LABELS[k]}`"
          @click="k === 'same' ? engine.acceptProposal() : engine.setProposalKind(k)"
        >{{ VARIATION_LABELS[k] }}</button>
        <button class="act-btn" aria-label="probar otra variación de este tipo" @click="engine.otherProposal()">↻ otra</button>
        <button class="act-btn" aria-label="aceptar la variación (también tocando la copia)" @click="engine.acceptProposal()">✓</button>
      </template>
      <button v-if="engine.playing.value" class="act-btn" :aria-label="mode === 'jugar' ? 'Escenario: toda la pantalla dispara golpes de efecto' : 'Efectos: los toques en el fondo disparan golpes de efecto'" @click="engine.setStage(true)">{{ mode === 'jugar' ? '⚡ Escenario' : '⚡ Efectos' }}</button>
      <button v-if="mode === 'jugar' && !pilotState.active && (engine.canConvert.value || engine.multi.value)" class="act-btn" aria-label="previsualizar: tu canción se construye sola" @click="emit('preview')">👁 Previsualizar</button>
      <button v-if="mode === 'jugar' && engine.playing.value" class="act-btn" :data-on="engine.keysOn.value" aria-label="teclado de agua: tocar el fondo hace sonar notas de la escala" @click="engine.setKeys(!engine.keysOn.value)">🎹 Agua</button>
      <button v-if="mode === 'jugar' && engine.keysOn.value" class="act-btn" :data-on="!!engine.keysRec.value" :aria-label="engine.keysRec.value ? 'terminar y guardar lo tocado como melodía' : 'grabar lo que toques en el agua como melodía'" @click="engine.toggleKeysRec()">{{ engine.keysRec.value ? `■ ${engine.keysRec.value.count} notas` : '● Grabar' }}</button>
      <button v-if="mode === 'jugar' && (engine.canVoice.value || engine.voiceRec.value !== 'idle')" class="act-btn" :data-on="engine.voiceRec.value !== 'idle'" :aria-label="engine.voiceRec.value === 'idle' ? 'grabar tu voz en bucle (2 compases, con cascos)' : 'cancelar la grabación de voz'" @click="engine.recordVoice(2)">{{ engine.voiceRec.value === 'idle' ? '🎤 Voz' : engine.voiceRec.value === 'armed' ? 'Espera el compás…' : engine.voiceRec.value === 'recording' ? '● Cantando' : 'Guardando…' }}</button>
      <button v-if="mode === 'jugar' && (engine.canLive.value || engine.liveRec.value)" class="act-btn" :data-on="!!engine.liveRec.value" :aria-label="engine.liveRec.value ? 'terminar la grabación y convertirla en células' : 'grabar canción: enciende y apaga capas al ritmo'" @click="engine.toggleLive()">{{ engine.liveRec.value ? `■ ${engine.liveRec.value.bars} compases` : '● Grabar canción' }}</button>
      <button v-if="engine.canConvert.value && mode === 'jugar' && !engine.liveRec.value" class="act-btn" aria-label="convertir este loop en una canción con la estructura del estilo" @click="engine.convertSong()">✦ Convertir en canción</button>
      <template v-if="engine.suggestion.value && mode === 'jugar'">
        <button class="act-btn" aria-label="melodía sugerida: probar otra" @click="engine.otherSuggestion()">↻ Otra melodía</button>
        <button class="act-btn" aria-label="no proponer esta melodía" @click="engine.dismissSuggestion()">✕</button>
      </template>
      <button v-if="engine.undoInfo.value" class="act-btn" data-kind="undo" aria-label="deshacer el último borrado" @click="engine.undo()">
        ↶ Deshacer
      </button>
    </div>

    <!-- bolas del fondo (modo manual, §16.17) -->
    <template v-if="bgMode === 'manual' && !colony && !engine.viewIsFree.value">
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
    <button
      v-if="guideText"
      class="guide-line absolute left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-5 py-2 text-sm text-white/85 backdrop-blur"
      style="bottom: calc(max(0.5rem, env(safe-area-inset-bottom)) + 150px)"
      aria-live="polite"
      aria-label="guía: toca para saltarla"
      @pointerdown.stop
      @click="skipGuide"
    >
      {{ guideText }}
    </button>

    <div v-if="engine.notice.value" class="notice pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white/85 backdrop-blur" style="top: calc(max(0.5rem, env(safe-area-inset-top)) + 130px); max-width: 90vw; text-align: center" role="status">{{ engine.notice.value }}</div>

    <div v-if="modeHint" class="mode-hint pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-xs text-white/80 backdrop-blur" style="top: calc(max(0.5rem, env(safe-area-inset-top)) + 96px)" role="status">{{ modeHint }}</div>

    <!-- Escenario: la pantalla entera es para tocar (spec 011 §13.1) -->
    <StageOverlay v-if="engine.stageOn.value" :reduced="reduced" />

    <WaterKeysOverlay v-if="engine.keysOn.value && mode === 'jugar' && !colony && !engine.stageOn.value" ref="keysOv" :reduced="reduced" :style-id="style" :recording="!!engine.keysRec.value" :bar="currentBar" :count="engine.keysRec.value?.count ?? 0" />

    <MelodyOrgan v-if="organ" :origin="organ" @close="organ = null" />
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
/* zona de acciones: una fila (o columna en horizontal) de botones del mismo estilo */
.stage-root[data-pilot='true'] .actions,
[data-pilot='true'] .actions,
[data-pilot='true'] .notice {
  opacity: 0.28;
  pointer-events: none !important;
}
[data-pilot='true'] .actions * {
  pointer-events: none !important;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  max-width: calc(100vw - 24px);
  gap: 8px;
  pointer-events: none;
}
.act-btn {
  pointer-events: auto;
  position: relative;
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
.act-btn[data-on='true'] {
  background: #f496bc;
  color: #0b0b0f;
}
.act-btn[data-kind='undo'] {
  border-color: rgb(255 255 255 / 0.4);
  background: rgb(255 255 255 / 0.09);
  color: rgb(255 255 255 / 0.9);
}
.act-btn::after {
  content: '';
  position: absolute;
  inset: -6px;
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
.chapa-num {
  font-variant-numeric: tabular-nums;
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

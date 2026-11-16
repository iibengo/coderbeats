<script setup lang="ts">
// El órgano de la melodía (spec 002, F2): tocar la franja de la melodía la abre a pantalla completa, como una caja de
// música de la célula. Horizontal = tiempo (los pasos del loop); vertical = solo las notas de la escala del estilo.
// Tocar un hueco pone una nota (arrastrar hacia la derecha la alarga); tocar una nota la hace sonar; arrastrarla la
// mueve, y **arrastrarla fuera del cuadro la borra**; tirar de su extremo cambia su duración. «↶ deshacer» devuelve la
// melodía como estaba antes de la última edición (unos 8 s, un solo nivel). La célula sigue sonando y la línea blanca marca dónde va.
// Se abre y se cierra con una transición de agua desde el punto donde se tocó la franja.
import { removeHit } from '~/lib/loopEdit'
import { answerPhrase } from '~/lib/melodyGrid'
import { addMelNote, dropExtraMelodies, extraMelodies, gForBar, melLoopOf, moveMelNote, resizeMelNote, restoreMel, setMelBars, snapMelStep, type MelEditOptions } from '~/lib/melodyEdit'
import type { FreeLoop, LoopsState } from '~/lib/freeLoops'
import { isTonic, rangeOf, rowOf, scaleNotes } from '~/lib/melodyView'
import type { MelodyHit } from '~/lib/melody'
import { midiName } from '~/lib/noteScore'
import { STYLE_MUSIC } from '~/lib/styles'

const props = defineProps<{ origin: { x: number; y: number } }>()
const emit = defineEmits<{ close: [] }>()
const engine = useAudioEngine()
const { loops, style, playing } = engine

const root = ref<HTMLElement | null>(null)
const ripples = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const reduced = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ── datos ────────────────────────────────────────────────────────────────────────
const loop = computed(() => melLoopOf(loops.value))
const bars = computed(() => loop.value?.bars ?? 1)
const synth = computed(() => loop.value?.synth ?? STYLE_MUSIC[style.value].synth)
const range = computed(() => rangeOf(synth.value))
/** las filas, de la nota más aguda (arriba) a la más grave: solo las notas de la escala del estilo */
const rows = computed(() => scaleNotes(style.value, range.value).reverse())
const steps = computed(() => bars.value * 16)
const notes = computed<MelodyHit[]>(() => (loop.value?.hits ?? []) as MelodyHit[])
// casillas grandes (spec 020): con ayuda, la casilla es una corchea (40 px en un móvil); «fino» las vuelve semicorcheas
const fine = ref(false)
const unit = computed<1 | 2>(() => (fine.value ? 1 : 2))
const q = () => (engine.assist.value ? unit.value : 0.25)
const opts = (): MelEditOptions => ({ assist: engine.assist.value, style: style.value, unit: unit.value })

// ── geometría ────────────────────────────────────────────────────────────────────
const CELL_MIN = 18
const view = reactive({ w: 390, h: 844 })
const rowH = computed(() => Math.max(18, Math.min(38, Math.floor((view.h - 150) / Math.max(1, rows.value.length)))))
// un compás (16 pasos) cabe justo en la pantalla; con 2 o 4 compases se desplaza
const cellW = computed(() => Math.max(CELL_MIN, Math.min(48, Math.floor((view.w - 70) / 16))))
const gridW = computed(() => steps.value * cellW.value)
const gridH = computed(() => rows.value.length * rowH.value)
const rowOfNote = (midi: number) => rowOf(midi, rows.value.slice().reverse()) // índice desde abajo
const rowTop = (midi: number) => (rows.value.length - 1 - rowOfNote(midi)) * rowH.value
const midiOfRow = (r: number) => rows.value[Math.min(rows.value.length - 1, Math.max(0, r))]!

// ── gestos ───────────────────────────────────────────────────────────────────────
type Gest =
  | { kind: 'new'; id: number; x0: number; y0: number; pos: number; row: number; dur: number; moved: boolean }
  | { kind: 'move'; id: number; x0: number; y0: number; hit: MelodyHit; grab: number; pos: number; row: number; moved: boolean; outside: boolean }
  | { kind: 'resize'; id: number; hit: MelodyHit; dur: number }
let g: Gest | null = null

const cell = (e: PointerEvent) => {
  const r = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
const snapPos = (pos: number): number => {
  const b = Math.min(bars.value - 1, Math.max(0, Math.floor(pos / 16)))
  return b * 16 + snapMelStep(pos - b * 16, opts())
}
/** compás del loop y paso dentro de él para una posición de 0 a bars·16 */
const split = (pos: number) => {
  const b = Math.min(bars.value - 1, Math.max(0, Math.floor(pos / 16 + 1e-9)))
  return { b, step: pos - b * 16 }
}

// ── deshacer: un solo nivel, unos 8 s (como el resto de la app, 005 §7.1) ─────────
const UNDO_MS = 8000
const undo = ref<{ id: number; before: FreeLoop | null } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | null = null
/** Aplica una edición y guarda cómo estaba el loop de melodía para poder deshacerla. */
function commit(next: LoopsState) {
  const before = loop.value ?? null
  engine.editLoops(next)
  const after = melLoopOf(next)
  const id = after?.id ?? before?.id
  if (id === undefined) return
  undo.value = { id, before }
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = setTimeout(() => (undo.value = null), UNDO_MS)
}
function doUndo() {
  const u = undo.value
  if (!u) return
  engine.editLoops(restoreMel(loops.value, u.id, u.before))
  undo.value = null
  if (undoTimer) clearTimeout(undoTimer)
}

function noteAt(x: number, y: number): { hit: MelodyHit; resize: boolean } | null {
  for (const h of notes.value) {
    const x0 = h.pos * cellW.value
    const x1 = (h.pos + h.dur) * cellW.value
    const y0 = rowTop(h.midi)
    if (x < x0 || x > x1 || y < y0 || y > y0 + rowH.value) continue
    return { hit: h, resize: x > x1 - Math.min(14, (x1 - x0) * 0.4) }
  }
  return null
}

function onDown(e: PointerEvent) {
  if (rec.value) return recNote(e)
  canvas.value!.setPointerCapture(e.pointerId)
  const { x, y } = cell(e)
  const hit = noteAt(x, y)
  if (hit) {
    if (hit.resize) g = { kind: 'resize', id: e.pointerId, hit: hit.hit, dur: hit.hit.dur }
    else g = { kind: 'move', id: e.pointerId, x0: x, y0: y, hit: hit.hit, grab: x / cellW.value - hit.hit.pos, pos: hit.hit.pos, row: Math.floor(y / rowH.value), moved: false, outside: false }
    engine.previewNote(hit.hit.midi, synth.value)
    return
  }
  const row = Math.min(rows.value.length - 1, Math.max(0, Math.floor(y / rowH.value)))
  g = { kind: 'new', id: e.pointerId, x0: x, y0: y, pos: snapPos(x / cellW.value), row, dur: 2, moved: false }
  engine.previewNote(midiOfRow(row), synth.value)
}

function onMove(e: PointerEvent) {
  if (!g || g.id !== e.pointerId) return
  const { x, y } = cell(e)
  if (g.kind === 'new') {
    if (Math.hypot(x - g.x0, y - g.y0) > 5) g.moved = true
    // arrastrar a la derecha alarga la nota que se está poniendo
    const u = q()
    if (g.moved) g.dur = Math.max(u, Math.round((x / cellW.value - g.pos) / u) * u)
  } else if (g.kind === 'move') {
    if (Math.hypot(x - g.x0, y - g.y0) > 5) g.moved = true
    // fuera del cuadro de la rejilla: al soltar, se borra
    const sr = scroller.value?.getBoundingClientRect()
    g.outside = !!sr && (e.clientX < sr.left - 28 || e.clientX > sr.right + 28 || e.clientY < sr.top - 28 || e.clientY > sr.bottom + 28)
    g.pos = snapPos(x / cellW.value - g.grab)
    const row = Math.min(rows.value.length - 1, Math.max(0, Math.floor(y / rowH.value)))
    if (row !== g.row) {
      g.row = row
      engine.previewNote(midiOfRow(row), synth.value)
    }
  } else if (g.kind === 'resize') {
    const u = q()
    g.dur = Math.max(u, Math.round((x / cellW.value - g.hit.pos) / u) * u)
  }
}

function onUp(e: PointerEvent, cancelled = false) {
  const gs = g
  g = null
  if (!gs || gs.id !== e.pointerId || cancelled) return
  const l = loop.value
  if (gs.kind === 'new') {
    const { b, step } = split(gs.pos)
    const r = addMelNote(loops.value, step, midiOfRow(gs.row), gForBar(l, b), opts(), gs.moved ? gs.dur : 2)
    if (r) commit(r.state)
  } else if (gs.kind === 'move') {
    if (!l) return
    // tocar una nota solo la hace sonar (ya sonó al apoyar el dedo)
    if (!gs.moved) return
    // soltarla fuera del cuadro la borra
    if (gs.outside) return commit(removeHit(loops.value, l.id, gs.hit.pos))
    const { b, step } = split(gs.pos)
    const r = moveMelNote(loops.value, l.id, gs.hit.pos, step, midiOfRow(gs.row), gForBar(l, b), opts())
    if (r) commit(r.state)
  } else if (gs.kind === 'resize' && l) {
    const r = resizeMelNote(loops.value, l.id, gs.hit.pos, gs.dur, opts())
    if (r) commit(r.state)
  }
}

function setBars(n: 1 | 2 | 4) {
  const l = loop.value
  if (l) commit(setMelBars(loops.value, l.id, n))
}

// una sola melodía por parte: si hay más, se avisa y se pueden quitar las extra (los efectos no cuentan)
const extras = computed(() => extraMelodies(loops.value).length)
async function dropExtras() {
  if (!(await askConfirm(`Esta parte tiene ${extras.value} ${extras.value === 1 ? 'melodía más' : 'melodías más'} apiladas. ¿Quitarlas y dejar solo la que ves?`, 'Quitar'))) return
  engine.editLoops(dropExtraMelodies(loops.value))
}

// ── ↻ responder (spec 020 §1.3): la frase de 2 compases pregunta; los 2 siguientes contestan, con otra variación cada vez, y cierran en la tónica ──
let seed = 0
const canRespond = computed(() => !rec.value && notes.value.some((h) => h.pos < 32))
function respond() {
  const next = answerPhrase(notes.value, style.value, seed++)
  const l = loop.value
  if (!next || !l) return
  commit({ ...loops.value, loops: loops.value.loops.map((x) => (x.id === l.id ? { ...x, bars: 4, hits: next, fromTemplate: false } : x)) })
}

// ── ● grabar a media velocidad (spec 020 §1.1): la base sigue a su tempo y la frase se toca al doble de lento; 1 compás de cuenta; se cuadra a la casilla; acaba sola ──
const rec = ref<{ start: number; bars: 1 | 2 } | null>(null)
const recState = ref<'' | 'cuenta' | 'grabando'>('')
let recHits: MelodyHit[] = []
async function startRec() {
  if (rec.value) return stopRec()
  const l = loop.value
  const rb = l ? (Math.min(2, l.bars) as 1 | 2) : 2
  if (l) commit({ ...loops.value, loops: loops.value.loops.filter((x) => x.id !== l.id) }) // la melodía de antes queda en «deshacer»
  recHits = []
  if (!playing.value) await engine.play()
  rec.value = { start: engine.clockNow().bar + 2, bars: rb }
  recState.value = 'cuenta'
}
function stopRec() {
  rec.value = null
  recState.value = ''
}
/** la posición de la toma en pasos del loop: la mitad de rápido que el reloj */
function recSteps(): number | null {
  const r = rec.value
  if (!r) return null
  const c = engine.clockNow()
  const elapsed = c.bar - r.start + c.barPhase
  return elapsed < 0 ? null : (elapsed / 2) * 16
}
function recNote(e: PointerEvent) {
  const r = rec.value
  if (!r) return
  const { y } = cell(e)
  const midi = midiOfRow(Math.min(rows.value.length - 1, Math.max(0, Math.floor(y / rowH.value))))
  engine.previewNote(midi, synth.value)
  const raw = recSteps()
  if (raw === null) return // en la cuenta, suena pero no se apunta
  const pos = Math.round(raw / unit.value) * unit.value
  if (pos >= r.bars * 16) return
  const sorted = [...recHits.filter((h) => h.pos !== pos), { pos, dur: unit.value, midi, strength: 0.8 }].sort((a, b) => a.pos - b.pos)
  recHits = sorted.map((h, i) => ({ ...h, dur: Math.max(unit.value, Math.min(2, (sorted[i + 1]?.pos ?? r.bars * 16) - h.pos)) }))
  const st = loops.value
  const own = melLoopOf(st)
  if (own) engine.editLoops({ ...st, loops: st.loops.map((x) => (x.id === own.id ? { ...x, hits: recHits, fromTemplate: false } : x)) })
  else if (st.loops.length < 8) engine.editLoops({ loops: [...st.loops, { id: st.nextId, instrument: 'mel', bars: r.bars, phaseBar: 0, hits: recHits, muted: false, bornAt: 0, fromTemplate: false }], nextId: st.nextId + 1 })
}

// ── dibujo ───────────────────────────────────────────────────────────────────────
let raf = 0
function draw() {
  raf = requestAnimationFrame(draw)
  const cv = canvas.value
  if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const W = gridW.value
  const H = gridH.value
  if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
    cv.width = Math.round(W * dpr)
    cv.height = Math.round(H * dpr)
  }
  const x = cv.getContext('2d')!
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  x.fillStyle = '#0B0B0F'
  x.fillRect(0, 0, W, H)
  const cw = cellW.value
  const rh = rowH.value
  // filas: la tónica resaltada
  rows.value.forEach((m, i) => {
    x.fillStyle = isTonic(m, style.value) ? 'rgba(244,150,188,0.09)' : i % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0)'
    x.fillRect(0, i * rh, W, rh)
  })
  // líneas de tiempo: compás, tiempo y semicorchea
  for (let s = 0; s <= steps.value; s++) {
    x.strokeStyle = s % 16 === 0 ? 'rgba(255,255,255,0.28)' : s % 4 === 0 ? 'rgba(255,255,255,0.12)' : s % unit.value === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)'
    x.lineWidth = 1
    x.beginPath()
    x.moveTo(s * cw + 0.5, 0)
    x.lineTo(s * cw + 0.5, H)
    x.stroke()
  }
  // notas
  const gs = g
  for (const h of notes.value) {
    const moving = gs?.kind === 'move' && gs.hit === h && gs.moved
    const resizing = gs?.kind === 'resize' && gs.hit === h
    const dur = resizing ? gs.dur : h.dur
    note(x, h.pos, dur, h.midi, moving ? 0.25 : 0.9, loop.value?.muted ? 0.4 : 1)
  }
  // lo que se está haciendo: la nota nueva o la movida, imantadas
  if (gs?.kind === 'new') noteRow(x, gs.pos, gs.moved ? gs.dur : 2, gs.row, 0.55)
  if (gs?.kind === 'move' && gs.moved) noteRow(x, gs.pos, gs.hit.dur, gs.row, gs.outside ? 0.35 : 0.75, gs.outside)
  // línea de reproducción (en la toma, a media velocidad)
  if (rec.value) {
    const st = recSteps()
    if (st !== null && st >= rec.value.bars * 16) stopRec()
    else {
      recState.value = st === null ? 'cuenta' : 'grabando'
      if (st !== null) {
        x.strokeStyle = 'rgba(255,77,109,0.9)'
        x.lineWidth = 2
        x.beginPath()
        x.moveTo(st * cw, 0)
        x.lineTo(st * cw, H)
        x.stroke()
      }
    }
  } else if (playing.value && loop.value) {
    const phase = engine.clockNow().barPhase
    const bar = engine.currentBar.value
    const b = ((bar - loop.value.phaseBar) % bars.value + bars.value) % bars.value
    const px = (b * 16 + phase * 16) * cw
    x.strokeStyle = 'rgba(255,255,255,0.8)'
    x.lineWidth = 1.5
    x.beginPath()
    x.moveTo(px, 0)
    x.lineTo(px, H)
    x.stroke()
    // sigue a la línea si el loop es más ancho que la pantalla
    const sc = scroller.value
    if (sc && W > sc.clientWidth && !gs) {
      if (px < sc.scrollLeft + 30 || px > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, px - 60)
    }
  }
}
function note(x: CanvasRenderingContext2D, pos: number, dur: number, midi: number, alpha: number, mute: number) {
  noteRow(x, pos, dur, (rows.value.length - 1) - rowOfNote(midi), alpha * mute)
}
function noteRow(x: CanvasRenderingContext2D, pos: number, dur: number, row: number, alpha: number, doomed = false) {
  const cw = cellW.value
  const rh = rowH.value
  const px = pos * cw + 1
  const py = row * rh + 2
  const w = Math.max(6, dur * cw - 2)
  const h = rh - 4
  // arrastrada fuera del cuadro: rosa y hueca (se borrará al soltar)
  x.fillStyle = doomed ? 'rgba(244,150,188,0.25)' : `rgba(255,255,255,${alpha * 0.85})`
  x.beginPath()
  x.roundRect(px, py, w, h, Math.min(7, h / 2))
  x.fill()
  if (doomed) {
    x.strokeStyle = 'rgba(244,150,188,0.9)'
    x.lineWidth = 1.5
    x.stroke()
  }
  // el asa para estirar: una rayita en el extremo
  x.fillStyle = `rgba(11,11,15,${alpha * 0.55})`
  x.fillRect(px + w - 5, py + h * 0.3, 1.5, h * 0.4)
}

// ── transición de agua ───────────────────────────────────────────────────────────
let anim: Animation | null = null
let closing = false
const radius = () => {
  const { x, y } = props.origin
  return Math.hypot(Math.max(x, view.w - x), Math.max(y, view.h - y)) + 8
}
function ringsAnimate(reverse: boolean) {
  if (reduced || !ripples.value) return
  const R = radius()
  ;[...ripples.value.children].forEach((el, i) => {
    const frames: Keyframe[] = [
      { transform: 'translate(-50%,-50%) scale(0.05)', opacity: 0.55 },
      { transform: `translate(-50%,-50%) scale(${(R * 2) / 200})`, opacity: 0 },
    ]
    el.animate(reverse ? frames.reverse() : frames, { duration: 620, delay: i * 110, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' })
  })
}
function open() {
  const el = root.value
  if (!el) return
  const { x, y } = props.origin
  if (reduced) {
    anim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'both' })
    return
  }
  anim = el.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${radius()}px at ${x}px ${y}px)` }], {
    duration: 560,
    easing: 'cubic-bezier(.22,.8,.25,1)',
    fill: 'both',
  })
  ringsAnimate(false)
}
/** Cierra con la transición al revés (el agua se recoge hacia donde se abrió) y avisa al terminar. */
function close() {
  if (closing) return
  closing = true
  if (!anim) return emit('close')
  anim.onfinish = () => emit('close')
  anim.playbackRate = -1.25
  anim.play()
  ringsAnimate(true)
}
defineExpose({ close })

const onKey = (e: KeyboardEvent) => {
  if (e.key === 'Escape') close()
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    doUndo()
  }
}
const measure = () => {
  view.w = window.innerWidth
  view.h = window.innerHeight
}
onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  window.addEventListener('keydown', onKey)
  raf = requestAnimationFrame(draw)
  nextTick(open)
})
onBeforeUnmount(() => {
  stopRec()
  if (undoTimer) clearTimeout(undoTimer)
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', measure)
  window.removeEventListener('keydown', onKey)
})
const label = (m: number) => midiName(m).replace('#', '♯')
</script>

<template>
  <Teleport to="body">
    <div ref="ripples" class="pointer-events-none fixed inset-0 z-[59] overflow-hidden" aria-hidden="true">
      <span v-for="i in 3" :key="i" class="ripple" :style="{ left: `${origin.x}px`, top: `${origin.y}px` }" />
    </div>
    <div
      ref="root"
      class="organ fixed inset-0 z-[60] flex flex-col bg-[#0B0B0F] text-white select-none"
      role="dialog"
      aria-label="órgano de la melodía"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
      @wheel.stop
      @contextmenu.prevent
    >
      <header class="flex items-center gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
        <button class="h-9 w-9 rounded-full border border-white/30 text-lg leading-none" aria-label="cerrar el órgano" @click="close">✕</button>
        <h2 class="text-sm font-medium tracking-wide text-white/80">Melodía</h2>
        <span class="text-xs text-white/40">{{ STYLE_MUSIC[style].key }}</span>
        <button v-if="undo" class="rounded-full border border-white/40 px-3 py-1 text-xs text-white" aria-label="deshacer la última edición" @click="doUndo">↶ deshacer</button>
        <div class="ml-auto flex items-center gap-1" role="group" aria-label="compases del loop">
          <button
            v-for="n in ([1, 2, 4] as const)"
            :key="n"
            class="h-8 min-w-8 rounded-full border px-2 text-xs disabled:opacity-30"
            :class="bars === n ? 'border-white bg-white text-black' : 'border-white/25 text-white/70'"
            :disabled="!loop"
            @click="setBars(n)"
          >
            {{ n }}
          </button>
          <span class="mr-1 text-xs text-white/40">comp.</span>
          <button class="h-9 w-9 rounded-full border border-white/30" :aria-label="playing ? 'parar' : 'reproducir'" @click="playing ? engine.stop() : engine.play()">
            {{ playing ? '■' : '▶' }}
          </button>
        </div>
      </header>

      <div class="flex flex-wrap items-center gap-2 px-4 pb-2 text-xs">
        <button class="rounded-full border px-3 py-1.5" :class="rec ? 'border-[#ff4d6d] text-[#ff4d6d]' : 'border-white/30 text-white'" data-organ-rec @click="startRec">{{ recState === 'cuenta' ? 'cuenta…' : recState === 'grabando' ? '■ grabando' : '● grabar' }}</button>
        <button class="rounded-full border border-[#F496BC]/60 px-3 py-1.5 text-white disabled:opacity-30" :disabled="!canRespond" data-organ-respond @click="respond">↻ responder</button>
        <button v-if="engine.assist.value" class="rounded-full border px-3 py-1.5" :class="fine ? 'border-white text-white' : 'border-white/25 text-white/60'" aria-label="casillas más finas (semicorcheas)" @click="fine = !fine">fino</button>
        <button v-if="extras" class="rounded-full border border-amber-300/60 px-3 py-1.5 text-amber-200" data-organ-extras @click="dropExtras">+{{ extras }} melodía{{ extras === 1 ? '' : 's' }} apilada{{ extras === 1 ? '' : 's' }} · quitar</button>
        <span v-if="rec" class="text-[#ff4d6d]">toca al doble de lento; se cuadra solo y acaba al llegar al final</span>
      </div>

      <div class="flex min-h-0 flex-1 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <!-- nombres de las notas -->
        <div class="relative w-11 shrink-0" :style="{ height: `${gridH}px` }">
          <span
            v-for="(m, i) in rows"
            :key="m"
            class="absolute right-1 text-[11px] tabular-nums"
            :class="isTonic(m, style) ? 'text-[#F496BC]' : 'text-white/45'"
            :style="{ top: `${i * rowH}px`, height: `${rowH}px`, lineHeight: `${rowH}px` }"
          >
            {{ label(m) }}
          </span>
        </div>
        <div ref="scroller" class="min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <canvas
            ref="canvas"
            data-organ-grid
            :data-cell-w="cellW"
            :data-row-h="rowH"
            :data-rows="rows.length"
            :data-top-midi="rows[0]"
            class="block touch-none rounded-md border border-white/10"
            :style="{ width: `${gridW}px`, height: `${gridH}px` }"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp($event)"
            @pointercancel="onUp($event, true)"
          />
        </div>
      </div>
      <p class="px-4 pb-2 text-center text-[11px] text-white/35">
        Toca un hueco para poner una nota (arrastra a la derecha para alargarla) · toca una nota para oírla · arrástrala para moverla, o fuera del cuadro para borrarla · tira de su extremo para cambiar su duración
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.ripple {
  position: fixed;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 1.5px solid rgba(255, 255, 255, 0.55);
  transform: translate(-50%, -50%) scale(0.05);
  opacity: 0;
}
</style>

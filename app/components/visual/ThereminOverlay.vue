<script setup lang="ts">
// El sintetizador de dedo (spec 015 §12–§13): al entrar en una célula de melodía, la pantalla entera es el instrumento. Mantener y deslizar suena continuo;
// arriba/abajo = nota de la escala, a los lados = filtro. La curva está viva (respira, gira, se deforma con la nota, tira hacia el dedo y cada nota lanza una onda de color).
// Modo guiado (por defecto): un tema de la biblioteca; la siguiente nota es un punto de luz fantasma en la curva, se lleva el dedo hasta él y suena; al acabar queda grabada.
import { curvePoint, deformOffset, lightAlpha, lightPush, lissajousOf, nearestParam, waveGlow, type LightPoint, type LissajousParams, type P2 } from '~/lib/theremin'
import { GHOST_R, GUIDE_FRESH, guideStep, noteY, placeGhost, type Ghost, type GuideState } from '~/lib/tuneGuide'
import { adaptTune, TUNES } from '~/lib/tuneLibrary'
import { midiName } from '~/lib/noteScore'
import { pitchColor, scaleNotes } from '~/lib/waterKeys'
import type { MelodyHit } from '~/lib/melody'

const props = defineProps<{ reduced: boolean; bar: number }>()
const emit = defineEmits<{ close: [] }>()
const engine = useAudioEngine()
const { style, playing, keysRec, loops, bpm } = engine

const root = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const notes = computed(() => scaleNotes(style.value))
const loopHits = computed<MelodyHit[]>(() => (loops.value.loops.find((l) => l.instrument === 'mel')?.hits ?? []) as MelodyHit[])
const touched = ref(false)
const down = ref(false)

// ── modo guiado ──────────────────────────────────────────────────────────────────
const guided = ref(true)
const tuneIdx = ref(0)
const tune = computed(() => TUNES[tuneIdx.value % TUNES.length]!)
const tuneHits = computed(() => adaptTune(tune.value, style.value))
const progress = ref(0)
const finished = ref(false)
let gstate: GuideState = { ...GUIDE_FRESH }
let ghost: Ghost | null = null

/** los parámetros de la curva: la del tema (guiado) o la de la melodía de la célula (libre) */
const params = computed<LissajousParams>(() => lissajousOf(guided.value ? tuneHits.value : loopHits.value))

// ── estado del dibujo ────────────────────────────────────────────────────────────
const trail: LightPoint[] = []
let finger: P2 = { x: 0, y: 0 }
let fingerS: P2 = { x: 0, y: 0 } // el dedo suavizado: la curva tira hacia él sin saltos
let pull = 0
let wobble = 0
let wave = { t0: 0, at: -10, h: 0.5 }
let lastNote: number | null = null
let raf = 0
let last = 0
let size = { w: 390, h: 844 }

const fy = (y: number) => y / Math.max(1, size.h)
const fx = (x: number) => x / Math.max(1, size.w)
const hOf = (midi: number | null) => {
  const i = midi === null ? -1 : notes.value.indexOf(midi)
  return i < 0 || notes.value.length < 2 ? 0.5 : i / (notes.value.length - 1)
}
const now = () => performance.now() / 1000
// en el guiado la curva no gira (el punto de luz se queda quieto y es fácil de seguir); en libre, gira despacio
const phaseAt = (t: number) => (props.reduced || guided.value ? 0 : (t * Math.PI * 2) / 30)
const breathAt = (t: number) => (props.reduced ? 1 : 1 + 0.03 * Math.sin((t * Math.PI * 2) / (120 / Math.max(40, bpm.value))))

/** el punto `t` de la curva tal como se ve ahora (con respiración, giro, deformación y tirón del dedo) */
function shown(t: number, tm: number): P2 {
  const base = curvePoint(params.value, t, size.w, size.h, phaseAt(tm), breathAt(tm))
  if (props.reduced || engine.drawLevel.value >= 2) return base
  const d = deformOffset(base, t, size.w, { wobble: engine.drawLevel.value ? 0 : wobble, k: Math.max(0, notes.value.indexOf(lastNote ?? -1)), time: tm, finger: down.value && !guided.value ? fingerS : null, pull })
  return { x: base.x + d.x, y: base.y + d.y }
}

/** la nota fantasma: sobre la curva base (sin deformar ni tirar del dedo), así no se escapa */
const ghostAt = (t: number): P2 => curvePoint(params.value, t, size.w, size.h, phaseAt(now()), 1)
let ghostShown: P2 | null = null

function placeNext() {
  if (!guided.value || gstate.done) return (ghost = null)
  const m = tuneHits.value[gstate.k]?.midi
  const idx = m === undefined ? -1 : notes.value.indexOf(m)
  if (idx < 0) return (ghost = null)
  ghost = placeGhost(params.value, size.w, size.h, idx, notes.value.length, ghost ? ghostAt(ghost.t) : null, phaseAt(now()), GHOST_R)
}
function restart() {
  gstate = { ...GUIDE_FRESH }
  progress.value = 0
  finished.value = false
  ghost = null
  placeNext()
}
function otherTune() {
  tuneIdx.value = (tuneIdx.value + 1) % TUNES.length
  restart()
}
function setGuided(on: boolean) {
  guided.value = on
  if (on) restart()
  else {
    ghost = null
    finished.value = false
  }
}
watch(() => style.value, () => guided.value && restart())

function trigger(midi: number, p: P2) {
  wobble = 1
  wave = { t0: nearestParam(params.value, p, size.w, size.h, phaseAt(now())), at: now(), h: hOf(midi) }
}

function pos(e: PointerEvent) {
  const r = root.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top }
}
function sound(e: PointerEvent | null) {
  if (!e) return
  const p = pos(e)
  finger = p
  let force: number | undefined
  if (guided.value && !gstate.done && ghost) {
    const target = ghost.t
    const r = guideStep(gstate, tuneHits.value.length, p, ghostAt(target))
    if (r.hit) {
      force = tuneHits.value[gstate.k]!.midi
      gstate = r.state
      progress.value = gstate.k
      trigger(force, p)
      if (gstate.done) {
        finished.value = engine.saveMelody(tuneHits.value.map((h) => ({ ...h })))
        ghost = null
      } else placeNext()
    } else gstate = r.state
  }
  const midi = engine.thereminMove(fx(p.x), fy(p.y), force)
  lightPush(trail, { x: p.x, y: p.y, t: now(), h: hOf(midi) })
}
function onDown(e: PointerEvent) {
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  } catch {
    /* sin captura */
  }
  touched.value = true
  down.value = true
  fingerS = pos(e)
  if (guided.value && gstate.done) restart() // tocar tras acabar: otra vuelta al mismo tema
  sound(e)
}
function onMove(e: PointerEvent) {
  if (down.value) sound(e)
}
function onUp() {
  down.value = false
  gstate = guideStep(gstate, tuneHits.value.length, null, ghost).state
  engine.thereminStop()
}

function rec() {
  if (!playing.value) {
    void engine.play()
    return
  }
  engine.toggleKeysRec()
}

// ── dibujo ───────────────────────────────────────────────────────────────────────
const PINK = '#ff8fc0'
const LILA = '#b9a3ff'
function draw() {
  raf = requestAnimationFrame(draw)
  const c = canvas.value
  const x = c?.getContext('2d')
  if (!c || !x) return
  const tm = now()
  const dt = Math.min(0.1, last ? tm - last : 0.016)
  last = tm
  const level = engine.drawLevel.value
  const { w, h } = size
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr)
    c.height = Math.round(h * dpr)
  }
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  x.clearRect(0, 0, w, h)
  // el dedo suavizado y cuánto tira; el temblor de la nota cae
  const k = 1 - Math.exp(-dt / 0.08)
  fingerS = { x: fingerS.x + (finger.x - fingerS.x) * k, y: fingerS.y + (finger.y - fingerS.y) * k }
  pull += ((down.value ? 1 : 0) - pull) * (1 - Math.exp(-dt / 0.15))
  wobble = Math.max(0, wobble - dt / 0.8)
  const cur = engine.thereminNote.value
  if (cur !== lastNote) {
    if (cur !== null && lastNote !== null && wave.at < tm - 0.05) trigger(cur, finger) // (si un acierto del guiado ya lanzó la onda, no se repite)
    lastNote = cur
  }
  const sounding = down.value && cur !== null
  const n = notes.value.length
  // las notas de la escala, suaves (la que suena, encendida)
  x.font = '10px ui-monospace, monospace'
  for (let i = 0; i < n; i++) {
    const y = noteY(i, n, h)
    const on = notes.value[i] === cur
    x.strokeStyle = on ? 'rgba(255,143,192,0.6)' : 'rgba(255,255,255,0.08)'
    x.lineWidth = on ? 1.5 : 1
    x.beginPath()
    x.moveTo(0, y)
    x.lineTo(w, y)
    x.stroke()
    x.fillStyle = on ? 'rgba(255,200,225,0.95)' : 'rgba(255,255,255,0.3)'
    x.fillText(midiName(notes.value[i]!), 8, y - 3)
  }
  // la curva viva
  const N = level === 0 ? 160 : 72
  const pts: P2[] = []
  for (let i = 0; i < N; i++) pts.push(shown((i / N) * Math.PI * 2, tm))
  x.lineJoin = 'round'
  x.lineCap = 'round'
  const stroke = (color: string, width: number, glow = 0) => {
    x.strokeStyle = color
    x.lineWidth = width
    x.shadowColor = color
    x.shadowBlur = level === 0 ? glow : 0
    x.beginPath()
    pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)))
    x.closePath()
    x.stroke()
    x.shadowBlur = 0
  }
  if (sounding) {
    stroke('rgba(255,143,192,0.35)', 9, 0)
    stroke(PINK, 3.4, 18)
  } else stroke(LILA, 2.6, 8)
  // la onda de color de la última nota, por la curva hacia los dos lados
  const age = tm - wave.at
  if (level === 0 && !props.reduced && age >= 0 && age < 0.9) {
    x.strokeStyle = pitchColor(wave.h)
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2
      const g = waveGlow(t, wave.t0, age)
      if (g < 0.05) continue
      const a = pts[i]!
      const b = pts[(i + 1) % N]!
      x.globalAlpha = Math.min(1, g * 1.3)
      x.lineWidth = 3 + g * 8
      x.beginPath()
      x.moveTo(a.x, a.y)
      x.lineTo(b.x, b.y)
      x.stroke()
    }
    x.globalAlpha = 1
  }
  // la nota fantasma (se desliza hasta su sitio) y, tenue, la siguiente, para ver adónde va
  if (ghost) {
    const target = ghostAt(ghost.t)
    ghostShown = ghostShown ? { x: ghostShown.x + (target.x - ghostShown.x) * (1 - Math.exp(-dt / 0.09)), y: ghostShown.y + (target.y - ghostShown.y) * (1 - Math.exp(-dt / 0.09)) } : target
    const g = ghostShown
    const nextMidi = tuneHits.value[gstate.k + 1]?.midi
    const ni = nextMidi === undefined ? -1 : notes.value.indexOf(nextMidi)
    if (ni >= 0) {
      const nx = placeGhost(params.value, size.w, size.h, ni, notes.value.length, target, phaseAt(tm), GHOST_R)
      const np = ghostAt(nx.t)
      x.strokeStyle = 'rgba(255,255,255,0.25)'
      x.setLineDash([4, 6])
      x.lineWidth = 1.5
      x.beginPath()
      x.moveTo(g.x, g.y)
      x.lineTo(np.x, np.y)
      x.stroke()
      x.setLineDash([])
      x.fillStyle = 'rgba(255,255,255,0.35)'
      x.beginPath()
      x.arc(np.x, np.y, 4.5, 0, Math.PI * 2)
      x.fill()
    }
    const pulse = props.reduced ? 0 : Math.sin(tm * 5)
    x.shadowColor = '#ffffff'
    x.shadowBlur = level === 0 ? 22 : 0
    x.fillStyle = 'rgba(255,255,255,0.95)'
    x.beginPath()
    x.arc(g.x, g.y, 8 + pulse * 1.5, 0, Math.PI * 2)
    x.fill()
    x.shadowBlur = 0
    x.strokeStyle = 'rgba(255,255,255,0.6)'
    x.lineWidth = 1.5
    x.beginPath()
    x.arc(g.x, g.y, GHOST_R * (0.62 + pulse * 0.04), 0, Math.PI * 2)
    x.stroke()
  } else ghostShown = null
  // la curva de luz del dedo
  if (!props.reduced) {
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1]!
      const b = trail[i]!
      const al = lightAlpha(b, tm)
      if (al <= 0) continue
      x.strokeStyle = pitchColor(b.h)
      x.globalAlpha = al * 0.9
      x.lineWidth = 2 + al * 5
      x.beginPath()
      x.moveTo(a.x, a.y)
      x.lineTo(b.x, b.y)
      x.stroke()
    }
    x.globalAlpha = 1
  }
  if (down.value) {
    x.fillStyle = sounding ? PINK : LILA
    x.beginPath()
    x.arc(finger.x, finger.y, 12, 0, Math.PI * 2)
    x.fill()
  }
  while (trail.length && tm - trail[0]!.t > 1.4) trail.shift()
}

onMounted(() => {
  const r = root.value!.getBoundingClientRect()
  size = { w: r.width || size.w, h: r.height || size.h }
  placeNext()
  raf = requestAnimationFrame(draw)
  engine.thereminShown.value = true
  // solo en desarrollo: las pruebas con Chrome necesitan saber dónde está la nota fantasma
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__thGhost = () => (ghost ? ghostAt(ghost.t) : null)
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
    <div class="btns">
      <template v-if="guided">
        <button class="btn" aria-label="elegir otra melodía" @pointerdown.stop @click="otherTune">↻ Otra</button>
        <button class="btn" aria-label="tocar libre, sin melodía guiada" @pointerdown.stop @click="setGuided(false)">✋ Libre</button>
      </template>
      <template v-else>
        <button class="btn" aria-label="volver al modo guiado" @pointerdown.stop @click="setGuided(true)">🎯 Guiado</button>
        <button class="btn" :class="{ rec: !!keysRec }" :aria-label="keysRec ? 'terminar y guardar lo tocado como melodía' : 'grabar lo que toques como melodía'" @pointerdown.stop @click="rec">
          {{ keysRec ? `■ ${keysRec.count} notas` : playing ? '● Grabar' : '▶ para grabar' }}
        </button>
      </template>
    </div>
    <p v-if="guided && finished" class="tag" role="status">¡Melodía guardada! Toca para repetirla</p>
    <p v-else-if="guided" class="tag" role="status">
      {{ tune.name }} · {{ progress }}/{{ tuneHits.length }}
      <span v-if="!touched" class="sub">Lleva el dedo al punto de luz</span>
    </p>
    <p v-else-if="keysRec" class="tag rec" role="status">● Grabando · compás {{ (bar % 4) + 1 }}/4</p>
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
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.5);
  padding: 0.4rem 0.9rem;
  font-size: 0.8rem;
  color: #fff;
}
.left {
  position: absolute;
  top: max(0.75rem, env(safe-area-inset-top));
  left: 0.75rem;
}
.btns {
  position: absolute;
  top: max(0.75rem, env(safe-area-inset-top));
  right: 0.75rem;
  display: flex;
  gap: 0.4rem;
}
.rec { border-color: #fb7185; color: #fecdd3; }
.tag {
  position: absolute;
  left: 50%;
  top: calc(max(0.75rem, env(safe-area-inset-top)) + 3rem);
  transform: translateX(-50%);
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.8);
  pointer-events: none;
  text-align: center;
  white-space: nowrap;
}
.tag .sub { display: block; margin-top: 0.2rem; font-size: 0.75rem; color: rgba(255, 255, 255, 0.55); }
.tag.rec { color: #fecdd3; }
</style>

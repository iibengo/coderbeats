<script setup lang="ts">
// Editor de melodía (spec 020 §1), tipo Song Maker: una cuadrícula de corcheas × notas de la escala del estilo. Suena en bucle mientras se edita; cada casilla suena al tocarla.
// Edita el loop de melodía de la célula de ahora (una sola melodía): si no hay, lo crea.
import { melLoopOf, setMelBars } from '~/lib/melodyEdit'
import type { MelodyHit } from '~/lib/melody'
import { answerPhrase, colsOf, COLS_PER_BAR, fitShift, GRID_ROWS, maxShift, noteAt, normalize, rowsFor, soundingAt, stretchNote, tapCell } from '~/lib/melodyGrid'
import type { FreeLoop } from '~/lib/freeLoops'

const open = defineModel<boolean>('open', { required: true })
const engine = useAudioEngine()
const NAMES = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si']
const nameOf = (m: number) => NAMES[m % 12]!

const loop = computed(() => melLoopOf(engine.loops.value))
const bars = computed<1 | 2 | 4>(() => (loop.value?.bars as 1 | 2 | 4) ?? chosenBars.value)
const chosenBars = ref<1 | 2 | 4>(2)
const hits = computed<MelodyHit[]>(() => ((loop.value?.hits ?? []) as MelodyHit[]).filter((h) => typeof h.midi === 'number'))
const shift = ref(0)
const rows = computed(() => rowsFor(engine.style.value, shift.value))
const page = ref(0)
const pageCount = computed(() => bars.value)
const history = ref<MelodyHit[][]>([])

watch(open, (o) => {
  if (!o) return stopRec()
  page.value = 0
  history.value = []
  shift.value = fitShift(engine.style.value, hits.value)
})
watch(() => engine.style.value, () => (shift.value = fitShift(engine.style.value, hits.value)))

/** escribe la melodía en el loop (o lo crea): se oye en el siguiente paso de la aguja */
function commit(next: MelodyHit[]) {
  const s = engine.loops.value
  const own = melLoopOf(s)
  if (own) {
    if (!next.length) return engine.editLoops({ ...s, loops: s.loops.filter((l) => l.id !== own.id) })
    return engine.editLoops({ ...s, loops: s.loops.map((l) => (l.id === own.id ? { ...l, hits: next, fromTemplate: false } : l)) })
  }
  if (!next.length || s.loops.length >= 8) return
  const made: FreeLoop = { id: s.nextId, instrument: 'mel', bars: chosenBars.value, phaseBar: 0, hits: next, muted: false, bornAt: 0, fromTemplate: false }
  engine.editLoops({ loops: [...s.loops, made], nextId: s.nextId + 1 })
}
function setBars(b: 1 | 2 | 4) {
  chosenBars.value = b
  const own = loop.value
  if (own) engine.editLoops(setMelBars(engine.loops.value, own.id, b))
  if (page.value >= b) page.value = b - 1
}
/** «↻ responder»: la frase de 2 compases pregunta, los 2 siguientes contestan (una variación distinta cada vez) y cierran en la tónica */
let seed = 0
function respond() {
  const next = answerPhrase(hits.value, engine.style.value, seed++)
  if (!next) return
  history.value.push(hits.value)
  const s = engine.loops.value
  const own = melLoopOf(s)
  chosenBars.value = 4
  if (own) engine.editLoops({ ...s, loops: s.loops.map((l) => (l.id === own.id ? { ...l, bars: 4, hits: next, fromTemplate: false } : l)) })
  else commit(next)
  page.value = 0
}
const canRespond = computed(() => hits.value.some((h) => h.pos < 32))
function undo() {
  const prev = history.value.pop()
  if (prev) commit(prev)
}
function clearAll() {
  if (!hits.value.length) return
  history.value.push(hits.value)
  commit([])
}

// ── «● grabar» a media velocidad (spec 020 §1.1): la base sigue a su tempo y la frase se toca al DOBLE de lento (2 compases de frase = 4 compases de toma); se cuadra a las columnas ──
const rec = ref<{ start: number; bars: number } | null>(null)
const recState = ref<'' | 'cuenta' | 'grabando'>('')
async function startRec() {
  if (rec.value) return stopRec()
  const b = (bars.value > 2 ? 2 : bars.value) as 1 | 2
  history.value.push(hits.value)
  commit([])
  if (!engine.playing.value) await engine.play()
  const c = engine.clockNow()
  rec.value = { start: c.bar + 2, bars: b } // un compás de cuenta
  recState.value = 'cuenta'
  chosenBars.value = b
  page.value = 0
}
function stopRec() {
  rec.value = null
  recState.value = ''
}
/** la posición de la toma en columnas (0..cols): la mitad de rápido que el reloj */
function recCol(): number | null {
  const r = rec.value
  if (!r) return null
  const c = engine.clockNow()
  const elapsed = c.bar - r.start + c.barPhase
  return elapsed < 0 ? null : (elapsed / 2) * COLS_PER_BAR
}
function recNote(e: PointerEvent): boolean {
  if (!rec.value) return false
  const w = where(e)
  const pos = recCol()
  const midi = w ? rows.value[w.row] : undefined
  if (pos === null || midi === undefined || !w) return true // en la cuenta: el toque suena pero no se apunta
  const col = Math.round(pos)
  if (col >= colsOf(rec.value.bars)) return true
  engine.previewNote(midi)
  const cur = hits.value
  commit(tapCell(noteAt(cur, col) ? cur.filter((h) => h !== noteAt(cur, col)) : cur, col, midi, rec.value.bars))
  return true
}

// ── tocar y arrastrar ──
const gridEl = ref<HTMLElement | null>(null)
let drag: { col: number; removeOnUp: boolean } | null = null
function where(e: PointerEvent): { col: number; row: number } | null {
  const r = gridEl.value?.getBoundingClientRect()
  if (!r) return null
  const c = Math.floor(((e.clientX - r.left) / r.width) * COLS_PER_BAR)
  const rr = Math.floor(((e.clientY - r.top) / r.height) * GRID_ROWS)
  if (c < 0 || c >= COLS_PER_BAR || rr < 0 || rr >= GRID_ROWS) return null
  return { col: page.value * COLS_PER_BAR + c, row: GRID_ROWS - 1 - rr } // la fila 0 es la más grave (abajo)
}
function down(e: PointerEvent) {
  if (rec.value) return void recNote(e)
  const w = where(e)
  const midi = w ? rows.value[w.row] : undefined
  if (!w || midi === undefined) return
  gridEl.value?.setPointerCapture(e.pointerId)
  history.value.push(hits.value)
  const before = noteAt(hits.value, w.col)
  navigator.vibrate?.(5)
  // sobre una nota de esa misma altura: se quita al soltar, salvo que se arrastre (entonces se alarga)
  if (before && before.midi === midi) {
    drag = { col: w.col, removeOnUp: true }
    return
  }
  const next = tapCell(hits.value, w.col, midi, bars.value)
  commit(next)
  engine.previewNote(midi)
  drag = noteAt(next, w.col) ? { col: w.col, removeOnUp: false } : null
}
function move(e: PointerEvent) {
  if (rec.value || !drag) return
  const w = where(e)
  if (!w || w.col <= drag.col) return
  drag.removeOnUp = false
  commit(stretchNote(hits.value, drag.col, w.col, bars.value))
}
function up() {
  if (drag?.removeOnUp) {
    const n = noteAt(hits.value, drag.col)
    if (n) commit(tapCell(hits.value, drag.col, n.midi, bars.value))
  }
  drag = null
}

// ── la aguja y ▶/■ ──
const head = ref(-1)
let raf = 0
onMounted(() => {
  const tick = () => {
    raf = requestAnimationFrame(tick)
    if (rec.value) {
      const col = recCol()
      if (col !== null && col >= colsOf(rec.value.bars)) {
        stopRec() // la toma acaba al llegar al final de la frase
        return void (head.value = -1)
      }
      recState.value = col === null ? 'cuenta' : 'grabando'
      return void (head.value = col ?? -1)
    }
    if (!open.value || !engine.playing.value || !loop.value) return void (head.value = -1)
    const c = engine.clockNow()
    const b = (((c.bar - loop.value.phaseBar) % loop.value.bars) + loop.value.bars) % loop.value.bars
    head.value = (b + c.barPhase) * COLS_PER_BAR
  }
  tick()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  stopRec()
})
const headCol = computed(() => head.value - page.value * COLS_PER_BAR)
const toggle = () => (engine.playing.value ? engine.stop() : engine.play())

const cell = (r: number, c: number) => {
  const col = page.value * COLS_PER_BAR + c
  const row = GRID_ROWS - 1 - r
  const s = soundingAt(hits.value, col)
  const on = !!s && s.midi === rows.value[row]
  return { on, start: on && colsOf(bars.value) > col && noteAt(hits.value, col)?.midi === rows.value[row] }
}
const hidden = computed(() => hits.value.filter((h) => !rows.value.includes(h.midi)).length)
if (import.meta.dev && import.meta.client) (window as unknown as Record<string, unknown>).__melody = { rec: () => recState.value, hits: () => hits.value.map((h) => [h.pos, h.dur, h.midi]), bars: () => bars.value, rows: () => rows.value, normalize }
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-30 flex flex-col bg-black px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] text-white" role="dialog" aria-label="editor de melodía" @pointerdown.stop>
      <header class="mx-auto flex w-full max-w-md items-center gap-2">
        <button class="rounded-lg border border-white/20 px-3 py-2 text-sm" aria-label="cerrar el editor" @click="open = false">✕</button>
        <h2 class="ml-1 text-base font-medium">Melodía</h2>
        <button class="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-white/25" :aria-label="engine.playing.value ? 'parar' : 'tocar'" @click="toggle">{{ engine.playing.value ? '■' : '▶' }}</button>
      </header>
      <div class="mx-auto mt-3 flex w-full max-w-md flex-wrap items-center gap-2 text-sm">
        <span class="text-white/50">largo</span>
        <button v-for="b in ([1, 2, 4] as const)" :key="b" class="rounded-lg px-3 py-1.5" :class="bars === b ? 'border border-[#F496BC]' : 'border border-white/15 text-white/60'" @click="setBars(b)">{{ b }}</button>
        <template v-if="pageCount > 1">
          <button class="ml-2 rounded-lg border border-white/15 px-3 py-1.5" aria-label="compás anterior" :disabled="page === 0" @click="page--">◀</button>
          <span class="tabular-nums text-white/60">{{ page + 1 }}/{{ pageCount }}</span>
          <button class="rounded-lg border border-white/15 px-3 py-1.5" aria-label="compás siguiente" :disabled="page >= pageCount - 1" @click="page++">▶</button>
        </template>
      </div>
      <div class="mx-auto mt-3 flex w-full max-w-md gap-2" style="height: min(62dvh, 560px)">
        <div class="flex h-full w-10 flex-col justify-between text-right text-[11px] text-white/40" aria-hidden="true">
          <span v-for="r in GRID_ROWS" :key="r" class="flex flex-1 items-center justify-end">{{ rows[GRID_ROWS - r] !== undefined ? nameOf(rows[GRID_ROWS - r]!) : '' }}</span>
        </div>
        <div
          ref="gridEl"
          data-grid
          class="relative grid h-full flex-1 touch-none select-none gap-[3px] rounded-xl"
          :style="{ gridTemplateColumns: `repeat(${COLS_PER_BAR}, 1fr)`, gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)` }"
          @pointerdown.prevent="down"
          @pointermove.prevent="move"
          @pointerup="up"
          @pointercancel="up"
        >
          <template v-for="r in GRID_ROWS" :key="r">
            <div
              v-for="c in COLS_PER_BAR"
              :key="c"
              class="rounded-md"
              :class="[cell(r - 1, c - 1).on ? (cell(r - 1, c - 1).start ? 'bg-[#F496BC]' : 'bg-[#F496BC]/55') : (c - 1) % 2 ? 'bg-white/[0.04]' : 'bg-white/[0.08]']"
            />
          </template>
          <div v-if="headCol >= 0 && headCol < COLS_PER_BAR" class="pointer-events-none absolute inset-y-0 w-[3px] rounded bg-white/80" :style="{ left: `${(headCol / COLS_PER_BAR) * 100}%` }" />
        </div>
        <div class="flex h-full w-10 flex-col justify-center gap-2">
          <button class="rounded-lg border border-white/20 py-2 text-sm" aria-label="notas más agudas" :disabled="shift >= maxShift(engine.style.value)" @click="shift = Math.min(maxShift(engine.style.value), shift + 3)">▲</button>
          <button class="rounded-lg border border-white/20 py-2 text-sm" aria-label="notas más graves" :disabled="shift <= 0" @click="shift = Math.max(0, shift - 3)">▼</button>
        </div>
      </div>
      <div class="mx-auto mt-3 flex w-full max-w-md items-center gap-2 text-sm">
        <button class="rounded-lg border border-white/20 px-3 py-2" :disabled="!history.length" @click="undo">↶ deshacer</button>
        <button class="rounded-lg border border-white/20 px-3 py-2" :disabled="!hits.length" @click="clearAll">vaciar</button>
        <button class="rounded-lg border px-3 py-2" :class="rec ? 'border-[#ff4d6d] text-[#ff4d6d]' : 'border-white/20'" @click="startRec">{{ recState === 'cuenta' ? 'cuenta…' : recState === 'grabando' ? '■ grabando' : '● grabar' }}</button>
        <button class="rounded-lg border border-[#F496BC]/60 px-3 py-2" :disabled="!canRespond || !!rec" @click="respond">↻ responder</button>
        <span v-if="hidden" class="text-xs ml-auto text-xs text-white/40">{{ hidden }} fuera de la vista (▲▼)</span>
      </div>
      <p v-if="rec" class="mx-auto mt-2 w-full max-w-md text-xs text-[#ff4d6d]">Toca donde quieras, al doble de lento: la aguja va a media velocidad y cada toque se cuadra a la columna más cercana. Termina sola al llegar al final.</p>
      <p v-else class="mx-auto mt-2 w-full max-w-md text-xs text-white/45">Toca una casilla para poner o quitar una nota; arrastra a la derecha para alargarla. Solo hay notas de la escala del estilo.</p>
    </div>
  </Transition>
</template>

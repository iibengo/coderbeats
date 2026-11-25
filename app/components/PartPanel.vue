<script setup lang="ts">
// Editar parte (spec 020): las capas de la parte que se ve, como en Capas del Laboratorio: tocar enciende o apaga, «editar» abre la forma de rellenarla
// (batería: círculo o cuadrícula; melodía: el Órgano). Una parte, como mucho 4 capas a la vista. «Parte» es lo que el usuario llama a lo que el motor llama célula.
import { VOICE_HEX } from '~/lib/palette'
import { isFxLoop, melLoopOf } from '~/lib/melodyEdit'
import type { FreeLoop } from '~/lib/freeLoops'
import { SING_BARS, melodyCount, MAX_PART_MELODIES, type SingBars } from '~/lib/singPart'
import { scaleLabel, type SongScale } from '~/lib/songScale'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ drums: []; organ: [MouseEvent] }>()
const engine = useAudioEngine()
const { t } = useI18n()
const GREY = '#CFCFD6'

const order = computed(() => engine.song.value.order)
const index = computed(() => Math.max(0, order.value.indexOf(engine.viewCellId.value)))
const name = computed(() => engine.song.value.cells.find((c) => c.id === engine.viewCellId.value)?.name || t('part.n', { n: index.value + 1 }))
function go(d: number) {
  const id = order.value[index.value + d]
  if (id !== undefined) engine.enterCell(id)
}

const loops = computed(() => engine.loops.value.loops)
const drumLoops = computed(() => loops.value.filter((l) => l.instrument === 'bd' || l.instrument === 'sd' || l.instrument === 'hh'))
const melodyLoop = computed(() => melLoopOf({ loops: loops.value.filter((l) => l.instrument === 'mel' && !isFxLoop(l)), nextId: 0 }))
const fxLoops = computed(() => loops.value.filter((l) => l.instrument === 'mel' && isFxLoop(l)))
const anyOn = (ls: FreeLoop[]) => ls.some((l) => !l.muted)

interface Slot {
  key: string
  label: string
  color: string
  has: boolean
  on: boolean
  toggle: () => void
  edit?: (e: MouseEvent) => void
  hint: string
  /** «Proponer una melodía» (solo la capa de melodía, mientras está vacía) */
  propose?: () => void
}
function setLoops(ls: FreeLoop[]) {
  const target = !anyOn(ls)
  for (const l of ls) if (l.muted === target) engine.mute(l.id)
}
const slots = computed<Slot[]>(() => {
  const s: Slot[] = [
    { key: 'bateria', label: t('part.drums'), color: VOICE_HEX.bd, has: drumLoops.value.length > 0, on: anyOn(drumLoops.value), toggle: () => setLoops(drumLoops.value), edit: () => emit('drums'), hint: t('part.drumsHint') },
    { key: 'melodia', label: t('part.melody'), color: VOICE_HEX.mel, has: !!melodyLoop.value, on: !!melodyLoop.value && !melodyLoop.value.muted, toggle: () => melodyLoop.value && engine.mute(melodyLoop.value.id), edit: (e) => editMelody(e), hint: t('part.melodyHint'), propose: () => proposeMelody() },
    { key: 'bajo', label: t('part.bass'), color: VOICE_HEX.bass, has: true, on: engine.bgManual.value.bass, toggle: () => engine.toggleBackgroundPart('bass'), hint: t('part.bassHint') },
    { key: 'acordes', label: t('part.chords'), color: GREY, has: true, on: engine.bgManual.value.chords, toggle: () => engine.toggleBackgroundPart('chords'), hint: t('part.chordsHint') },
  ]
  if (fxLoops.value.length) s.push({ key: 'efectos', label: t('part.fx'), color: GREY, has: true, on: anyOn(fxLoops.value), toggle: () => setLoops(fxLoops.value), hint: t('part.fxHint') })
  return s
})
/** «editar» la melodía: si suena una melodía sugerida (fantasma) y todavía no hay capa, se queda como capa y el Órgano la enseña, no vacío (spec 060) */
function editMelody(e: MouseEvent) {
  if (!melodyLoop.value && engine.suggestion.value) engine.acceptSuggestion()
  emit('organ', e)
}
const proposeMsg = ref('')
function proposeMelody() {
  proposeMsg.value = engine.proposeMelody() ? '' : t('part.proposeNone')
}
const MAX_PARTS = 8
/** «Duplicar con variación» (decisión de la auditoría: las variaciones solo salen al duplicar una parte): copia la parte justo detrás y propone variaciones (+ energía, − energía, melodía, relleno) */
const canDuplicate = computed(() => order.value.length < MAX_PARTS)
function duplicate() {
  const cur = engine.viewCellId.value
  const at = engine.song.value.cells.find((c) => c.id === cur)?.at
  engine.setSuggestions(true)
  const id = engine.copyCell(cur, { x: (at?.x ?? 0) + 3, y: (at?.y ?? 0) + 1 })
  if (id !== null) {
    engine.orderAfter(cur, id)
    engine.enterCell(id)
  }
  open.value = false
}
// ▶ Tocar en el Laboratorio: ver `useToLab`
const toLab = useToLab()
const labError = toLab.error
async function playInLab() {
  if (await toLab.playInLab()) open.value = false
}
const many = computed(() => slots.value.filter((x) => x.has && x.on).length > 4)
// ── Cantar esta parte (spec 039): graba 2–4 compases, ajusta las notas a la escala de la canción y añade una melodía nueva ──
const partLock = usePartLock()
const singBars = ref<SingBars>(2)
const scale = computed(() => engine.song.value.scale ?? null)
const askScale = ref(false) // si la canción no tiene escala, se pregunta (no se adivina)
const picked = ref('7-minor')
const SCALES: { value: string; label: string; scale: SongScale }[] = (['minor', 'major'] as const).flatMap((mode) =>
  Array.from({ length: 12 }, (_, tonic) => ({ value: `${tonic}-${mode}`, label: scaleLabel({ tonic, mode }), scale: { tonic, mode } })),
)
const singState = engine.voiceRec
const singMsg = ref('')
const melodies = computed(() => melodyCount(loops.value))
const canSing = computed(() => engine.playing.value && melodies.value < MAX_PART_MELODIES)
async function sing(withScale?: SongScale) {
  const sc = withScale ?? scale.value
  if (!sc) {
    askScale.value = true
    return
  }
  askScale.value = false
  if (withScale) engine.setSongScale(withScale)
  singMsg.value = ''
  partLock.enter()
  try {
    if (!(await engine.setListening(true))) return void (singMsg.value = t('part.singNoMic'))
    const r = await engine.singPart(singBars.value, sc)
    singMsg.value = r === 'ok' ? t('part.singDone') : r === 'nothing' ? t('part.singNothing') : r === 'headphones' ? t('part.singHeadphones') : r === 'full' ? t('part.singFull', { n: MAX_PART_MELODIES }) : r === 'no-play' ? t('part.singNoPlay') : ''
  } finally {
    partLock.leave()
  }
}
function deleteSung() {
  const id = engine.lastSung.value
  if (id === null) return
  const st = engine.loops.value
  engine.editLoops({ ...st, loops: st.loops.filter((l) => l.id !== id) })
  engine.lastSung.value = null
  singMsg.value = ''
}
const hasSung = computed(() => engine.lastSung.value !== null && loops.value.some((l) => l.id === engine.lastSung.value))
if (import.meta.dev && import.meta.client) (window as unknown as Record<string, unknown>).__parte = { slots: () => slots.value.map((s) => [s.key, s.has, s.on]), name: () => name.value }
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-20 flex items-end" @pointerdown.self="open = false">
      <div class="absolute inset-0 bg-black/50" @click="open = false" />
      <section class="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#121217] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm" :aria-label="t('part.edit')" @pointerdown.stop>
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <div class="mb-3 flex items-center gap-2">
          <button class="h-11 w-11 rounded-full border border-white/20 disabled:opacity-30" :aria-label="t('part.prev')" :disabled="index <= 0" @click="go(-1)">◀</button>
          <div class="min-w-0 flex-1 text-center">
            <h2 class="truncate text-base text-white" data-part-name>{{ name }}</h2>
            <p class="text-xs text-neutral-500">{{ t('part.of', { n: index + 1, total: order.length }) }}</p>
          </div>
          <button class="h-11 w-11 rounded-full border border-white/20 disabled:opacity-30" :aria-label="t('part.next')" :disabled="index >= order.length - 1" @click="go(1)">▶</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="s in slots" :key="s.key" class="rounded-2xl border p-3" :class="s.on ? 'border-white/30' : 'border-white/10'" :data-slot="s.key">
            <button class="flex w-full items-center gap-3 text-left" :aria-pressed="s.on" :aria-label="`${s.label}: ${s.on ? 'suena' : 'apagada'}`" @click="s.has ? s.toggle() : s.edit?.($event)">
              <span class="h-8 w-8 shrink-0 rounded-full border-2" :style="{ borderColor: s.color, background: s.on ? s.color : 'transparent' }" />
              <span class="min-w-0">
                <span class="block text-white">{{ s.label }}</span>
                <span class="block truncate text-xs text-neutral-500">{{ !s.has ? t('part.tapToCreate') : s.on ? t('part.on') : t('part.off') }}</span>
              </span>
            </button>
            <button v-if="s.propose && !s.has" class="mt-3 w-full rounded-full border border-[#7FD6C2] py-2 text-xs text-white" data-propose-melody @click="s.propose()">{{ t('part.propose') }}</button>
            <button v-if="s.edit" class="mt-2 w-full rounded-full border border-white/20 py-2 text-xs text-white" :data-edit="s.key" @click="s.edit($event)">{{ t('part.editBtn') }}</button>
            <p v-else class="mt-3 text-center text-xs text-neutral-600">{{ s.hint }}</p>
          </div>
        </div>
        <p v-if="proposeMsg" class="mt-2 text-xs text-amber-300" role="status" data-propose-msg>{{ proposeMsg }}</p>
        <!-- cantar esta parte (spec 039) -->
        <div class="mt-3 rounded-2xl border border-white/10 p-3" data-sing>
          <div class="flex items-center gap-2">
            <button class="h-11 flex-1 rounded-full border border-[#F496BC] px-4 text-white disabled:opacity-40" :disabled="!canSing && singState === 'idle'" data-sing-btn @click="singState === 'idle' ? sing() : engine.singPart(singBars, scale ?? SCALES[0]!.scale)">
              {{ singState === 'armed' ? t('part.singArmed') : singState === 'recording' ? t('part.singRecording') : singState === 'saving' ? t('part.singSaving') : t('part.sing') }}
            </button>
            <div v-if="singState === 'idle'" class="flex shrink-0 gap-1" role="group" :aria-label="t('part.singBars')">
              <button v-for="n in SING_BARS" :key="n" class="h-11 w-11 rounded-full border text-sm" :class="singBars === n ? 'border-white text-white' : 'border-white/25 text-white/60'" :aria-pressed="singBars === n" :data-sing-bars="n" @click="singBars = n">{{ n }}</button>
            </div>
          </div>
          <p class="mt-2 text-xs text-neutral-500">{{ scale ? t('part.singScale', { s: scaleLabel(scale) }) : t('part.singNoScale') }}</p>
          <div v-if="askScale" class="mt-2 flex items-center gap-2" data-sing-ask>
            <select v-model="picked" class="h-11 min-w-0 flex-1 rounded-lg border border-white/20 bg-black px-2 text-white" :aria-label="t('part.singPick')" data-sing-pick>
              <option v-for="o in SCALES" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
            <button class="h-11 rounded-full bg-white px-4 text-black" data-sing-use @click="sing(SCALES.find((o) => o.value === picked)!.scale)">{{ t('part.singUse') }}</button>
          </div>
          <div v-if="hasSung" class="mt-2 flex gap-2">
            <button class="h-11 flex-1 rounded-full border border-white/20 text-sm text-white" data-sing-edit @click="emit('organ', $event)">{{ t('part.singEdit') }}</button>
            <button class="h-11 flex-1 rounded-full border border-white/20 text-sm text-white" data-sing-delete @click="deleteSung">{{ t('part.singDelete') }}</button>
          </div>
          <p v-if="singMsg" class="mt-2 text-xs text-amber-300" role="status" data-sing-msg>{{ singMsg }}</p>
        </div>
        <button class="mt-3 w-full rounded-full bg-white py-2.5 font-medium text-black" data-play-lab @click="playInLab">{{ t('part.playLab') }}</button>
        <p v-if="labError" class="mt-1 text-xs text-amber-300" role="alert">{{ labError }}</p>
        <button class="mt-2 w-full rounded-full border border-white/20 py-2.5 text-white disabled:opacity-40" :disabled="!canDuplicate" data-duplicate @click="duplicate">{{ t('part.duplicate') }}</button>
        <p v-if="!canDuplicate" class="mt-1 text-xs text-neutral-500">{{ t('part.max8') }}</p>
        <p v-if="many" class="mt-3 text-xs text-amber-300">{{ t('part.many') }}</p>
      </section>
    </div>
  </Transition>
</template>

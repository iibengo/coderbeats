<script setup lang="ts">
// Hoja de ajustes (§16.16): todo lo que no es tocar está aquí, escondido tras "⋯".
import type { BackgroundMode } from '~/lib/background'
import { KIT_ORDER, KITS } from '~/lib/constants'
import { autoImageDelayMs, describeImageDelay, FINE_MAX_MS, FINE_MIN_MS, FINE_STEP_MS } from '~/lib/imageDelay'
import type { LoopLength } from '~/lib/phrases'
import type { PhraseMode, RepeatMode } from '~/composables/useAudioEngine'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ renderer: string; layout: () => string }>()
const emit = defineEmits<{ recalibrate: ['latency' | 'sounds']; pilot: []; preview: []; video: [] }>()
const engine = useAudioEngine()
const { t } = useI18n()
const prefsStudio = useStudioPrefs()
function toggleEq() {
  prefsStudio.setEq(!prefsStudio.eq.value)
  engine.setEq(prefsStudio.eq.value)
}
function toggleGlue() {
  prefsStudio.setGlue(!prefsStudio.glue.value)
  engine.setGlue(prefsStudio.glue.value)
}
const adv = prefsStudio.advanced
const ui = useUi()
// lo que reemplaza la canción la desvincula de la guardada de la que venía (spec 006, §10.4): así "Guardar" no machaca una guardada
const library = useLibrary()
const { kit, assist, melodyOn, melodyBlocked, metronome, bgMode, phraseCloseBeats, maxPhraseBars, phraseMode, repeatMode, fx, playing, diag, echo, loops, multi, imageAuto, imageFineMs, imageDelayShown, syncTest, syncFlash } =
  engine

const code = computed(() => engine.displayCode())
// giroscopio (spec 003, E3.6): solo en móvil y sin movimiento reducido
const motion = useAroMotion()
const reduced = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const showMotion = computed(() => motion.available() && !reduced)
const copied = ref(false)
const tab = ref<'ajustes' | 'codigo' | 'diagnostico' | 'acerca'>('ajustes')

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}

async function copy() {
  await copyText(code.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

/** Copia el diagnóstico completo (spec 003, E4.0): pantalla y registro, del más antiguo al más nuevo. */
const diagCopied = ref(false)
async function copyDiag() {
  const lines = [...diag.value]
    .reverse()
    .map((d) => `${d.at.toFixed(2)} · ${d.kind} · ${d.text}${d.uiMs !== undefined ? ` · ${d.uiMs.toFixed(0)} ms` : ''}`)
  await copyText([`visual: ${props.renderer}`, `pantalla: ${props.layout()}`, ...lines].join('\n'))
  diagCopied.value = true
  setTimeout(() => (diagCopied.value = false), 1500)
}

/** Prueba de rendimiento (diagnóstico): la demo repetida hasta 8 o 16 células. */
async function stressDemo(count: 8 | 16) {
  if ((loops.value.loops.length || multi.value) && !(await askConfirm(`¿Reemplazar tu canción por la demo de prueba de ${count} células?`))) return
  if (await engine.loadStressDemo(count)) {
    library.setCurrent(null)
    open.value = false
  }
}

/** Añade una célula libre (spec 005, §16): un grupo de una célula, apagado y vacío; se entra en ella para llenarla. */
function addFree() {
  if (engine.addGroupCell() !== null) open.value = false
}

/** "Borrar todo" pide confirmación y se puede deshacer unos segundos (spec 005, §7.1). */
async function clearAll() {
  if ((loops.value.loops.length || multi.value) && !(await askConfirm('¿Borrar toda la canción?'))) return
  engine.clearAll()
  library.setCurrent(null)
}

function recalibrate(what: 'latency' | 'sounds') {
  engine.stop()
  open.value = false
  emit('recalibrate', what)
}

const BG_MODES: { id: BackgroundMode; label: string }[] = [
  { id: 'manual', label: 'manual' },
  { id: 'progressive', label: 'progresivo' },
  { id: 'full', label: 'completo' },
  { id: 'off', label: 'sin fondo' },
]
const PHRASE_MODES: { id: PhraseMode; label: string }[] = [
  { id: 'bar', label: '1 compás' },
  { id: 'silence', label: 'por silencio' },
]
const REPEAT_MODES: { id: RepeatMode; label: string }[] = [
  { id: 'replace', label: 'sustituye' },
  { id: 'complete', label: 'completa' },
]
const CLOSE: { id: 1 | 2 | 4; label: string }[] = [
  { id: 1, label: '1 tiempo' },
  { id: 2, label: '2 tiempos' },
  { id: 4, label: '1 compás' },
]
const MAX: LoopLength[] = [1, 2, 4]
const chip = (on: boolean) => (on ? 'bg-white text-black' : 'text-neutral-400')
const val = (e: Event) => Number((e.target as HTMLInputElement).value)

/** retraso de imagen automático que sale de tu calibración (spec 003, E6), para enseñarlo */
const autoMs = computed(() => autoImageDelayMs(engine.roundTripMs.value, engine.reportedOutputMs.value))
/** cuánto va retrasada la imagen ahora y de qué se compone (spec 003, E6.9) */
const imageLine = computed(() =>
  describeImageDelay({
    auto: engine.imageAuto.value,
    fineMs: engine.imageFineMs.value,
    roundTripMs: engine.roundTripMs.value,
    reportedOutputMs: engine.reportedOutputMs.value,
    savedRoundTripMs: engine.savedLatencyMs.value,
  }),
)
// al abrir ⋯, se vuelve a leer lo que informa el navegador (puede haber cambiado al conectar unos cascos)
watch(open, (o) => {
  if (o) engine.refreshImageDelay()
  else engine.stopSyncTest()
})
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-20 flex items-end" @pointerdown.self="open = false">
      <div class="absolute inset-0 bg-black/50" @click="open = false" />
      <section
        class="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#121217] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm"
        @pointerdown.stop
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <nav class="mb-4 flex gap-1 text-xs">
          <button class="rounded-full px-3 py-1" :class="chip(tab === 'ajustes')" @click="tab = 'ajustes'">{{ t('settings.tabSettings') }}</button>
          <button v-if="adv" class="rounded-full px-3 py-1" :class="chip(tab === 'codigo')" @click="tab = 'codigo'">{{ t('settings.tabCode') }}</button>
          <button v-if="adv" class="rounded-full px-3 py-1" :class="chip(tab === 'diagnostico')" @click="tab = 'diagnostico'">
            {{ t('settings.tabDiag') }}
          </button>
          <button class="rounded-full px-3 py-1" :class="chip(tab === 'acerca')" @click="tab = 'acerca'">{{ t('settings.tabAbout') }}</button>
        </nav>

        <div v-if="tab === 'ajustes'" class="grid gap-3">
          <!-- lo esencial -->
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5">{{ t('settings.sound') }} <InfoTip :text="t('settings.info.sound')" /></span>
            <span class="flex gap-1">
              <button v-for="k in KIT_ORDER" :key="k" class="rounded-full px-2 py-0.5 text-xs" :class="chip(kit === k)" @click="engine.setKit(k)">
                {{ KITS[k].label }}
              </button>
            </span>
          </div>
          <label class="flex items-center justify-between">
            <span class="flex items-center gap-1.5">{{ t('settings.scale') }} <InfoTip :text="t('settings.info.scale')" /></span>
            <input type="checkbox" :checked="assist" @change="engine.setAssist(($event.target as HTMLInputElement).checked)" />
          </label>
          <div class="flex gap-2">
            <button class="flex-1 rounded-full border border-white/30 py-2 disabled:opacity-40" :disabled="!playing" @click="engine.drop()">{{ t('settings.drop') }}</button>
            <button class="flex-1 rounded-full border border-white/15 py-2 disabled:opacity-40" :disabled="!loops.loops.length && !multi" @click="clearAll">{{ t('settings.fresh') }}</button>
            <InfoTip class="self-center" :text="`${t('settings.info.drop')} · ${t('settings.info.fresh')}`" />
          </div>
          <div class="flex items-center gap-3">
            <button class="shrink-0 rounded-full border border-white/15 px-4 py-2" @click="emit('video'); open = false">{{ t('settings.video') }}</button>
            <span class="text-xs text-neutral-500">{{ t('settings.videoHelp') }}</span>
            <InfoTip :text="t('settings.info.video')" />
          </div>

          <!-- avanzado: se abre y se cierra -->
          <button class="flex w-full items-center justify-between rounded-xl border border-white/15 px-3 py-2.5 text-left" :aria-expanded="adv" data-advanced-toggle @click="prefsStudio.setAdvanced(!adv)">
            <span>{{ t('settings.advanced') }} <span class="block text-xs text-neutral-500">{{ t('settings.advancedHint') }}</span></span>
            <span class="text-lg text-white/70" aria-hidden="true">{{ adv ? t('settings.advancedState.open') : t('settings.advancedState.closed') }}</span>
          </button>

          <template v-if="adv">
            <MasterMeter />
            <div class="flex items-center justify-between" data-eq>
              <span class="flex items-center gap-1.5">{{ t('settings.eq.label') }} <InfoTip :text="t('settings.eq.info')" /></span>
              <button class="rounded-full px-3 py-0.5 text-xs" :class="chip(prefsStudio.eq.value)" :aria-pressed="prefsStudio.eq.value" data-eq-toggle @click="toggleEq">{{ prefsStudio.eq.value ? t('settings.glue.on') : t('settings.glue.off') }}</button>
            </div>
            <div class="flex items-center justify-between" data-glue>
              <span class="flex items-center gap-1.5">{{ t('settings.glue.label') }} <InfoTip :text="t('settings.glue.info')" /></span>
              <button class="rounded-full px-3 py-0.5 text-xs" :class="chip(prefsStudio.glue.value)" :aria-pressed="prefsStudio.glue.value" data-glue-toggle @click="toggleGlue">{{ prefsStudio.glue.value ? t('settings.glue.on') : t('settings.glue.off') }}</button>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.bg.label') }} <InfoTip :text="t('settings.info.bg')" /></span>
              <span class="flex gap-1">
                <button v-for="m in BG_MODES" :key="m.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(bgMode === m.id)" @click="engine.setBackgroundMode(m.id)">{{ t(`settings.bg.${m.id === 'progressive' ? 'progressive' : m.id}`) }}</button>
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.phrase.label') }} <InfoTip :text="t('settings.info.phrase')" /></span>
              <span class="flex gap-1">
                <button v-for="m in PHRASE_MODES" :key="m.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(phraseMode === m.id)" @click="engine.setPhraseOptions({ mode: m.id })">{{ t(`settings.phrase.${m.id}`) }}</button>
              </span>
            </div>
            <template v-if="phraseMode === 'silence'">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1.5">{{ t('settings.phrase.close') }} <InfoTip :text="t('settings.info.close')" /></span>
                <span class="flex gap-1">
                  <button v-for="c in CLOSE" :key="c.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(phraseCloseBeats === c.id)" @click="engine.setPhraseOptions({ closeBeats: c.id })">{{ t(`settings.phrase.beats${c.id}`) }}</button>
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1.5">{{ t('settings.phrase.max') }} <InfoTip :text="t('settings.info.maxPhrase')" /></span>
                <span class="flex gap-1">
                  <button v-for="b in MAX" :key="b" class="rounded-full px-2 py-0.5 text-xs" :class="chip(maxPhraseBars === b)" @click="engine.setPhraseOptions({ maxBars: b })">{{ t('settings.phrase.bars', { n: b }) }}</button>
                </span>
              </div>
            </template>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.repeat.label') }} <InfoTip :text="t('settings.info.repeat')" /></span>
              <span class="flex gap-1">
                <button v-for="m in REPEAT_MODES" :key="m.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(repeatMode === m.id)" @click="engine.setRepeatMode(m.id)">{{ t(`settings.repeat.${m.id}`) }}</button>
              </span>
            </div>
            <label class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.suggestions') }} <span class="text-xs text-neutral-500">{{ t('settings.suggestionsHint') }}</span> <InfoTip :text="t('settings.info.suggestions')" /></span>
              <input type="checkbox" :checked="engine.suggestions.value" @change="engine.setSuggestions(($event.target as HTMLInputElement).checked)" />
            </label>
            <label class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.production') }} <span class="text-xs text-neutral-500">{{ t('settings.productionHint') }}</span> <InfoTip :text="t('settings.info.production')" /></span>
              <input type="checkbox" :checked="engine.production.value" @change="engine.setProduction(($event.target as HTMLInputElement).checked)" />
            </label>
            <label class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.flow') }} <span class="text-xs text-neutral-500">{{ t('settings.flowHint') }}</span> <InfoTip :text="t('settings.info.flow')" /></span>
              <input type="checkbox" :checked="engine.flow.value" @change="engine.setFlow(($event.target as HTMLInputElement).checked)" />
            </label>
            <div class="grid gap-0.5">
              <label class="flex items-center justify-between">
                <span class="flex items-center gap-1.5">{{ t('settings.voiceMelody') }} <span class="text-xs text-neutral-500">{{ t('settings.beta') }}</span> <InfoTip :text="t('settings.info.voiceMelody')" /></span>
                <input type="checkbox" :checked="melodyOn" @change="engine.setMelody(($event.target as HTMLInputElement).checked)" />
              </label>
              <p class="text-xs text-neutral-500">{{ t('settings.voiceHelp') }}</p>
              <p v-if="melodyOn && melodyBlocked" class="text-xs text-amber-300">{{ t('settings.voiceBlocked') }}</p>
            </div>
            <label v-if="showMotion" class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.motion') }} <InfoTip :text="t('settings.info.motion')" /></span>
              <input type="checkbox" :checked="motion.enabled.value" @change="motion.toggle()" />
            </label>
            <label class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.metronome') }} <InfoTip :text="t('settings.info.metronome')" /></span>
              <input type="checkbox" :checked="metronome" @change="engine.setMetronome(($event.target as HTMLInputElement).checked)" />
            </label>
            <div class="grid gap-1">
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-1.5">{{ t('settings.imageDelay') }} <span class="text-xs text-neutral-500 tabular-nums">{{ imageDelayShown }} ms</span> <InfoTip :text="t('settings.info.imageDelay')" /></span>
                <label class="flex items-center gap-2 text-xs text-neutral-400">
                  {{ t('settings.auto') }}
                  <input type="checkbox" :checked="imageAuto" @change="engine.setImageDelay({ auto: ($event.target as HTMLInputElement).checked })" />
                </label>
              </div>
              <input type="range" :min="FINE_MIN_MS" :max="FINE_MAX_MS" :step="FINE_STEP_MS" :value="imageFineMs" :aria-label="t('settings.imageFine')" @input="engine.setImageDelay({ fineMs: val($event) })" />
              <p class="text-xs text-neutral-500">{{ t('settings.imageHelp', { auto: autoMs, fine: `${imageFineMs > 0 ? '+' : ''}${imageFineMs}` }) }}</p>
              <div class="flex items-center gap-3">
                <button class="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs" @click="syncTest ? engine.stopSyncTest() : engine.startSyncTest()">{{ syncTest ? t('settings.syncStop') : t('settings.syncStart') }}</button>
                <span :key="syncFlash" class="sync-dot shrink-0" :class="{ on: syncTest && syncFlash > 0 }" aria-hidden="true" />
                <span class="text-xs text-neutral-500">{{ t('settings.syncHelp') }}</span>
              </div>
            </div>
            <label class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-1.5">{{ t('settings.warmth') }} <InfoTip :text="t('settings.info.warmth')" /></span>
              <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="fx.warmth" @input="engine.setFx({ warmth: val($event) })" />
            </label>
            <div class="flex items-center gap-3">
              <button class="shrink-0 rounded-full border border-white/15 px-4 py-2 disabled:opacity-40" :disabled="!loops.loops.length && !multi" @click="emit('preview'); open = false">{{ t('settings.preview') }}</button>
              <span class="text-xs text-neutral-500">{{ t('settings.previewHelp') }}</span>
              <InfoTip :text="t('settings.info.preview')" />
            </div>
            <div v-if="engine.style.value === 'dembow'" class="flex items-center gap-3">
              <button class="shrink-0 rounded-full border border-white/15 px-4 py-2" @click="emit('pilot'); open = false">{{ t('settings.pilot') }}</button>
              <span class="text-xs text-neutral-500">{{ t('settings.pilotHelp') }}</span>
              <InfoTip :text="t('settings.info.pilot')" />
            </div>
            <div class="flex items-center gap-3">
              <button class="shrink-0 rounded-full border border-white/15 px-4 py-2 disabled:opacity-40" :disabled="!engine.canConvert.value" @click="engine.convertSong(); open = false">{{ t('settings.convert') }}</button>
              <span class="text-xs text-neutral-500">{{ t('settings.convertHelp') }}</span>
              <InfoTip :text="t('settings.info.convert')" />
            </div>
            <div class="flex items-center gap-3">
              <button class="shrink-0 rounded-full border border-white/15 px-4 py-2" @click="addFree">{{ t('settings.free') }}</button>
              <span class="text-xs text-neutral-500">{{ t('settings.freeHelp') }}</span>
              <InfoTip :text="t('settings.info.free')" />
            </div>
            <label class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">{{ t('settings.syncMelody') }} <span class="text-xs text-neutral-500">{{ t('settings.syncMelodyHint') }}</span> <InfoTip :text="t('settings.info.syncMelody')" /></span>
              <input type="checkbox" :checked="ui.state.syncMelody" @change="ui.setSync(($event.target as HTMLInputElement).checked)" />
            </label>
            <div class="flex items-center gap-3">
              <button class="shrink-0 rounded-full border border-white/15 px-4 py-2" @click="engine.addMelodyCell(); open = false">{{ t('settings.addMelody') }}</button>
              <span class="text-xs text-neutral-500">{{ t('settings.addMelodyHelp') }}</span>
              <InfoTip :text="t('settings.info.addMelody')" />
            </div>
            <p class="text-xs text-neutral-500">{{ t('settings.gestures') }}</p>
            <p class="text-xs text-neutral-500">{{ engine.personalModel.value ? t('settings.soundsCalibrated') : t('settings.soundsDefault') }}</p>
            <div class="flex items-center gap-4 text-xs text-neutral-500">
              <button class="underline underline-offset-4" @click="recalibrate('latency')">{{ engine.personalModel.value ? t('settings.recalLatency') : t('settings.measureLatency') }}</button>
              <button class="underline underline-offset-4" @click="recalibrate('sounds')">{{ engine.personalModel.value ? t('settings.recalSounds') : t('settings.calSounds') }}</button>
              <InfoTip :text="t('settings.info.calibration')" />
            </div>
            <p v-if="echo?.bleed" class="text-xs text-amber-300">{{ t('settings.bleed', { ms: (echo.roundTrip * 1000).toFixed(0) }) }}</p>
            <button class="rounded-xl border border-white/15 py-2.5 text-white/80" data-advanced-close @click="prefsStudio.setAdvanced(false)">{{ t('settings.closeAdvanced') }}</button>
          </template>
        </div>

        <div v-else-if="tab === 'codigo'">
          <div class="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>Strudel<span v-if="!assist"> · ritmo exacto con .nudge()</span></span>
            <button class="text-white" @click="copy">{{ copied ? 'Copiado' : 'Copiar' }}</button>
          </div>
          <pre class="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-neutral-300">{{ code }}</pre>
        </div>

        <AboutPanel v-else-if="tab === 'acerca'" />

        <div v-else class="text-xs text-neutral-500">
          <div class="mb-2 flex items-center justify-between">
            <span>registro ({{ diag.length }})</span>
            <button class="text-white" @click="copyDiag">{{ diagCopied ? 'Copiado' : 'Copiar' }}</button>
          </div>
          <div class="mb-3 flex items-center gap-2">
            <span>prueba de rendimiento</span>
            <button class="rounded-full border border-white/20 px-3 py-1 text-white" @click="stressDemo(8)">demo ×8 células</button>
            <button class="rounded-full border border-white/20 px-3 py-1 text-white" @click="stressDemo(16)">demo ×16</button>
          </div>
          <p class="mb-1">visual: {{ props.renderer }}</p>
          <p class="mb-1 text-neutral-300">{{ imageLine }}</p>
          <p class="mb-2">pantalla: {{ props.layout() }}</p>
          <ul class="space-y-0.5 font-mono tabular-nums">
            <li v-for="(d, i) in diag.slice(0, 60)" :key="i">
              {{ d.at.toFixed(2) }} · {{ d.kind }} · {{ d.text }}<template v-if="d.uiMs !== undefined"> · {{ d.uiMs.toFixed(0) }} ms</template>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
/* punto de la prueba de sincronía: se enciende un instante con cada destello */
.sync-dot {
  width: 18px;
  height: 18px;
  border-radius: 9999px;
  background: rgb(255 255 255 / 0.1);
}
.sync-dot.on {
  animation: sync-flash 180ms ease-out;
}
@keyframes sync-flash {
  from {
    background: rgb(255 255 255 / 0.95);
    box-shadow: 0 0 14px rgb(255 255 255 / 0.6);
  }
  to {
    background: rgb(255 255 255 / 0.1);
    box-shadow: none;
  }
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sheet-enter-active section,
.sheet-leave-active section {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from section,
.sheet-leave-to section {
  transform: translateY(24px);
}
</style>

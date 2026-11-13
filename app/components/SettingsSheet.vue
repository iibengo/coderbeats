<script setup lang="ts">
// Hoja de ajustes (§16.16): todo lo que no es tocar está aquí, escondido tras "⋯".
import type { BackgroundMode } from '~/lib/background'
import { KIT_ORDER, KITS } from '~/lib/constants'
import { autoImageDelayMs, FINE_MAX_MS, FINE_MIN_MS, FINE_STEP_MS } from '~/lib/imageDelay'
import type { LoopLength } from '~/lib/phrases'
import type { PhraseMode, RepeatMode } from '~/composables/useAudioEngine'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ renderer: string; layout: () => string }>()
const emit = defineEmits<{ recalibrate: ['latency' | 'sounds'] }>()
const engine = useAudioEngine()
const { kit, assist, metronome, bgMode, phraseCloseBeats, maxPhraseBars, phraseMode, repeatMode, fx, playing, diag, echo, loops, multi, imageAuto, imageFineMs, imageDelayShown, syncTest, syncFlash } =
  engine

const code = computed(() => engine.displayCode())
// giroscopio (spec 003, E3.6): solo en móvil y sin movimiento reducido
const motion = useAroMotion()
const reduced = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const showMotion = computed(() => motion.available() && !reduced)
const copied = ref(false)
const tab = ref<'ajustes' | 'codigo' | 'diagnostico'>('ajustes')

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

/** Demo del estilo actual; si ya hay loops, se pide confirmación antes de reemplazarlos (§16.20). */
function loadDemo() {
  if ((loops.value.loops.length || multi.value) && !confirm('¿Reemplazar tu canción por la demo de este estilo?')) return
  engine.loadDemo()
  open.value = false
}

/** Prueba de rendimiento (diagnóstico): la demo repetida hasta 8 o 16 células. */
async function stressDemo(count: 8 | 16) {
  if ((loops.value.loops.length || multi.value) && !confirm(`¿Reemplazar tu canción por la demo de prueba de ${count} células?`)) return
  if (await engine.loadStressDemo(count)) open.value = false
}

/** "Borrar todo" pide confirmación y se puede deshacer unos segundos (spec 005, §7.1). */
function clearAll() {
  if ((loops.value.loops.length || multi.value) && !confirm('¿Borrar toda la canción?')) return
  engine.clearAll()
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
          <button class="rounded-full px-3 py-1" :class="chip(tab === 'ajustes')" @click="tab = 'ajustes'">ajustes</button>
          <button class="rounded-full px-3 py-1" :class="chip(tab === 'codigo')" @click="tab = 'codigo'">código</button>
          <button class="rounded-full px-3 py-1" :class="chip(tab === 'diagnostico')" @click="tab = 'diagnostico'">
            diagnóstico
          </button>
        </nav>

        <div v-if="tab === 'ajustes'" class="grid gap-3">
          <div class="flex items-center justify-between">
            Kit
            <span class="flex gap-1">
              <button v-for="k in KIT_ORDER" :key="k" class="rounded-full px-2 py-0.5 text-xs" :class="chip(kit === k)" @click="engine.setKit(k)">
                {{ KITS[k].label }}
              </button>
            </span>
          </div>
          <div class="flex items-center justify-between">
            Fondo
            <span class="flex gap-1">
              <button v-for="m in BG_MODES" :key="m.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(bgMode === m.id)" @click="engine.setBackgroundMode(m.id)">
                {{ m.label }}
              </button>
            </span>
          </div>
          <div class="flex items-center justify-between">
            Frase
            <span class="flex gap-1">
              <button v-for="m in PHRASE_MODES" :key="m.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(phraseMode === m.id)" @click="engine.setPhraseOptions({ mode: m.id })">
                {{ m.label }}
              </button>
            </span>
          </div>
          <template v-if="phraseMode === 'silence'">
            <div class="flex items-center justify-between">
              Cierre
              <span class="flex gap-1">
                <button v-for="c in CLOSE" :key="c.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(phraseCloseBeats === c.id)" @click="engine.setPhraseOptions({ closeBeats: c.id })">
                  {{ c.label }}
                </button>
              </span>
            </div>
            <div class="flex items-center justify-between">
              Frase máxima
              <span class="flex gap-1">
                <button v-for="b in MAX" :key="b" class="rounded-full px-2 py-0.5 text-xs" :class="chip(maxPhraseBars === b)" @click="engine.setPhraseOptions({ maxBars: b })">
                  {{ b }} c.
                </button>
              </span>
            </div>
          </template>
          <div class="flex items-center justify-between">
            Repetir instrumento
            <span class="flex gap-1">
              <button v-for="m in REPEAT_MODES" :key="m.id" class="rounded-full px-2 py-0.5 text-xs" :class="chip(repeatMode === m.id)" @click="engine.setRepeatMode(m.id)">
                {{ m.label }}
              </button>
            </span>
          </div>
          <label class="flex items-center justify-between">
            Ayuda
            <input type="checkbox" :checked="assist" @change="engine.setAssist(($event.target as HTMLInputElement).checked)" />
          </label>
          <label v-if="showMotion" class="flex items-center justify-between">
            Movimiento del móvil
            <input type="checkbox" :checked="motion.enabled.value" @change="motion.toggle()" />
          </label>
          <label class="flex items-center justify-between">
            Metrónomo
            <input type="checkbox" :checked="metronome" @change="engine.setMetronome(($event.target as HTMLInputElement).checked)" />
          </label>
          <div class="grid gap-1">
            <div class="flex items-center justify-between">
              <span>Retraso de imagen <span class="text-xs text-neutral-500 tabular-nums">{{ imageDelayShown }} ms</span></span>
              <label class="flex items-center gap-2 text-xs text-neutral-400">
                automático
                <input type="checkbox" :checked="imageAuto" @change="engine.setImageDelay({ auto: ($event.target as HTMLInputElement).checked })" />
              </label>
            </div>
            <input
              type="range"
              :min="FINE_MIN_MS"
              :max="FINE_MAX_MS"
              :step="FINE_STEP_MS"
              :value="imageFineMs"
              aria-label="ajuste fino del retraso de imagen"
              @input="engine.setImageDelay({ fineMs: val($event) })"
            />
            <p class="text-xs text-neutral-500">
              Si la aguja y las bolas van por delante del sonido (cascos Bluetooth), sube el ajuste. Automático:
              {{ autoMs }} ms de tu calibración · ajuste fino {{ imageFineMs > 0 ? '+' : '' }}{{ imageFineMs }} ms. Se guarda en este dispositivo.
              Con Bluetooth el retraso de los cascos puede variar: si vuelve a descuadrar, ajústalo otra vez.
            </p>
            <div class="flex items-center gap-3">
              <button class="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs" @click="syncTest ? engine.stopSyncTest() : engine.startSyncTest()">
                {{ syncTest ? 'Parar prueba' : 'Probar sincronía' }}
              </button>
              <span :key="syncFlash" class="sync-dot shrink-0" :class="{ on: syncTest && syncFlash > 0 }" aria-hidden="true" />
              <span class="text-xs text-neutral-500">
                Un clic por segundo y un punto que se enciende. Si el punto se enciende antes que el clic, sube el ajuste; si después, bájalo.
              </span>
            </div>
          </div>
          <label class="flex items-center justify-between gap-3">
            Calor
            <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="fx.warmth" @input="engine.setFx({ warmth: val($event) })" />
          </label>
          <div class="flex gap-2">
            <button class="flex-1 rounded-full border border-white/30 py-2 disabled:opacity-40" :disabled="!playing" @click="engine.drop()">
              Drop
            </button>
            <button class="flex-1 rounded-full border border-white/15 py-2 disabled:opacity-40" :disabled="!loops.loops.length && !multi" @click="clearAll">
              Borrar todo
            </button>
            <button class="flex-1 rounded-full border border-white/15 py-2" @click="loadDemo">Cargar demo</button>
          </div>
          <p class="text-xs text-neutral-500">
            Arrastra en vertical sobre el agua para el filtro y en horizontal para el espacio. Dos dedos: fondo sí/no.
            Toca un loop para silenciarlo; mantenlo para borrarlo.
          </p>
          <div class="flex gap-4 text-xs text-neutral-500">
            <button class="underline underline-offset-4" @click="recalibrate('latency')">Recalibrar latencia</button>
            <button class="underline underline-offset-4" @click="recalibrate('sounds')">Recalibrar sonidos</button>
          </div>
          <p v-if="echo?.bleed" class="text-xs text-amber-300">
            El micro oye los altavoces ({{ (echo.roundTrip * 1000).toFixed(0) }} ms). Usa cascos.
          </p>
        </div>

        <div v-else-if="tab === 'codigo'">
          <div class="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>Strudel<span v-if="!assist"> · ritmo exacto con .nudge()</span></span>
            <button class="text-white" @click="copy">{{ copied ? 'Copiado' : 'Copiar' }}</button>
          </div>
          <pre class="overflow-x-auto rounded-lg bg-black/30 p-3 font-mono text-xs leading-relaxed text-neutral-300">{{ code }}</pre>
        </div>

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

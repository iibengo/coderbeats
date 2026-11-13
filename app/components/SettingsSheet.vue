<script setup lang="ts">
// Hoja de ajustes (§16.16): todo lo que no es tocar está aquí, escondido tras "⋯".
import type { BackgroundMode } from '~/lib/background'
import { KIT_ORDER, KITS } from '~/lib/constants'
import type { LoopLength } from '~/lib/phrases'
import type { PhraseMode, RepeatMode } from '~/composables/useAudioEngine'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ renderer: string; layout: () => string }>()
const emit = defineEmits<{ recalibrate: ['latency' | 'sounds'] }>()
const engine = useAudioEngine()
const { kit, assist, metronome, bgMode, phraseCloseBeats, maxPhraseBars, phraseMode, repeatMode, fx, playing, diag, echo, loops } =
  engine

const code = computed(() => engine.displayCode())
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
  if (loops.value.loops.length && !confirm('¿Reemplazar tus loops por la demo de este estilo?')) return
  engine.loadDemo()
  open.value = false
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
          <label class="flex items-center justify-between">
            Metrónomo
            <input type="checkbox" :checked="metronome" @change="engine.setMetronome(($event.target as HTMLInputElement).checked)" />
          </label>
          <label class="flex items-center justify-between gap-3">
            Calor
            <input class="flex-1" type="range" min="0" max="1" step="0.01" :value="fx.warmth" @input="engine.setFx({ warmth: val($event) })" />
          </label>
          <div class="flex gap-2">
            <button class="flex-1 rounded-full border border-white/30 py-2 disabled:opacity-40" :disabled="!playing" @click="engine.drop()">
              Drop
            </button>
            <button class="flex-1 rounded-full border border-white/15 py-2 disabled:opacity-40" :disabled="!loops.loops.length" @click="engine.clearAll()">
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

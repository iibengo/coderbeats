<script setup lang="ts">
// Batería de la parte (spec 020 §1b): dos formas de rellenarla, tocando (el círculo de ritmo o una cuadrícula) o con la boca (🎤, opcional: solo aparece si hay micro).
// Lo grabado con la boca queda en los mismos tres loops y se corrige tocando aquí. El micro nunca es obligatorio.
import { AMBER, LAB_INSTRUMENTS, LAB_W, STEPS, drumLoop, toggleStep } from '~/lib/lab'
import { VOICE_HEX } from '~/lib/palette'
import type { FreeLoop } from '~/lib/freeLoops'
import type { Instrument } from '~/lib/types'
import type { StageFrame } from './lab/LabStage.vue'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ mic: [] }>()
const engine = useAudioEngine()
const partLock = usePartLock()
watch(open, (o) => (o ? partLock.enter() : partLock.leave()))
onBeforeUnmount(() => open.value && partLock.leave())
const C = LAB_W / 2
const R = [100, 175, 245]
const COLOR: Record<Instrument, string> = { bd: AMBER, sd: VOICE_HEX.sd, hh: VOICE_HEX.hh }
const NAME: Record<Instrument, string> = { bd: 'bombo', sd: 'caja', hh: 'platillo' }
const view = ref<'circulo' | 'cuadricula'>('circulo')
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void } | null>(null)

const loopOf = (i: Instrument): FreeLoop | undefined => engine.loops.value.loops.find((l) => l.instrument === i)
const stepsOf = (i: Instrument): number[] => (loopOf(i)?.hits ?? []).map((h) => Math.round(h.pos) % STEPS)
const isOn = (i: Instrument, s: number) => stepsOf(i).includes(s)

/** pone o quita el golpe del paso `s` del instrumento (si no hay loop de ese instrumento, lo crea) */
function toggle(i: Instrument, s: number) {
  const st = engine.loops.value
  const own = loopOf(i)
  if (own) {
    const hits = toggleStep(own.hits, s)
    engine.editLoops({ ...st, loops: hits.length ? st.loops.map((l) => (l.id === own.id ? { ...l, hits } : l)) : st.loops.filter((l) => l.id !== own.id) })
  } else if (st.loops.length < 8) engine.editLoops({ loops: [...st.loops, drumLoop(st.nextId, i, [s])], nextId: st.nextId + 1 })
}
function clear() {
  const st = engine.loops.value
  engine.editLoops({ ...st, loops: st.loops.filter((l) => !LAB_INSTRUMENTS.includes(l.instrument as Instrument)) })
}

const ringOf = (d: number) => (d < 140 ? 0 : d < 210 ? 1 : d < 280 ? 2 : -1)
function down(x: number, y: number) {
  const ring = ringOf(Math.hypot(x - C, y - C))
  if (ring < 0) return
  let a = Math.atan2(y - C, x - C) + Math.PI / 2
  if (a < 0) a += Math.PI * 2
  const step = Math.round((a / (Math.PI * 2)) * STEPS) % STEPS
  const inst = LAB_INSTRUMENTS[ring]!
  toggle(inst, step)
  stage.value?.ripple(x, y, COLOR[inst], 5, 14)
  navigator.vibrate?.(6)
}
const pt = (step: number, r: number): [number, number] => {
  const a = (step / STEPS) * Math.PI * 2 - Math.PI / 2
  return [C + Math.cos(a) * r, C + Math.sin(a) * r]
}
function draw(g: CanvasRenderingContext2D, f: StageFrame) {
  for (let s = 0; s < STEPS; s++)
    for (const r of R) {
      const [x, y] = pt(s, r)
      g.beginPath()
      g.arc(x, y, 3, 0, 7)
      g.fillStyle = 'rgba(255,255,255,.35)'
      g.fill()
    }
  LAB_INSTRUMENTS.forEach((inst, k) => {
    const pts = [...new Set(stepsOf(inst))].sort((a, b) => a - b).map((s) => pt(s, R[k]!))
    if (pts.length > 1) {
      g.beginPath()
      pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])))
      g.closePath()
      g.strokeStyle = COLOR[inst]
      g.lineWidth = 2
      g.globalAlpha = 0.7
      g.stroke()
      g.globalAlpha = 1
    }
    for (const s of stepsOf(inst)) {
      const [x, y] = pt(s, R[k]!)
      const near = f.playing && Math.abs(((s - f.phase * STEPS + STEPS * 1.5) % STEPS) - STEPS / 2) < 0.7
      g.beginPath()
      g.arc(x, y, near ? 12 : 8, 0, 7)
      g.fillStyle = COLOR[inst]
      g.fill()
    }
  })
}
const toggleLabel = computed(() => (engine.playing.value ? '■' : '▶'))
if (import.meta.dev && import.meta.client) (window as unknown as Record<string, unknown>).__drums = { steps: (i: Instrument) => stepsOf(i), toggle }
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-30 flex flex-col overflow-y-auto bg-black px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] text-white" role="dialog" aria-label="batería de la parte" @pointerdown.stop>
      <header class="mx-auto flex w-full max-w-md items-center gap-2">
        <button class="rounded-lg border border-white/20 px-3 py-2 text-sm" aria-label="cerrar la batería" @click="open = false">✕</button>
        <h2 class="ml-1 text-base font-medium">Batería</h2>
        <button v-if="partLock.available.value || partLock.locked.value" class="h-10 rounded-lg border px-3 text-sm" :class="partLock.locked.value ? 'border-[#F496BC] text-[#F496BC]' : 'border-white/30 text-white/70'" :aria-pressed="partLock.locked.value" :aria-label="partLock.locked.value ? 'parte fija: tocar para que la canción siga' : 'fijar la parte en bucle'" data-lock @click="partLock.toggle()">{{ partLock.locked.value ? '🔒' : '🔓' }}</button>
        <button class="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-white/25" :aria-label="engine.playing.value ? 'parar' : 'tocar'" @click="engine.playing.value ? engine.stop() : engine.play()">{{ toggleLabel }}</button>
      </header>
      <div class="mx-auto mt-3 flex w-full max-w-md items-center gap-2 text-sm">
        <button v-for="v in ([['circulo', 'círculo'], ['cuadricula', 'cuadrícula']] as const)" :key="v[0]" class="rounded-lg px-3 py-1.5" :class="view === v[0] ? 'border border-[#F496BC]' : 'border border-white/15 text-white/60'" @click="view = v[0]">{{ v[1] }}</button>
        <button v-if="!engine.noMic.value" class="ml-auto rounded-lg border border-white/25 px-3 py-1.5" aria-label="grabar con la boca (opcional)" @click="open = false; emit('mic')">🎤 boca</button>
        <button class="rounded-lg border border-white/15 px-3 py-1.5 text-white/70" :class="{ 'ml-auto': engine.noMic.value }" @click="clear">vaciar</button>
      </div>
      <div class="mx-auto mt-3 w-full max-w-md">
        <LabStage v-if="view === 'circulo'" ref="stage" :rings="R" :draw="draw" @down="down" />
        <div v-else class="grid gap-3" data-grid-drums>
          <div v-for="i in LAB_INSTRUMENTS" :key="i">
            <div class="mb-1 text-xs" :style="{ color: COLOR[i] }">{{ NAME[i] }}</div>
            <div class="grid grid-cols-8 gap-[3px]" style="grid-template-columns: repeat(16, minmax(0, 1fr))">
              <button v-for="s in STEPS" :key="s" class="h-10 rounded-md" :class="s % 4 === 1 ? 'border border-white/20' : ''" :style="{ background: isOn(i, s - 1) ? COLOR[i] : 'rgba(255,255,255,.06)' }" :aria-label="`${NAME[i]} paso ${s}`" :aria-pressed="isOn(i, s - 1)" @click="toggle(i, s - 1)" />
            </div>
          </div>
        </div>
      </div>
      <p class="mx-auto mt-3 w-full max-w-md text-xs text-white/45">Toca para poner o quitar golpes; suena en bucle con la parte. Con 🎤 puedes decir «bum · pff · ts» y luego corregirlo aquí.</p>
    </div>
  </Transition>
</template>

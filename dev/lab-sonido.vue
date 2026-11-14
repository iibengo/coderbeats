<script setup lang="ts">
// Laboratorio del sonido de la melodía (spec 002, §17): la misma melodía con cada variante, para elegir de oído.
// Solo en desarrollo (`nuxt dev`). NO cambia el sonido de la app: solo compara.
//   · Panel A (el sonido de hoy) y panel B (una propuesta): duración (celdas o real), legato, glide y sinte con reverb y delay.
//   · «Alternar A/B» toca dos vueltas de cada una, una tras otra, hasta que pares.
//   · «Comprobar que todo suena» evalúa cada combinación en Strudel y mide la salida (sin escuchar).
import { STYLES } from '~/lib/constants'
import { MIDI_MAX, MIDI_MIN, type MelodyHit } from '~/lib/melody'
import { assistMelody, type RawNote } from '~/lib/melodyAssist'
import { applyLegato, CURRENT_SOUND, glideOffsets, TIMBRES, variantCode, type SoundConfig, type Timbre } from '~/lib/melodyVariants'
import { midiName } from '~/lib/noteScore'
import { readJson, writeJson } from '~/lib/storage'
import { detectOnsets } from '~/lib/onsets'
import { STYLE_MUSIC } from '~/lib/styles'
import type { StyleId } from '~/lib/types'

// ── la melodía de prueba: lo que cantarías, en semicorcheas con decimales ────────
type Sung = [step: number, dur: number, midi: number][]
const MELODIES: Record<string, { label: string; bars: 1 | 2; notes: Sung }> = {
  legato: {
    label: 'Legato (frase suave, casi sin pausas)',
    bars: 2,
    notes: [[0.1, 3.6, 57.2], [4, 3.7, 60.1], [8, 2.8, 62.2], [11, 4.9, 64.1], [16.2, 3.5, 62], [20, 3.8, 60], [24, 3.6, 57.1], [28, 3.9, 55.3]],
  },
  staccato: {
    label: 'Staccato (notas cortas con aire)',
    bars: 1,
    notes: [[0, 1.2, 57], [2, 0.9, 60], [4, 1.1, 64], [6.2, 0.8, 62], [8, 1.3, 60], [10, 0.7, 57], [12, 1.2, 64], [14.1, 1.0, 67]],
  },
  mixta: {
    label: 'Mixta (largas y cortas, con saltos)',
    bars: 2,
    notes: [[0, 6.2, 57], [6.4, 1.1, 60], [8, 0.9, 62], [9.9, 1.2, 64], [12, 3.7, 60], [16, 2.4, 67], [18.3, 1.4, 64], [20, 5.5, 62], [26, 1.0, 60], [28, 3.8, 57]],
  },
}

const style = ref<StyleId>('hiphop90')
const melodyId = ref<keyof typeof MELODIES>('legato')
const synthPick = ref<'auto' | 'piano' | 'lead' | 'pad'>('auto')
const pulse = ref(true)
const bpm = computed(() => STYLES[style.value].bpm)
const synth = computed<'piano' | 'lead' | 'pad'>(() => {
  if (synthPick.value !== 'auto') return synthPick.value
  const d = STYLE_MUSIC[style.value].synth
  return d === 'drone' ? 'piano' : d
})

// ── los dos paneles ──────────────────────────────────────────────────────────────
const PROPOSAL: SoundConfig = { timbre: 'b', dur: 'real', legato: 'huecos', glide: 'penv', glideMs: 80, room: 0.2, delay: 0.2 }
const KEY = 'coderbeats:lab:sonido'
interface Saved { A: SoundConfig; B: SoundConfig; picks: Record<string, string> }
const saved = readJson(KEY, (x): x is Saved => !!x && typeof x === 'object' && 'A' in x && 'B' in x) ?? null
const A = reactive<SoundConfig>({ ...(saved?.A ?? CURRENT_SOUND) })
const B = reactive<SoundConfig>({ ...(saved?.B ?? PROPOSAL) })
const picks = reactive<Record<string, string>>({ ...(saved?.picks ?? {}) })
watch([A, B, picks], () => writeJson(KEY, { A: { ...A }, B: { ...B }, picks: { ...picks } }), { deep: true })
const resetA = () => Object.assign(A, CURRENT_SOUND)
const resetB = () => Object.assign(B, PROPOSAL)

// ── de la melodía cantada a golpes y a código ────────────────────────────────────
const stepSec = computed(() => 60 / bpm.value / 4)
function hitsFor(cfg: SoundConfig): MelodyHit[] {
  const m = MELODIES[melodyId.value]!
  const raw: RawNote[] = m.notes.map(([step, dur, midi]) => ({ step, dur, midi, strength: 0.6 }))
  return assistMelody(raw, {
    assist: true,
    style: style.value,
    startBar: 0,
    bars: m.bars,
    register: synth.value,
    stepSeconds: stepSec.value,
    ...(cfg.dur === 'real' ? { durGrid: 0.25 } : {}),
  })
}
const codeFor = (cfg: SoundConfig): string => {
  const m = MELODIES[melodyId.value]!
  const code = variantCode(cfg, { hits: hitsFor(cfg), bars: m.bars, phaseBar: 0, synth: synth.value, bpm: bpm.value })
  if (!pulse.value) return code
  // un pulso grave a negras para sentir el tempo
  const [head, line] = code.split('\n') as [string, string]
  return `${head}\nstack(\n  ${line},\n  note("c2*4").s("sine").decay(0.12).sustain(0).gain(0.45).orbit(1)\n)`
}
const codeShown = (cfg: SoundConfig) => variantCode(cfg, { hits: hitsFor(cfg), bars: MELODIES[melodyId.value]!.bars, phaseBar: 0, synth: synth.value, bpm: bpm.value })
const notesShown = (cfg: SoundConfig) => hitsFor(cfg).map((h) => `${midiName(h.midi)}@${h.pos}·${h.dur}`).join('  ')
const loopSec = computed(() => MELODIES[melodyId.value]!.bars * 16 * stepSec.value)

// ── audio ────────────────────────────────────────────────────────────────────────
const started = ref(false)
const msg = ref('')
const playingLabel = ref('')
let ctx: AudioContext | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let S: any = null
let abort = 0

async function start() {
  try {
    ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    S = await import('@strudel/web')
    S.setAudioContext(ctx)
    await S.initAudio()
    await S.initStrudel({})
    const base = useRuntimeConfig().app.baseURL
    await ctx.audioWorklet.addModule(`${base}worklets/capture-processor.js`)
    started.value = true
    msg.value = `listo · ${ctx.sampleRate} Hz`
  } catch (e) {
    msg.value = `No se pudo iniciar el audio: ${e instanceof Error ? e.message : String(e)}`
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Un sinte propio de Web Audio con portamento: la otra vía para el glide (no es Strudel). */
function playWebAudio(cfg: SoundConfig, loops: number): () => void {
  const c = ctx!
  const hits = cfg.legato === 'no' ? hitsFor(cfg) : applyLegato(hitsFor(cfg))
  const off = glideOffsets(hits)
  const total = MELODIES[melodyId.value]!.bars * 16 * stepSec.value
  const wave = { piano: 'triangle', lead: 'square', pad: 'sawtooth' }[synth.value] as OscillatorType
  const out = c.createGain()
  out.gain.value = 0.5
  out.connect(c.destination)
  // reverb: un ruido que decae; eco: un delay con realimentación
  if (cfg.room > 0.01) {
    const len = Math.round(c.sampleRate * (0.6 + 1.6 * cfg.room))
    const buf = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5
    }
    const conv = c.createConvolver()
    conv.buffer = buf
    const wet = c.createGain()
    wet.gain.value = cfg.room * 0.8
    out.connect(conv).connect(wet).connect(c.destination)
  }
  if (cfg.delay > 0.01) {
    const dl = c.createDelay(2)
    dl.delayTime.value = 0.75 * (60 / bpm.value)
    const fb = c.createGain()
    fb.gain.value = 0.4
    const wet = c.createGain()
    wet.gain.value = cfg.delay * 0.6
    out.connect(dl)
    dl.connect(fb).connect(dl)
    dl.connect(wet).connect(c.destination)
  }
  const t0 = c.currentTime + 0.1
  const oscs: OscillatorNode[] = []
  for (let k = 0; k < loops; k++) {
    hits.forEach((h, i) => {
      const t = t0 + k * total + h.pos * stepSec.value
      const d = Math.max(0.05, h.dur * stepSec.value)
      const f = 440 * 2 ** ((h.midi - 69) / 12)
      const o = c.createOscillator()
      const lp = c.createBiquadFilter()
      const g = c.createGain()
      o.type = wave
      lp.type = 'lowpass'
      lp.frequency.value = synth.value === 'lead' ? 1800 : 2800
      // portamento: parte de la nota anterior (si está pegada) y llega en `glideMs`
      const from = cfg.glide === 'webaudio' && off[i] ? f * 2 ** (off[i]! / 12) : f
      o.frequency.setValueAtTime(from, t)
      if (from !== f) o.frequency.exponentialRampToValueAtTime(f, t + cfg.glideMs / 1000)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.22, t + (synth.value === 'pad' ? 0.1 : 0.01))
      g.gain.setValueAtTime(0.22, t + Math.max(0.02, d - 0.06))
      g.gain.linearRampToValueAtTime(0, t + d + (cfg.legato === 'solapado' ? 0.05 : 0.02))
      o.connect(lp).connect(g).connect(out)
      o.start(t)
      o.stop(t + d + 0.1)
      oscs.push(o)
    })
  }
  return () => {
    for (const o of oscs) try { o.stop() } catch { /* ya parado */ }
    out.disconnect()
  }
}

/** Toca una variante `loops` vueltas (Strudel; o Web Audio si el glide es el propio) y espera a que acabe o a que se pare. */
async function playSegment(cfg: SoundConfig, label: string, loops: number, token: number) {
  playingLabel.value = label
  if (cfg.glide === 'webaudio') {
    const stop = playWebAudio(cfg, loops)
    const end = Date.now() + loops * loopSec.value * 1000 + 300
    while (Date.now() < end && abort === token) await sleep(60)
    stop()
    return
  }
  await S.evaluate(codeFor(cfg))
  const end = Date.now() + loops * loopSec.value * 1000
  while (Date.now() < end && abort === token) await sleep(60)
  S.hush()
}

async function playOne(which: 'A' | 'B') {
  stop()
  const token = ++abort
  const cfg = which === 'A' ? A : B
  // hasta que pares: tandas de 4 vueltas
  while (abort === token) await playSegment(cfg, which, 4, token)
  playingLabel.value = ''
}

async function alternate() {
  stop()
  const token = ++abort
  while (abort === token) {
    await playSegment(A, 'A', 2, token)
    if (abort !== token) break
    await playSegment(B, 'B', 2, token)
  }
  playingLabel.value = ''
}

function stop() {
  abort++
  S?.hush()
  playingLabel.value = ''
}

// ── comprobar que todo suena ─────────────────────────────────────────────────────
const rows = ref<{ name: string; peak: number; ok: boolean; err?: string }[]>([])
const checking = ref(false)

async function checkAll() {
  stop()
  checking.value = true
  rows.value = []
  const c = ctx!
  const out: AudioNode = S.getSuperdoughAudioController().output.destinationGain
  const tap = new AudioWorkletNode(c, 'capture-processor', { numberOfInputs: 1, numberOfOutputs: 1 })
  const silent = c.createGain()
  silent.gain.value = 0
  out.connect(tap)
  tap.connect(silent).connect(c.destination)
  const chunks: { frame: number; data: Float32Array }[] = []
  let done: (() => void) | null = null
  tap.port.onmessage = (e: MessageEvent) => {
    const d = e.data as { type: string; frame?: number; data?: Float32Array }
    if (d.type === 'chunk') chunks.push({ frame: d.frame!, data: d.data! })
    if (d.type === 'stopped') done?.()
  }
  const list: [string, SoundConfig, 'piano' | 'lead' | 'pad'][] = []
  for (const sy of ['piano', 'lead', 'pad'] as const)
    for (const t of ['actual', 'b', 'c'] as Timbre[]) list.push([`${sy} · ${t}`, { ...CURRENT_SOUND, timbre: t }, sy])
  for (const sy of ['piano', 'lead', 'pad'] as const) list.push([`${sy} · b + glide + legato + real + fx`, { ...PROPOSAL, timbre: 'b', room: 0.4, delay: 0.4 }, sy])
  const saveSynth = synthPick.value
  for (const [name, cfg, sy] of list) {
    try {
      synthPick.value = sy
      await nextTick()
      pulse.value = false
      await S.evaluate(codeFor(cfg))
      await sleep(700)
      chunks.length = 0
      tap.port.postMessage('start')
      await sleep(Math.min(4000, loopSec.value * 1000 + 600))
      await new Promise<void>((r) => {
        done = r
        tap.port.postMessage('stop')
      })
      S.hush()
      const buf = new Float32Array(chunks.reduce((n, ch) => n + ch.data.length, 0))
      let o = 0
      for (const ch of chunks) {
        buf.set(ch.data, o)
        o += ch.data.length
      }
      const peak = buf.reduce((p, v) => Math.max(p, Math.abs(v)), 0)
      detectOnsets(buf, c.sampleRate)
      rows.value.push({ name, peak: Math.round(peak * 1000) / 1000, ok: peak > 0.02 })
    } catch (e) {
      rows.value.push({ name, peak: 0, ok: false, err: e instanceof Error ? e.message : String(e) })
    }
    await sleep(250)
  }
  synthPick.value = saveSynth
  checking.value = false
}

// ── mi elección ──────────────────────────────────────────────────────────────────
const summary = computed(() =>
  JSON.stringify({ estilo: style.value, sinte: synth.value, melodia: melodyId.value, A: { ...A }, B: { ...B }, prefiero: { ...picks } }, null, 1),
)
const copied = ref(false)
async function copy() {
  await navigator.clipboard?.writeText(summary.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}
const choose = (w: 'A' | 'B' | 'ni') => (picks[`${style.value}/${synth.value}/${melodyId.value}`] = w)
const chosen = computed(() => picks[`${style.value}/${synth.value}/${melodyId.value}`] ?? '')

onBeforeUnmount(() => {
  stop()
  void ctx?.close()
})
const MIDI_RANGE = `${MIDI_MIN}–${MIDI_MAX}`
</script>

<template>
  <main class="min-h-screen bg-[#0B0B0F] p-4 text-neutral-200">
    <div class="mx-auto max-w-5xl space-y-4">
      <header class="flex flex-wrap items-baseline gap-3">
        <h1 class="text-xl font-semibold text-[#F496BC]">Sonido de la melodía: A/B</h1>
        <span class="text-xs text-neutral-500">spec 002 §17 · solo en desarrollo · no cambia el sonido de la app (rango MIDI {{ MIDI_RANGE }})</span>
      </header>

      <p v-if="!started" class="text-sm text-neutral-400">
        Compara la misma melodía con cada variante. A empieza con el sonido de hoy y B con una propuesta; cambia lo que quieras de cada uno y
        usa <b>Alternar A/B</b> para oír la diferencia. Mejor con cascos.
      </p>
      <button v-if="!started" class="rounded bg-[#F496BC] px-4 py-2 font-medium text-black" @click="start">Activar el audio</button>
      <p v-if="msg" class="text-sm text-neutral-300">{{ msg }}</p>

      <template v-if="started">
        <!-- qué se toca -->
        <section class="flex flex-wrap items-center gap-3 rounded border border-neutral-800 p-3 text-sm">
          <label>Estilo
            <select v-model="style" class="ml-1 rounded bg-neutral-900 px-2 py-1"><option v-for="s in Object.values(STYLES)" :key="s.id" :value="s.id">{{ s.label }} ({{ s.bpm }} bpm)</option></select>
          </label>
          <label>Sinte
            <select v-model="synthPick" class="ml-1 rounded bg-neutral-900 px-2 py-1">
              <option value="auto">el del estilo ({{ synth }})</option><option value="piano">piano</option><option value="lead">lead</option><option value="pad">pad</option>
            </select>
          </label>
          <label>Melodía
            <select v-model="melodyId" class="ml-1 rounded bg-neutral-900 px-2 py-1"><option v-for="(m, id) in MELODIES" :key="id" :value="id">{{ m.label }}</option></select>
          </label>
          <label class="flex items-center gap-1"><input v-model="pulse" type="checkbox" /> pulso grave</label>
        </section>

        <!-- A y B -->
        <section class="grid gap-3 md:grid-cols-2">
          <div v-for="p in [{ id: 'A' as const, c: A, reset: resetA }, { id: 'B' as const, c: B, reset: resetB }]" :key="p.id" class="space-y-2 rounded border p-3 text-sm" :class="playingLabel === p.id ? 'border-[#F496BC]' : 'border-neutral-800'">
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-semibold">{{ p.id }}</h2>
              <span class="text-xs text-neutral-500">{{ p.id === 'A' ? 'el sonido de hoy' : 'propuesta' }}</span>
              <button class="ml-auto rounded border border-neutral-700 px-2 py-0.5 text-xs" @click="p.reset">{{ p.id === 'A' ? 'como hoy' : 'propuesta' }}</button>
              <button class="rounded bg-[#F496BC] px-3 py-1 font-medium text-black" @click="playOne(p.id)">▶ {{ p.id }}</button>
            </div>
            <label class="flex items-center justify-between gap-2">Sinte
              <select v-model="p.c.timbre" class="rounded bg-neutral-900 px-2 py-1"><option value="actual">actual</option><option value="b">mejorado B</option><option value="c">mejorado C</option></select>
            </label>
            <label class="flex items-center justify-between gap-2">Duración
              <select v-model="p.c.dur" class="rounded bg-neutral-900 px-2 py-1"><option value="cuantizada">a celdas (como hoy)</option><option value="real">la real (cuarto de paso)</option></select>
            </label>
            <label class="flex items-center justify-between gap-2">Legato
              <select v-model="p.c.legato" class="rounded bg-neutral-900 px-2 py-1"><option value="no">no</option><option value="huecos">rellena los huecos</option><option value="solapado">huecos + solape</option></select>
            </label>
            <label class="flex items-center justify-between gap-2">Glide
              <select v-model="p.c.glide" class="rounded bg-neutral-900 px-2 py-1"><option value="no">no</option><option value="penv">envolvente de altura (Strudel)</option><option value="webaudio">sinte propio (Web Audio)</option></select>
            </label>
            <label class="flex items-center justify-between gap-2">Duración del glide {{ p.c.glideMs }} ms
              <input v-model.number="p.c.glideMs" type="range" min="30" max="250" step="10" :disabled="p.c.glide === 'no'" />
            </label>
            <label class="flex items-center justify-between gap-2">Reverb {{ p.c.room.toFixed(2) }}<input v-model.number="p.c.room" type="range" min="0" max="1" step="0.05" /></label>
            <label class="flex items-center justify-between gap-2">Eco {{ p.c.delay.toFixed(2) }}<input v-model.number="p.c.delay" type="range" min="0" max="1" step="0.05" /></label>
            <details class="text-xs text-neutral-400">
              <summary class="cursor-pointer">código y notas</summary>
              <pre class="mt-1 overflow-x-auto rounded bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-neutral-300">{{ p.c.glide === 'webaudio' ? '(Web Audio: no hay código Strudel para el glide)\n' : '' }}{{ codeShown(p.c) }}</pre>
              <p class="mt-1 font-mono text-[11px]">{{ notesShown(p.c) }}</p>
            </details>
          </div>
        </section>

        <section class="flex flex-wrap items-center gap-2 rounded border border-neutral-800 p-3 text-sm">
          <button class="rounded bg-neutral-200 px-3 py-1.5 font-medium text-black" @click="alternate">⇄ Alternar A/B (2 vueltas de cada)</button>
          <button class="rounded border border-neutral-600 px-3 py-1.5" @click="stop">■ Parar</button>
          <span v-if="playingLabel" class="font-mono text-lg text-[#F496BC]">suena {{ playingLabel }}</span>
          <span class="ml-auto text-xs text-neutral-500">una vuelta = {{ loopSec.toFixed(1) }} s</span>
        </section>

        <!-- elegir -->
        <section class="space-y-2 rounded border border-neutral-800 p-3 text-sm">
          <h2 class="font-medium">Mi elección para esta combinación ({{ style }} · {{ synth }} · {{ melodyId }})</h2>
          <div class="flex flex-wrap items-center gap-2">
            <button v-for="w in (['A', 'B', 'ni'] as const)" :key="w" class="rounded border px-3 py-1" :class="chosen === w ? 'border-[#F496BC] bg-[#1a1218]' : 'border-neutral-700'" @click="choose(w)">
              {{ w === 'ni' ? 'ninguna me convence' : `me gusta más ${w}` }}
            </button>
            <button class="ml-auto rounded border border-neutral-600 px-3 py-1" @click="copy">{{ copied ? 'Copiado' : 'Copiar mi elección' }}</button>
          </div>
          <p class="text-xs text-neutral-500">Se guarda en este navegador. «Copiar» deja en el portapapeles los ajustes de A y B y lo que prefieres, para pegarlo en el chat.</p>
          <pre class="max-h-48 overflow-auto rounded bg-black/40 p-2 font-mono text-[11px] text-neutral-400">{{ summary }}</pre>
        </section>

        <!-- comprobar -->
        <section class="space-y-2 rounded border border-neutral-800 p-3 text-sm">
          <h2 class="font-medium">Comprobar que todo suena (sin escuchar)</h2>
          <p class="text-xs text-neutral-400">Evalúa en Strudel cada sinte y cada timbre, y una propuesta completa por sinte, y mide la salida (pico &gt; 0,02). Unos 60 s.</p>
          <button class="rounded border border-neutral-700 px-2 py-1 disabled:opacity-40" :disabled="checking" @click="checkAll">{{ checking ? 'Probando…' : 'Comprobar' }}</button>
          <table v-if="rows.length" class="text-xs font-mono">
            <tbody><tr v-for="r in rows" :key="r.name"><td class="pr-4">{{ r.name }}</td><td class="pr-4">{{ r.peak }}</td><td :class="r.ok ? 'text-green-400' : 'text-red-400'">{{ r.ok ? 'suena' : (r.err ?? 'no suena') }}</td></tr></tbody>
          </table>
        </section>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
// SPIKE A3.0 (rama spike/strudel): verifica @strudel/web antes de construir encima. No es código de producto.
import { detectOnsets } from '~/lib/onsets'

type Result = { ok: boolean | null; detail: string }
const results = reactive<Record<string, Result>>({})
const running = ref(false)
const log = ref<string[]>([])
const say = (m: string) => log.value.push(`${new Date().toISOString().slice(17, 23)} ${m}`)
const set = (k: string, ok: boolean | null, detail: string) => {
  results[k] = { ok, detail }
  say(`${k}: ${ok === null ? '·' : ok ? 'OK' : 'FALLA'} ${detail}`)
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
let S: Any
let ctx: AudioContext
const triggers: { name: string; begin: number; t: number }[] = []

/** Nodo de captura (nuestro worklet) para grabar una señal con tiempos de contexto. */
function makeTap(): { node: AudioWorkletNode; record: (ms: number) => Promise<{ buf: Float32Array; start: number }> } {
  const node = new AudioWorkletNode(ctx, 'capture-processor', { numberOfInputs: 1, numberOfOutputs: 1 })
  const silent = ctx.createGain()
  silent.gain.value = 0
  node.connect(silent).connect(ctx.destination)
  let chunks: { frame: number; data: Float32Array }[] = []
  let onStop: (() => void) | null = null
  node.port.onmessage = (e: MessageEvent) => {
    const m = e.data
    if (m.type === 'chunk') chunks.push({ frame: m.frame, data: m.data })
    if (m.type === 'stopped') onStop?.()
  }
  return {
    node,
    record: async (ms) => {
      chunks = []
      node.port.postMessage('start')
      await wait(ms)
      await new Promise<void>((r) => {
        onStop = r
        node.port.postMessage('stop')
      })
      const first = chunks[0]
      const last = chunks.at(-1)
      if (!first || !last) return { buf: new Float32Array(0), start: 0 }
      const buf = new Float32Array(last.frame - first.frame + last.data.length)
      for (const c of chunks) buf.set(c.data, c.frame - first.frame)
      return { buf, start: first.frame / ctx.sampleRate }
    },
  }
}

const hook = `.onTrigger((h, ct, cps, t) => window.__trig(h, t), false)`

async function play(code: string) {
  triggers.length = 0
  await S.evaluate(code)
}

function lowpassRms(buf: Float32Array, sr: number, from: number, to: number): number {
  // filtro de un polo a 150 Hz (energía del bajo), RMS en [from, to) muestras
  const a = 1 - Math.exp((-2 * Math.PI * 150) / sr)
  let y = 0
  let sum = 0
  let n = 0
  for (let i = Math.max(0, from - 2000); i < Math.min(buf.length, to); i++) {
    y += a * (buf[i]! - y)
    if (i >= from) {
      sum += y * y
      n++
    }
  }
  return n ? Math.sqrt(sum / n) : 0
}

async function duckRatioDb(tap: ReturnType<typeof makeTap>, withDuck: boolean): Promise<number> {
  const duck = withDuck ? '.duckorbit(2).duckdepth(0.8).duckattack(0.15)' : ''
  await play(`setcpm(120/4)
stack(
  note("a1").s("sine").attack(0.001).release(0.01).orbit(2).gain(0.5),
  s("hh*4").bank("RolandTR909").gain(0.3)${duck}${hook},
)`)
  await wait(1200)
  const { buf, start } = await tap.record(3000)
  const sr = ctx.sampleRate
  const ts = triggers.filter((x) => x.name.endsWith('hh')).map((x) => x.t - start).filter((t) => t > 0.1 && t < 2.7)
  let inDuck = 0
  let between = 0
  for (const t of ts) {
    inDuck += lowpassRms(buf, sr, Math.round((t + 0.03) * sr), Math.round((t + 0.07) * sr))
    between += lowpassRms(buf, sr, Math.round((t + 0.38) * sr), Math.round((t + 0.45) * sr))
  }
  return 20 * Math.log10((between + 1e-9) / (inDuck + 1e-9))
}

async function runSpike() {
  running.value = true
  log.value = []
  try {
    // ── 1. Contexto compartido ───────────────────────────────────────────────
    ctx = new AudioContext({ latencyHint: 'interactive' })
    void ctx.resume()
    const t0 = performance.now()
    S = await import('@strudel/web')
    say(`import @strudel/web: ${(performance.now() - t0).toFixed(0)} ms`)
    S.setAudioContext(ctx)
    ;(window as Any).__trig = (h: Any, t: number) =>
      triggers.push({ name: String(h.value?.s ?? h.value?.note ?? '?'), begin: Number(h.whole.begin), t })
    const base = `${location.origin}/samples/`
    await S.initStrudel({
      prebake: async () => {
        const g = globalThis as Any
        set('globals', typeof g.samples === 'function' && typeof g.s === 'function', `samples=${typeof g.samples} s=${typeof g.s} ref=${typeof g.ref}`)
        await g.samples(
          {
            RolandTR909_bd: ['909/bd.wav'],
            RolandTR909_sd: ['909/sd.wav'],
            RolandTR909_hh: ['909/hh.wav'],
          },
          base,
        )
      },
    })
    await ctx.audioWorklet.addModule('/worklets/capture-processor.js')
    const controller = S.getSuperdoughAudioController()
    const tap = makeTap()
    const master = (): AudioNode => controller.output.destinationGain
    master().connect(tap.node)

    // micro en el mismo contexto
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    const mic = makeTap()
    ctx.createMediaStreamSource(stream).connect(mic.node)

    await play(`setcpm(120/4)\ns("bd*4").bank("RolandTR909")${hook}`)
    await wait(600)
    const [out, micRec] = await Promise.all([tap.record(2000), mic.record(2000)])
    const shared = S.getAudioContext() === ctx
    const outPeak = out.buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    set(
      '1 contexto compartido',
      shared && micRec.buf.length > 0 && outPeak > 0.01,
      `getAudioContext()===ctx: ${shared} · micro: ${micRec.buf.length} muestras mientras suena · salida pico ${outPeak.toFixed(3)} · samples locales cargados: ${outPeak > 0.01}`,
    )

    // ── 2. Precisión de onTrigger (salida real grabada en el bus de superdough) ──
    const sr = ctx.sampleRate
    const onsets = detectOnsets(out.buf, sr).map((o) => o.time + out.start)
    const trig = triggers.filter((x) => x.t > out.start + 0.05 && x.t < out.start + 1.9).map((x) => x.t)
    const diffs = trig.map((t) => {
      const near = onsets.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a), Infinity)
      return (near - t) * 1000
    })
    const maxAbs = Math.max(...diffs.map(Math.abs))
    set(
      '2 onTrigger vs sonido',
      diffs.length >= 3 && maxAbs <= 3,
      `${diffs.length} golpes · diferencias (ms): ${diffs.map((d) => d.toFixed(1)).join(', ')} · máx |${maxAbs.toFixed(1)}| ms`,
    )

    // ── 3. Reevaluación sin cortes ─────────────────────────────────────────────
    const steady = `s("hh*16").bank("RolandTR909").gain(0.4)${hook}`
    await play(`setcpm(120/4)\nstack(${steady}, s("bd ~ ~ ~").bank("RolandTR909"))`)
    await wait(500)
    const variants = ['bd ~ bd ~', 'bd ~ ~ ~', '~ bd ~ bd', 'bd bd ~ ~']
    for (let i = 0; i < 10; i++) {
      await wait(370)
      await S.evaluate(`setcpm(120/4)\nstack(${steady}, s("${variants[i % 4]}").bank("RolandTR909"))`)
    }
    await wait(400)
    say(`nombres de eventos: ${[...new Set(triggers.map((x) => x.name))].join(', ')} (${triggers.length})`)
    const hh = triggers.filter((x) => x.name.endsWith('hh')).map((x) => Math.round(x.begin * 16))
    const uniq = new Set(hh)
    const sorted = [...uniq].sort((a, b) => a - b)
    let gaps = 0
    for (let i = 1; i < sorted.length; i++) if (sorted[i]! - sorted[i - 1]! !== 1) gaps++
    const dups = hh.length - uniq.size
    set(
      '3 reevaluar sin cortes',
      gaps === 0 && dups === 0 && hh.length > 30,
      `10 reevaluaciones en ~4 s · ${hh.length} semicorcheas · huecos ${gaps} · duplicados ${dups}`,
    )

    // ── 5a. Sidechain (duckorbit) ──────────────────────────────────────────────
    const ducked = await duckRatioDb(tap, true)
    const control = await duckRatioDb(tap, false)
    set(
      '5a duckorbit',
      ducked - control >= 6,
      `atenuación del bajo tras cada golpe: con duck ${ducked.toFixed(1)} dB · sin duck ${control.toFixed(1)} dB`,
    )

    // ── 5b. Limitador maestro sobre controller.output ─────────────────────────
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.001
    limiter.release.value = 0.1
    const ceiling = ctx.createGain()
    ceiling.gain.value = 10 ** (-1 / 20)
    const masterBefore = master()
    masterBefore.disconnect()
    const after = makeTap()
    masterBefore.connect(limiter).connect(ceiling)
    ceiling.connect(ctx.destination)
    ceiling.connect(after.node)
    await play(`setcpm(120/4)\nstack(s("bd*4").bank("RolandTR909").gain(3), note("a1 e2").s("sawtooth").gain(2))`)
    await wait(800)
    const loud = await after.record(2000)
    const peak = loud.buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    const peakDb = 20 * Math.log10(peak + 1e-9)
    const audible = peak > 0.05
    set(
      '5b limitador maestro',
      audible && peakDb <= -0.5,
      `se puede reenrutar destinationGain: ${audible} · pico con gain 3: ${peakDb.toFixed(2)} dBFS (objetivo ≤ −1, tolerancia −0,5)`,
    )

    S.hush()
    await wait(300)
    await play(`s("bd").bank("RolandTR909")`)
    await wait(300)
    const survives = master() === masterBefore
    set(
      '5c el reenrutado sobrevive a hush/play',
      survives,
      survives ? 'destinationGain es el mismo nodo tras hush + play' : 'superdough recrea destinationGain: hay que reenganchar el limitador tras cada reset',
    )
    // ── 6. ref(): filtro en vivo sin reevaluar (base de los gestos) ─────────────
    ;(window as Any).__lpf = 300
    await play(`setcpm(120/4)\nnote("a2*8").s("sawtooth").lpf(ref(() => window.__lpf)).gain(0.5)${hook}`)
    await wait(800)
    const closed = await after.record(1000)
    ;(window as Any).__lpf = 8000
    await wait(300)
    const open = await after.record(1000)
    const hf = (b: Float32Array) => {
      // energía por encima de ~2 kHz: diferencia de muestras consecutivas
      let sum = 0
      for (let i = 1; i < b.length; i++) sum += (b[i]! - b[i - 1]!) ** 2
      return Math.sqrt(sum / Math.max(1, b.length))
    }
    const gainDb = 20 * Math.log10((hf(open.buf) + 1e-9) / (hf(closed.buf) + 1e-9))
    set('6 ref() en vivo', gainDb >= 10, `agudos al abrir el filtro de 300 Hz a 8 kHz sin reevaluar: +${gainDb.toFixed(1)} dB`)

    // ── 7. nudge(): ritmo exacto (medido tras el limitador, comparando con nudge 0) ──
    const delayAfterTrigger = async (nudge: number) => {
      await play(`setcpm(120/4)\ns("bd*4").bank("RolandTR909").nudge(${nudge})${hook}`)
      await wait(600)
      const rec = await after.record(2000)
      const on = detectOnsets(rec.buf, sr).map((o) => o.time + rec.start)
      const d = triggers
        .filter((x) => x.t > rec.start + 0.05 && x.t < rec.start + 1.85)
        .map((x) => ((on.find((o) => o >= x.t - 0.005) ?? NaN) - x.t) * 1000)
      return [...d].sort((p, q) => p - q)[d.length >> 1] ?? NaN
    }
    const d0 = await delayAfterTrigger(0)
    const d50 = await delayAfterTrigger(0.05)
    set(
      '7 nudge',
      Math.abs(d50 - d0 - 50) <= 2,
      `tras el limitador: nudge 0 → ${d0.toFixed(1)} ms, nudge 50 ms → ${d50.toFixed(1)} ms; desplazamiento real ${(d50 - d0).toFixed(1)} ms. targetTime de onTrigger NO incluye el nudge. El limitador añade ${(d0 - 2).toFixed(1)} ms`,
    )

    // ── 8. Bloqueos del hilo principal (el planificador de Strudel usa setInterval) ──
    for (const stall of [50, 120, 250]) {
      await play(`setcpm(120/4)\ns("hh*16").bank("RolandTR909")${hook}`)
      await wait(700)
      const until = performance.now() + stall
      while (performance.now() < until) {
        /* bloqueo deliberado */
      }
      await wait(700)
      const steps = triggers.filter((x) => x.name.endsWith('hh')).map((x) => Math.round(x.begin * 16))
      const u = [...new Set(steps)].sort((p, q) => p - q)
      let lost = 0
      for (let i = 1; i < u.length; i++) lost += u[i]! - u[i - 1]! - 1
      set(`8 bloqueo ${stall} ms`, lost === 0, `semicorcheas perdidas: ${lost} de ${u.length + lost}`)
    }

    S.hush()
    set('4 iOS', null, 'no verificable aquí: abrir /spike en un iPhone (npm run dev:phone) y pulsar el botón')
  } catch (e) {
    set('error', false, e instanceof Error ? `${e.message}\n${e.stack}` : String(e))
  } finally {
    running.value = false
    ;(window as Any).__spikeResults = JSON.parse(JSON.stringify(results))
    ;(window as Any).__spikeLog = log.value.join('\n')
  }
}
</script>

<template>
  <main class="mx-auto max-w-2xl space-y-4 p-4 text-sm">
    <h1 class="text-xl font-medium">Spike A3.0 · @strudel/web</h1>
    <button class="rounded-full bg-white px-6 py-2 text-black disabled:opacity-50" :disabled="running" @click="runSpike">
      {{ running ? 'Ejecutando… (~25 s)' : 'Ejecutar spike' }}
    </button>
    <table class="w-full">
      <tr v-for="(r, k) in results" :key="k" class="border-b border-white/10 align-top">
        <td class="py-1 pr-2">{{ r.ok === null ? '·' : r.ok ? '✓' : '✗' }}</td>
        <td class="py-1 pr-2 whitespace-nowrap">{{ k }}</td>
        <td class="py-1 text-neutral-400">{{ r.detail }}</td>
      </tr>
    </table>
    <pre class="whitespace-pre-wrap text-xs text-neutral-500">{{ log.join('\n') }}</pre>
  </main>
</template>

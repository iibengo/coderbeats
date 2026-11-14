<script setup lang="ts">
// Laboratorio de voz (spec 002, §9, fase 0). Solo en desarrollo (`nuxt dev`): no entra en el build.
// Graba tomas con el micro, saca la altura (YIN), las notas y la puerta de tono, y las compara con lo que querías cantar.
import { detectOnsets } from '~/lib/onsets'
import { DEFAULT_NOTE_OPTIONS, DEFAULT_TONE_GATE, segmentNotes, toneGate, type Note } from '~/lib/notes'
import { midiName, parseExpected, scoreNotes, type Score } from '~/lib/noteScore'
import { DEFAULT_PITCH_OPTIONS, midiToHz, trackPitch, type PitchTrack } from '~/lib/pitch'
import { decodeWav, encodeWav } from '~/lib/wav'

// ── tomas del protocolo (spec 002 §9) ────────────────────────────────────────────
interface TakeDef {
  id: number
  slug: string
  title: string
  how: string
  sec: number
  /** clic a 90 bpm (con cascos); sin él, para la toma de fuga */
  click: boolean
  /** fondo de prueba por los altavoces */
  background?: boolean
  expected: string
  /** nº de "na" de la toma (para contar la puerta de tono), si no son todas las notas esperadas */
  pattern?: string
}
const TAKES: TakeDef[] = [
  { id: 1, slug: 'escala', title: 'Escala lenta con "na"', sec: 14, click: true, expected: 'A3 B3 C4 D4 E4 F4 G4 A4', how: 'Una nota cada ~1,5 s, "na" claro: la si do re mi fa sol la (o tu escala de la menor cómoda; corrige las notas esperadas).' },
  { id: 2, slug: 'melodia-da', title: 'Melodía de 5 notas con "da"', sec: 12, click: true, expected: 'A3 C4 E4 D4 C4', how: '"da" corto en cada nota: la do mi re do. Despacio, sin prisa.' },
  { id: 3, slug: 'tarareo', title: 'Tarareo "mmm" legato con deslizamientos', sec: 10, click: true, expected: 'A3 C4 E4', how: 'Sin cortar la voz: "mmm" de la a do y de do a mi, deslizándote entre ellas.' },
  { id: 4, slug: 'vibrato', title: 'Una nota larga con vibrato', sec: 8, click: true, expected: 'A3', how: 'Una sola nota (la) sostenida unos 4 s, con vibrato.' },
  { id: 5, slug: 'susurro', title: 'Frase muy suave', sec: 10, click: true, expected: 'A3 C4 E4 C4', how: 'Casi susurrando: "na" muy suave en la do mi do.' },
  { id: 6, slug: 'bajo-dum', title: 'Línea de bajo con "dum"', sec: 12, click: true, expected: 'A2 A2 D3 E3', how: 'Grave, "dum" en cada nota: la la re mi (en tu registro grave; corrige las notas si hace falta).' },
  { id: 7, slug: 'mezcla', title: 'Beatbox y "na" mezclados', sec: 12, click: true, expected: 'A3 C4', pattern: 'bum na ts na', how: '"bum na ts na" repetido varias veces; en los "na" canta la y do (los "bum" y "ts" son beatbox de siempre).' },
  { id: 8, slug: 'beatbox', title: 'Beatbox solo', sec: 10, click: true, expected: '', pattern: 'bum pff ts', how: '"bum pff ts" repetido, sin cantar nada. No debería salir ninguna melodía.' },
  { id: 9, slug: 'fuga', title: 'Fuga: fondo por los altavoces (sin cascos)', sec: 14, click: false, background: true, expected: 'A3 C4 E4', how: 'SIN cascos y con el volumen normal: 5 s sin cantar (solo se oye el fondo) y luego "na" en la do mi.' },
]

const BPM = 90
const BEAT = 60 / BPM
const COUNT_IN = 4 * BEAT
const STEP = BEAT / 4

// ── estado ───────────────────────────────────────────────────────────────────────
const take = ref<TakeDef>(TAKES[0]!)
const expectedText = ref(TAKES[0]!.expected)
const label = ref('pc')
const click = ref(true)
const background = ref(false)
const started = ref(false)
const status = ref<'idle' | 'counting' | 'recording' | 'done'>('idle')
const beatText = ref('')
const progress = ref(0)
const msg = ref('')
const rec = shallowRef<Float32Array | null>(null)
const sr = ref(48000)
const saved = ref<string[]>([])
const loadedName = ref<string | null>(null)

const P = reactive({ threshold: DEFAULT_PITCH_OPTIONS.threshold, median: DEFAULT_PITCH_OPTIONS.median })
const N = reactive({ ...DEFAULT_NOTE_OPTIONS })
const G = reactive({ ...DEFAULT_TONE_GATE })

let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let mic: AudioWorkletNode | null = null

watch(take, (t) => {
  expectedText.value = t.expected
  click.value = t.click
  background.value = !!t.background
})

// ── análisis ─────────────────────────────────────────────────────────────────────
const track = computed<PitchTrack | null>(() => (rec.value ? trackPitch(rec.value, sr.value, { threshold: P.threshold, median: P.median }) : null))
const onsets = computed(() => (rec.value ? detectOnsets(rec.value, sr.value).map((o) => o.time) : []))
const notes = computed<Note[]>(() => (track.value ? segmentNotes(track.value, onsets.value, N) : []))
const gates = computed(() => (track.value ? onsets.value.map((t) => ({ t, ...toneGate(track.value!, t, G) })) : []))
const expected = computed(() => parseExpected(expectedText.value))
const score = computed<Score | null>(() => (expected.value && expected.value.length ? scoreNotes(expected.value, notes.value, STEP, 0) : null))
const passes = computed(() => gates.value.filter((g) => g.pass).length)
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)} %`)
const cents = (m: number) => Math.round((m - Math.round(m)) * 100)

// ── audio: arranque, clic, fondo ─────────────────────────────────────────────────
async function start() {
  try {
    ctx = new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    })
    const base = useRuntimeConfig().app.baseURL
    await ctx.audioWorklet.addModule(`${base}worklets/capture-processor.js`)
    mic = new AudioWorkletNode(ctx, 'capture-processor', { numberOfInputs: 1, numberOfOutputs: 1 })
    const mute = ctx.createGain()
    mute.gain.value = 0
    ctx.createMediaStreamSource(stream).connect(mic).connect(mute).connect(ctx.destination)
    sr.value = ctx.sampleRate
    started.value = true
    msg.value = `micro listo · ${ctx.sampleRate} Hz`
    await refreshList()
  } catch (e) {
    msg.value = `No se pudo abrir el micro: ${e instanceof Error ? e.message : String(e)}`
  }
}

function clickAt(t: number, accent: boolean) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.value = accent ? 1500 : 1000
  g.gain.setValueAtTime(0.25, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + 0.05)
}

/** Fondo de prueba con tono (acordes y bajo en la menor): el peor caso de fuga, con cosas con altura. */
function backgroundAt(t: number, sec: number) {
  if (!ctx) return
  const out = ctx.createGain()
  out.gain.value = 0.35
  out.connect(ctx.destination)
  const add = (hz: number, type: OscillatorType, gain: number) => {
    const o = ctx!.createOscillator()
    const g = ctx!.createGain()
    o.type = type
    o.frequency.value = hz
    g.gain.value = gain
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + sec)
  }
  add(midiToHz(33), 'sawtooth', 0.25) // la1
  for (const m of [57, 60, 64]) add(midiToHz(m), 'triangle', 0.15) // la3 do4 mi4
}

// ── grabar ───────────────────────────────────────────────────────────────────────
async function record() {
  if (!ctx || !mic) return
  const c = ctx
  const m = mic
  const def = take.value
  const sec = def.sec
  rec.value = null
  loadedName.value = null
  status.value = 'counting'
  msg.value = ''
  const chunks: { frame: number; data: Float32Array }[] = []
  let stopped: (() => void) | null = null
  m.port.onmessage = (e: MessageEvent) => {
    const d = e.data as { type: string; frame?: number; data?: Float32Array }
    if (d.type === 'chunk') chunks.push({ frame: d.frame!, data: d.data! })
    if (d.type === 'stopped') stopped?.()
  }
  m.port.postMessage('start')
  const t0 = c.currentTime + 0.4
  const zeroT = t0 + COUNT_IN
  if (click.value) for (let k = 0; k * BEAT < COUNT_IN + sec; k++) clickAt(t0 + k * BEAT, k % 4 === 0)
  if (background.value) backgroundAt(t0, COUNT_IN + sec + 0.3)

  await new Promise<void>((resolve) => {
    const tick = () => {
      const now = c.currentTime
      if (now < zeroT) {
        status.value = 'counting'
        beatText.value = now < t0 ? '…' : String(Math.min(4, Math.floor((now - t0) / BEAT) + 1))
        progress.value = 0
      } else {
        status.value = 'recording'
        beatText.value = '¡canta!'
        progress.value = Math.min(1, (now - zeroT) / sec)
      }
      if (now >= zeroT + sec + 0.15) return resolve()
      requestAnimationFrame(tick)
    }
    tick()
  })
  await new Promise<void>((resolve) => {
    stopped = resolve
    m.port.postMessage('stop')
  })
  const first = chunks[0]
  const last = chunks.at(-1)
  if (!first || !last) {
    status.value = 'idle'
    msg.value = 'No llegó audio del micro.'
    return
  }
  const all = new Float32Array(last.frame - first.frame + last.data.length)
  for (const ch of chunks) all.set(ch.data, ch.frame - first.frame)
  const zero = Math.max(0, Math.round(zeroT * c.sampleRate) - first.frame)
  rec.value = all.slice(zero, zero + Math.round(sec * c.sampleRate))
  sr.value = c.sampleRate
  status.value = 'done'
  const peak = rec.value.reduce((p, v) => Math.max(p, Math.abs(v)), 0)
  msg.value = `toma lista · pico ${(20 * Math.log10(peak + 1e-9)).toFixed(1)} dBFS${peak < 0.02 ? ' (muy baja: acerca el micro o sube la ganancia)' : peak > 0.98 ? ' (saturada)' : ''}`
}

// ── guardar y cargar ─────────────────────────────────────────────────────────────
const b64 = (buf: ArrayBuffer) => {
  let s = ''
  const u = new Uint8Array(buf)
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

async function refreshList() {
  try {
    saved.value = ((await $fetch('/_lab/take')) as { takes: string[] }).takes
  } catch {
    saved.value = []
  }
}

async function save() {
  if (!rec.value) return
  const clean = label.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'pc'
  const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '')
  const name = `t${take.value.id}-${take.value.slug}_${clean}_${stamp}`
  const meta = {
    takeId: take.value.id,
    title: take.value.title,
    expected: expectedText.value.trim(),
    pattern: take.value.pattern ?? null,
    sampleRate: sr.value,
    bpm: BPM,
    click: click.value,
    background: background.value,
    label: clean,
    createdAt: new Date().toISOString(),
  }
  try {
    const r = (await $fetch('/_lab/take', { method: 'POST', body: { name, wav: b64(encodeWav(rec.value, sr.value)), meta } })) as { path: string }
    msg.value = `guardada: ${r.path}`
    loadedName.value = name
    await refreshList()
  } catch (e) {
    msg.value = `No se pudo guardar: ${e instanceof Error ? e.message : String(e)}`
  }
}

async function load(name: string) {
  try {
    const r = (await $fetch('/_lab/take', { query: { name } })) as { meta: { takeId?: number; expected?: string }; wav: string }
    const bin = Uint8Array.from(atob(r.wav), (ch) => ch.charCodeAt(0))
    const w = decodeWav(bin.buffer)
    if (!w) throw new Error('wav no válido')
    const def = TAKES.find((t) => t.id === r.meta.takeId)
    if (def) take.value = def
    await nextTick()
    expectedText.value = r.meta.expected ?? ''
    sr.value = w.sampleRate
    rec.value = w.samples
    loadedName.value = name
    status.value = 'done'
    msg.value = `cargada ${name}`
  } catch (e) {
    msg.value = `No se pudo cargar: ${e instanceof Error ? e.message : String(e)}`
  }
}

// ── escuchar ─────────────────────────────────────────────────────────────────────
let playStop: (() => void) | null = null
const playhead = ref<number | null>(null)

function stopPlay() {
  playStop?.()
  playStop = null
  playhead.value = null
}

function runPlayhead(c: AudioContext, t0: number, sec: number) {
  const tick = () => {
    const t = c.currentTime - t0
    if (!playStop || t > sec) {
      playhead.value = null
      return
    }
    playhead.value = t
    requestAnimationFrame(tick)
  }
  tick()
}

function playTake() {
  if (!ctx || !rec.value) return
  stopPlay()
  const b = ctx.createBuffer(1, rec.value.length, sr.value)
  b.copyToChannel(rec.value, 0)
  const s = ctx.createBufferSource()
  s.buffer = b
  s.connect(ctx.destination)
  const t0 = ctx.currentTime + 0.05
  s.start(t0)
  playStop = () => s.stop()
  s.onended = () => (playhead.value = null)
  runPlayhead(ctx, t0, b.duration)
}

/** Las notas detectadas, tal cual (sin ayuda), con un sinte de prueba. */
function playNotes() {
  if (!ctx) return
  stopPlay()
  const c = ctx
  const t0 = c.currentTime + 0.05
  const oscs: OscillatorNode[] = []
  for (const n of notes.value) {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'triangle'
    o.frequency.value = midiToHz(n.midi)
    const d = Math.max(0.05, n.end - n.start)
    g.gain.setValueAtTime(0, t0 + n.start)
    g.gain.linearRampToValueAtTime(0.25, t0 + n.start + 0.01)
    g.gain.setValueAtTime(0.25, t0 + n.start + d - 0.03)
    g.gain.linearRampToValueAtTime(0, t0 + n.start + d)
    o.connect(g).connect(c.destination)
    o.start(t0 + n.start)
    o.stop(t0 + n.start + d + 0.02)
    oscs.push(o)
  }
  playStop = () => oscs.forEach((o) => { try { o.stop() } catch { /* ya parado */ } })
  runPlayhead(c, t0, (rec.value?.length ?? 0) / sr.value)
}

// ── dibujo ───────────────────────────────────────────────────────────────────────
const canvas = ref<HTMLCanvasElement | null>(null)
const H = 360
const ML = 46

function draw() {
  const cv = canvas.value
  const t = track.value
  if (!cv) return
  const dpr = window.devicePixelRatio || 1
  const W = cv.clientWidth
  cv.width = W * dpr
  cv.height = H * dpr
  const x = cv.getContext('2d')!
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  x.fillStyle = '#0B0B0F'
  x.fillRect(0, 0, W, H)
  const dur = rec.value ? rec.value.length / sr.value : take.value.sec
  const px = (s: number) => ML + (s / dur) * (W - ML - 8)
  const stripH = 36
  const plotB = H - stripH - 14
  const plotT = 8
  const exp = expected.value ?? []
  const voiced = t ? [...t.midi].filter((m, i) => t.prob[i]! >= N.minProb && !Number.isNaN(m)) : []
  const lo = Math.floor(Math.min(...voiced, ...exp.map((e) => e.midi), 55) - 3)
  const hi = Math.ceil(Math.max(...voiced, ...exp.map((e) => e.midi), 72) + 3)
  const py = (m: number) => plotB - ((m - lo) / (hi - lo)) * (plotB - plotT)

  x.font = '10px ui-monospace, monospace'
  for (let m = lo; m <= hi; m++) {
    const isC = m % 12 === 0
    x.strokeStyle = isC ? '#3a3a46' : '#1b1b23'
    x.beginPath()
    x.moveTo(ML, py(m))
    x.lineTo(W - 8, py(m))
    x.stroke()
    if (isC || m % 12 === 9 || m % 12 === 4) {
      x.fillStyle = '#8a8a99'
      x.fillText(midiName(m), 6, py(m) + 3)
    }
  }
  // compases y tiempos del clic (la toma empieza en el compás 0)
  for (let k = 0; k * BEAT <= dur; k++) {
    x.strokeStyle = k % 4 === 0 ? '#3a3a46' : '#1f1f28'
    x.beginPath()
    x.moveTo(px(k * BEAT), plotT)
    x.lineTo(px(k * BEAT), H - stripH - 14)
    x.stroke()
    if (k % 4 === 0) {
      x.fillStyle = '#8a8a99'
      x.fillText(`${(k * BEAT).toFixed(1)}s`, px(k * BEAT) + 2, H - stripH - 2)
    }
  }
  // notas esperadas
  x.setLineDash([4, 4])
  x.strokeStyle = '#8ECFF2aa'
  for (const e of exp) {
    x.beginPath()
    x.moveTo(ML, py(e.midi))
    x.lineTo(W - 8, py(e.midi))
    x.stroke()
  }
  x.setLineDash([])
  if (!t) return
  // volumen
  const maxRms = Math.max(1e-6, ...t.rms)
  x.fillStyle = '#2a2a36'
  for (let i = 0; i < t.rms.length; i++) {
    const h = (t.rms[i]! / maxRms) * (stripH - 4)
    x.fillRect(px(t.times[i]!), H - 6 - h, Math.max(1, (W - ML) / t.rms.length), h)
  }
  // altura: con voz (rosa, según probabilidad) y rechazada (gris tenue)
  for (let i = 0; i < t.midi.length; i++) {
    const m = t.midi[i]!
    if (Number.isNaN(m) || m < lo || m > hi) continue
    if (t.prob[i]! >= N.minProb && t.rms[i]! >= N.minRms) x.fillStyle = `rgba(244,150,188,${0.35 + 0.65 * t.prob[i]!})`
    else x.fillStyle = 'rgba(120,120,140,0.35)'
    x.fillRect(px(t.times[i]!) - 1, py(m) - 1, 2.5, 2.5)
  }
  // notas detectadas
  for (const n of notes.value) {
    x.fillStyle = 'rgba(255,255,255,0.22)'
    x.strokeStyle = '#ffffff'
    x.fillRect(px(n.start), py(n.midi) - 5, Math.max(2, px(n.end) - px(n.start)), 10)
    x.strokeRect(px(n.start), py(n.midi) - 5, Math.max(2, px(n.end) - px(n.start)), 10)
    x.fillStyle = '#ffffff'
    x.fillText(midiName(n.midi), px(n.start) + 2, py(n.midi) - 8)
  }
  // onsets: verde si pasan la puerta de tono, rojo si no
  for (const g of gates.value) {
    x.strokeStyle = g.pass ? '#7be08a' : '#e07b7b'
    x.beginPath()
    x.moveTo(px(g.t), plotT)
    x.lineTo(px(g.t), plotB)
    x.stroke()
  }
  if (playhead.value !== null) {
    x.strokeStyle = '#ffffff'
    x.beginPath()
    x.moveTo(px(playhead.value), plotT)
    x.lineTo(px(playhead.value), H - 6)
    x.stroke()
  }
}

watch([track, notes, gates, expected, playhead, take, started, () => N.minProb, () => N.minRms], () => nextTick(draw))
onMounted(() => {
  draw()
  window.addEventListener('resize', draw)
  void refreshList()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', draw)
  stopPlay()
  stream?.getTracks().forEach((t) => t.stop())
  void ctx?.close()
})

// ── prueba de Strudel: ¿.nudge() y .late() sirven en sintes? ─────────────────────
const nudgeRows = ref<{ name: string; delayMs: number; phaseMs: number; n: number }[]>([])
const nudgeVerdict = ref('')
const nudgeBusy = ref(false)

async function nudgeTest() {
  if (!ctx) return
  nudgeBusy.value = true
  nudgeRows.value = []
  nudgeVerdict.value = ''
  const c = ctx
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const S: any = await import('@strudel/web')
    S.setAudioContext(c)
    const trig: number[] = []
    ;(window as unknown as Record<string, unknown>).__labTrig = (t: number) => trig.push(t)
    await S.initAudio()
    await S.initStrudel({})
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
    const cases = [
      { name: 'sin nada', fx: '' },
      { name: '.nudge(0.25) · 0,25 s', fx: '.nudge(0.25)' },
      { name: '.late(0.125) · 0,25 s', fx: '.late(0.125)' },
    ]
    const rows: typeof nudgeRows.value = []
    for (const k of cases) {
      trig.length = 0
      chunks.length = 0
      // 120 bpm: un ciclo = 2 s (como la app); 4 notas por ciclo = una cada 0,5 s
      await S.evaluate(`setcpm(120/4)\nnote("c4*4").s("triangle").attack(0.002).decay(0.08).sustain(0).release(0.02)${k.fx}.onTrigger((h, ct, cps, t) => window.__labTrig(t), false)`)
      await wait(1200)
      chunks.length = 0
      trig.length = 0
      tap.port.postMessage('start')
      await wait(3000)
      await new Promise<void>((r) => {
        done = r
        tap.port.postMessage('stop')
      })
      S.hush()
      const first = chunks[0]
      const last = chunks.at(-1)
      if (!first || !last) continue
      const buf = new Float32Array(last.frame - first.frame + last.data.length)
      for (const ch of chunks) buf.set(ch.data, ch.frame - first.frame)
      const t0 = first.frame / c.sampleRate
      const heard = detectOnsets(buf, c.sampleRate).map((o) => o.time + t0)
      const med = (v: number[]) => [...v].sort((a, b) => a - b)[v.length >> 1] ?? Number.NaN
      const delays = trig
        .filter((t) => t > t0 + 0.2 && t < t0 + 2.5)
        .map((t) => {
          const next = heard.filter((h) => h >= t - 0.01).sort((a, b) => a - b)[0]
          return next === undefined ? Number.NaN : next - t
        })
        .filter((d) => !Number.isNaN(d))
      const phases = heard.filter((h) => h > t0 + 0.2 && h < t0 + 2.5).map((h) => ((h % 0.5) + 0.5) % 0.5)
      rows.push({ name: k.name, delayMs: Math.round(med(delays) * 1000), phaseMs: Math.round(med(phases) * 1000), n: delays.length })
      nudgeRows.value = [...rows]
    }
    const base = rows[0]
    const nudge = rows[1]
    const late = rows[2]
    if (base && nudge && late) {
      const nudgeWorks = nudge.delayMs - base.delayMs > 150
      const lateWorks = Math.abs((((late.phaseMs - base.phaseMs) % 500) + 500) % 500 - 250) < 40
      nudgeVerdict.value = `.nudge() en sintes: ${nudgeWorks ? 'SÍ retrasa el sonido' : 'NO tiene efecto'} · .late(): ${lateWorks ? 'SÍ desplaza el patrón (usable)' : 'no se ve el desplazamiento esperado'}`
    }
  } catch (e) {
    nudgeVerdict.value = `Falló la prueba: ${e instanceof Error ? e.message : String(e)}`
  } finally {
    nudgeBusy.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-[#0B0B0F] p-4 text-neutral-200">
    <div class="mx-auto max-w-5xl space-y-4">
      <header class="flex flex-wrap items-baseline gap-3">
        <h1 class="text-xl font-semibold text-[#F496BC]">Laboratorio de voz</h1>
        <span class="text-xs text-neutral-500">spec 002 · fase 0 · solo en desarrollo · YIN propio</span>
      </header>

      <p v-if="!started" class="text-sm text-neutral-400">
        Con cascos (salvo en la toma 9). Cada toma lleva una cuenta de 4 tiempos a 90 bpm y después grabas. Las tomas se guardan en
        <code>tests/fixtures/voice/</code> (no se suben al repo).
      </p>
      <button v-if="!started" class="rounded bg-[#F496BC] px-4 py-2 font-medium text-black" @click="start">Activar el micro</button>
      <p v-if="msg" class="text-sm text-neutral-300">{{ msg }}</p>

      <template v-if="started">
        <!-- tomas -->
        <section class="grid gap-2 sm:grid-cols-3">
          <button
            v-for="t in TAKES"
            :key="t.id"
            class="rounded border p-2 text-left text-sm"
            :class="take.id === t.id ? 'border-[#F496BC] bg-[#1a1218]' : 'border-neutral-800 hover:border-neutral-600'"
            @click="take = t"
          >
            <b>{{ t.id }}.</b> {{ t.title }}
          </button>
        </section>

        <section class="space-y-2 rounded border border-neutral-800 p-3">
          <p class="text-sm"><b>Toma {{ take.id }}:</b> {{ take.how }}</p>
          <p v-if="take.pattern" class="text-xs text-neutral-500">Patrón: «{{ take.pattern }}»</p>
          <label class="block text-xs text-neutral-400">
            Notas que quieres cantar (A3 C4 E4…; opcional <code>@paso</code> en semicorcheas desde el 1.er tiempo, p. ej. <code>A3@0 C4@4</code>)
            <input v-model="expectedText" class="mt-1 w-full rounded bg-neutral-900 px-2 py-1 font-mono text-sm text-neutral-100" />
          </label>
          <p v-if="expected === null" class="text-xs text-red-400">No entiendo alguna nota (usa A3, C#4, Bb2…).</p>
          <div class="flex flex-wrap items-center gap-3 text-sm">
            <label class="flex items-center gap-1"><input v-model="click" type="checkbox" /> clic (solo con cascos)</label>
            <label class="flex items-center gap-1"><input v-model="background" type="checkbox" /> fondo de prueba por los altavoces</label>
            <button
              class="rounded bg-[#F496BC] px-3 py-1.5 font-medium text-black disabled:opacity-40"
              :disabled="status === 'counting' || status === 'recording'"
              @click="record"
            >
              ● Grabar ({{ take.sec }} s)
            </button>
            <span v-if="status === 'counting' || status === 'recording'" class="font-mono text-2xl text-white">{{ beatText }}</span>
          </div>
          <div v-if="status === 'recording'" class="h-1 w-full bg-neutral-800"><div class="h-1 bg-[#F496BC]" :style="{ width: `${progress * 100}%` }" /></div>
        </section>

        <!-- análisis -->
        <section class="space-y-2">
          <canvas ref="canvas" class="w-full rounded border border-neutral-800" :style="{ height: `${H}px` }" />
          <p class="text-xs text-neutral-500">
            Rosa = altura con voz · gris = rechazada · blanco = notas detectadas · azul discontinuo = notas esperadas · verde/rojo = onsets que
            pasan / no pasan la puerta de tono.
          </p>
          <div v-if="rec" class="flex flex-wrap items-center gap-2 text-sm">
            <button class="rounded border border-neutral-700 px-2 py-1" @click="playTake">▶ Mi toma</button>
            <button class="rounded border border-neutral-700 px-2 py-1" @click="playNotes">▶ Notas detectadas</button>
            <button class="rounded border border-neutral-700 px-2 py-1" @click="stopPlay">■</button>
            <input v-model="label" class="w-24 rounded bg-neutral-900 px-2 py-1 text-xs" title="etiqueta del nombre (pc, iphone, cascos…)" />
            <button class="rounded bg-neutral-200 px-2 py-1 font-medium text-black" :disabled="!rec" @click="save">Guardar toma</button>
            <span v-if="loadedName" class="text-xs text-neutral-500">{{ loadedName }}</span>
          </div>
        </section>

        <section v-if="rec" class="grid gap-4 md:grid-cols-2">
          <div class="space-y-1 rounded border border-neutral-800 p-3 text-sm">
            <h2 class="font-medium">Resultado</h2>
            <p>Onsets: <b>{{ onsets.length }}</b> · pasan la puerta de tono: <b>{{ passes }}</b> · notas detectadas: <b>{{ notes.length }}</b></p>
            <p v-if="take.id === 8" class="text-xs text-neutral-400">
              Sin cantar nada: confundidos con melodía = <b>{{ onsets.length ? pct(passes / onsets.length) : '—' }}</b> (objetivo ≤ 5 %) · notas falsas: <b>{{ notes.length }}</b>
            </p>
            <p v-else-if="take.id === 7" class="text-xs text-neutral-400">
              Debería pasar la puerta solo en los "na" (esperadas {{ expected?.length ?? 0 }} por vuelta del patrón).
            </p>
            <template v-if="score">
              <p>
                Clase de altura correcta: <b>{{ pct(score.pitchClassRate) }}</b> · nota exacta: <b>{{ pct(score.exactRate) }}</b> · inicio a ≤ 1
                semicorchea: <b>{{ pct(score.startRate) }}</b>
              </p>
              <p class="text-xs text-neutral-400">Perdidas: {{ score.missed.length }} · de más: {{ score.extra.length }} · objetivo ≥ 90 % con ayuda, ≥ 80 % sin ella</p>
            </template>
            <table class="mt-2 w-full text-xs">
              <thead class="text-neutral-500">
                <tr><th class="text-left">#</th><th class="text-left">nota</th><th class="text-left">cents</th><th class="text-left">inicio</th><th class="text-left">paso</th><th class="text-left">dur</th></tr>
              </thead>
              <tbody>
                <tr v-for="(n, i) in notes" :key="i" class="font-mono">
                  <td>{{ i + 1 }}</td>
                  <td>{{ midiName(n.midi) }}</td>
                  <td>{{ cents(n.midi) > 0 ? '+' : '' }}{{ cents(n.midi) }}</td>
                  <td>{{ n.start.toFixed(2) }}s</td>
                  <td>{{ (n.start / STEP).toFixed(1) }}</td>
                  <td>{{ (n.end - n.start).toFixed(2) }}s</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="space-y-1 rounded border border-neutral-800 p-3 text-xs">
            <h2 class="text-sm font-medium">Umbrales (se reanaliza al momento)</h2>
            <label class="flex items-center justify-between gap-2">YIN umbral {{ P.threshold }}<input v-model.number="P.threshold" type="range" min="0.05" max="0.4" step="0.01" /></label>
            <label class="flex items-center justify-between gap-2">mediana (frames) {{ P.median }}<input v-model.number="P.median" type="range" min="1" max="15" step="2" /></label>
            <label class="flex items-center justify-between gap-2">prob. de voz mín. {{ N.minProb }}<input v-model.number="N.minProb" type="range" min="0.3" max="0.95" step="0.05" /></label>
            <label class="flex items-center justify-between gap-2">volumen mín. {{ N.minRms }}<input v-model.number="N.minRms" type="range" min="0.0005" max="0.03" step="0.0005" /></label>
            <label class="flex items-center justify-between gap-2">nota mín. {{ N.minNoteSec }} s<input v-model.number="N.minNoteSec" type="range" min="0.02" max="0.2" step="0.01" /></label>
            <label class="flex items-center justify-between gap-2">corte por cambio {{ N.splitSemitones }} st<input v-model.number="N.splitSemitones" type="range" min="0.3" max="2" step="0.1" /></label>
            <label class="flex items-center justify-between gap-2">puerta: duración {{ G.minSec }} s<input v-model.number="G.minSec" type="range" min="0.04" max="0.25" step="0.01" /></label>
            <label class="flex items-center justify-between gap-2">puerta: tolerancia ±{{ G.tolerance }} st<input v-model.number="G.tolerance" type="range" min="0.3" max="2" step="0.1" /></label>
          </div>
        </section>

        <!-- tomas guardadas -->
        <section class="rounded border border-neutral-800 p-3 text-sm">
          <h2 class="mb-1 font-medium">Tomas guardadas <button class="ml-2 text-xs text-neutral-500 underline" @click="refreshList">actualizar</button></h2>
          <p v-if="!saved.length" class="text-xs text-neutral-500">Ninguna todavía.</p>
          <ul class="flex flex-wrap gap-2">
            <li v-for="n in saved" :key="n"><button class="rounded border border-neutral-700 px-2 py-0.5 font-mono text-xs hover:border-[#F496BC]" @click="load(n)">{{ n }}</button></li>
          </ul>
        </section>

        <!-- nudge / late -->
        <section class="space-y-2 rounded border border-neutral-800 p-3 text-sm">
          <h2 class="font-medium">Strudel: ¿sirven <code>.nudge()</code> y <code>.late()</code> en sintes?</h2>
          <p class="text-xs text-neutral-400">
            Toca 4 notas por ciclo con un sinte (suena ~10 s en total), graba la salida y mide cuándo suena cada nota respecto a cuándo
            Strudel dice que la dispara.
          </p>
          <button class="rounded border border-neutral-700 px-2 py-1 disabled:opacity-40" :disabled="nudgeBusy" @click="nudgeTest">
            {{ nudgeBusy ? 'Probando…' : 'Probar' }}
          </button>
          <table v-if="nudgeRows.length" class="text-xs font-mono">
            <thead class="text-neutral-500"><tr><th class="pr-4 text-left">caso</th><th class="pr-4 text-left">retardo tras el disparo</th><th class="pr-4 text-left">fase en el ciclo (mod 0,5 s)</th><th class="text-left">notas</th></tr></thead>
            <tbody>
              <tr v-for="r in nudgeRows" :key="r.name"><td class="pr-4">{{ r.name }}</td><td class="pr-4">{{ r.delayMs }} ms</td><td class="pr-4">{{ r.phaseMs }} ms</td><td>{{ r.n }}</td></tr>
            </tbody>
          </table>
          <p v-if="nudgeVerdict" class="text-sm text-[#F496BC]">{{ nudgeVerdict }}</p>
        </section>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
// 5 · Remixes (spec 019): eliges una canción y actúas sus partes. Nada avanza solo: tocas una parte y entra en el siguiente compás; dentro, enciendes y apagas capas y usas el DJ.
// Lo que actúas se graba como «mi versión» (hasta 2 min; el final entra solo ≈ 8 s antes del tope y termina en el compás justo) y se comparte en vídeo.
import { useLab } from '~/composables/useLab'
import { AMBER, LAB_W } from '~/lib/lab'
import { addSong, isLabMark, makeSaved, newId } from '~/lib/library'
import { barSeconds, finalPartOf, labRemixFromSaved, LAB_REMIXES, partLoops, partsOn, remixTake, songFromTake, takePlan, type LabLayer, type LabRemix, type TakeBar } from '~/lib/labRemixes'
import { readJson, writeText } from '~/lib/storage'
import type { StageFrame } from './LabStage.vue'

const lab = useLab()
const { engine } = lab
const emit = defineEmits<{ back: [] }>()
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void; videoSource: () => never } | null>(null)
const C = LAB_W / 2

const remix = ref<LabRemix | null>(null)
// los míos: lo que se editó en el Estudio y se guardó en Mis canciones (con la marca `lab`) vuelve aquí
const library = useLibrary()
onMounted(() => library.load())
const mios = computed(() => library.lib.value.entries.flatMap((e) => (e.saved && isLabMark(e.saved.lab) ? [labRemixFromSaved(e.saved)] : [])).filter((r): r is LabRemix => !!r))
const part = ref('') // la parte elegida, por nombre (entra en el siguiente compás)
const shown = ref('') // la que suena ya
let shownFrom = 0 // compás desde el que `shown` vale `part`
const on = ref<Set<string>>(new Set())
let ids: Record<string, number[]> = {}
const mode = ref<'actuar' | 'escuchar'>('actuar')

const COLOR: Record<string, string> = { bombo: AMBER, ritmo: AMBER, caja: '#F496BC', hat: '#8ECFF2', bajo: '#B7A6F2', acordes: '#cfcfd6', tema: '#7fd6c2', subida: '#F5A97A' }
const PART_COLOR: Record<string, string> = { Intro: '#8ECFF2', Estrofa: '#7fd6c2', Subida: '#F5A97A', Drop: '#F496BC', Break: '#cfcfd6', Final: '#B7A6F2', Salida: '#B7A6F2', Puente: '#cfcfd6' }
/** el color de una parte por su nombre sin número («Drop 2» → Drop) */
const colorOfPart = (name: string): string => PART_COLOR[name.replace(/\s+\d+$/, '')] ?? '#B7A6F2'
const cur = computed(() => remix.value?.parts.find((p) => p.name === part.value) ?? null)

// ── mi versión: se guarda aparte (clave propia; nada del Estudio) ──
const TAKE_KEY = 'coderbeats:lab:take:v1'
type Takes = Record<string, TakeBar[]>
const isTakes = (x: unknown): x is Takes =>
  !!x && typeof x === 'object' && Object.values(x).every((t) => Array.isArray(t) && t.length <= 200 && t.every((b) => !!b && typeof (b as TakeBar).part === 'string' && (b as TakeBar).part.length <= 40 && Array.isArray((b as TakeBar).on) && (b as TakeBar).on.every((k) => typeof k === 'string')))
const takes = ref<Takes>(readJson(TAKE_KEY, isTakes) ?? {})
const mine = computed(() => (remix.value ? takes.value[remix.value.id] ?? null : null))

interface Rec { startBar: number; changes: { from: number; part: string; on: string[] }[]; endBar: number | null }
const rec = ref<Rec | null>(null)
const recBars = ref(0)
const plan = computed(() => takePlan(remix.value?.style ?? 'techno'))

async function pick(r: LabRemix) {
  await lab.begin()
  await lab.changeStyle(r.style)
  engine.setKit(r.kit)
  remix.value = r
  part.value = shown.value = r.parts[0]!.name
  await enter(part.value)
}
/** pone una parte: todos sus loops (los apagados, silenciados) y su fondo; sonando, entra en el siguiente compás */
async function enter(name: string) {
  const r = remix.value!
  if (mode.value === 'escuchar') {
    mode.value = 'actuar'
    engine.stop()
    await engine.clearAll()
  }
  const p = r.parts.find((x) => x.name === name)
  if (!p) return
  on.value = new Set(p.start)
  const pl = partLoops(p, on.value, 1, true)
  ids = pl.ids
  engine.setBackgroundMode('manual')
  engine.setBackgroundManual(partsOn(p, on.value))
  engine.editLoops({ loops: pl.loops, nextId: pl.nextId })
}
const nextBar = () => engine.clockNow().bar + 1
function note() {
  const r = rec.value
  if (r && r.endBar === null) r.changes.push({ from: nextBar(), part: part.value, on: [...on.value] })
}
async function goPart(name: string) {
  if (!remix.value || (rec.value?.endBar ?? null) !== null) return
  if (!engine.playing.value) await lab.start()
  part.value = name
  shownFrom = engine.playing.value ? nextBar() : 0
  await enter(name)
  note()
}
function toggleLayer(l: LabLayer) {
  if (mode.value !== 'actuar' || (rec.value?.endBar ?? null) !== null) return
  const next = new Set(on.value)
  if (next.has(l.key)) next.delete(l.key)
  else next.add(l.key)
  on.value = next
  if (l.bass) engine.toggleBackgroundPart('bass')
  else if (l.chords) engine.toggleBackgroundPart('chords')
  else for (const id of ids[l.key] ?? []) engine.mute(id)
  note()
}

// ── grabar ──
async function startRec() {
  if (!remix.value || mode.value !== 'actuar') return
  if (!engine.playing.value) await lab.start()
  rec.value = { startBar: nextBar(), changes: [{ from: nextBar(), part: part.value, on: [...on.value] }], endBar: null }
  recBars.value = 0
}
function takeUntil(endBar: number): TakeBar[] {
  const r = rec.value!
  const out: TakeBar[] = []
  for (let b = r.startBar; b < endBar; b++) {
    let c = r.changes[0]!
    for (const x of r.changes) if (x.from <= b) c = x
    out.push({ part: c.part, on: [...c.on] })
  }
  return out
}
/** «■ Terminar»: en el siguiente compás entra el final y se acaba en un compás justo (a lo sumo, el tope) */
async function endRec() {
  const r = rec.value
  if (!r || r.endBar !== null) return
  const nb = nextBar()
  const rel = Math.max(1, nb - r.startBar)
  // si ya estaba en el final, cuenta los compases que lleva en él
  const fin = finalPartOf(remix.value!).name
  const trailing = takeUntil(nb).reverse().findIndex((b) => b.part !== fin)
  const inFinal = part.value === fin ? (trailing < 0 ? rel : trailing) : 0
  r.endBar = r.startBar + Math.min(plan.value.maxBars, rel + Math.max(1, plan.value.finalBars - inFinal))
  if (part.value !== fin) {
    part.value = fin
    shownFrom = nb
    await enter(fin)
    r.changes.push({ from: nb, part: fin, on: [...on.value] })
  }
}
async function finishRec() {
  const r = rec.value
  if (!r || r.endBar === null || !remix.value) return
  const take = takeUntil(r.endBar)
  engine.stop()
  rec.value = null
  takes.value = { ...takes.value, [remix.value.id]: take }
  writeText(TAKE_KEY, JSON.stringify(takes.value))
  await listen(take)
}
// parar con ■ deja la grabación en nada (no se guarda a medias)
watch(() => engine.playing.value, (p) => {
  if (!p && rec.value) rec.value = null
})
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (!engine.playing.value) return
    const bar = engine.clockNow().bar
    if (shown.value !== part.value && bar >= shownFrom) shown.value = part.value
    const r = rec.value
    if (!r || bar < r.startBar) return
    recBars.value = bar - r.startBar + 1
    // el final entra solo cuando faltan ≈ 8 s del tope
    if (r.endBar === null && bar + 1 >= r.startBar + plan.value.finalStart) void endRec()
    if (r.endBar !== null && bar >= r.endBar) void finishRec()
  }, 20)
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__remix = { part: () => part.value, shown: () => shown.value, on: () => [...on.value].join(','), mode: () => mode.value, rec: () => (rec.value ? { bars: recBars.value, end: rec.value.endBar, start: rec.value.startBar } : null), take: () => (remix.value ? takes.value[remix.value.id]?.length ?? 0 : 0), plan: () => plan.value }
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  engine.setFx({ filter: 1, space: 0 })
  lab.stopAll()
})

// ── Abrir en el Estudio (spec 020): una sola copia por remix, nunca una nueva cada vez ──
// · Un remix «mío» se abre tal cual (es la propia canción guardada; los cambios se guardan en ella con «Guardar cambios»).
// · Un remix de serie se copia **una vez** a Mis canciones (id fijo `lab-<remix>`); si ya hay copia, se abre esa, sin tocarla. El original nunca se toca.
const openError = ref('')
async function openInStudio() {
  const r = remix.value
  if (!r) return
  let id: string
  if (r.id.startsWith('mio:')) id = r.id.slice(4)
  else {
    id = `lab-${r.id}`
    if (!library.lib.value.entries.some((e) => e.id === id)) {
      const song = songFromTake(r, mine.value ?? remixTake(r))
      if (!song) return
      const saved = { ...makeSaved({ style: r.style, kit: r.kit, bgMode: 'manual', fx: { filter: 1, space: 0, warmth: engine.snapshot().fx.warmth }, song }, id, `Mi ${r.title}`, new Date()), lab: { remixId: r.id } }
      if (!library.persist(addSong(library.lib.value, saved))) {
        openError.value = library.error.value ?? 'No se ha podido guardar la copia.'
        return
      }
    }
  }
  library.setCurrent(id)
  lab.stopAll()
  await navigateTo(`/estudio?abrir=${encodeURIComponent(id)}`)
}

// ── escuchar y compartir ──
async function listen(take: TakeBar[]) {
  const r = remix.value
  if (!r) return
  const song = songFromTake(r, take)
  if (!song) return
  mode.value = 'escuchar'
  engine.stop()
  engine.setSong(song)
  await engine.play()
}
const listenOriginal = () => (remix.value ? listen(remixTake(remix.value)) : undefined)
const listenMine = () => (mine.value ? listen(mine.value) : undefined)
const exporter = useVideoExport(() => stage.value?.videoSource() ?? null)
const video = useVideoState()
async function makeVideo() {
  if (!remix.value || !mine.value) return
  // la grabación es la de mi versión, desde el principio, y dura lo mismo que ella
  const song = songFromTake(remix.value, mine.value)
  if (!song) return
  engine.stop()
  engine.setSong(song)
  mode.value = 'escuchar'
  await exporter.start({ what: 'song', bars: 0, format: 'cuadrado', size: 720, fps: 30, mark: true, header: true })
}

// ── el escenario: las capas de la parte, en círculo ──
const POS = computed(() => (cur.value?.layers ?? []).map((_, i, a) => {
  const ang = -Math.PI / 2 + (i * Math.PI * 2) / a.length
  return [C + Math.cos(ang) * 175, C + Math.sin(ang) * 175] as const
}))
function down(x: number, y: number) {
  if (!cur.value || mode.value !== 'actuar') return
  cur.value.layers.forEach((l, i) => {
    if (Math.hypot(x - POS.value[i]![0], y - POS.value[i]![1]) < 62) {
      if (!engine.playing.value) void lab.start()
      toggleLayer(l)
      stage.value?.ripple(POS.value[i]![0], POS.value[i]![1], COLOR[l.key] ?? '#fff', 4, 48)
      navigator.vibrate?.(8)
    }
  })
}
function draw(g: CanvasRenderingContext2D, f: StageFrame) {
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  if (mode.value === 'escuchar') {
    g.fillStyle = 'rgba(255,255,255,.55)'
    g.font = '400 24px system-ui, sans-serif'
    g.fillText('escuchando', C, C)
    return
  }
  if (!cur.value) return
  const queued = shown.value !== part.value
  g.beginPath()
  g.arc(C, C, 62 + (f.beat ? 6 : 0), 0, 7)
  g.strokeStyle = colorOfPart(part.value)
  g.globalAlpha = queued && Math.floor(f.t * 4) % 2 ? 0.3 : 1
  g.lineWidth = 3
  g.stroke()
  g.globalAlpha = 1
  g.fillStyle = colorOfPart(part.value)
  g.font = '500 26px system-ui, sans-serif'
  g.fillText(part.value, C, C)
  cur.value.layers.forEach((l, i) => {
    const [x, y] = POS.value[i]!
    const isOn = on.value.has(l.key)
    const col = COLOR[l.key] ?? '#fff'
    g.beginPath()
    g.arc(x, y, 52 + (isOn && f.beat ? 7 : 0), 0, 7)
    g.fillStyle = isOn ? col : 'rgba(255,255,255,.05)'
    g.globalAlpha = isOn ? 0.9 : 1
    g.fill()
    g.globalAlpha = 1
    g.strokeStyle = isOn ? col : 'rgba(255,255,255,.2)'
    g.lineWidth = 2
    g.stroke()
    g.fillStyle = isOn ? '#0b0b0d' : 'rgba(255,255,255,.6)'
    g.font = '500 21px system-ui, sans-serif'
    g.fillText(l.label, x, y)
  })
  if (rec.value) {
    g.beginPath()
    g.arc(34, 34, 9, 0, 7)
    g.fillStyle = '#ff4d6d'
    g.fill()
    g.fillStyle = 'rgba(255,255,255,.8)'
    g.font = '400 20px system-ui, sans-serif'
    g.textAlign = 'left'
    g.fillText(`${recBars.value}/${plan.value.maxBars}${rec.value.endBar !== null ? ' · final' : ''}`, 52, 34)
  }
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const phrase = computed(() => (remix.value ? 'Toca una parte: entra en el siguiente compás y se queda hasta que elijas otra. Dentro, enciende y apaga capas.' : 'Elige una canción.'))
</script>

<template>
  <LabShell title="Remixes" :phrase="phrase" hide-style @back="emit('back')" @style="() => {}" @play="remix ? goPart(part) : undefined" @stop="lab.stopAll()">
    <div v-if="!remix" class="grid gap-3 py-2">
      <button v-for="r in [...LAB_REMIXES, ...mios]" :key="r.id" class="rounded-2xl border border-white/15 bg-white/5 p-4 text-left" @click="pick(r)">
        <div class="text-lg">{{ r.title }}</div>
        <div class="text-sm text-white/60">{{ r.id.startsWith('mio:') ? 'mi versión · editada en el Estudio' : r.composer }}{{ r.key ? ` · ${r.key}` : '' }} · {{ r.style }}</div>
      </button>
    </div>
    <template v-else>
      <LabStage ref="stage" :draw="draw" @down="down" />
    </template>
    <template #extra>
      <template v-if="remix">
        <div class="mt-4 grid grid-cols-2 gap-2" aria-label="partes">
          <button
            v-for="pt in remix.parts"
            :key="pt.name"
            :data-part="pt.name"
            class="rounded-2xl border px-4 py-5 text-lg"
            :class="mode === 'actuar' && part === pt.name ? 'border-2 text-white' : 'border-white/20 text-white/70'"
            :style="mode === 'actuar' && part === pt.name ? { borderColor: colorOfPart(pt.name) } : {}"
            @pointerdown.prevent="goPart(pt.name)"
          >
            {{ pt.name }}<span v-if="mode === 'actuar' && part === pt.name && shown !== pt.name" class="ml-2 text-xs text-white/50">entra…</span>
          </button>
        </div>
        <div class="mt-4"><LabDj @start="goPart(part)" /></div>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button v-if="!rec" class="rounded-lg border border-white/25 px-4 py-2 text-sm" :disabled="mode !== 'actuar'" @click="startRec">● Grabar mi versión</button>
          <button v-else class="rounded-lg border border-[#ff4d6d] px-4 py-2 text-sm" :disabled="rec.endBar !== null" @click="endRec">{{ rec.endBar !== null ? 'terminando…' : '■ Terminar' }}</button>
          <button v-if="mine && !rec" class="rounded-lg border border-white/25 px-4 py-2 text-sm" @click="listenMine">▶ Mi versión ({{ fmt(mine.length * barSeconds(remix.style)) }})</button>
          <button v-if="mine && !rec" class="rounded-lg border border-white/25 px-4 py-2 text-sm" :disabled="video.phase === 'recording' || video.phase === 'waiting'" @click="makeVideo">🎬 Mi vídeo</button>
        </div>
        <p v-if="openError" class="mt-2 text-sm text-red-300" role="alert">{{ openError }}</p>
        <p v-if="video.phase === 'waiting' || video.phase === 'recording'" class="mt-2 text-sm text-white/60" role="status">Grabando el vídeo {{ video.elapsed.toFixed(0) }}/{{ video.total.toFixed(0) }} s <button class="ml-2 underline" @click="exporter.stop()">■ parar</button></p>
        <p v-else-if="video.phase === 'error'" class="mt-2 text-sm text-red-300" role="alert">{{ video.message }}</p>
        <div v-else-if="video.phase === 'done'" class="mt-2 flex gap-2 text-sm">
          <button class="rounded-lg border border-white/25 px-4 py-2" @click="exporter.save(true)">Compartir vídeo</button>
          <button class="rounded-lg border border-white/25 px-4 py-2" @click="exporter.save(false)">Guardar</button>
        </div>
        <div class="mt-3 flex items-center gap-4 text-xs text-white/40">
          <button class="underline decoration-white/20" @click="listenOriginal">escuchar el remix original</button>
          <button class="underline decoration-white/20" @click="openInStudio">Abrir en el Estudio</button>
          <button class="underline decoration-white/20" @click="remix = null; lab.stopAll()">otra canción</button>
        </div>
      </template>
    </template>
  </LabShell>
</template>

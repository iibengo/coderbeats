<script setup lang="ts">
// 5 · Remixes (spec 019): eliges una canción y actúas sus partes. Nada avanza solo: tocas una parte y entra en el siguiente compás; dentro, enciendes y apagas capas y usas el DJ.
// Lo que actúas se graba como «mi versión» (hasta 2 min; el final entra solo ≈ 8 s antes del tope y termina en el compás justo) y se comparte en vídeo.
import { useLab } from '~/composables/useLab'
import { fontPx, LAB_W } from '~/lib/lab'
import { VOICE_HEX } from '~/lib/palette'
import { liveLane, makePulso, makePulsoLive, pushLive, setLivePart, PULSO_COMPACT, type PulsoScene } from '~/lib/visuals/pulso'
import { songTimeline } from '~/lib/timeline'
import { borderAngle, partProgress } from '~/lib/partProgress'
import { coverBars, filterRemixes, fmtDuration, neighborId, styleChips, styleLabel } from '~/lib/remixLibrary'
import type { FreeLoop } from '~/lib/freeLoops'
import { addSong, makeSaved } from '~/lib/library'
import { autoNext, barSeconds, finalPartOf, remixSeconds, labRemixFromSaved, LAB_REMIXES, partLoops, partsOn, remixTake, songFromTake, takePlan, type LabLayer, type LabRemix, type TakeBar } from '~/lib/labRemixes'
import { readJson, writeText } from '~/lib/storage'
import { encodeShare, shareUrl } from '~/lib/shareLink'
import { hasVoiceLoops, type CardRef } from '~/lib/shareCard'
import { diveProgress, diveWindow, dives, hitsNext, levelsFor, NESTED_SCALE, reducedFade, stackAt, type Ring } from '~/lib/zoomStack'
import type { StageFrame } from './LabStage.vue'

const { t } = useI18n()
const lab = useLab()
const { engine } = lab
const emit = defineEmits<{ back: [] }>()
const stage = ref<{ ripple: (x: number, y: number, c: string, g?: number, r?: number) => void; videoSource: () => never } | null>(null)
const C = LAB_W / 2

const remix = ref<LabRemix | null>(null)
// ── biblioteca y mini reproductor (spec 051): la lista de remixes (con buscador y filtros) o el reproductor; el remix cargado sigue sonando al volver a la lista ──
const view = ref<'lista' | 'player'>('lista')
const query = ref('')
const styleFilter = ref<string>('todos') // 'todos' o la clave de un estilo (`styleKey`)
function showLibrary() {
  menuOpen.value = false
  view.value = 'lista'
}
// ── la pantalla «reproduciendo» (spec 052): el menú «⋯» (una hoja con los extras), anterior y siguiente remix ──
const menuOpen = ref(false)
const shareOpen = ref(false)
/** el enlace de la tarjeta: un remix de la app, por su id (corto); uno propio, con sus datos (spec 061) */
async function buildShare(): Promise<CardRef | null> {
  const r = remix.value
  if (!r) return null
  if (LAB_REMIXES.some((x) => x.id === r.id)) return { kind: 'r', id: r.id }
  const payload = await encodeShare({ ...engine.snapshot(), style: r.style, kit: r.kit, song: r.song }, r.title)
  return { kind: 'c', payload }
}
const remixList = computed(() => [...LAB_REMIXES, ...mios.value])
const remixSub = computed(() => (remix.value ? [remix.value.composer, remix.value.key, styleLabel(remix.value.style)].filter(Boolean).join(' · ') : ''))
/** anterior y siguiente: si sonaba, el nuevo sigue sonando desde su primera parte (la persona ya había empezado); si estaba parado, queda parado */
async function skip(dir: 1 | -1) {
  const id = neighborId(remixList.value, remix.value?.id ?? null, dir)
  const next = remixList.value.find((r) => r.id === id)
  if (!next) return
  const wasPlaying = engine.playing.value && mode.value === 'actuar'
  await pick(next)
  if (wasPlaying) await goPart(part.value)
}
/** una acción del menú «⋯»: cierra la hoja y la hace (las opciones no cierran) */
function run(f: () => unknown) {
  menuOpen.value = false
  void f()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuOpen.value) menuOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
function miniToggle() {
  if (engine.playing.value) lab.stopAll()
  else if (remix.value) void goPart(part.value)
}
const coverCache = new Map<string, number[]>()
/** la carátula de un remix (cinco alturas de su línea de tiempo), calculada una vez */
function coverOf(r: LabRemix): number[] {
  let c = coverCache.get(r.id)
  if (!c) {
    try {
      c = coverBars(songTimeline(r.song, r.style))
    } catch {
      c = [0.14, 0.14, 0.14, 0.14, 0.14]
    }
    coverCache.set(r.id, c)
  }
  return c
}
// los míos: lo que se editó en el Estudio y se guardó en Mis canciones (con la marca `lab`) vuelve aquí
const library = useLibrary()
const route = useRoute()
onMounted(async () => {
  library.load()
  // «▶ Tocar en el Laboratorio» desde el Estudio: ese remix ya elegido
  const want = route.query.remix
  if (typeof want === 'string') {
    await nextTick()
    const r = [...LAB_REMIXES, ...mios.value].find((x) => x.id === want)
    history.replaceState(null, '', location.pathname)
    if (r) await pick(r)
  }
})
const mios = computed(() => library.lib.value.entries.flatMap((e) => (e.saved ? [labRemixFromSaved(e.saved)] : [])).filter((r): r is LabRemix => !!r))
const chips = computed(() => styleChips([...LAB_REMIXES, ...mios.value]))
const groups = computed(() => [
  { id: 'serie', label: t('lab.remix.groupSerie'), items: filterRemixes(LAB_REMIXES, query.value, styleFilter.value) },
  { id: 'mios', label: t('lab.remix.groupMine'), items: filterRemixes(mios.value, query.value, styleFilter.value) },
].filter((g) => g.items.length))
const rowSub = (r: LabRemix) => `${r.id.startsWith('mio:') ? t('lab.remix.mineKind') : r.composer} · ${styleLabel(r.style)}${r.unverified ? ` · ${t('lab.remix.unverified')}` : ''}`
const part = ref('') // la parte elegida, por nombre (entra en el siguiente compás)
const shown = ref('') // la que suena ya
let shownFrom = 0 // compás desde el que `shown` vale `part`
const on = ref<Set<string>>(new Set())
let ids: Record<string, number[]> = {}
const mode = ref<'actuar' | 'escuchar'>('actuar')

// el color es solo de los instrumentos (el mismo que en todas partes); acordes y subida, gris (fondo y efecto). Las partes no tienen color: la que suena, blanca; la que entra, parpadea; las demás, tenues.
const GREY = '#CFCFD6'
const COLOR: Record<string, string> = { bombo: VOICE_HEX.bd, ritmo: VOICE_HEX.bd, caja: VOICE_HEX.sd, hat: VOICE_HEX.hh, bajo: VOICE_HEX.bass, acordes: GREY, tema: VOICE_HEX.mel, subida: GREY }
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
const plan = computed(() => takePlan(remix.value?.style ?? 'techno', remix.value?.song.bpm))

async function pick(r: LabRemix) {
  menuOpen.value = false
  // otro remix: no se pueden mezclar dos; el que suena se para y el nuevo carga **sin empezar solo** (la persona decide cuándo)
  if (remix.value && remix.value.id !== r.id && engine.playing.value) lab.stopAll()
  await lab.begin()
  await lab.changeStyle(r.style)
  engine.setBpm(r.song.bpm ?? null) // el tempo de la canción manda (si no, el del estilo)
  engine.setKit(r.kit)
  remix.value = r
  part.value = shown.value = r.parts[0]!.name
  visIndex.value = 0
  dive = null
  await enter(part.value)
  view.value = 'player'
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
  loopInfo = new Map(pl.loops.map((l) => [l.id, l]))
  liveScene.title = [r.composer, styleLabel(r.style)].filter(Boolean).join(' · ') // el título va en la cabecera; el lienzo, compositor y estilo
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
  startDive(name)
  part.value = name
  shownFrom = engine.playing.value ? nextBar() : 0
  if (shown.value === name) shownBar = shownFrom // la misma parte: no hay cambio que lo anote, vuelve a empezar en ese compás
  await enter(name)
  note()
}
// ── vista «Pulso» (spec 050): el lienzo de círculos de siempre, o las cinco columnas del visual (sin capas tocables; se cambia de parte con el pad) ──
const VISTA_KEY = 'coderbeats:lab:vista:v1'
const vista = ref<'circulos' | 'pulso'>(readJson(VISTA_KEY, (x): x is { v: 'circulos' | 'pulso' } => !!x && typeof x === 'object' && ((x as { v?: unknown }).v === 'circulos' || (x as { v?: unknown }).v === 'pulso'))?.v ?? 'pulso')
// ── pasar solo a la siguiente parte (spec 050): al acabar sus compases, la parte siguiente entra en el compás justo; la última sigue en bucle hasta que la persona haga algo. Apagado, nada avanza solo (como antes) ──
const AUTO_KEY = 'coderbeats:lab:auto:v1'
const auto = ref(readJson(AUTO_KEY, (x): x is { v: boolean } => !!x && typeof x === 'object' && typeof (x as { v?: unknown }).v === 'boolean')?.v ?? true)
function toggleAuto() {
  auto.value = !auto.value
  writeText(AUTO_KEY, JSON.stringify({ v: auto.value }))
}
let shownBar = 0 // el compás en el que empezó a sonar la parte que se ve
// el borde del botón de la parte que suena se ilumina con sus compases (spec 050); al acabar, con Auto entra la siguiente y sin Auto vuelve a empezar
const progress = ref(0)
const padSize = ref({ w: 180, h: 64 })
const progressBg = computed(() => {
  const a = Math.round(borderAngle(progress.value, padSize.value.w, padSize.value.h) * 10) / 10
  return `conic-gradient(from 0deg, #fff ${a}deg, rgba(255,255,255,.2) ${a}deg)`
})
function toggleVista() {
  vista.value = vista.value === 'pulso' ? 'circulos' : 'pulso'
  writeText(VISTA_KEY, JSON.stringify({ v: vista.value }))
}
/** la escena en directo (actuando) y, escuchando, la de la línea de tiempo de esa canción */
const liveScene = makePulsoLive('', PULSO_COMPACT)
const listenScene = ref<PulsoScene | null>(null)
const pulsoScene = computed<PulsoScene>(() => (mode.value === 'escuchar' && listenScene.value ? listenScene.value : liveScene))
// qué carril es cada loop de la parte que suena (los golpes del motor traen el id del loop)
let loopInfo = new Map<number, FreeLoop>()
let offVisual: (() => void) | null = null
/** ¿suena de verdad el bajo o los acordes del fondo del estilo en la parte de ahora? El motor sigue **emitiendo** sus golpes aunque esa capa esté apagada (se silencian en el audio, no en los eventos): como el Estudio con `bgParts`, solo cuentan si la capa está encendida */
function bgSounds(kind: 'bass' | 'chords'): boolean {
  const p = remix.value?.parts.find((x) => x.name === shown.value)
  return !!p?.layers.some((l) => l[kind] && on.value.has(l.key))
}
function onHit(h: Parameters<Parameters<typeof engine.onVisual>[0]>[0]) {
  if (h.kind !== 'hit' || mode.value !== 'actuar') return
  if ((h.instrument === 'bass' || h.instrument === 'chords') && !bgSounds(h.instrument)) return
  const r = liveLane(h.instrument, h.loopId !== null ? (loopInfo.get(h.loopId) ?? null) : null, h.strength)
  if (r) pushLive(liveScene, r.lane, r.level, h.time)
}
onMounted(() => {
  offVisual = engine.onVisual(onHit)
})
onBeforeUnmount(() => offVisual?.())
// el nombre de la parte que suena y el flash al cambiar
watch(() => shown.value, (n) => {
  if (n) setLivePart(liveScene, n, engine.clockNow().time)
})

// ── zoom infinito (spec 026, prototipo): apagado por defecto; con él apagado esta pantalla se ve y funciona exactamente igual ──
const ZOOM_KEY = 'coderbeats:lab:zoom:v1'
const zoomOn = ref(readJson(ZOOM_KEY, (x): x is { on: boolean } => !!x && typeof (x as { on?: unknown }).on === 'boolean')?.on ?? false)
function toggleZoom() {
  zoomOn.value = !zoomOn.value
  writeText(ZOOM_KEY, JSON.stringify({ on: zoomOn.value }))
}
const reducedMotion = import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const R0 = 300
const visIndex = ref(0) // la parte que se ve grande en reposo
let dive: { from: number; to: number; d: number; startS: number; landS: number } | null = null
let fadeFrom: { from: number; startS: number } | null = null
let lastT = 0
let lastScale = 0.53
let zoomLevels = 2 // el vigilante: 2 (el tercero taparía el nombre de la parte) → 1
let dts: number[] = []
const indexOfPart = (name: string) => Math.max(0, remix.value?.parts.findIndex((p) => p.name === name) ?? 0)
function startDive(name: string) {
  if (!zoomOn.value || !remix.value) return
  const n = remix.value.parts.length
  const from = dive?.to ?? visIndex.value
  const to = indexOfPart(name)
  const d = dives(from, to, n)
  if (n < 2 || d === 0) return
  if (reducedMotion) {
    fadeFrom = { from, startS: lastT }
    visIndex.value = to
    return
  }
  const barSec = barSeconds(remix.value.style, remix.value.song.bpm)
  const w = engine.playing.value ? diveWindow(lastT, barSec, engine.clockNow().barPhase) : { startS: lastT, landS: lastT + 0.6 }
  dive = { from, to, d, startS: w.startS, landS: w.landS }
}
function drawRings(g: CanvasRenderingContext2D, rings: Ring[], k = 1) {
  for (const r of rings) {
    if (r.r < 2 || r.r > 900 || r.level >= zoomLevels) continue
    g.globalAlpha = Math.min(1, r.alpha * k) * 0.5
    g.beginPath()
    g.arc(C, C, r.r, 0, 7)
    g.stroke()
  }
}
/** las gotas anidadas, detrás de las capas (solo con el zoom encendido) */
function drawZoomBack(g: CanvasRenderingContext2D, f: StageFrame) {
  const r = remix.value
  if (!r || r.parts.length < 2) return
  // vigilante: p95 de cada 120 frames
  if (lastT > 0) dts.push((f.t - lastT) * 1000)
  if (dts.length >= 120) {
    const sorted = [...dts].sort((a, b) => a - b)
    zoomLevels = Math.max(1, Math.min(2, levelsFor(sorted[Math.floor(sorted.length * 0.95)]!, zoomLevels)))
    dts = []
  }
  lastT = f.t
  lastScale = f.scale
  const n = r.parts.length
  g.save()
  g.strokeStyle = '#fff'
  g.lineWidth = 2
  if (dive && f.t >= dive.landS) {
    visIndex.value = dive.to
    dive = null
  }
  if (dive) drawRings(g, stackAt(diveProgress(f.t, dive.startS, dive.landS, dive.d), dive.from, n, R0))
  else if (fadeFrom && f.t - fadeFrom.startS < 0.16) {
    const k = reducedFade(f.t - fadeFrom.startS)
    drawRings(g, stackAt(0, fadeFrom.from, n, R0), k.out)
    drawRings(g, stackAt(0, visIndex.value, n, R0), k.in)
  } else {
    fadeFrom = null
    drawRings(g, stackAt(0, visIndex.value, n, R0))
    // el nombre de la siguiente, a tamaño normal, fuera de la gota pequeña
    if (mode.value === 'actuar') {
      g.globalAlpha = 0.6
      g.fillStyle = '#fff'
      g.font = `400 ${fontPx(20, f.scale)}px system-ui, sans-serif`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(t('lab.remix.next', { name: r.parts[(visIndex.value + 1) % n]!.name }), C, C + R0 * NESTED_SCALE + 22)
    }
  }
  g.restore()
}
const drawStage = (g: CanvasRenderingContext2D, f: StageFrame) => {
  if (zoomOn.value) drawZoomBack(g, f)
  draw(g, f)
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
    if (!engine.playing.value) {
      progress.value = 0
      return
    }
    const clk = engine.clockNow()
    const bar = clk.bar
    if (shown.value !== part.value && bar >= shownFrom) {
      shown.value = part.value
      shownBar = bar
    }
    // el progreso de la parte que suena (el borde de su botón)
    const cur = mode.value === 'actuar' && shown.value === part.value ? remix.value?.parts.find((x) => x.name === shown.value) : undefined
    if (cur) {
      progress.value = Math.round(partProgress(clk.bar, clk.barPhase, shownBar, cur.bars) * 200) / 200
      const el = document.querySelector('[data-part]')
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && (Math.abs(r.width - padSize.value.w) > 0.5 || Math.abs(r.height - padSize.value.h) > 0.5)) padSize.value = { w: r.width, h: r.height }
      }
    } else progress.value = 0
    // pasar solo a la siguiente parte, en el compás justo (la nueva entra en el siguiente compás: se pide en el último de la actual)
    const rm = remix.value
    if (auto.value && rm && mode.value === 'actuar' && shown.value === part.value && (rec.value?.endBar ?? null) === null) {
      const next = autoNext(rm.parts, part.value, shownBar, bar)
      if (next) void goPart(next)
    }
    const r = rec.value
    if (!r || bar < r.startBar) return
    recBars.value = bar - r.startBar + 1
    // el final entra solo cuando faltan ≈ 8 s del tope
    if (r.endBar === null && bar + 1 >= r.startBar + plan.value.finalStart) void endRec()
    if (r.endBar !== null && bar >= r.endBar) void finishRec()
  }, 20)
  if (import.meta.dev) (window as unknown as Record<string, unknown>).__remix = { zoom: () => ({ on: zoomOn.value, vis: visIndex.value, diving: !!dive, levels: zoomLevels }), part: () => part.value, shown: () => shown.value, on: () => [...on.value].join(','), mode: () => mode.value, rec: () => (rec.value ? { bars: recBars.value, end: rec.value.endBar, start: rec.value.startBar } : null), take: () => (remix.value ? takes.value[remix.value.id]?.length ?? 0 : 0), plan: () => plan.value }
})
onBeforeUnmount(() => {
  engine.setBpm(null) // el tempo propio de una canción no se queda para las demás pantallas
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

// ── enlace (spec 027): el remix de ahora (o mi versión) por enlace, que se abre en el Estudio; solo datos, el `#c=` no llega al servidor ──
const linkNote = ref('')
async function shareLink() {
  const r = remix.value
  if (!r) return
  const entry = r.id.startsWith('mio:') ? library.lib.value.entries.find((e) => `mio:${e.id}` === r.id)?.saved : undefined
  const song = entry ? entry.song : songFromTake(r, mine.value ?? remixTake(r))
  if (!song) return
  const snap = { style: r.style, kit: r.kit, bgMode: 'manual' as const, fx: entry?.fx ?? { filter: 1, space: 0, warmth: engine.snapshot().fx.warmth }, song }
  const url = shareUrl(`${location.origin}/estudio`, await encodeShare(snap, r.title))
  try {
    if (navigator.share) await navigator.share({ title: r.title, url })
    else {
      await navigator.clipboard.writeText(url)
      linkNote.value = t('lab.remix.linkCopied')
    }
  } catch {
    linkNote.value = t('lab.remix.linkFail')
  }
  setTimeout(() => (linkNote.value = ''), 3500)
}

// ── escuchar y compartir ──
async function listen(take: TakeBar[]) {
  const r = remix.value
  if (!r) return
  const song = songFromTake(r, take)
  if (!song) return
  listenScene.value = makePulso(songTimeline(song, r.style), r.title, PULSO_COMPACT)
  mode.value = 'escuchar'
  engine.stop()
  engine.setSong(song)
  await engine.play()
}
const listenOriginal = () => (remix.value ? listen(remixTake(remix.value)) : undefined)
const listenMine = () => (mine.value ? listen(mine.value) : undefined)
const exporter = useVideoExport(() => stage.value?.videoSource() ?? null)
const video = useVideoState()
// guardar el audio del remix original en MP3 (spec 054): suena entero, desde el principio, en tiempo real
const audioExp = useAudioExport()
const audio = useAudioExportState()
async function exportMp3() {
  const r = remix.value
  if (!r) return
  const song = songFromTake(r, remixTake(r))
  if (!song) return
  listenScene.value = makePulso(songTimeline(song, r.style), r.title, PULSO_COMPACT)
  mode.value = 'escuchar'
  await audioExp.start(song, r.title)
}
// al acabar (o fallar), la pantalla vuelve a poder tocarse
watch(() => audio.phase, async (p) => {
  if ((p === 'encoding' || p === 'done' || p === 'error' || p === 'idle') && mode.value === 'escuchar') {
    mode.value = 'actuar'
    await engine.clearAll()
  }
})
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
  // con el zoom, tocar la gota pequeña = zambullirse en la siguiente parte
  if (zoomOn.value && remix.value && remix.value.parts.length > 1 && hitsNext(x, y, C, C, R0, lastScale)) {
    void goPart(remix.value.parts[(visIndex.value + 1) % remix.value.parts.length]!.name)
    return
  }
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
    g.font = `400 ${fontPx(24, f.scale)}px system-ui, sans-serif`
    g.fillText(t('lab.remix.listening'), C, C)
    return
  }
  if (!cur.value) return
  const queued = shown.value !== part.value
  g.beginPath()
  g.arc(C, C, 62 + (f.beat ? 6 : 0), 0, 7)
  g.strokeStyle = '#fff'
  g.globalAlpha = queued && Math.floor(f.t * 4) % 2 ? 0.3 : 1
  g.lineWidth = 3
  g.stroke()
  g.globalAlpha = 1
  g.fillStyle = '#fff'
  g.font = `500 ${fontPx(26, f.scale)}px system-ui, sans-serif`
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
    g.font = `500 ${fontPx(21, f.scale)}px system-ui, sans-serif`
    g.fillText(t(`lab.remix.layers.${l.key}`, l.label), x, y)
  })
  if (rec.value) {
    g.beginPath()
    g.arc(34, 34, 9, 0, 7)
    g.fillStyle = '#ff4d6d'
    g.fill()
    g.fillStyle = 'rgba(255,255,255,.8)'
    g.font = `400 ${fontPx(20, f.scale)}px system-ui, sans-serif`
    g.textAlign = 'left'
    g.fillText(`${recBars.value}/${plan.value.maxBars}${rec.value.endBar !== null ? ' · final' : ''}`, 52, 34)
  }
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const phrase = computed(() => (remix.value && view.value === 'player' ? t(auto.value ? 'lab.remix.phraseAuto' : 'lab.remix.phrase') : t('lab.remix.pick')))
</script>

<template>
  <LabShell :title="view === 'player' && remix ? remix.title : t('lab.screens.remixes.title')" :phrase="phrase" hide-style bare @back="emit('back')" @style="() => {}" @play="remix ? goPart(part) : undefined" @stop="lab.stopAll()">
    <template #header>
      <div v-if="remix && view === 'player'" class="flex items-center gap-1">
        <button class="grid h-11 w-11 place-items-center text-white/70" :aria-label="t('share.title')" data-share-open @click="shareOpen = true"><ShareIcon /></button>
        <button class="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-lg" :aria-label="t('lab.remix.more')" aria-haspopup="dialog" data-more @click="menuOpen = true">⋯</button>
      </div>
    </template>
    <!-- la biblioteca (spec 051): buscador, filtros por estilo y una fila por remix con su carátula -->
    <div v-if="view === 'lista'" class="pb-28" data-library>
      <input
        v-model="query"
        type="search"
        enterkeyhint="search"
        autocomplete="off"
        class="h-11 w-full rounded-xl border border-white/20 bg-white/5 px-4 text-base text-white placeholder:text-white/40"
        :placeholder="t('lab.remix.search')"
        :aria-label="t('lab.remix.search')"
        data-search
      />
      <div class="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1" role="group" aria-label="estilo" data-style-chips>
        <button class="min-h-11 shrink-0 rounded-full border px-4 text-sm" :class="styleFilter === 'todos' ? 'border-[#F496BC] text-white' : 'border-white/20 text-white/60'" :aria-pressed="styleFilter === 'todos'" @click="styleFilter = 'todos'">{{ t('lab.remix.all') }}</button>
        <button v-for="c in chips" :key="c.key" class="min-h-11 shrink-0 rounded-full border px-4 text-sm" :class="styleFilter === c.key ? 'border-[#F496BC] text-white' : 'border-white/20 text-white/60'" :aria-pressed="styleFilter === c.key" @click="styleFilter = c.key">{{ c.label }}</button>
      </div>
      <div v-for="g in groups" :key="g.id" class="mt-4 grid grid-cols-1 gap-2">
        <h2 class="text-xs uppercase tracking-wide text-white/40">{{ g.label }}</h2>
        <button v-for="r in g.items" :key="r.id" class="flex w-full min-w-0 items-center gap-3 rounded-2xl border bg-white/5 p-3 text-left" :class="remix?.id === r.id ? 'border-[#F496BC]/60' : 'border-white/10'" :data-remix="r.id" @click="pick(r)">
          <LabCover :bars="coverOf(r)" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-base" :class="remix?.id === r.id ? 'text-[#F496BC]' : 'text-white'">{{ r.title }}</span>
            <span class="block truncate text-sm text-white/60">{{ rowSub(r) }}</span>
          </span>
          <span class="shrink-0 text-xs text-white/40">{{ fmtDuration(remixSeconds(r)) }}</span>
        </button>
      </div>
      <p v-if="!groups.length" class="mt-6 text-sm text-white/50" role="status" data-no-results>{{ t('lab.remix.noResults') }}</p>
    </div>
    <template v-else>
      <!-- el reproductor (spec 052): «⌄» a la biblioteca (sin parar el sonido), compositor · tonalidad · estilo, el lienzo y el transporte -->
      <div class="flex items-center gap-3">
        <button class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 text-lg" :aria-label="t('lab.remix.library')" data-library-back @click="showLibrary">⌄</button>
        <p class="min-w-0 truncate text-sm text-white/60">{{ remixSub }}</p>
      </div>
      <div class="mt-2">
        <LabStage v-if="vista === 'circulos'" ref="stage" :draw="drawStage" @down="down" />
        <LabPulso v-else ref="stage" :scene="pulsoScene" />
      </div>
      <div class="mt-3 flex items-center justify-center gap-6" data-transport>
        <button class="grid h-12 w-12 place-items-center rounded-full border border-white/20 text-white/80" :aria-label="t('lab.remix.prev')" data-prev @click="skip(-1)">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zM20 6v12L9.5 12z" /></svg>
        </button>
        <button class="grid h-16 w-16 place-items-center rounded-full border-2 border-white text-white" :aria-label="engine.playing.value ? t('app.stopAll') : t('app.play')" data-play @click="miniToggle">
          <svg viewBox="0 0 24 24" class="h-7 w-7" fill="currentColor" aria-hidden="true"><path v-if="engine.playing.value" d="M7 7h10v10H7z" /><path v-else d="M8 5v14l11-7z" /></svg>
        </button>
        <button class="grid h-12 w-12 place-items-center rounded-full border border-white/20 text-white/80" :aria-label="t('lab.remix.next')" data-next @click="skip(1)">
          <svg viewBox="0 0 24 24" class="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M16 6h2v12h-2zM4 6l10.5 6L4 18z" /></svg>
        </button>
      </div>
    </template>
    <!-- el mini reproductor: con un remix cargado y en la biblioteca, una barra fija abajo; tocarla vuelve al reproductor; ▶/■ para o pone a sonar sin salir de la lista -->
    <div v-if="remix && view === 'lista'" class="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[460px] border-t border-white/15 bg-black/95 px-3 pt-3 backdrop-blur" style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom))" data-mini-player>
      <div class="flex items-center gap-3">
        <button class="flex min-w-0 flex-1 items-center gap-3 text-left" :aria-label="t('lab.remix.openPlayer')" @click="view = 'player'">
          <LabCover :bars="coverOf(remix)" :size="44" />
          <span class="min-w-0">
            <span class="block truncate text-sm text-white">{{ remix.title }}</span>
            <span class="block truncate text-xs text-white/50">{{ shown }}</span>
          </span>
        </button>
        <button class="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/30 text-lg" :aria-label="engine.playing.value ? t('app.stopAll') : t('app.play')" data-mini-play @click="miniToggle">{{ engine.playing.value ? '■' : '▶' }}</button>
      </div>
    </div>
    <ShareSheet v-if="remix && view === 'player'" v-model:open="shareOpen" :build="buildShare" :title="remix.title" :has-voice="hasVoiceLoops(remix.song)" />
    <!-- la hoja «⋯» (spec 052): los extras, fuera de la pantalla principal. Con la hoja cerrada los botones siguen en el DOM (`v-show`) -->
    <div v-if="remix && view === 'player'" v-show="menuOpen" class="fixed inset-0 z-20" data-more-sheet>
      <div class="absolute inset-0 bg-black/60" @click="menuOpen = false" />
      <div class="absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] w-full max-w-[460px] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#0f0f12] px-4 pt-3" style="padding-bottom: max(1rem, env(safe-area-inset-bottom))" role="dialog" aria-modal="true" :aria-label="t('lab.remix.more')">
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <h2 class="text-xs uppercase tracking-wide text-white/40">{{ t('lab.remix.sheetMine') }}</h2>
        <div class="mt-2 grid gap-2">
          <button v-if="!rec" class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base disabled:opacity-40" :disabled="mode !== 'actuar'" @click="run(startRec)">{{ t('lab.remix.rec') }}</button>
          <button v-if="mine && !rec" class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base" @click="run(listenMine)">{{ t('lab.remix.mine', { time: fmt(mine.length * barSeconds(remix.style, remix.song.bpm)) }) }}</button>
          <button v-if="mine && !rec" class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base disabled:opacity-40" :disabled="video.phase === 'recording' || video.phase === 'waiting'" @click="run(makeVideo)">{{ t('lab.remix.video') }}</button>
        </div>
        <h2 class="mt-5 text-xs uppercase tracking-wide text-white/40">{{ t('lab.remix.sheetShare') }}</h2>
        <div class="mt-2 grid gap-2">
          <button class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base" @click="run(listenOriginal)">{{ t('lab.remix.original') }}</button>
          <button class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base disabled:opacity-40" :disabled="audio.phase === 'recording' || audio.phase === 'encoding' || !!rec" data-audio-export @click="run(exportMp3)">{{ t('lab.remix.audio') }}</button>
          <button class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base" data-share-link @click="run(shareLink)">{{ t('lab.remix.link') }}</button>
          <button class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base" data-open-studio @click="run(openInStudio)">{{ t('lab.remix.openStudio') }}</button>
          <button class="flex min-h-12 w-full items-center rounded-2xl border border-white/15 bg-white/5 px-4 text-left text-base" data-remix-list @click="run(showLibrary)">{{ t('lab.remix.other') }}</button>
        </div>
        <h2 class="mt-5 text-xs uppercase tracking-wide text-white/40">{{ t('lab.remix.sheetOptions') }}</h2>
        <div class="mt-2 flex flex-wrap gap-2" role="group" aria-label="opciones">
          <button class="min-h-11 rounded-full border px-4 text-sm" :class="auto ? 'border-[#F496BC] text-white' : 'border-white/20 text-white/60'" data-auto-toggle :aria-pressed="auto" @click="toggleAuto">{{ auto ? t('lab.remix.autoOn') : t('lab.remix.autoOff') }}</button>
          <button class="min-h-11 rounded-full border px-4 text-sm" :class="vista === 'pulso' ? 'border-[#F496BC] text-white' : 'border-white/20 text-white/60'" data-vista-toggle :aria-pressed="vista === 'pulso'" @click="toggleVista">{{ vista === 'pulso' ? t('lab.remix.vistaPulso') : t('lab.remix.vistaCirculos') }}</button>
          <button class="min-h-11 rounded-full border px-4 text-sm" :class="zoomOn ? 'border-[#F496BC] text-white' : 'border-white/20 text-white/60'" :aria-label="t('lab.remix.zoomAria')" :aria-pressed="zoomOn" data-zoom-toggle @click="toggleZoom">{{ zoomOn ? t('lab.remix.zoomOn') : t('lab.remix.zoomOff') }}</button>
        </div>
        <button class="mt-5 min-h-12 w-full rounded-2xl border border-white/25 text-base text-white" data-sheet-close @click="menuOpen = false">{{ t('lab.remix.close') }}</button>
      </div>
    </div>
    <template #extra>
      <template v-if="remix && view === 'player'">
        <!-- lo que está en marcha, a la vista con el menú cerrado: la grabación (con su Terminar) y los avisos del vídeo y del enlace -->
        <div v-if="rec" class="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[#ff4d6d]/60 px-4 py-2" data-rec-status>
          <span class="text-sm text-white/80"><span class="text-[#ff4d6d]">●</span> {{ recBars }}/{{ plan.maxBars }}<span v-if="rec.endBar !== null"> · final</span></span>
          <button class="min-h-11 rounded-lg border border-[#ff4d6d] px-4 text-sm" :disabled="rec.endBar !== null" @click="endRec">{{ rec.endBar !== null ? t('lab.remix.finishing') : t('lab.remix.finish') }}</button>
        </div>
        <p v-if="openError" class="mt-2 text-sm text-red-300" role="alert">{{ openError }}</p>
        <p v-if="linkNote" class="mt-2 text-sm text-white/70" role="status" data-link-note>{{ linkNote }}</p>
        <p v-if="video.phase === 'waiting' || video.phase === 'recording'" class="mt-2 text-sm text-white/60" role="status">{{ t('lab.remix.videoRec', { a: video.elapsed.toFixed(0), b: video.total.toFixed(0) }) }} <button class="ml-2 underline" @click="exporter.stop()">{{ t('lab.remix.stop') }}</button></p>
        <p v-else-if="video.phase === 'error'" class="mt-2 text-sm text-red-300" role="alert">{{ video.message }}</p>
        <p v-if="audio.phase === 'recording'" class="mt-2 text-sm text-white/60" role="status" data-audio-status>{{ t('lab.remix.audioRec', { a: audio.elapsed.toFixed(0), b: audio.total.toFixed(0) }) }} <button class="ml-2 underline" @click="audioExp.cancel()">{{ t('lab.remix.stop') }}</button></p>
        <p v-else-if="audio.phase === 'encoding'" class="mt-2 text-sm text-white/60" role="status" data-audio-status>{{ t('lab.remix.audioEnc') }} {{ audio.total ? Math.round((audio.elapsed / audio.total) * 100) : 0 }} %</p>
        <p v-else-if="audio.phase === 'error'" class="mt-2 text-sm text-red-300" role="alert" data-audio-status>{{ audio.message }}</p>
        <div v-else-if="audio.phase === 'done'" class="mt-2 flex gap-2 text-sm" data-audio-done>
          <button class="min-h-11 rounded-lg border border-white/25 px-4" @click="audioExp.save(true)">{{ t('lab.remix.audioShare') }}</button>
          <button class="min-h-11 rounded-lg border border-white/25 px-4" data-audio-save @click="audioExp.save(false)">{{ t('lab.remix.audioSave') }}</button>
        </div>
        <div v-else-if="video.phase === 'done'" class="mt-2 flex gap-2 text-sm">
          <button class="min-h-11 rounded-lg border border-white/25 px-4" @click="exporter.save(true)">{{ t('lab.remix.share') }}</button>
          <button class="min-h-11 rounded-lg border border-white/25 px-4" @click="exporter.save(false)">{{ t('lab.remix.save') }}</button>
        </div>
        <p class="mt-3 text-sm text-white/50">{{ phrase }}</p>
        <!-- las partes se eligen con `click` (no con `pointerdown`): si el dedo empieza a desplazar la pantalla sobre un botón, el navegador cancela el toque y no cambia de parte -->
        <div class="mt-3 grid grid-cols-2 gap-2" aria-label="partes">
          <!-- el borde es el fondo del botón (2 px de relleno alrededor de un centro negro): el de la parte que suena se ilumina con sus compases (`progressBg`); la que va a entrar parpadea; las demás, tenues -->
          <button
            v-for="pt in remix.parts"
            :key="pt.name"
            :data-part="pt.name"
            class="touch-manipulation rounded-2xl p-[2px] text-lg"
            :class="mode === 'actuar' && part === pt.name ? (shown === pt.name ? (engine.playing.value ? '' : 'bg-white') : 'animate-pulse bg-white/70') : 'bg-white/15'"
            :style="mode === 'actuar' && part === pt.name && shown === pt.name && engine.playing.value ? { background: progressBg } : undefined"
            @click="goPart(pt.name)"
          >
            <span class="block rounded-[14px] bg-black px-4 py-5" :class="mode === 'actuar' && part === pt.name ? 'text-white' : 'text-white/45'">{{ pt.name }}<span v-if="mode === 'actuar' && part === pt.name && shown !== pt.name" class="ml-2 text-xs text-white/50">{{ t('lab.remix.entering') }}</span></span>
          </button>
        </div>
        <div class="mt-4"><LabDj @start="goPart(part)" /></div>
      </template>
    </template>
  </LabShell>
</template>

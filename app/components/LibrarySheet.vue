<script setup lang="ts">
// Remixes (spec 006 + unificación 2026-11-16): «Mis remixes» (guardar el de ahora con nombre automático editable, y abrir los guardados) y, debajo, los remixes «de serie»
// (los de dominio público del Estudio, spec 008). Una sola lista; los datos siguen en la misma clave de siempre (`coderbeats:library:v1`).
import { encodeShare, shareUrl } from '~/lib/shareLink'
import type { Song } from '~/lib/cells'
import { kitFromSaved } from '~/lib/constants'
import type { KitId, StyleId } from '~/lib/types'
import { STYLES } from '~/lib/constants'
import { barSeconds, LAB_REMIXES, remixBars as labBars, type LabRemix } from '~/lib/labRemixes'
import { remixBars, REMIXES, type Remix } from '~/lib/remixes'
import { addSong, autoName, dateText, isEmptySong, isUnsaved, makeSaved, newId, replaceSong, filterEntries, groupByStyle, sortedEntries, summaryText, type Entry } from '~/lib/library'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ preview: [{ song: Song; style: StyleId; kit: KitId; title: string }]; created: [] }>()
/** «👁 Previsualizar» una guardada: se construye sola sin abrirla (al acabar, lo que tenías sigue igual) */
function previewEntry(e: Entry) {
  if (!e.saved) return
  open.value = false
  emit('preview', { song: e.saved.song, style: e.saved.style, kit: (kitFromSaved(e.saved.kit) ?? 'electro') as KitId, title: e.saved.name })
}
const engine = useAudioEngine()
const { t } = useI18n()
const library = useLibrary()
const { lib, error, currentId, removed } = library

/** el nombre del campo de guardar: el automático (estilo + fecha), editable */
const name = ref('')
const justSaved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null

const allEntries = computed(() => sortedEntries(lib.value))
/** el buscador y el «árbol» por estilos (spec 006): con pocas canciones no hace falta */
const query = ref('')
const entries = computed(() => filterEntries(allEntries.value, query.value))
const groups = computed(() => (allEntries.value.length > 4 ? groupByStyle(entries.value) : null))
/** «🔗» compartir: el enlace lleva solo datos (nunca código); se copia o se comparte con la hoja del sistema */
const linkNote = ref('')
async function shareEntry(e: Entry) {
  if (!e.saved) return
  const url = shareUrl(`${location.origin}${location.pathname}`, await encodeShare(e.saved, e.saved.name))
  try {
    if (navigator.share) await navigator.share({ title: e.saved.name, url })
    else {
      await navigator.clipboard.writeText(url)
      linkNote.value = 'Enlace copiado'
    }
  } catch {
    linkNote.value = url.length > 2000 ? 'No se pudo copiar el enlace (es muy largo)' : 'No se pudo compartir'
  }
  setTimeout(() => (linkNote.value = ''), 3500)
}
/** Abre un remix de serie: reemplaza lo de ahora (avisa si no está guardado) y no queda «viniendo de» ninguno guardado. */
async function openSerie(r: Remix) {
  if (isUnsaved(engine.snapshot(), reference.value) && !(await askConfirm(`¿Abrir el remix «${r.title}»? Lo que tienes ahora no está guardado.`))) return
  await engine.openRemix(r)
  library.setCurrent(null)
  open.value = false
}
/** Abre el remix principal (≈ 1 min, el mismo que se actúa en el Laboratorio). */
async function openMain(r: LabRemix) {
  if (isUnsaved(engine.snapshot(), reference.value) && !(await askConfirm(`¿Abrir el remix «${r.title}»? Lo que tienes ahora no está guardado.`))) return
  await engine.openSaved(makeSaved({ style: r.style, kit: r.kit, bgMode: 'manual', fx: { filter: 1, space: 0, warmth: engine.snapshot().fx.warmth }, song: r.song }, `serie-${r.id}`, r.title, new Date()))
  library.setCurrent(null)
  open.value = false
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
// ── + Nueva canción (spec 027): desde cero, eligiendo estilo y tempo; queda guardada en Mis canciones y se abre vacía ──
const creating = ref(false)
const newStyle = ref<StyleId>('hiphop90')
const newBpm = ref(90)
const newStyles = computed(() => Object.values(STYLES).filter((s) => !s.legacy))
watch(newStyle, (id) => (newBpm.value = STYLES[id].bpm))
async function createSong() {
  if (isUnsaved(engine.snapshot(), reference.value) && !(await askConfirm(t('remixes.newConfirm'), t('remixes.newStart')))) return
  const bpm = Math.min(200, Math.max(50, Math.round(Number(newBpm.value) || STYLES[newStyle.value].bpm)))
  engine.stop()
  await engine.clearAll()
  await engine.setStyle(newStyle.value)
  engine.setBpm(bpm === STYLES[newStyle.value].bpm ? null : bpm)
  engine.setBackgroundMode('manual')
  engine.setBackgroundManual({ bass: false, chords: false })
  const saved = makeSaved(engine.snapshot(), newId(Date.now()), t('remixes.newName', { style: STYLES[newStyle.value].label }), new Date())
  if (!library.persist(addSong(lib.value, saved))) return
  library.setCurrent(saved.id)
  creating.value = false
  open.value = false
  emit('created')
}
/** la guardada de la que viene lo de ahora (con lo que comparar si está sin guardar) */
const reference = computed(() => lib.value.entries.find((e) => e.id === currentId.value)?.saved ?? null)
const empty = computed(() => isEmptySong(engine.liveSong()))
/** la entrada de la que viene lo de ahora, si sigue en la lista y se puede abrir: se le pueden "guardar cambios" */
const current = computed(() => lib.value.entries.find((e) => e.id === currentId.value && e.saved) ?? null)

watch(open, (o) => {
  if (!o) return
  library.load()
  // si lo de ahora viene de la lista, el campo lleva su nombre (editarlo la renombra al guardar cambios)
  name.value = current.value ? current.value.name : autoName(engine.style.value, new Date())
  justSaved.value = false
  editingId.value = null
})

function flashSaved() {
  justSaved.value = true
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => (justSaved.value = false), 2500)
}

/** Guarda la canción de ahora como una entrada nueva (spec 006, §4.2). */
function saveNew() {
  if (empty.value) return
  const saved = makeSaved(engine.snapshot(), newId(Date.now()), name.value, new Date())
  if (!library.persist(addSong(lib.value, saved))) return
  library.setCurrent(saved.id)
  name.value = saved.name
  flashSaved()
}

/** "Guardar cambios": sustituye la guardada de la que viene lo de ahora, con el nombre del campo. */
function saveChanges() {
  const cur = current.value
  if (empty.value || !cur) return
  const saved = { ...makeSaved(engine.snapshot(), cur.id, name.value || cur.name, new Date()), ...(cur.saved?.lab ? { lab: cur.saved.lab } : {}) }
  if (!library.persist(replaceSong(lib.value, saved))) return
  name.value = saved.name
  flashSaved()
}

/** El botón principal: guardar cambios si viene de la lista; si no, guardar una nueva. */
const save = () => (current.value ? saveChanges() : saveNew())

// renombrar en la fila (✎): Intro y salir del campo lo guardan; Esc lo deja como estaba
const editingId = ref<string | null>(null)
const editName = ref('')
// dentro de un v-for, la referencia es una lista (y solo hay un campo a la vez)
const renameEls = ref<HTMLInputElement[]>([])

async function startRename(e: Entry) {
  if (!e.saved) return
  editingId.value = e.id
  editName.value = e.name
  await nextTick()
  renameEls.value[0]?.focus()
  renameEls.value[0]?.select()
}
function commitRename() {
  const id = editingId.value
  if (!id) return
  editingId.value = null
  library.rename(id, editName.value)
  // si es la de ahora y el campo tenía su nombre, que el campo siga igual
  if (current.value?.id === id) name.value = lib.value.entries.find((x) => x.id === id)?.name ?? name.value
}
function cancelRename() {
  editingId.value = null
}

/** Borrar (✓ con confirmación): sale al momento y se puede deshacer unos segundos. */
async function removeEntry(e: Entry) {
  if (!(await askConfirm(`¿Borrar «${e.name}»? Se puede deshacer unos segundos.`))) return
  library.remove(e.id)
}

/** Abre una guardada (spec 006, §4.3): avisa si lo de ahora no está guardado. */
async function openEntry(e: Entry) {
  if (!e.saved) return
  if (isUnsaved(engine.snapshot(), reference.value) && !(await askConfirm(`¿Abrir «${e.saved.name}»? Tu canción de ahora no está guardada.`))) return
  await engine.openSaved(e.saved)
  library.setCurrent(e.saved.id)
  open.value = false
}
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
        <h2 class="mb-3 text-xs tracking-wide text-neutral-400 uppercase">{{ t('remixes.title') }}</h2>

        <!-- + Nueva canción: estilo y tempo -->
        <div class="mb-4">
          <button v-if="!creating" class="w-full rounded-full border border-white/25 py-2.5 text-white" data-new-song @click="creating = true">{{ t('remixes.newSong') }}</button>
          <form v-else class="grid gap-3 rounded-xl border border-white/15 p-3" data-new-form @submit.prevent="createSong">
            <div class="text-xs text-neutral-400">{{ t('remixes.newTitle') }}</div>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="mr-1 text-xs text-neutral-500">{{ t('remixes.newStyle') }}</span>
              <button v-for="s in newStyles" :key="s.id" type="button" class="rounded-full border px-3 py-1.5 text-xs" :class="newStyle === s.id ? 'border-[#F496BC] text-white' : 'border-white/20 text-white/60'" :data-new-style="s.id" @click="newStyle = s.id as StyleId">{{ s.label }}</button>
            </div>
            <label class="flex items-center gap-2 text-xs text-neutral-400">{{ t('remixes.newTempo') }}
              <input v-model.number="newBpm" type="number" min="50" max="200" class="w-20 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-white" data-new-bpm />
              <span class="text-neutral-500">bpm</span>
            </label>
            <div class="flex gap-2">
              <button type="submit" class="flex-1 rounded-full bg-white py-2 font-medium text-black" data-new-create>{{ t('remixes.newCreate') }}</button>
              <button type="button" class="rounded-full border border-white/20 px-4 py-2" @click="creating = false">{{ t('remixes.newCancel') }}</button>
            </div>
          </form>
        </div>

        <!-- guardar la de ahora, con nombre automático editable -->
        <form class="mb-4 flex items-center gap-2" @submit.prevent="save">
          <input
            v-model="name"
            class="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white"
            maxlength="60"
            aria-label="nombre de la canción"
            :disabled="empty"
          />
          <button type="submit" class="shrink-0 rounded-full bg-white px-4 py-2 font-medium text-black disabled:opacity-40" :disabled="empty">
            {{ justSaved ? 'Guardada' : current ? 'Guardar cambios' : 'Guardar' }}
          </button>
          <button v-if="current" type="button" class="shrink-0 rounded-full border border-white/25 px-3 py-2 text-white disabled:opacity-40" :disabled="empty" @click="saveNew">
            Como nueva
          </button>
        </form>
        <p v-if="current" class="-mt-2 mb-3 text-xs text-neutral-500">Viene de «{{ current.name }}».</p>
        <p v-if="empty" class="-mt-2 mb-3 text-xs text-neutral-500">Aún no hay nada que guardar: graba algo o carga una demo.</p>
        <p v-if="error" class="mb-3 text-xs text-amber-300" role="alert">{{ error }}</p>
        <!-- tras borrar, "↶ deshacer" unos segundos -->
        <p v-if="removed" class="mb-3 flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs text-neutral-300">
          <span class="truncate">«{{ removed.entry.name }}» borrada</span>
          <button class="ml-3 shrink-0 text-white underline" @click="library.undoRemove()">↶ deshacer</button>
        </p>

        <!-- la lista, de la más reciente a la más antigua -->
        <input v-if="allEntries.length > 4" v-model="query" type="search" class="mb-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white" placeholder="Buscar por nombre o estilo" aria-label="buscar en mis canciones" />
        <p v-if="linkNote" class="mb-2 text-xs text-neutral-300" role="status">{{ linkNote }}</p>
        <p v-if="!allEntries.length" class="py-6 text-center text-neutral-500">{{ t('remixes.empty') }}</p>
        <p v-else-if="!entries.length" class="py-6 text-center text-neutral-500">Ningún remix coincide.</p>
        <template v-else>
        <div v-for="g in groups ?? [{ style: 'todas', label: '', entries }]" :key="g.style ?? 'otras'">
        <h3 v-if="groups" class="mt-2 mb-1 text-[11px] tracking-wide text-neutral-500 uppercase">{{ g.label }} · {{ g.entries.length }}</h3>
        <ul class="grid gap-1">
          <li v-for="e in g.entries" :key="e.id" class="flex items-center gap-1">
            <input
              v-if="editingId === e.id"
              ref="renameEls"
              v-model="editName"
              class="min-w-0 flex-1 rounded-lg border border-white/25 bg-black/30 px-3 py-2 text-white"
              maxlength="60"
              aria-label="nuevo nombre"
              @keydown.enter.prevent="commitRename"
              @keydown.esc.prevent="cancelRename"
              @blur="commitRename"
            />
            <button
              v-else-if="e.saved"
              class="min-w-0 flex-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5 active:bg-white/10"
              @click="openEntry(e)"
            >
              <span class="block truncate text-white">{{ e.name }}</span>
              <span class="block truncate text-xs text-neutral-500">{{ summaryText(e.saved) }} · {{ dateText(e.savedAt) }}</span>
            </button>
            <button v-if="e.saved" class="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs" aria-label="previsualizar: la canción se construye sola" @click="previewEntry(e)">👁</button>
            <button v-if="e.saved" class="shrink-0 rounded-full border border-white/15 px-3 py-1 text-xs" aria-label="compartir por enlace (solo datos)" @click="shareEntry(e)">🔗</button>
            <div v-else class="min-w-0 flex-1 rounded-lg px-3 py-2 text-left opacity-60">
              <span class="block truncate text-white">{{ e.name }}</span>
              <span class="block truncate text-xs text-amber-300">no se puede abrir</span>
            </div>
            <button v-if="e.saved && editingId !== e.id" class="shrink-0 rounded-full p-2 text-neutral-400 hover:text-white" aria-label="renombrar" @pointerdown.prevent @click="startRename(e)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 14l1-3.5L11 2.5a1.4 1.4 0 0 1 2 2L5 12.5 2 14zM9.5 4l2.5 2.5" /></svg>
            </button>
            <button class="shrink-0 rounded-full p-2 text-neutral-400 hover:text-white" aria-label="borrar" @click="removeEntry(e)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.5 7v4M9.5 7v4" /></svg>
            </button>
          </li>
        </ul>
        </div>
        </template>

        <!-- los remixes de serie (antes en su propia hoja): el principal de ≈ 1 min y, aparte, la versión larga como archivo -->
        <h3 class="mt-5 mb-1 text-[11px] tracking-wide text-neutral-500 uppercase">{{ t('remixes.serie') }}</h3>
        <ul class="grid gap-1" data-remixes-serie>
          <li v-for="r in LAB_REMIXES" :key="r.id" class="flex items-center gap-2 rounded-lg px-3 py-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-white">{{ r.title }}</p>
              <p class="truncate text-xs text-neutral-500">{{ r.composer }} · {{ STYLES[r.style].label }} · {{ r.key }} · {{ r.parts.length }} partes · {{ mmss(labBars(r) * barSeconds(r.style)) }}</p>
            </div>
            <button class="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs" @click="openMain(r)">{{ t('remixes.open') }}</button>
          </li>
        </ul>
        <details class="mt-3" data-remixes-archivo>
          <summary class="cursor-pointer text-xs text-neutral-500">{{ t('remixes.archive') }}</summary>
          <ul class="mt-1 grid gap-1">
            <li v-for="r in REMIXES" :key="r.id" class="flex items-center gap-2 rounded-lg px-3 py-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-white">{{ r.title }}</p>
                <p class="truncate text-xs text-neutral-500">{{ r.composer }} · {{ remixBars(r) }} compases</p>
              </div>
              <button class="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs" @click="openSerie(r)">{{ t('remixes.open') }}</button>
            </li>
          </ul>
        </details>
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
  transform: translateY(100%);
}
</style>

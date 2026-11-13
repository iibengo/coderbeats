<script setup lang="ts">
// Mis canciones (spec 006): guardar la de ahora con nombre automático editable, y abrir las guardadas.
import { addSong, autoName, dateText, isEmptySong, isUnsaved, makeSaved, newId, sortedEntries, summaryText, type Entry } from '~/lib/library'

const open = defineModel<boolean>('open', { required: true })
const engine = useAudioEngine()
const library = useLibrary()
const { lib, error, currentId } = library

/** el nombre del campo de guardar: el automático (estilo + fecha), editable */
const name = ref('')
const justSaved = ref(false)
let savedTimer: ReturnType<typeof setTimeout> | null = null

const entries = computed(() => sortedEntries(lib.value))
/** la guardada de la que viene lo de ahora (con lo que comparar si está sin guardar) */
const reference = computed(() => lib.value.entries.find((e) => e.id === currentId.value)?.saved ?? null)
const empty = computed(() => isEmptySong(engine.liveSong()))

watch(open, (o) => {
  if (!o) return
  library.load()
  name.value = autoName(engine.style.value, new Date())
  justSaved.value = false
})

/** Guarda la canción de ahora como una entrada nueva (spec 006, §4.2). */
function save() {
  if (empty.value) return
  const saved = makeSaved(engine.snapshot(), newId(Date.now()), name.value, new Date())
  if (!library.persist(addSong(lib.value, saved))) return
  library.setCurrent(saved.id)
  name.value = autoName(engine.style.value, new Date())
  justSaved.value = true
  if (savedTimer) clearTimeout(savedTimer)
  savedTimer = setTimeout(() => (justSaved.value = false), 2500)
}

/** Abre una guardada (spec 006, §4.3): avisa si lo de ahora no está guardado. */
async function openEntry(e: Entry) {
  if (!e.saved) return
  if (isUnsaved(engine.snapshot(), reference.value) && !confirm(`¿Abrir «${e.saved.name}»? Tu canción de ahora no está guardada.`)) return
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
        <h2 class="mb-3 text-xs tracking-wide text-neutral-400 uppercase">Mis canciones</h2>

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
            {{ justSaved ? 'Guardada' : 'Guardar' }}
          </button>
        </form>
        <p v-if="empty" class="-mt-2 mb-3 text-xs text-neutral-500">Aún no hay nada que guardar: graba algo o carga una demo.</p>
        <p v-if="error" class="mb-3 text-xs text-amber-300" role="alert">{{ error }}</p>

        <!-- la lista, de la más reciente a la más antigua -->
        <p v-if="!entries.length" class="py-6 text-center text-neutral-500">Aún no has guardado ninguna canción.</p>
        <ul v-else class="grid gap-1">
          <li v-for="e in entries" :key="e.id">
            <button
              v-if="e.saved"
              class="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/5 active:bg-white/10"
              @click="openEntry(e)"
            >
              <span class="block truncate text-white">{{ e.name }}</span>
              <span class="block truncate text-xs text-neutral-500">{{ summaryText(e.saved) }} · {{ dateText(e.savedAt) }}</span>
            </button>
            <div v-else class="w-full rounded-lg px-3 py-2 text-left opacity-60">
              <span class="block truncate text-white">{{ e.name }}</span>
              <span class="block truncate text-xs text-amber-300">no se puede abrir</span>
            </div>
          </li>
        </ul>
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

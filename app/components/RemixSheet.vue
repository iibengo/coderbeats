<script setup lang="ts">
// Remixes (spec 008): canciones de demo que mezclan un estilo con una melodía de dominio público.
import { STYLES } from '~/lib/constants'
import { isUnsaved } from '~/lib/library'
import { remixBars, REMIXES, type Remix } from '~/lib/remixes'

const open = defineModel<boolean>('open', { required: true })
const engine = useAudioEngine()
const library = useLibrary()
const { lib, currentId } = library

/** la guardada de la que viene lo de ahora (para avisar si lo de ahora no está guardado, como al abrir una) */
const reference = computed(() => lib.value.entries.find((e) => e.id === currentId.value)?.saved ?? null)
watch(open, (o) => o && library.load())

/** Abre un remix: reemplaza la canción de ahora (avisa si no está guardada) y no queda "viniendo de" ninguna guardada. */
async function openRemix(r: Remix) {
  if (isUnsaved(engine.snapshot(), reference.value) && !confirm(`¿Abrir el remix «${r.title}»? Tu canción de ahora no está guardada.`)) return
  await engine.openRemix(r)
  library.setCurrent(null)
  open.value = false
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="open" class="fixed inset-0 z-20 flex items-end" @pointerdown.self="open = false">
      <div class="absolute inset-0 bg-black/50" @click="open = false" />
      <section
        class="relative max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#121217] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm"
        aria-label="remixes"
        @pointerdown.stop
      >
        <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
        <h2 class="text-xs tracking-wide text-neutral-400 uppercase">Remixes</h2>
        <p class="mb-3 mt-1 text-xs text-neutral-500">Un estilo con una melodía conocida de dominio público. Se abre como cualquier canción: puedes editarla y guardarla.</p>

        <ul class="grid gap-3">
          <li v-for="r in REMIXES" :key="r.id" class="rounded-xl border border-white/10 bg-black/20 p-3">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-base text-white">{{ r.title }}</p>
                <p class="text-xs text-neutral-400">{{ r.composer }} · {{ r.years }}</p>
                <p class="text-xs text-neutral-500">{{ STYLES[r.style].label }} · {{ r.key }} · {{ remixBars(r) }} compases</p>
              </div>
              <button class="shrink-0 rounded-full bg-white px-4 py-2 font-medium text-black" @click="openRemix(r)">Abrir</button>
            </div>
            <ol class="mt-2 grid gap-0.5 text-xs text-neutral-400">
              <li v-for="(c, i) in r.info.cells" :key="c.name">
                <span class="text-neutral-500 tabular-nums">{{ i + 1 }}</span>
                <span class="text-neutral-200"> {{ c.name }}</span>
                <span class="text-neutral-500"> · {{ c.turns }}</span> — {{ c.text }}
              </li>
            </ol>
            <p class="mt-2 text-[11px] text-neutral-500">{{ r.publicDomain }}</p>
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

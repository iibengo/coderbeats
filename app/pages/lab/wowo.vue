<script setup lang="ts">
/**
 * Lab del wowo (spec 008, §9; solo desarrollo): la prueba de oído del "wowo" en **Strudel puro**, con las células del
 * remix del Dies Irae que lo llevan. Es el código que la app muestra y copia: se pega en strudel.cc y suena igual.
 *
 * `npm run dev` → http://localhost:3000/lab/wowo
 */
import { computed, ref } from 'vue'
import { remixById } from '~/lib/remixes'
import { songCode, type SongState } from '~/lib/song'

definePageMeta({ ssr: false })

const remix = remixById('dies-irae-techno')!
const song = remix.build()
const name = (n: string) => song.cells.find((c) => c.name === n)!

/** El código de una canción sin fondo ni extras: solo las células, con su filtro y su wowo. */
const codeOf = (cells: string[]): string => {
  const ids = cells.map((n) => name(n).id)
  return songCode(
    {
      loops: [], style: remix.style, kit: remix.kit, background: { mode: 'manual', parts: { bass: false, chords: false } },
      metronome: false, fx: { filter: 1, space: 0, warmth: 0 },
      cells: { list: song.cells, order: ids, window: [] },
    } satisfies SongState,
    'display',
  )
}

const VARIANTS = [
  { id: 'tema', title: '1 · Entra el tema (acid)', cells: ['Entra el tema'], note: 'lpq 8, lpenv 3: el filtro sube vuelta a vuelta (500 → 3 600 Hz) y cada golpe de la melodía lo abre. Es la célula del remix.' },
  { id: 'build', title: '2 · Build (house)', cells: ['Build'], note: 'Sin bombo ni bajo: la caja en roll y el filtro abriéndose de 1 400 a 8 000 Hz. Donde mejor se oye el barrido.' },
  { id: 'sin', title: '3 · Lo mismo sin wowo (de oído)', cells: [], note: 'La prueba de oído: la célula de la entrada sin lpq ni lpenv, para comparar.' },
  { id: 'juntos', title: '4 · Tema + Build, seguidos (16 compases)', cells: ['Entra el tema', 'Build'], note: 'La entrada completa hasta el drop.' },
] as const

const chosen = ref<(typeof VARIANTS)[number]>(VARIANTS[0])
const plain = computed(() => codeOf([...chosen.value.cells]).replace(/\n( *)\)\.lpf\([^)]*\)(\.lpq\([^)]*\)\.lpenv\([^)]*\)\.lpa\([^)]*\)\.lpd\([^)]*\))?\],/g, '\n$1)],'))
const code = computed(() => (chosen.value.id === 'sin' ? plain.value : codeOf([...chosen.value.cells])))
const copied = ref(false)
const copy = async () => {
  try {
    await navigator.clipboard.writeText(code.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1200)
  } catch {
    /* sin permiso: se copia a mano */
  }
}
</script>

<template>
  <div class="min-h-dvh bg-neutral-950 p-4 text-neutral-200">
    <h1 class="text-lg font-semibold">Lab · el wowo</h1>
    <p class="mt-1 max-w-2xl text-xs text-neutral-400">
      El código que la app muestra y copia. Pégalo en <a class="underline" href="https://strudel.cc" target="_blank" rel="noreferrer">strudel.cc</a>. En la
      app todavía no suena dentro de la célula (lo de Strudel no se interpola dentro de los golpes): esto es la prueba de oído para decidir.
    </p>
    <div class="mt-4 flex flex-wrap gap-2">
      <button
        v-for="v in VARIANTS"
        :key="v.id"
        class="rounded-full border px-3 py-1 text-xs"
        :class="chosen.id === v.id ? 'border-amber-300 bg-amber-300/15 text-amber-200' : 'border-white/10 text-neutral-400'"
        @click="chosen = v"
      >
        {{ v.title }}
      </button>
    </div>
    <p class="mt-2 text-xs italic text-neutral-400">{{ chosen.note }}</p>
    <button class="mt-3 rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/5" @click="copy">{{ copied ? 'copiado ✓' : 'copiar' }}</button>
    <pre class="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed">{{ code }}</pre>
  </div>
</template>

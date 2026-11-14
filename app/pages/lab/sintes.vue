<script setup lang="ts">
/**
 * Lab de sintes (spec 010, §6; solo desarrollo): las variantes de lead, pad y bajo para elegir de oído. Es Strudel puro:
 * se copia y se pega en strudel.cc. **No cambia el sonido de la app**; lo que se elija pasa a `SYNTH_SOUND` / al fondo del estilo.
 *
 * `npm run dev` → http://localhost:3000/lab/sintes
 */
import { computed, ref } from 'vue'
import { SYNTH_VARIANTS, variantDemoCode, type SynthRole } from '~/lib/synthVariants'

definePageMeta({ ssr: false })

const ROLES: { id: SynthRole; title: string }[] = [
  { id: 'lead', title: 'Lead' },
  { id: 'pad', title: 'Pad' },
  { id: 'bass', title: 'Bajo' },
]
const role = ref<SynthRole>('lead')
const list = computed(() => SYNTH_VARIANTS.filter((v) => v.role === role.value))
const copied = ref('')
async function copy(id: string, code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copied.value = id
    setTimeout(() => (copied.value = ''), 1200)
  } catch {
    /* sin permiso: se copia a mano */
  }
}
</script>

<template>
  <div class="min-h-dvh bg-neutral-950 p-4 text-neutral-200">
    <h1 class="text-lg font-semibold">Lab · sintes</h1>
    <p class="mt-1 max-w-2xl text-xs text-neutral-400">
      Variantes de lead, pad y bajo en Strudel puro. Pégalas en <a class="underline" href="https://strudel.cc" target="_blank" rel="noreferrer">strudel.cc</a> y
      compáralas con «el de hoy». La app sigue sonando como siempre hasta que elijas una.
    </p>
    <div class="mt-4 flex gap-2">
      <button
        v-for="r in ROLES"
        :key="r.id"
        class="rounded-full border px-3 py-1 text-xs"
        :class="role === r.id ? 'border-amber-300 bg-amber-300/15 text-amber-200' : 'border-white/10 text-neutral-400'"
        @click="role = r.id"
      >
        {{ r.title }}
      </button>
    </div>
    <section v-for="v in list" :key="v.id" class="mt-4 max-w-3xl">
      <div class="flex items-center gap-3">
        <h2 class="text-sm font-medium">{{ v.title }}</h2>
        <button class="rounded-lg border border-white/10 px-3 py-1 text-xs hover:bg-white/5" @click="copy(v.id, variantDemoCode(v))">{{ copied === v.id ? 'copiado ✓' : 'copiar' }}</button>
      </div>
      <p class="mt-1 text-xs italic text-neutral-400">{{ v.note }}</p>
      <pre class="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed">{{ variantDemoCode(v) }}</pre>
    </section>
  </div>
</template>

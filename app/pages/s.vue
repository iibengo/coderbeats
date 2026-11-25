<script setup lang="ts">
/**
 * La tarjeta de una canción compartida (spec 061, paso 2): `/s#r=<id>` o `/s#c=<datos>` (+ `&f=<firma>`). Una tarjeta, un ▶ grande (en iOS el audio exige un toque) y, debajo,
 * «Abrir en coderbeats». Todo en el fragmento: no llega a ningún servidor. Solo datos: lo recibido se valida (`parseCardHash`, `resolveCard`) y nunca se evalúa.
 */
import { ACCENT } from '~/lib/palette'
import { STYLES } from '~/lib/constants'
import { cardHash, cardMeta, parseCardHash, resolveCard, type CardData, type CardRef } from '~/lib/shareCard'

definePageMeta({ ssr: false })
const { t } = useI18n()
useHead({ title: 'coderbeats', meta: [{ name: 'robots', content: 'noindex' }] })

const lab = useLab()
const engine = useAudioEngine()
const state = ref<'loading' | 'ready' | 'invalid'>('loading')
const card = ref<CardData | null>(null)
const ref_ = ref<CardRef | null>(null)
const busy = ref(false)
const BARS = [55, 100, 38, 24, 72]

async function load() {
  state.value = 'loading'
  const r = parseCardHash(location.hash)
  const c = r ? await resolveCard(r) : null
  ref_.value = r
  card.value = c
  state.value = c ? 'ready' : 'invalid'
}
onMounted(() => {
  void load()
  window.addEventListener('hashchange', load)
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', load)
  engine.stop()
})

/** La línea en mono: «firma · estilo · bpm» (sin firma, sin autor: nada de «anónimo»). */
const meta = computed(() => {
  const c = card.value
  if (!c) return ''
  const bpm = Math.round(c.bpm || STYLES[c.style].bpm)
  return cardMeta(c, t('card.bpm', { n: bpm }))
})

/** el ▶: el contexto de audio nace en este toque; la canción suena entera, como la compartieron */
async function toggle() {
  const c = card.value
  if (!c || busy.value) return
  if (engine.playing.value) return engine.stop()
  busy.value = true
  try {
    await lab.begin()
    engine.stop()
    await engine.setStyle(c.style)
    engine.setBpm(c.song.bpm ?? null)
    engine.setKit(c.kit)
    engine.setBackgroundMode(c.bgMode ?? 'manual')
    engine.setSong(c.song)
    await engine.play()
  } finally {
    busy.value = false
  }
}

/** «Abrir en coderbeats»: un remix de la app, en Remixes del Laboratorio; una canción propia, en el Estudio (el mismo enlace `#c=` de siempre) */
const openHref = computed(() => {
  const r = ref_.value
  if (!r) return '/lab'
  return r.kind === 'r' ? `/lab?remix=${encodeURIComponent(r.id)}` : `/${cardHash({ kind: 'c', payload: r.payload })}`
})
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col items-center bg-[#0B0B0F] px-5 pb-10 pt-[max(2rem,env(safe-area-inset-top))] text-white" data-card-page>
    <template v-if="state === 'ready' && card">
      <!-- la tarjeta -->
      <section class="mt-6 w-full rounded-[2rem] border border-white/10 bg-white/[.04] px-7 pb-6 pt-8 text-center" data-card>
        <svg class="mx-auto h-16 w-24" viewBox="0 0 96 64" aria-hidden="true">
          <rect v-for="(h, i) in BARS" :key="i" :x="i * 20" :y="64 - h * 0.64" width="14" :height="h * 0.64" rx="3" :fill="ACCENT" />
        </svg>
        <h1 class="mt-6 text-balance text-3xl font-semibold leading-tight tracking-tight" data-card-title>{{ card.title }}</h1>
        <p class="mt-3 font-mono text-xs text-white/60" data-card-meta>{{ meta }}</p>
        <p class="mt-10 font-mono text-[11px] text-white/40">{{ t('card.madeWith') }}</p>
      </section>

      <!-- ▶ grande -->
      <button
        class="mt-8 flex h-20 w-20 items-center justify-center rounded-full bg-white text-black transition active:scale-95 disabled:opacity-60 motion-reduce:transition-none"
        :aria-label="engine.playing.value ? t('card.stop') : t('card.play')"
        :disabled="busy"
        data-card-play
        @click="toggle"
      >
        <svg v-if="!engine.playing.value" width="30" height="32" viewBox="0 0 18 20" fill="currentColor" aria-hidden="true"><path d="M2 1.5v17a1 1 0 0 0 1.5.86l14-8.5a1 1 0 0 0 0-1.72l-14-8.5A1 1 0 0 0 2 1.5Z" /></svg>
        <svg v-else width="26" height="26" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect width="16" height="16" rx="2" /></svg>
      </button>

      <!-- promo -->
      <p class="mt-12 text-center text-sm text-white/60" data-card-promo>{{ t('card.promo') }}</p>
      <a class="mt-4 flex min-h-11 w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-medium" :style="{ borderColor: ACCENT, color: ACCENT }" :href="openHref" data-card-open>{{ t('card.open') }}</a>
    </template>

    <template v-else-if="state === 'invalid'">
      <p class="mt-24 text-center text-white/70" data-card-invalid>{{ t('card.invalid') }}</p>
      <a class="mt-6 flex min-h-11 items-center justify-center rounded-full border px-5 py-3 text-sm" :style="{ borderColor: ACCENT, color: ACCENT }" href="/lab">{{ t('card.openApp') }}</a>
    </template>

    <p v-else class="mt-24 text-sm text-white/40">{{ t('card.loading') }}</p>
  </main>
</template>

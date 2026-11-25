<script setup lang="ts">
/**
 * Compartir como tarjeta (spec 061, paso 3a): una hoja con la firma opcional («firmar como…», solo viaja en el enlace y no se guarda en ningún sitio), el botón del sistema
 * para compartir y «Copiar enlace». El enlace lo arma `cardUrl`; para una canción propia se codifica al abrir la hoja (`build`). Sin servidor.
 */
import { ACCENT } from '~/lib/palette'
import { cardUrl, MAX_BY, resolveCard, type CardRef } from '~/lib/shareCard'

const props = defineProps<{ build: () => Promise<CardRef | null>; title: string }>()
const open = defineModel<boolean>('open', { required: true })
const { t } = useI18n()

const video = useCardVideo()
const vs = useCardVideoState()
const by = ref('')
const canVideo = ref(false)
const url = ref('')
const state = ref<'idle' | 'building' | 'ready' | 'fail'>('idle')
const note = ref('')
let ref_: CardRef | null = null
let noteTimer: ReturnType<typeof setTimeout> | null = null
const canShare = computed(() => typeof navigator !== 'undefined' && typeof navigator.share === 'function')

function say(text: string) {
  note.value = text
  if (noteTimer) clearTimeout(noteTimer)
  noteTimer = setTimeout(() => (note.value = ''), 2500)
}
function refresh() {
  url.value = ref_ ? cardUrl(location.origin, { ...ref_, by: by.value }) : ''
}
watch(open, async (o) => {
  if (!o) {
    video.cancel()
    video.reset()
    return
  }
  canVideo.value = video.canRecord()
  state.value = 'building'
  note.value = ''
  try {
    ref_ = await props.build()
  } catch {
    ref_ = null
  }
  state.value = ref_ ? 'ready' : 'fail'
  refresh()
})
watch(by, refresh)
onBeforeUnmount(() => noteTimer && clearTimeout(noteTimer))

async function share() {
  if (!url.value) return
  try {
    await navigator.share({ title: props.title, url: url.value })
  } catch (e) {
    if ((e as Error)?.name !== 'AbortError') say(t('share.fail'))
  }
}
async function copy() {
  if (!url.value) return
  try {
    await navigator.clipboard.writeText(url.value)
    return say(t('share.copied'))
  } catch {
    /* sin permiso del portapapeles: se prueba el camino antiguo */
  }
  const ta = document.createElement('textarea')
  ta.value = url.value
  ta.setAttribute('readonly', '')
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
  document.body.appendChild(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  say(ok ? t('share.copied') : t('share.copyFail'))
}
/** el vídeo de la historia: el resumen de la canción, grabado en tiempo real (spec 061, paso 3) */
async function makeVideo() {
  if (!ref_) return
  const card = await resolveCard({ ...ref_, by: by.value })
  if (!card) return say(t('share.videoFail'))
  await video.start(card, { bpm: t('card.bpm', { n: Math.round(card.bpm) }), madeWith: t('card.madeWith') })
}
async function shareVideo() {
  const r = await video.share()
  if (r === 'downloaded') say(t('share.videoSaved'))
}
const pct = computed(() => Math.round(vs.progress * 100))
const shown = computed(() => (url.value.length > 64 ? `${url.value.slice(0, 36)}…${url.value.slice(-16)}` : url.value))
</script>

<template>
  <Transition name="share">
    <div v-if="open" class="fixed inset-0 z-30 flex items-end sm:items-center sm:justify-center" data-share-sheet @keydown.esc="open = false">
      <div class="absolute inset-0 bg-black/70" @click="open = false" />
      <section role="dialog" aria-modal="true" :aria-label="t('share.title')" class="relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-white/10 bg-[#121217] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-sm sm:rounded-2xl">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-base text-white">{{ t('share.title') }}</h2>
          <button class="flex h-11 w-11 items-center justify-center text-white/60" :aria-label="t('start.close')" data-share-close @click="open = false">
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg>
          </button>
        </div>
        <p class="truncate text-white/80">{{ title }}</p>

        <label class="mt-4 block text-xs text-white/60" for="share-by">{{ t('share.sign') }}</label>
        <input
          id="share-by"
          v-model="by"
          type="text"
          :maxlength="MAX_BY"
          autocomplete="off"
          autocapitalize="words"
          :placeholder="t('share.signPlaceholder')"
          class="mt-1 h-11 w-full rounded-xl border border-white/20 bg-black px-3 text-white placeholder-white/30"
          data-share-by
        />
        <p class="mt-1 text-xs text-white/40">{{ t('share.signHelp') }}</p>

        <p class="mt-4 truncate font-mono text-xs text-white/50" data-share-url>{{ state === 'building' ? t('share.building') : state === 'fail' ? t('share.fail') : shown }}</p>

        <div class="mt-3 grid gap-2">
          <button v-if="canShare" class="min-h-12 rounded-full border px-4 text-base font-medium disabled:opacity-40" :style="{ borderColor: ACCENT, color: ACCENT }" :disabled="state !== 'ready'" data-share-native @click="share">{{ t('share.share') }}</button>
          <button class="min-h-12 rounded-full border border-white/25 px-4 text-base text-white disabled:opacity-40" :disabled="state !== 'ready'" data-share-copy @click="copy">{{ t('share.copy') }}</button>
        </div>
        <p class="mt-2 min-h-4 text-center text-xs text-white/60" role="status" data-share-note>{{ note }}</p>

        <!-- el vídeo de la historia -->
        <div class="mt-3 border-t border-white/10 pt-3" data-share-video>
          <template v-if="vs.phase === 'recording'">
            <p class="text-sm text-white" role="status" data-video-status>{{ t('share.videoWorking', { n: pct }) }}</p>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" :aria-valuenow="pct" aria-valuemin="0" aria-valuemax="100">
              <div class="h-full rounded-full" :style="{ width: pct + '%', background: ACCENT }" />
            </div>
            <p class="mt-2 text-xs text-white/50">{{ t('share.videoKeep', { s: Math.round(vs.seconds) }) }}</p>
            <button class="mt-3 min-h-11 w-full rounded-full border border-white/25 text-white" data-video-cancel @click="video.cancel()">{{ t('share.videoCancel') }}</button>
          </template>
          <template v-else-if="vs.phase === 'done'">
            <video :src="vs.url" controls playsinline class="mx-auto max-h-64 rounded-xl bg-black" data-video-preview />
            <p class="mt-2 text-xs text-white/60">{{ t('share.videoDone') }}</p>
            <div class="mt-2 grid gap-2">
              <button class="min-h-12 rounded-full border px-4 text-base font-medium" :style="{ borderColor: ACCENT, color: ACCENT }" data-video-share @click="shareVideo">{{ t('share.videoShare') }}</button>
              <button class="min-h-12 rounded-full border border-white/25 px-4 text-base text-white" data-video-save @click="video.download()">{{ t('share.videoSave') }}</button>
            </div>
          </template>
          <template v-else>
            <button v-if="canVideo" class="min-h-12 w-full rounded-full border border-white/25 px-4 text-base text-white disabled:opacity-40" :disabled="state !== 'ready'" data-video-start @click="makeVideo">{{ t('share.video') }}</button>
            <p v-if="canVideo" class="mt-1 text-center text-xs text-white/40">{{ t('share.videoHelp') }}</p>
            <p v-else class="text-center text-xs text-white/40" data-video-unsupported>{{ t('share.videoUnsupported') }}</p>
            <p v-if="vs.phase === 'error'" class="mt-2 text-center text-xs text-amber-300" role="alert" data-video-error>{{ vs.error === 'hidden' ? t('share.videoHidden') : vs.error === 'unsupported' ? t('share.videoUnsupported') : t('share.videoFail') }}</p>
          </template>
        </div>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.share-enter-active,
.share-leave-active { transition: opacity 0.2s ease; }
.share-enter-from,
.share-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .share-enter-active,
  .share-leave-active { transition: opacity 0.1s linear; }
}
</style>

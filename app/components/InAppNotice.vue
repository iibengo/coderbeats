<script setup lang="ts">
// Aviso discreto en los navegadores internos de Instagram, Facebook o TikTok (spec 062): ahí el audio suele no sonar. No bloquea nada y se cierra.
import { detectInApp } from '~/lib/inApp'
const { t } = useI18n()
const KEY = 'coderbeats:inapp:session'
const show = ref(false)
onMounted(() => {
  if (!detectInApp(navigator.userAgent)) return
  try {
    if (sessionStorage.getItem(KEY)) return
  } catch { /* sin almacenamiento de sesión: se enseña igual */ }
  show.value = true
})
function close() {
  show.value = false
  try { sessionStorage.setItem(KEY, '1') } catch { /* da igual */ }
}
</script>

<template>
  <div
    v-if="show"
    class="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-3"
    style="padding-top: max(0.5rem, env(safe-area-inset-top))"
    data-inapp-notice
  >
    <div class="pointer-events-auto flex max-w-sm items-start gap-2 rounded-2xl border border-white/15 bg-[#121217]/95 py-2 pl-4 pr-1 text-xs shadow-xl backdrop-blur" role="status">
      <p class="min-w-0 flex-1 py-1">
        <span class="block text-sm text-white">{{ t('inapp.title') }}</span>
        <span class="mt-0.5 block text-white/60">{{ t('inapp.hint') }}</span>
      </p>
      <button class="flex h-11 w-11 shrink-0 items-center justify-center text-white/60" :aria-label="t('start.close')" data-inapp-close @click="close">
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg>
      </button>
    </div>
  </div>
</template>

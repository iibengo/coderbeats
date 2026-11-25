<script setup lang="ts">
// El cuadro de confirmación de la app (ver `useConfirm`): en lugar de `window.confirm`, que el móvil puede bloquear.
const state = useConfirmState()
</script>

<template>
  <div v-if="state.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" role="alertdialog" aria-modal="true" aria-label="confirmar" @pointerdown.stop>
    <div class="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121217] p-5 text-sm text-white/90">
      <p class="mb-5 leading-relaxed">{{ state.message }}</p>
      <div class="flex justify-end gap-2">
        <button class="rounded-full border border-white/20 px-4 py-2" @click="answerConfirm(false)">{{ state.cancel }}</button>
        <button class="rounded-full bg-white px-4 py-2 font-medium text-black" @click="answerConfirm(true)">{{ state.ok }}</button>
      </div>
    </div>
  </div>
</template>

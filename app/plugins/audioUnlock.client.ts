// Desbloquea el audio con el primer toque (modo silencio de iOS, navegadores internos): ver `useAudioUnlock`.
export default defineNuxtPlugin(() => {
  installFirstTouchUnlock()
})

/**
 * Que suene con el interruptor de silencio del iPhone puesto y en los navegadores internos (spec 062). Se llama en el **primer toque** de la persona:
 * - si existe `navigator.audioSession`, su tipo pasa a `playback` (el audio de la web cuenta como música, no como «ambiente», y el modo silencio no lo calla);
 * - si no, en iOS se reproduce en bucle un `<audio>` mudo, que hace que iOS use la categoría de reproducción. El contexto de audio del motor se crea o se reanuda en su propio toque (`start`).
 * Una sola vez, sin fallar nunca: si el navegador no deja, la app sigue como estaba.
 */
import { isIos, silentWavDataUri } from '~/lib/inApp'

export interface UnlockEnv {
  nav: { audioSession?: { type: string }; userAgent: string; maxTouchPoints?: number }
  makeAudio: () => { loop: boolean; muted?: boolean; setAttribute?: (k: string, v: string) => void; play: () => Promise<void> | void }
}

export type UnlockResult = 'audioSession' | 'silentAudio' | 'none'
let done: UnlockResult | null = null

export function unlockIosAudio(env: UnlockEnv): UnlockResult {
  if (done) return done
  try {
    if (env.nav.audioSession) {
      env.nav.audioSession.type = 'playback'
      return (done = 'audioSession')
    }
    if (isIos(env.nav.userAgent, env.nav.maxTouchPoints ?? 0)) {
      const a = env.makeAudio()
      a.loop = true
      a.setAttribute?.('playsinline', '')
      const p = a.play()
      if (p && typeof (p as Promise<void>).catch === 'function') void (p as Promise<void>).catch(() => { done = null })
      return (done = 'silentAudio')
    }
  } catch {
    /* sin permiso o sin soporte: la app sigue como estaba */
  }
  return (done = 'none')
}

/** Solo para los tests */
export const resetUnlockForTests = () => { done = null }

/** Engancha el desbloqueo al primer toque o clic de la página (se quita solo después). */
export function installFirstTouchUnlock(): () => void {
  const events = ['touchend', 'pointerup', 'click'] as const
  const off = () => events.forEach((e) => window.removeEventListener(e, onGesture, true))
  function onGesture() {
    off()
    unlockIosAudio({ nav: navigator as unknown as UnlockEnv['nav'], makeAudio: () => new Audio(silentWavDataUri()) })
  }
  events.forEach((e) => window.addEventListener(e, onGesture, { capture: true, passive: true }))
  return off
}

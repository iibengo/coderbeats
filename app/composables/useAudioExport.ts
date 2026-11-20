/**
 * Exportar el audio a MP3 (spec 054): toca la canción desde el principio, captura la salida **sin comprimir** (sin el micro) con el mismo patrón que el vídeo (en tiempo real, con progreso y cancelar),
 * recorta el silencio de antes de que empiece la música y el final exacto (con un fundido de 2,5 s), lleva el volumen a −14 LUFS sin pasar de −2,3 dBFS, codifica a MP3 y da el archivo. Nada sale del navegador.
 */
import { reactive } from 'vue'
import { songBars, type Song } from '~/lib/cells'
import { normalizeLoudness } from '~/lib/loudness'
import { encodeMp3, firstSound, joinChunks, mp3FileName, sliceWithFade, MP3_KBPS } from '~/lib/audioExport'

export type AudioPhase = 'idle' | 'recording' | 'encoding' | 'done' | 'error'
const state = reactive({ phase: 'idle' as AudioPhase, elapsed: 0, total: 0, message: '', url: '', name: '', bytes: 0 })
export const useAudioExportState = () => state

let cancelFlag: (() => void) | null = null
const FADE_S = 2.5
/** objetivo de volumen (Spotify normaliza a ≈ −14 LUFS) y techo de pico (−2,3 dBFS: la codificación a MP3 suma ≈ 0,8 dB y así queda por debajo de −1 dBTP; medido) */
const TARGET_LUFS = -14
const CEILING_DB = -2.3

export function useAudioExport() {
  const engine = useAudioEngine()
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
  const busy = () => state.phase === 'recording' || state.phase === 'encoding'

  async function start(song: Song, title: string): Promise<boolean> {
    if (busy()) return false
    if (state.url) URL.revokeObjectURL(state.url)
    Object.assign(state, { phase: 'recording', elapsed: 0, total: 0, message: '', url: '', name: '', bytes: 0 })
    let cap: Awaited<ReturnType<typeof engine.pcmCapture>> = null
    let canceled = false
    const onHide = () => {
      if (document.hidden) cancelFlag?.()
    }
    try {
      engine.stop()
      engine.setSong(song)
      // la captura se engancha **antes** de que suene nada (así no se pierde el primer golpe). Si el motor aún no tiene salida (nunca ha sonado), se le hace sonar un instante para crearla
      cap = await engine.pcmCapture()
      if (!cap) {
        await engine.play()
        cap = await engine.pcmCapture()
        engine.stop()
      }
      if (!cap) throw new Error('este navegador no puede capturar el audio')
      // la cola de lo que sonaba antes (reverb) se apaga antes de empezar a capturar
      await wait(700)
      const seconds = (songBars(song) * 4 * 60) / engine.bpm.value
      state.total = seconds
      const sr = cap.sampleRate
      cap.start()
      await engine.play()
      cancelFlag = () => (canceled = true)
      document.addEventListener('visibilitychange', onHide)
      const t0 = performance.now()
      // hasta tener `seconds` de música contados desde el primer sonido (o, si no suena nada, un tope de seguridad)
      for (;;) {
        await wait(200)
        const f = cap.firstFrame()
        state.elapsed = f >= 0 ? Math.min(seconds, (cap.frames() - f) / sr) : 0
        if (canceled) break
        if (f >= 0 && cap.frames() - f >= seconds * sr) break
        if ((performance.now() - t0) / 1000 > seconds + 15) throw new Error('la música no arrancó')
        if (!engine.playing.value) throw new Error('la música se paró')
      }
      document.removeEventListener('visibilitychange', onHide)
      cancelFlag = null
      const got = await cap.stop()
      engine.stop()
      if (canceled) {
        state.phase = 'idle'
        state.message = document.hidden ? 'Se cortó al salir de la pantalla.' : ''
        return false
      }
      const l = joinChunks(got.l)
      const r = joinChunks(got.r)
      const from = firstSound(l, r)
      if (from < 0) throw new Error('no se oyó nada')
      const frames = Math.round(seconds * sr)
      const fade = Math.round(FADE_S * sr)
      state.phase = 'encoding'
      state.message = ''
      const outL = sliceWithFade(l, from, frames, fade)
      const outR = sliceWithFade(r, from, frames, fade)
      // al volumen de streaming sin pasar del techo de pico (spec 055); cede el hilo antes, que son unos segundos de cuentas
      await wait(0)
      normalizeLoudness(outL, outR, sr, TARGET_LUFS, CEILING_DB)
      const parts = await encodeMp3(outL, outR, sr, MP3_KBPS, (p) => (state.elapsed = seconds * p))
      const blob = new Blob(parts as BlobPart[], { type: 'audio/mpeg' })
      state.bytes = blob.size
      state.url = URL.createObjectURL(blob)
      state.name = mp3FileName(title, new Date())
      state.phase = 'done'
      return true
    } catch (e) {
      document.removeEventListener('visibilitychange', onHide)
      cancelFlag = null
      try {
        await cap?.stop()
      } catch {
        /* nada que cerrar */
      }
      engine.stop()
      state.phase = 'error'
      state.message = `No se pudo guardar el audio: ${e instanceof Error ? e.message : String(e)}`
      return false
    }
  }

  /** Guarda el archivo: lo comparte con la hoja del sistema si se puede (móvil) o lo descarga. */
  async function save(share = false) {
    if (!state.url) return
    if (share && navigator.canShare) {
      const blob = await (await fetch(state.url)).blob()
      const f = new File([blob], state.name, { type: 'audio/mpeg' })
      if (navigator.canShare({ files: [f] })) {
        try {
          await navigator.share({ files: [f], title: state.name })
          return
        } catch {
          /* se cancela o no se puede: se descarga */
        }
      }
    }
    const a = document.createElement('a')
    a.href = state.url
    a.download = state.name
    a.click()
  }

  return { state, start, cancel: () => cancelFlag?.(), save }
}

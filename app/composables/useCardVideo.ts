/**
 * El vídeo de la historia (spec 061, paso 3): ~15 s en vertical (1080 × 1920) con la tarjeta y el resumen de la canción. Se graba en tiempo real: un lienzo propio (`drawCard`) y el
 * audio del motor (`videoAudio`) en un `MediaRecorder`, sin ffmpeg. La canción derivada (`planSummary`) se toca de principio a fin con el reproductor de siempre; el avance que se
 * enseña es el real (dónde va la canción respecto a sus compases). Al acabar, o al cancelar, el motor vuelve a lo que había.
 */
import { reactive } from 'vue'
import { planSummary } from '~/lib/cardSummary'
import { CARD_H, CARD_W, drawCard, progressOf } from '~/lib/cardCanvas'
import { drawEndFade, drawOutro, outroU, partProgress, TIMES } from '~/lib/cardOutro'
import { makeSaved } from '~/lib/library'
import { songTimeline } from '~/lib/timeline'
import { makePulso, PULSO_COMPACT, sampleLane } from '~/lib/visuals/pulso'
import { cardMeta, type CardData } from '~/lib/shareCard'
import { AUDIO_BPS, pickMime } from '~/lib/videoExport'

export type CardVideoPhase = 'idle' | 'recording' | 'done' | 'error'
export type CardVideoError = 'unsupported' | 'fail' | 'hidden' | ''
const state = reactive({ phase: 'idle' as CardVideoPhase, progress: 0, seconds: 0, error: '' as CardVideoError, url: '', name: '', file: null as File | null })
export const useCardVideoState = () => state
const VIDEO_BPS = 6_000_000
/** lo que se sigue grabando tras el último compás, con el diablillo y el nombre ya completos (y para que termine el fundido del audio) */
const TAIL_MS = 1500
/** el sonido sale unos milisegundos después de su compás en el reloj: las barras se adelantan un poco para saltar con el golpe que se oye */
const LEAD_S = 0.04
let cancelNow: (() => void) | null = null

const slug = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cancion'

export function useCardVideo() {
  const engine = useAudioEngine()
  const lab = useLab()
  const kind = () => (typeof MediaRecorder === 'undefined' || typeof HTMLCanvasElement === 'undefined' || !('captureStream' in HTMLCanvasElement.prototype) ? null : pickMime((t) => MediaRecorder.isTypeSupported(t)))
  const canRecord = () => !!kind()

  function reset() {
    if (state.url) URL.revokeObjectURL(state.url)
    Object.assign(state, { phase: 'idle', progress: 0, seconds: 0, error: '', url: '', name: '', file: null })
  }
  const fail = (e: CardVideoError) => Object.assign(state, { phase: 'error', error: e })

  async function start(card: CardData, texts: { bpm: string; madeWith: string }): Promise<boolean> {
    if (state.phase === 'recording') return false
    reset()
    const mime = kind()
    if (!mime) return fail('unsupported'), false
    const plan = planSummary(card.song, card.bpm)
    if (!plan) return fail('fail'), false
    const totalBars = plan.bars.reduce((s, b) => s + b, 0)
    const barSeconds = 240 / card.bpm
    const fadeBars = plan.fadeSeconds / barSeconds
    const before = engine.snapshot()
    state.phase = 'recording'
    state.seconds = plan.seconds

    const out = document.createElement('canvas')
    out.width = CARD_W
    out.height = CARD_H
    const g = out.getContext('2d')!
    const mkPath = (d: string) => new Path2D(d)
    const look = { title: card.title, meta: cardMeta(card, texts.bpm), madeWith: texts.madeWith, site: location.host }
    let rec: MediaRecorder | null = null
    let cancelled = false
    let raf = 0
    let hiddenFlag = false
    const onHide = () => { if (document.hidden) { hiddenFlag = true; cancelled = true } }
    document.addEventListener('visibilitychange', onHide)
    cancelNow = () => { cancelled = true }
    try {
      await Promise.all(['600 88px Inter', '400 36px "JetBrains Mono"'].map((f) => document.fonts?.load(f).catch(() => null)))
      await lab.begin()
      engine.stop()
      await engine.setStyle(card.style)
      engine.setBpm(card.song.bpm ?? null)
      engine.setKit(card.kit)
      engine.setBackgroundMode(card.bgMode ?? 'manual')
      engine.setSong(plan.song)
      drawCard(g, look)
      const stream = out.captureStream(30)
      const audio = engine.videoAudio()
      if (audio) for (const t of audio.getAudioTracks()) stream.addTrack(t)
      rec = new MediaRecorder(stream, { mimeType: mime.mime, videoBitsPerSecond: VIDEO_BPS, audioBitsPerSecond: AUDIO_BPS })
      const parts: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
      const stopped = new Promise<void>((r) => (rec!.onstop = () => r()))
      rec.start(250)
      await engine.play()

      // el avance y el dibujo siguen a la canción de verdad (los compases que lleva), no a un reloj aparte
      let pos0: number | null = null
      let tailStart: number | null = null
      let stung = false
      let fading = false
      // las barras salen de los golpes de la canción (como el «Pulso» de Remixes): cada golpe de su voz sube la barra y se apaga rápido; así saltan justo en el golpe
      const pulso = makePulso(songTimeline(plan.song, card.style), card.title, PULSO_COMPACT)
      const bars = [0, 0, 0, 0, 0]
      const t0 = performance.now()
      await new Promise<void>((resolve) => {
        const tick = () => {
          const c = engine.clockNow()
          if (c && pos0 === null) pos0 = c.bar + c.barPhase
          const pos = c && pos0 !== null ? c.bar + c.barPhase - pos0 : 0
          if (!fading && pos >= totalBars - fadeBars) {
            fading = true
            engine.fadeOut(plan.fadeSeconds)
          }
          for (let i = 0; i < 5; i++) {
            sampleLane(pulso, i, Math.max(0, pos) * barSeconds + LEAD_S)
            bars[i] = pulso.energy[i]!
          }
          // el final: la tarjeta se apaga y el diablillo de coderbeats se dibuja como un neón, con el nombre debajo
          const u = outroU(pos, totalBars, barSeconds)
          // el brillo de detrás respira con el bajo; las barras vuelven a su reposo al apagarse la tarjeta; y al final todo se funde a oscuro (último 40 % de la cola) para que el bucle de la historia no corte en seco
          drawCard(g, { ...look, level: bars, glow: bars[1], rest: partProgress(u, TIMES.card), fade: Math.min(1, u / TIMES.card[1]) })
          drawOutro(g, mkPath, u)
          // el sonido del diablillo entra cuando empieza a dibujarse, mientras la canción ya baja; va por su propio camino y el fundido de la canción no lo apaga
          if (!stung && u >= TIMES.contour[0]) {
            stung = true
            engine.playSting()
          }
          if (tailStart !== null) drawEndFade(g, (((performance.now() - tailStart) / TAIL_MS) - 0.6) / 0.4)
          state.progress = progressOf(pos, totalBars)
          // al acabar la canción se sigue dibujando la imagen final un rato (la cola): un lienzo quieto no da fotogramas y el nombre no llegaría a verse
          if (pos >= totalBars && tailStart === null) tailStart = performance.now()
          if (cancelled || (tailStart !== null && performance.now() - tailStart > TAIL_MS) || performance.now() - t0 > (plan.seconds + 5) * 1000) return resolve()
          raf = requestAnimationFrame(tick)
        }
        tick()
      })
      cancelAnimationFrame(raf)
      engine.stop()
      if (rec.state !== 'inactive') rec.stop()
      await stopped
      stream.getTracks().forEach((t) => t.stop())
      if (cancelled) {
        fail(hiddenFlag ? 'hidden' : '')
        if (!hiddenFlag) reset()
        return false
      }
      const blob = new Blob(parts, { type: mime.mime.split(';')[0] })
      if (!blob.size) return fail('fail'), false
      const name = `coderbeats-${slug(card.title)}.${mime.ext}`
      state.file = new File([blob], name, { type: blob.type })
      state.url = URL.createObjectURL(blob)
      state.name = name
      state.progress = 1
      state.phase = 'done'
      return true
    } catch {
      cancelAnimationFrame(raf)
      try { if (rec && rec.state !== 'inactive') rec.stop() } catch { /* ya parada */ }
      engine.stop()
      return fail('fail'), false
    } finally {
      document.removeEventListener('visibilitychange', onHide)
      cancelNow = null
      // el motor vuelve a lo que había (parado, con su canción)
      try { await engine.openSaved(makeSaved(before, 'tarjeta', 'tarjeta', new Date())) } catch { /* sin restaurar: no es grave */ }
    }
  }

  const cancel = () => cancelNow?.()

  /** Compartir el vídeo con la hoja del sistema; si no se puede compartir un archivo, se descarga. */
  async function share(): Promise<'shared' | 'downloaded' | 'canceled' | 'none'> {
    const f = state.file
    if (!f) return 'none'
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: state.name })
        return 'shared'
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return 'canceled'
      }
    }
    download()
    return 'downloaded'
  }
  function download() {
    if (!state.url) return
    const a = document.createElement('a')
    a.href = state.url
    a.download = state.name
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return { start, cancel, reset, share, download, canRecord }
}

/**
 * Exportar vídeo (spec 013): graba la visualización (agua y aro, **sin botones**) con el audio de la app, en tiempo real, con `MediaRecorder`, y da el archivo.
 * Un lienzo de salida 2D se redibuja cada frame (también si la escena está quieta) copiando los lienzos de la escena justo después de pintarlos; el audio sale de una derivación del
 * final de la cadena maestra (el micro no entra). Fases 1–3 (célula actual, formatos, canción completa); la previsualización (fase 4) y probar en iOS quedan pendientes.
 */
import { STYLES } from '~/lib/constants'
import { reactive } from 'vue'
import { songBars } from '~/lib/cells'
import { MAX_SECONDS, AUDIO_BPS, coverRect, estimateBytes, fileName, outputSize, pickMime, secondsFor, VIDEO_BPS, type VideoFormat, type VideoSize } from '~/lib/videoExport'

interface Source {
  water: HTMLCanvasElement | null
  aro: HTMLCanvasElement | null
  width: number
  height: number
  setHook: (f: (() => void) | null) => void
}

export type VideoPhase = 'idle' | 'waiting' | 'recording' | 'done' | 'error'
const state = reactive({ phase: 'idle' as VideoPhase, elapsed: 0, total: 0, message: '', url: '', name: '', bytes: 0 })
export const useVideoState = () => state

export interface VideoOptions {
  what: 'cell' | 'song' | 'preview'
  /** compases de la célula (what = 'cell') */
  bars: number
  format: VideoFormat
  size: VideoSize
  fps: 30 | 60
  mark: boolean
  /** arriba, el estilo y los BPM, como en los reels de ritmos en círculo (spec 016 §2b) */
  header?: boolean
}

let stopFlag: (() => void) | null = null

export function useVideoExport(getSource: () => Source | null, runPreview?: () => Promise<unknown>) {
  const pilot = usePilotState()
  const engine = useAudioEngine()
  const support = () => (typeof MediaRecorder === 'undefined' ? null : pickMime((t) => MediaRecorder.isTypeSupported(t)))

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)))

  async function start(o: VideoOptions): Promise<boolean> {
    if (state.phase === 'recording' || state.phase === 'waiting') return false
    const kind = support()
    const src = getSource()
    if (!kind || !src) {
      state.phase = 'error'
      state.message = 'Este navegador no puede grabar vídeo con sonido.'
      return false
    }
    if (state.url) URL.revokeObjectURL(state.url)
    Object.assign(state, { phase: 'waiting', elapsed: 0, message: 'Esperando la línea de compás…', url: '', name: '', bytes: 0 })
    try {
      // la música tiene que estar sonando: la canción entera arranca desde el principio; la célula, tal como suena
      const preview = o.what === 'preview'
      if (preview && !runPreview) throw new Error('la previsualización no está disponible')
      if (!preview) {
        if (o.what === 'song' && engine.playing.value) engine.stop()
        if (!engine.playing.value) await engine.play()
        let c = engine.pilot.clock()
        for (let i = 0; i < 40 && !c; i++) {
          await wait(150)
          c = engine.pilot.clock()
        }
        if (!c) throw new Error('la música no arrancó')
      }
      const bpm = engine.bpm.value
      // la previsualización dura lo que tarde en construirse (hasta el tope); lo demás, los compases pedidos
      const seconds = preview ? MAX_SECONDS : o.what === 'song' ? secondsFor(songBars(engine.snapshot().song), bpm) : secondsFor(o.bars, bpm)
      state.total = seconds
      // empieza en la siguiente línea de compás (la previsualización empieza ya: el piloto arranca la música)
      if (!preview) {
        const c = engine.pilot.clock()!
        await wait(engine.pilot.msUntil(c.at(c.bar)))
      }

      const { w, h } = outputSize(o.format, o.size)
      const out = document.createElement('canvas')
      out.width = w
      out.height = h
      const g = out.getContext('2d', { alpha: false })!
      const draw = () => {
        const s = getSource()
        if (!s) return
        const r = coverRect(s.width, s.height, w, h)
        g.fillStyle = '#0B0B0F'
        g.fillRect(0, 0, w, h)
        for (const cv of [s.water, s.aro]) {
          if (!cv || !cv.width) continue
          const k = cv.width / s.width
          g.drawImage(cv, r.sx * k, r.sy * (cv.height / s.height), r.sw * k, r.sh * (cv.height / s.height), 0, 0, w, h)
        }
        if (o.header) {
          g.font = `600 ${Math.round(w / 20)}px system-ui, sans-serif`
          g.fillStyle = 'rgba(255,255,255,0.9)'
          g.textAlign = 'center'
          g.fillText(`${STYLES[engine.style.value].label.toUpperCase()}  ·  ${engine.bpm.value} BPM`, w / 2, Math.round(h * 0.085))
        }
        // el rótulo de la capa que entra (Previsualizar: «Anatomía de tu ritmo»), en una píldora abajo
        if (o.header && pilot.active && pilot.captions && pilot.caption) {
          const size = Math.round(w / 26)
          g.font = `600 ${size}px system-ui, sans-serif`
          g.textAlign = 'center'
          const tw = Math.min(w * 0.92, g.measureText(pilot.caption).width + size * 1.6)
          const ph = size * 2
          const py = Math.round(h * 0.86)
          g.fillStyle = 'rgba(0,0,0,0.55)'
          g.beginPath()
          g.roundRect(w / 2 - tw / 2, py - ph * 0.7, tw, ph, ph / 2)
          g.fill()
          g.fillStyle = 'rgba(255,255,255,0.95)'
          g.fillText(pilot.caption, w / 2, py + size * 0.3, w * 0.9)
        }
        if (o.mark) {
          g.font = `500 ${Math.round(w / 34)}px system-ui, sans-serif`
          g.fillStyle = 'rgba(255,255,255,0.45)'
          g.textAlign = 'center'
          g.fillText('coderbeats', w / 2, h - Math.round(w / 22))
        }
      }
      draw()
      src.setHook(draw)

      const stream = out.captureStream(o.fps)
      const audio = engine.videoAudio()
      if (audio) for (const t of audio.getAudioTracks()) stream.addTrack(t)
      const rec = new MediaRecorder(stream, { mimeType: kind.mime, videoBitsPerSecond: VIDEO_BPS[o.size], audioBitsPerSecond: AUDIO_BPS })
      const parts: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
      const done = new Promise<void>((r) => (rec.onstop = () => r()))
      const t0 = performance.now()
      state.phase = 'recording'
      state.message = ''
      rec.start(1000)
      let stopped = false
      const stopNow = () => {
        if (stopped) return
        stopped = true
        if (rec.state !== 'inactive') rec.stop()
      }
      stopFlag = stopNow
      // previsualización: se lanza el piloto y se para cuando termina (o se para con un toque / el botón)
      if (preview) {
        void runPreview!()
        let started = false
        const watcher = setInterval(() => {
          if (pilot.active) started = true
          else if (started) stopNow()
        }, 300)
        void done.then(() => clearInterval(watcher))
      }
      // en segundo plano se queda sin audio ni frames: se para y se guarda lo grabado
      const onHide = () => document.hidden && stopNow()
      document.addEventListener('visibilitychange', onHide)
      const tick = setInterval(() => {
        state.elapsed = (performance.now() - t0) / 1000
        if (state.elapsed >= seconds) stopNow()
      }, 200)
      await done
      clearInterval(tick)
      document.removeEventListener('visibilitychange', onHide)
      src.setHook(null)
      stopFlag = null
      for (const t of stream.getVideoTracks()) t.stop()
      const blob = new Blob(parts, { type: kind.mime.split(';')[0] })
      state.bytes = blob.size
      state.url = URL.createObjectURL(blob)
      state.name = fileName(engine.style.value, new Date(), kind.ext)
      state.phase = 'done'
      state.message = ''
      return true
    } catch (e) {
      getSource()?.setHook(null)
      state.phase = 'error'
      state.message = `No se pudo grabar: ${e instanceof Error ? e.message : String(e)}`
      return false
    }
  }

  /** Guarda el archivo (descarga) o lo comparte con la hoja del sistema si el navegador lo permite. */
  async function save(share = false) {
    if (!state.url) return
    if (share && navigator.canShare) {
      const blob = await (await fetch(state.url)).blob()
      const f = new File([blob], state.name, { type: blob.type })
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

  return { state, start, stop: () => stopFlag?.(), save, supported: () => !!support(), estimate: (seconds: number, size: VideoSize) => estimateBytes(seconds, size) }
}

// Captura del micro con marca de tiempo exacta (currentFrame del AudioContext).
//
// Mensajes de entrada (port):
//   'start' | 'stop'                       captura a buffer (calibración, tomas)
//   { type: 'stream-port' } + [MessagePort] puerto directo al worker de análisis
//   'stream-on' | 'stream-off'             envío continuo al worker
// Mensajes de salida (port):
//   { type: 'chunk', frame, data } | { type: 'stopped' } | { type: 'level', peak }
// Mensajes de salida (stream port):
//   { type: 'chunk', frame, data }         bloques de STREAM_CHUNK muestras
const CHUNK = 4096
const STREAM_CHUNK = 512
const LEVEL_EVERY = 16 // bloques de 128 (~43 ms a 48 kHz)

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.active = false
    this.buf = new Float32Array(CHUNK)
    this.n = 0
    this.startFrame = 0
    this.streamPort = null
    this.streaming = false
    this.sbuf = new Float32Array(STREAM_CHUNK)
    this.sn = 0
    this.sStart = 0
    this.peak = 0
    this.blocks = 0
    this.port.onmessage = (e) => {
      const m = e.data
      if (m === 'start') {
        this.active = true
        this.n = 0
      } else if (m === 'stop') {
        this.flush()
        this.active = false
        this.port.postMessage({ type: 'stopped' })
      } else if (m === 'stream-on') {
        this.streaming = true
        this.sn = 0
      } else if (m === 'stream-off') {
        this.streaming = false
        this.sn = 0
      } else if (m && m.type === 'stream-port') {
        this.streamPort = e.ports[0]
      }
    }
  }

  flush() {
    if (this.n === 0) return
    this.port.postMessage({ type: 'chunk', frame: this.startFrame, data: this.buf.slice(0, this.n) })
    this.n = 0
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    const stream = this.streaming && this.streamPort
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i]
      const a = v < 0 ? -v : v
      if (a > this.peak) this.peak = a
      if (this.active) {
        if (this.n === 0) this.startFrame = currentFrame + i
        this.buf[this.n++] = v
        if (this.n === CHUNK) this.flush()
      }
      if (stream) {
        if (this.sn === 0) this.sStart = currentFrame + i
        this.sbuf[this.sn++] = v
        if (this.sn === STREAM_CHUNK) {
          const data = this.sbuf
          this.streamPort.postMessage({ type: 'chunk', frame: this.sStart, data }, [data.buffer])
          this.sbuf = new Float32Array(STREAM_CHUNK)
          this.sn = 0
        }
      }
    }
    if (++this.blocks >= LEVEL_EVERY) {
      this.port.postMessage({ type: 'level', peak: this.peak })
      this.peak = 0
      this.blocks = 0
    }
    return true
  }
}

registerProcessor('capture-processor', CaptureProcessor)

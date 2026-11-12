// Captura del micro con marca de tiempo exacta (currentFrame del AudioContext).
// Mensajes de entrada: 'start' | 'stop'
// Mensajes de salida: { type: 'chunk', frame, data } | { type: 'stopped' } | { type: 'level', peak }
const CHUNK = 4096
const LEVEL_EVERY = 16 // bloques de 128 (~43 ms a 48 kHz)

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.active = false
    this.buf = new Float32Array(CHUNK)
    this.n = 0
    this.startFrame = 0
    this.peak = 0
    this.blocks = 0
    this.port.onmessage = (e) => {
      if (e.data === 'start') {
        this.active = true
        this.n = 0
      } else if (e.data === 'stop') {
        this.flush()
        this.active = false
        this.port.postMessage({ type: 'stopped' })
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
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i]
      const a = v < 0 ? -v : v
      if (a > this.peak) this.peak = a
      if (this.active) {
        if (this.n === 0) this.startFrame = currentFrame + i
        this.buf[this.n++] = v
        if (this.n === CHUNK) this.flush()
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

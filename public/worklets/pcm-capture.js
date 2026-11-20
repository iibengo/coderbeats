// Captura del audio de salida sin comprimir (exportar a MP3, spec 054): copia los dos canales en bloques y los manda al hilo principal.
// Mensajes de entrada: 'start' | 'stop'.  Salida: { type: 'chunk', l, r } (Float32Array, se transfieren) y { type: 'stopped' }.
const CHUNK = 4096

class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super()
    this.on = false
    this.l = new Float32Array(CHUNK)
    this.r = new Float32Array(CHUNK)
    this.n = 0
    this.port.onmessage = (e) => {
      if (e.data === 'start') this.on = true
      else if (e.data === 'stop') {
        this.flush()
        this.on = false
        this.port.postMessage({ type: 'stopped' })
      }
    }
  }

  flush() {
    if (!this.n) return
    const l = this.l.slice(0, this.n)
    const r = this.r.slice(0, this.n)
    this.n = 0
    this.port.postMessage({ type: 'chunk', l, r }, [l.buffer, r.buffer])
  }

  process(inputs) {
    const inp = inputs[0]
    if (this.on && inp && inp.length) {
      const a = inp[0]
      const b = inp[1] || inp[0]
      for (let i = 0; i < a.length; i++) {
        this.l[this.n] = a[i]
        this.r[this.n] = b[i]
        if (++this.n === CHUNK) this.flush()
      }
    }
    return true
  }
}

registerProcessor('pcm-capture', PcmCapture)

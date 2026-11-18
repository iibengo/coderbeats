/**
 * Compresor «de pegamento» de la cadena master (spec 010, §7): suave y **sin latencia** (sin lookahead), para no mover el
 * tiempo de la salida (la prueba de eco y la calibración de latencia miden la cadena entera). Detector de nivel RMS rápido
 * y enlazado entre canales, rodilla blanda y ataque/suelta sobre la ganancia en dB. El algoritmo es la clase
 * `GlueCompressor`; el mismo archivo lo cargan los tests (`module.exports`) y lo usa el worklet.
 */
class GlueCompressor {
  constructor(sampleRate, o) {
    this.sampleRate = sampleRate
    this.power = 0 // potencia media del detector
    this.grDb = 0 // reducción de ganancia actual (≤ 0), en dB
    this.set(o)
  }

  /** Cambia los ajustes en marcha (spec 042: el interruptor «techno»); el detector y la reducción actual siguen, sin saltos. */
  set(o) {
    this.o = o
    const coef = (sec) => Math.exp(-1 / Math.max(1, sec * this.sampleRate))
    this.attack = coef(o.attack)
    this.release = coef(o.release)
    this.rms = coef(o.rmsMs / 1000)
    this.makeup = 10 ** (o.makeupDb / 20)
  }

  /** Reducción objetivo (≤ 0 dB) para un nivel en dB: rodilla blanda alrededor del umbral. */
  target(levelDb) {
    const { thresholdDb: t, ratio: r, kneeDb: k } = this.o
    const over = levelDb - t
    if (2 * over < -k) return 0
    if (2 * Math.abs(over) <= k) return (1 / r - 1) * ((over + k / 2) ** 2) / (2 * k)
    return over / r - over
  }

  /** Procesa una muestra estéreo y devuelve la ganancia lineal que se le aplica (incluye el makeup). */
  gain(l, r) {
    const p = Math.max(l * l, r * r)
    this.power = this.rms * this.power + (1 - this.rms) * p
    const levelDb = 10 * Math.log10(this.power + 1e-12)
    const tg = this.target(levelDb)
    const c = tg < this.grDb ? this.attack : this.release
    this.grDb = c * this.grDb + (1 - c) * tg
    return 10 ** (this.grDb / 20) * this.makeup
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor(
    'master-glue',
    class extends AudioWorkletProcessor {
      constructor(options) {
        super()
        this.comp = new GlueCompressor(sampleRate, options.processorOptions)
        // spec 042: cambiar de ajustes en marcha (el interruptor «techno»)
        this.port.onmessage = (e) => {
          const d = e.data
          if (d && d.type === 'options' && d.options && typeof d.options.ratio === 'number') this.comp.set(d.options)
        }
      }

      process(inputs, outputs) {
        const input = inputs[0]
        const output = outputs[0]
        if (!input || !input.length) return true
        const a = input[0]
        const b = input[1] || input[0]
        for (let i = 0; i < a.length; i++) {
          const g = this.comp.gain(a[i], b[i])
          output[0][i] = a[i] * g
          if (output[1]) output[1][i] = b[i] * g
        }
        return true
      }
    },
  )
}

if (typeof module !== 'undefined') module.exports = { GlueCompressor }

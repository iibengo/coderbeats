/**
 * Limitador de pico de la salida (spec 047): lo último de la cadena, «de verdad». Con mirada hacia delante (lookahead): el audio sale retrasado `lookahead` (1,5 ms por defecto) y la ganancia se calcula
 * con lo que viene, así que **ningún pico pasa del techo** (−1 dBFS), sin recortar. Algoritmo clásico: la ganancia necesaria de cada muestra (techo / pico), el **mínimo** de la ventana de
 * `lookahead + 1` muestras, suavizado con una media de esa misma longitud (la media de mínimos nunca supera la ganancia necesaria de la muestra a la que se aplica) y una suelta lenta (80 ms) que solo
 * puede dejar la ganancia por debajo, nunca por encima. Por debajo del techo la ganancia es 1: sale **la misma señal, retrasada**. Estéreo enlazado (la misma ganancia en los dos canales: no mueve la imagen).
 * El mismo archivo lo cargan los tests (`module.exports`) y lo usa el worklet.
 */
class BrickwallLimiter {
  constructor(sampleRate, o) {
    this.ceiling = 10 ** (o.ceilingDb / 20)
    this.n = Math.max(1, Math.round((o.lookaheadMs / 1000) * sampleRate)) // retardo y longitud de la ventana, en muestras
    this.rel = Math.exp(-1 / Math.max(1, (o.releaseMs / 1000) * sampleRate))
    const size = this.n + 1 // ventana de necesidades: la muestra de ahora y las `n` anteriores
    this.size = size
    this.bufL = new Float32Array(this.n) // el audio retrasado `n` muestras
    this.bufR = new Float32Array(this.n)
    this.need = new Float32Array(size) // ganancia necesaria de las últimas `size` muestras (anillo)
    this.mins = new Float32Array(size) // el mínimo de ventana de las últimas `size` muestras (anillo)
    this.need.fill(1)
    this.mins.fill(1)
    this.t = 0 // contador de muestras
    this.sum = size // suma de `mins`
    this.g = 1 // ganancia final anterior (para la suelta)
  }

  /** Procesa una muestra estéreo; devuelve [l, r] ya limitadas y retrasadas `n` muestras (en `out`). */
  process(l, r, out) {
    const { n, size } = this
    const peak = Math.max(Math.abs(l), Math.abs(r))
    const need = peak > this.ceiling ? this.ceiling / peak : 1
    const ia = this.t % n
    const ib = this.t % size
    // sale la muestra de hace `n` muestras (la que se escribió en este hueco hace `n` pasos) y entra la de ahora
    const outL = this.bufL[ia]
    const outR = this.bufR[ia]
    this.bufL[ia] = l
    this.bufR[ia] = r
    this.need[ib] = need
    // mínimo de las `size` últimas necesidades (barrido simple: `size` es pequeño, ~72)
    let m = 1
    for (let k = 0; k < size; k++) if (this.need[k] < m) m = this.need[k]
    this.sum += m - this.mins[ib]
    this.mins[ib] = m
    const smooth = this.sum / size
    // suelta lenta: baja de golpe, sube despacio (y nunca por encima de `smooth`)
    this.g = smooth < this.g ? smooth : Math.min(smooth, this.g + (smooth - this.g) * (1 - this.rel))
    this.t++
    out[0] = outL * this.g
    out[1] = outR * this.g
    return this.g
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor(
    'master-limiter',
    class extends AudioWorkletProcessor {
      constructor(options) {
        super()
        this.lim = new BrickwallLimiter(sampleRate, options.processorOptions)
        this.out = [0, 0]
      }

      process(inputs, outputs) {
        const input = inputs[0]
        const output = outputs[0]
        if (!input || !input.length) return true
        const a = input[0]
        const b = input[1] || input[0]
        for (let i = 0; i < a.length; i++) {
          this.lim.process(a[i], b[i], this.out)
          output[0][i] = this.out[0]
          if (output[1]) output[1][i] = this.out[1]
        }
        return true
      }
    },
  )
}

if (typeof module !== 'undefined') module.exports = { BrickwallLimiter }

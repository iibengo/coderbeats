/** FFT compleja radix-2 en el sitio (tamaño potencia de 2). Puro; se reutilizan las tablas del tamaño. */
export class Fft {
  private readonly cos: Float64Array
  private readonly sin: Float64Array
  private readonly rev: Uint32Array

  constructor(readonly size: number) {
    if (size < 2 || (size & (size - 1)) !== 0) throw new Error('el tamaño de la FFT debe ser potencia de 2')
    this.cos = new Float64Array(size / 2)
    this.sin = new Float64Array(size / 2)
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size)
      this.sin[i] = Math.sin((2 * Math.PI * i) / size)
    }
    this.rev = new Uint32Array(size)
    const bits = Math.log2(size)
    for (let i = 0; i < size; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b)
      this.rev[i] = r
    }
  }

  /** Transformada directa (o inversa sin escalar, con `inverse`) sobre `re` e `im`. */
  transform(re: Float64Array, im: Float64Array, inverse = false): void {
    const n = this.size
    for (let i = 0; i < n; i++) {
      const j = this.rev[i]!
      if (j > i) {
        const tr = re[i]!
        re[i] = re[j]!
        re[j] = tr
        const ti = im[i]!
        im[i] = im[j]!
        im[j] = ti
      }
    }
    const sign = inverse ? 1 : -1
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1
      const step = n / len
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const wr = this.cos[k * step]!
          const wi = sign * this.sin[k * step]!
          const a = i + k
          const b = a + half
          const xr = re[b]! * wr - im[b]! * wi
          const xi = re[b]! * wi + im[b]! * wr
          re[b] = re[a]! - xr
          im[b] = im[a]! - xi
          re[a] = re[a]! + xr
          im[a] = im[a]! + xi
        }
      }
    }
  }
}

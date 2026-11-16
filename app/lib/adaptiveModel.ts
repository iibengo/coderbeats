/**
 * El modelo por defecto que **se adapta a tu micro** (spec 001 §17.8). Un micro de móvil cambia el espectro (todo suena «un escalón más grave» que en la toma del laboratorio),
 * y con prototipos fijos el platillo cae en la caja y la caja en el bombo. Lo que **no** cambia es el orden: el «ts» siempre es más agudo que el «pff», y este que el «bum».
 * Con el registro real de un iPhone (centroide 0,05–0,14 y cruces 0,02–0,10, frente a 0,3–0,5 en el laboratorio) se vio qué sí es **independiente del micro**: la **energía grave**
 * (< 800 Hz) del bombo es ≥ 0,47 en el iPhone y ≈ 0,75 en el laboratorio, y la de caja y platillo, ≤ 0,25 y ≈ 0,05. Así que:
 *   1. **bombo** = lo que tiene al menos `BD_LOW` (0,42) de su energía por debajo de 800 Hz, en cualquier micro;
 *   2. **caja o platillo** = lo demás, y entre ellos manda el orden (el platillo es más agudo): la **claridad** (centroide + cruces por cero) de los últimos golpes que no son bombo; cuando
 *      forman **dos grupos bien separados**, aprende sus dos centros (el grave = caja, el agudo = platillo) y clasifica por el más cercano, ajustándolos despacio;
 *   3. mientras no haya visto los dos grupos, decide con los prototipos fijos (`defaultModel`), que son del laboratorio. Los centros se guardan y valen en la próxima sesión.
 * Puro y determinista: sin audio, solo cifras.
 */
import { defaultClassifier, PROTOTYPES } from './defaultModel'
import type { Classification } from './classifier'
import type { FeatureVector, Instrument } from './types'

export const ORDER: readonly Instrument[] = ['sd', 'hh']
/** el bombo: al menos esta parte de la energía por debajo de 800 Hz (iPhone ≥ 0,47; laboratorio ≈ 0,75; caja y platillo ≤ 0,25) */
export const BD_LOW = 0.42
/** claridad a medio camino entre la caja y el platillo de los prototipos del laboratorio */
export const LAB_MID = (PROTOTYPES.sd.centroid + PROTOTYPES.sd.zcr + PROTOTYPES.hh.centroid + PROTOTYPES.hh.zcr) / 2
/** golpes (que no son bombo) recordados para buscar los dos grupos, y los mínimos para fiarse */
export const HISTORY = 24
export const MIN_HITS = 6
export const MIN_PER_GROUP = 2
/** separación mínima entre los dos centros: relativa a su nivel y a lo que varía cada grupo por dentro (así vale con cualquier micro) */
export const MIN_REL_GAP = 0.12
export const GAP_OVER_SPREAD = 4
/** cuánto se mueve un centro hacia cada golpe nuevo */
export const DRIFT = 0.06

/** La claridad de un golpe: más alta = más agudo. */
export const brightness = (f: FeatureVector): number => f.centroid + f.zcr
/** La parte de la energía por debajo de 800 Hz. */
export const lowShare = (f: FeatureVector): number => f.bands[0] + f.bands[1]

const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length

/** Los dos centros ordenados (grave, agudo) de los `values` si forman dos grupos claros; si no, `null`. Corte de Otsu en 1-D (varianza entre grupos máxima). */
export function findCenters(values: readonly number[]): [number, number] | null {
  if (values.length < MIN_HITS) return null
  const v = [...values].sort((a, b) => a - b)
  const n = v.length
  const total = mean(v)
  let best: { i: number; score: number } | null = null
  for (let i = MIN_PER_GROUP; i <= n - MIN_PER_GROUP; i++) {
    const g = [v.slice(0, i), v.slice(i)]
    const score = g.reduce((s, x) => s + x.length * (mean(x) - total) ** 2, 0)
    if (!best || score > best.score) best = { i, score }
  }
  if (!best) return null
  const g = [v.slice(0, best.i), v.slice(best.i)]
  const c = g.map(mean) as [number, number]
  const spread = Math.sqrt(mean(g.flatMap((x, k) => x.map((y) => (y - c[k]!) ** 2))))
  if (c[1] - c[0] < Math.max(MIN_REL_GAP * mean(c), GAP_OVER_SPREAD * spread)) return null
  return c
}

export class AdaptiveClassifier {
  private readonly base = defaultClassifier()
  private history: number[] = []
  private centers: [number, number] | null

  /** `centers`: lo aprendido en otra sesión (opcional; se ignora si no tiene sentido). */
  constructor(centers?: readonly number[] | null) {
    this.centers = centers && centers.length === 2 && centers.every((x) => Number.isFinite(x) && x > 0) && centers[0]! < centers[1]! ? ([...centers] as [number, number]) : null
  }

  /** Los centros aprendidos (para guardarlos), o `null`. */
  learned(): [number, number] | null {
    return this.centers ? [...this.centers] : null
  }

  classify(f: FeatureVector): Classification {
    const abs = this.base.classify(f)
    const low = lowShare(f)
    // 1. el bombo, por sus graves: no depende del micro
    if (Number.isFinite(low) && low >= BD_LOW) {
      const win = Math.min(1, 0.6 + (low - BD_LOW))
      return { instrument: 'bd', confidence: win, nearestDistance: abs.nearestDistance, scores: { bd: win, sd: (1 - win) / 2, hh: (1 - win) / 2 } }
    }
    const b = brightness(f)
    if (!Number.isFinite(b)) return abs
    this.history.push(b)
    if (this.history.length > HISTORY) this.history.shift()
    // 2. caja o platillo: ¿ya hay dos grupos claros?
    if (this.history.length >= MIN_HITS && this.history.length % 2 === 0) {
      const found = findCenters(this.history)
      if (found) this.centers = found
    }
    let inst: Instrument
    let win = 0.67
    if (this.centers) {
      const k = Math.abs(b - this.centers[0]) <= Math.abs(b - this.centers[1]) ? 0 : 1
      this.centers[k] = this.centers[k]! + (b - this.centers[k]!) * DRIFT
      this.centers.sort((x, y) => x - y)
      inst = ORDER[k]!
      const d0 = Math.abs(b - this.centers[0])
      const d1 = Math.abs(b - this.centers[1])
      win = 0.5 + 0.5 * (1 - Math.min(d0, d1) / Math.max(d0, d1, 1e-9))
    } else {
      // 3. sin ver aún los dos grupos: por la claridad de los prototipos del laboratorio (a medio camino entre la caja y el platillo)
      inst = b >= LAB_MID ? 'hh' : 'sd'
      win = 0.6
    }
    const other = (1 - win) / 2
    const scores: Partial<Record<Instrument, number>> = { bd: other, sd: other, hh: other }
    scores[inst] = win
    return { instrument: inst, confidence: win, nearestDistance: abs.nearestDistance, scores }
  }
}

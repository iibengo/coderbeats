/**
 * El modelo por defecto que **se adapta a tu micro** (spec 001 §17.8). Un micro de móvil cambia el espectro (todo suena «un escalón más grave» que en la toma del laboratorio),
 * y con prototipos fijos el platillo cae en la caja y la caja en el bombo. Lo que **no** cambia es el orden: el «ts» siempre es más agudo que el «pff», y este que el «bum».
 * Así que se compara **entre sí** lo que va oyendo:
 *   - la **claridad** de un golpe es una sola cifra (centroide + cruces por cero): bum < pff < ts en cualquier micro;
 *   - mientras no haya visto las tres clases, clasifica con los prototipos fijos (`defaultModel`);
 *   - cuando entre los últimos golpes aparecen **tres grupos de claridad bien separados**, aprende sus centros (graves → bombo, medios → caja, agudos → platillo) y desde entonces
 *     clasifica por el centro más cercano, y los va ajustando despacio. Los centros se pueden guardar y volver a usar en la próxima sesión (mismo móvil, mismo micro).
 * Puro y determinista: sin audio, solo cifras.
 */
import { defaultClassifier } from './defaultModel'
import type { Classification } from './classifier'
import type { FeatureVector, Instrument } from './types'

export const ORDER: readonly Instrument[] = ['bd', 'sd', 'hh']
/** golpes recordados para buscar los tres grupos, y los mínimos para fiarse */
export const HISTORY = 24
export const MIN_HITS = 9
export const MIN_PER_GROUP = 2
/** separación mínima entre grupos vecinos (en unidades de claridad) y relativa a lo que varía cada grupo por dentro */
export const MIN_GAP = 0.08
export const GAP_OVER_SPREAD = 4
/** cuánto se mueve un centro hacia cada golpe nuevo */
export const DRIFT = 0.06

/** La claridad de un golpe: más alta = más agudo. */
export const brightness = (f: FeatureVector): number => f.centroid + f.zcr

const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length

/** Tres centros ordenados (grave, medio, agudo) de los `values` si forman tres grupos claros; si no, `null`. Corte de Otsu en 1-D (varianza entre grupos máxima). */
export function findCenters(values: readonly number[]): [number, number, number] | null {
  if (values.length < MIN_HITS) return null
  const v = [...values].sort((a, b) => a - b)
  const n = v.length
  const total = mean(v)
  let best: { i: number; j: number; score: number } | null = null
  for (let i = MIN_PER_GROUP; i <= n - 2 * MIN_PER_GROUP; i++)
    for (let j = i + MIN_PER_GROUP; j <= n - MIN_PER_GROUP; j++) {
      const g = [v.slice(0, i), v.slice(i, j), v.slice(j)]
      const score = g.reduce((s, x) => s + x.length * (mean(x) - total) ** 2, 0)
      if (!best || score > best.score) best = { i, j, score }
    }
  if (!best) return null
  const g = [v.slice(0, best.i), v.slice(best.i, best.j), v.slice(best.j)]
  const c = g.map(mean) as [number, number, number]
  const spread = Math.sqrt(mean(g.flatMap((x, k) => x.map((y) => (y - c[k]!) ** 2))))
  for (let k = 0; k < 2; k++) if (c[k + 1]! - c[k]! < Math.max(MIN_GAP, GAP_OVER_SPREAD * spread)) return null
  return c
}

export class AdaptiveClassifier {
  private readonly base = defaultClassifier()
  private history: number[] = []
  private centers: [number, number, number] | null

  /** `centers`: lo aprendido en otra sesión (opcional; se ignora si no tiene sentido). */
  constructor(centers?: readonly number[] | null) {
    this.centers = centers && centers.length === 3 && centers.every(Number.isFinite) && centers[0]! < centers[1]! && centers[1]! < centers[2]! ? ([...centers] as [number, number, number]) : null
  }

  /** Los centros aprendidos (para guardarlos), o `null`. */
  learned(): [number, number, number] | null {
    return this.centers ? [...this.centers] : null
  }

  classify(f: FeatureVector): Classification {
    const abs = this.base.classify(f)
    const b = brightness(f)
    if (Number.isFinite(b)) {
      this.history.push(b)
      if (this.history.length > HISTORY) this.history.shift()
    }
    // cada 3 golpes, ¿hay ya tres grupos claros? (si los hay, son los centros nuevos; si solo se ven dos, se sigue con los que se tengan)
    if (this.history.length >= MIN_HITS && this.history.length % 3 === 0) {
      const found = findCenters(this.history)
      if (found) this.centers = found
    }
    if (!this.centers || !Number.isFinite(b)) return abs
    const d = this.centers.map((c) => Math.abs(b - c))
    const k = d.indexOf(Math.min(...d))
    this.centers[k] = this.centers[k]! + (b - this.centers[k]!) * DRIFT
    // los centros nunca se cruzan
    this.centers.sort((x, y) => x - y)
    const inst = ORDER[k]!
    // la confianza: cuánto más cerca está del suyo que del siguiente más cercano
    const sorted = [...d].sort((x, y) => x - y)
    const margin = sorted[1]! > 0 ? 1 - sorted[0]! / sorted[1]! : 1
    const win = 0.5 + 0.5 * margin
    const other = (1 - win) / 2
    const scores: Partial<Record<Instrument, number>> = { bd: other, sd: other, hh: other }
    scores[inst] = win
    return { instrument: inst, confidence: win, nearestDistance: abs.nearestDistance, scores }
  }
}

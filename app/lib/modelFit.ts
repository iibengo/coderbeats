/**
 * ¿Acierta poco el modelo por defecto con esta voz? (spec 001, «Modelo por defecto»). Sin saber qué quería decir cada golpe, se mira **lo lejos que cae cada golpe de las
 * muestras de su clase**: la distancia al vecino más cercano en unidades de la distancia media entre muestras (`fit`). Con beatbox normal sale ~0,1 (medido con las tomas del
 * laboratorio; con voz cantada, ~1). Si la **mediana de los últimos golpes** pasa de `FIT_POOR`, se propone calibrar («¿te afino a tu voz?»). Puro.
 */
export const FIT_WINDOW = 12
export const FIT_MIN = 8
export const FIT_POOR = 0.45

export class FitMonitor {
  private recent: number[] = []

  /** Un golpe oído: su `fit` (distancia relativa; `null` si fue desconocido, que cuenta como muy lejos). */
  push(fit: number | null): void {
    this.recent.push(fit === null || !Number.isFinite(fit) ? 9 : fit)
    if (this.recent.length > FIT_WINDOW) this.recent.shift()
  }

  /** La mediana de los últimos golpes, o `null` si aún son pocos para opinar. */
  median(): number | null {
    if (this.recent.length < FIT_MIN) return null
    const s = [...this.recent].sort((a, b) => a - b)
    const m = s.length >> 1
    return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
  }

  /** ¿Acierta poco? */
  poor(): boolean {
    const m = this.median()
    return m !== null && m > FIT_POOR
  }

  reset(): void {
    this.recent = []
  }
}

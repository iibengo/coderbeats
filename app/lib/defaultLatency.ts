/**
 * La latencia de ida y vuelta (ms) cuando no se ha medido con las palmadas (spec 001, «Latencia por defecto»): un valor razonable para cascos de cable o altavoz, y uno
 * mayor si parece Bluetooth. Se detecta por el nombre de la salida de audio (cuando el navegador lo da) o por la latencia de salida que informa el contexto. Puro.
 */
export const DEFAULT_LATENCY_MS = 50
export const BLUETOOTH_LATENCY_MS = 180

const BT = /bluetooth|airpods|buds|beats|bose|jabra|sony wh|wh-1000|wf-1000|galaxy buds|pixel buds|hands-?free|a2dp|wireless/i

/** ¿Alguna de las salidas parece Bluetooth? */
export const looksBluetooth = (labels: readonly string[]): boolean => labels.some((l) => BT.test(l))

/**
 * La latencia que se usa sin calibrar: la medida si la hay (> 0); si no, la de Bluetooth si hay salida Bluetooth o el contexto informa una salida muy larga (> 120 ms),
 * y si no, la normal.
 */
export function fallbackLatencyMs(measured: number | null | undefined, o: { outputLabels?: readonly string[]; reportedOutputMs?: number } = {}): number {
  if (typeof measured === 'number' && Number.isFinite(measured) && measured > 0) return measured
  return looksBluetooth(o.outputLabels ?? []) || (o.reportedOutputMs ?? 0) > 120 ? BLUETOOTH_LATENCY_MS : DEFAULT_LATENCY_MS
}

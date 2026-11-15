/**
 * Producción (spec 014, fase 1): humanización con datos, **opcional** (las canciones guardadas no cambian sin que se active). Puro y determinista:
 * **swing** (se retrasa un poco la semicorchea de contratiempo) y **matices de volumen** (acentos en los tiempos, contratiempos más suaves, una variación pequeña y fija por
 * paso). Se expresan con `.nudge()` y `.gain()` de Strudel, así que el código mostrado suena igual en strudel.cc.
 */
export interface Production {
  /** 0..0,5: cuánto se retrasa, en fracción de semicorchea, la de contratiempo (los pasos impares) */
  swing: number
  /** 0..1: cuánto varía el volumen entre golpes */
  humanize: number
}

export const DEFAULT_PRODUCTION: Production = { swing: 0.16, humanize: 0.5 }

/** Hasta dónde se deja llegar cada ajuste (se limpia lo que venga de fuera). */
export const clampProduction = (p: Production): Production => ({
  swing: Math.min(0.5, Math.max(0, Number.isFinite(p.swing) ? p.swing : 0)),
  humanize: Math.min(1, Math.max(0, Number.isFinite(p.humanize) ? p.humanize : 0)),
})

/** Retraso (s) de cada paso por el swing: solo los pasos impares (la semicorchea de contratiempo). */
export function swingNudges(total: number, swing: number, stepSeconds: number): number[] {
  const d = Math.round(Math.min(0.5, Math.max(0, swing)) * stepSeconds * 1000) / 1000
  return Array.from({ length: total }, (_, i) => (i % 2 === 1 ? d : 0))
}

/** Un número 0..1 repetible a partir de un entero (mismo paso, misma variación). */
const hash01 = (n: number): number => {
  let x = (n * 2654435761) >>> 0
  x ^= x >>> 15
  x = Math.imul(x, 2246822519) >>> 0
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

/**
 * Factor de volumen de cada paso (1 = como está): el bombo se deja firme (casi sin variar); la caja varía poco; el platillo, más. Los tiempos fuertes (0, 4, 8, 12) suenan
 * un poco más y los pasos impares (contratiempo) un poco menos, más una variación fija de ±. Siempre entre 0,6 y 1.
 */
export function humanGains(instrument: string, total: number, humanize: number, seed = 1): number[] {
  const h = Math.min(1, Math.max(0, humanize))
  const depth = instrument === 'hh' ? 0.3 : instrument === 'sd' ? 0.15 : 0.05
  return Array.from({ length: total }, (_, i) => {
    const step = i % 16
    const accent = step % 4 === 0 ? 0 : step % 2 === 1 ? -0.5 : -0.2
    const jitter = (hash01(seed * 131 + i) - 0.5) * 0.6
    const g = 1 + h * depth * (accent + jitter)
    return Math.round(Math.min(1, Math.max(0.6, g)) * 100) / 100
  })
}

/**
 * El bajo del fondo como datos (spec 003, E1.3): notas con su paso y duración, más el timbre como
 * texto Strudel. `bassCode` genera la línea `note("…")` en mini-notación; con las notas de cada
 * estilo sale exactamente la línea literal de antes, así suena igual.
 */

export interface BassNote {
  /** semicorcheas desde el inicio del patrón (0 .. bars·16) */
  pos: number
  /** semicorcheas (≥ 1); no cruza la línea de compás */
  dur: number
  /** nombre de la nota en Strudel ('a1', 'bb0'…) */
  note: string
}

export interface BassPattern {
  bars: 1 | 2 | 4
  notes: BassNote[]
  /** timbre: lo que va detrás de note("…"), p. ej. '.s("triangle").lpf(600).gain(0.7)' */
  sound: string
}

const GRIDS = [1, 2, 4, 8, 16] as const

/** Mini-notación de un compás: la rejilla más gruesa que respeta inicios y duraciones. */
export function barMini(notes: readonly BassNote[]): string {
  const ok = (g: number) => {
    const len = 16 / g
    return notes.every((n) => n.pos % len === 0 && n.dur % len === 0)
  }
  const g = GRIDS.find(ok) ?? 16
  const len = 16 / g
  const tokens: string[] = []
  for (let slot = 0; slot < g; ) {
    const n = notes.find((x) => Math.round(x.pos / len) === slot)
    if (!n) {
      tokens.push('~')
      slot++
      continue
    }
    const k = Math.max(1, Math.min(g - slot, Math.round(n.dur / len)))
    tokens.push(k > 1 ? `${n.note}@${k}` : n.note)
    slot += k
  }
  return tokens.length === 1 ? tokens[0]! : `[${tokens.join(' ')}]`
}

/** Notas de un compás del patrón, con la posición relativa al compás (0..16). */
export function notesInBar(p: BassPattern, bar: number): BassNote[] {
  const b = ((bar % p.bars) + p.bars) % p.bars
  return p.notes
    .filter((n) => n.pos >= b * 16 && n.pos < b * 16 + 16)
    .map((n) => ({ ...n, pos: n.pos - b * 16, dur: Math.min(n.dur, b * 16 + 16 - n.pos) }))
    .sort((a, c) => a.pos - c.pos)
}

/** Línea Strudel del bajo (sin orbit ni coma). Ciclo de Strudel = compás global. */
export function bassCode(p: BassPattern): string {
  const bars = Array.from({ length: p.bars }, (_, b) => barMini(notesInBar(p, b)))
  const mini = bars.length === 1 ? bars[0]! : `<${bars.join(' ')}>`
  return `note("${mini}")${p.sound}`
}

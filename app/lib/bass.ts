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
  /**
   * Deslizamiento (spec 048, el 808 del drill): semitonos **desde los que arranca** la nota; la altura cae a la suya en `SLIDE_SECONDS` (envolvente de altura `penv`). Entero de −12 a 12;
   * sin él (y sin él en ninguna nota del patrón), el código es exactamente el de siempre.
   */
  slide?: number
}

/** lo que tarda el 808 en llegar a su nota al deslizarse (s) */
export const SLIDE_SECONDS = 0.2

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
  const slide = slideMini(p)
  return `note("${mini}")${p.sound}${slide ? `.penv("${slide}").pattack(0.001).pdecay(${SLIDE_SECONDS}).psustain(0)` : ''}`
}

const clampSlide = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? Math.max(-12, Math.min(12, Math.round(n))) : 0)

/** El patrón de `penv`: **la misma estructura que el de las notas** (mismos pasos, mismas duraciones, mismo reparto por compás) con el desplazamiento de cada nota (0 = sin deslizar). Vacío si ninguna nota se desliza. */
export function slideMini(p: BassPattern): string {
  if (!p.notes.some((n) => clampSlide(n.slide) !== 0)) return ''
  const bars = Array.from({ length: p.bars }, (_, b) => barMini(notesInBar(p, b).map((n) => ({ ...n, note: String(clampSlide(n.slide)) }))))
  return bars.length === 1 ? bars[0]! : `<${bars.join(' ')}>`
}

/**
 * La melodía como datos (spec 002, §8.1): sinte, registro, nombres de nota y mini-notación. Puro.
 *
 * Seguridad: lo que se escribe en el código Strudel es siempre un nombre sacado de `STRUDEL_NOTE` a partir de un
 * entero validado; nunca un valor leído tal cual de lo guardado.
 */
/** `drone`: un sine con mucha reverb, para fondos (la demo del dembow); no es de los que se eligen para cantar */
export type MelodySynth = 'lead' | 'piano' | 'pad' | 'drone' | 'riser'
export const MELODY_SYNTHS: readonly MelodySynth[] = ['lead', 'piano', 'pad', 'drone', 'riser']

/** Rango MIDI que se admite en un loop de melodía o bajo (C1–C7). */
export const MIDI_MIN = 24
export const MIDI_MAX = 96

export const isMidi = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= MIDI_MIN && v <= MIDI_MAX

const NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b']
/** Nombre de nota de Strudel de cada MIDI válido: 60 → "c4", 58 → "bb3". */
export const STRUDEL_NOTE: Readonly<Record<number, string>> = Object.fromEntries(
  Array.from({ length: MIDI_MAX - MIDI_MIN + 1 }, (_, i) => MIDI_MIN + i).map((m) => [m, `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`]),
)

/** Registro del sinte (spec 002, §5): la mediana de la melodía se coloca aquí, por octavas. */
export const REGISTER: Record<MelodySynth | 'bass', readonly [number, number]> = {
  lead: [60, 84], // C4–C6
  piano: [48, 72], // C3–C5
  pad: [48, 72], // C3–C5
  drone: [36, 60], // C2–C4
  riser: [48, 72], // ruido: la altura no cuenta (spec 008, §11)
  bass: [28, 52], // E1–E3
}

/** Líneas Strudel de cada sinte (sin orbit; spec 002, §6). Se afinan de oído. */
export const SYNTH_SOUND: Record<MelodySynth, string> = {
  piano: '.s("triangle").fm(1.5).fmh(2).decay(0.6).sustain(0.2).room(0.4)',
  lead: '.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)',
  pad: '.s("supersaw").attack(0.08).release(0.6).lpf(1200).room(0.8)',
  drone: '.s("sine").room(0.9)',
  // ruido rosa para los builds (spec 008, §11): la nota solo marca cuándo suena; el filtro de la célula lo abre
  riser: '.s("pink").attack(0.12).decay(0.2).sustain(0.7).release(0.05).gain(0.6).room(0.3)',
}

/** Golpe de una melodía: `pos` y `dur` en semicorcheas dentro del loop; `midi` entero. */
export interface MelodyHit {
  pos: number
  strength: number
  midi: number
  dur: number
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/**
 * Mini-notación de un compás de 16 pasos: cada nota `nombre@peso`, los huecos `~@peso`. Los pesos son enteros en
 * la rejilla más gruesa que respeta inicios y duraciones (pasos, o cuartos de paso si hay rejilla fina).
 */
function barMini(hits: readonly MelodyHit[], res: number): string {
  const sorted = [...hits].sort((a, b) => a.pos - b.pos)
  const tokens: string[] = []
  let at = 0
  const w = (n: number) => (n === 1 ? '' : `@${n}`)
  for (const h of sorted) {
    const start = Math.round(h.pos * res)
    const dur = Math.max(1, Math.round(h.dur * res))
    if (start > at) tokens.push(`~${w(start - at)}`)
    tokens.push(`${STRUDEL_NOTE[h.midi] ?? 'c4'}${w(dur)}`)
    at = start + dur
  }
  const total = 16 * res
  if (at < total) tokens.push(`~${w(total - at)}`)
  return tokens.join(' ')
}

/** Menor periodo (divisor del nº de compases) con el que se repiten los compases. */
function period(bars: string[]): number {
  for (let p = 1; p < bars.length; p++) {
    if (bars.length % p !== 0) continue
    if (bars.every((b, i) => b === bars[i % p])) return p
  }
  return bars.length
}

/**
 * Mini-notación del loop entero, con la fase como la batería: el ciclo `j` de Strudel suena el compás
 * `(j − phaseBar) mod bars` del loop. Compases repetidos colapsados. Una nota no cruza la línea de compás:
 * lo que sobre se recorta.
 */
export function melodyMini(hits: readonly MelodyHit[], bars: number, phaseBar: number): string {
  const valid = hits.filter((h) => isMidi(h.midi) && Number.isFinite(h.pos) && Number.isFinite(h.dur) && h.dur > 0)
  const fine = valid.some((h) => !Number.isInteger(h.pos) || !Number.isInteger(h.dur))
  const res = fine ? 4 : 1
  const perBar: string[] = []
  for (let b = 0; b < bars; b++) {
    const inBar = valid
      .filter((h) => Math.floor(h.pos / 16 + 1e-9) === b)
      .map((h) => ({ ...h, pos: h.pos - b * 16, dur: Math.min(h.dur, (b + 1) * 16 - h.pos) }))
    perBar.push(barMini(inBar, res))
  }
  const rot = Array.from({ length: bars }, (_, j) => perBar[mod(j - (Number.isFinite(phaseBar) ? phaseBar : 0), bars)]!)
  const unique = rot.slice(0, period(rot))
  return unique.length === 1 ? unique[0]! : `<${unique.map((b) => `[${b}]`).join(' ')}>`
}

/**
 * Overdub de una melodía ("completa", spec 002, §5): añade las notas de `add` al loop `base`. Monofónica: una nota
 * nueva solo entra en huecos libres; si empieza dentro de una existente se descarta, y si empieza en un hueco se
 * recorta contra la siguiente (y contra la línea de compás). Si `add` es más largo, el patrón base se repite.
 */
export function mergeMelody(
  base: { bars: 1 | 2 | 4; phaseBar: number; hits: readonly MelodyHit[] },
  add: { bars: 1 | 2 | 4; phaseBar: number; hits: readonly MelodyHit[] },
): { bars: 1 | 2 | 4; phaseBar: number; hits: MelodyHit[]; added: number } {
  const bars = Math.max(base.bars, add.bars) as 1 | 2 | 4
  const total = bars * 16
  const hits: MelodyHit[] = []
  for (let k = 0; k < bars / base.bars; k++) for (const h of base.hits) hits.push({ ...h, pos: h.pos + k * base.bars * 16 })
  hits.sort((a, b) => a.pos - b.pos)
  let added = 0
  const incoming = add.hits
    .map((h) => ({ ...h, pos: mod(h.pos + (add.phaseBar - base.phaseBar) * 16, total) }))
    .sort((a, b) => a.pos - b.pos)
  for (const h of incoming) {
    // ¿empieza dentro de una nota que ya suena?
    if (hits.some((x) => x.pos <= h.pos + 1e-9 && h.pos < x.pos + x.dur - 1e-9)) continue
    const next = hits.find((x) => x.pos > h.pos)
    const barEnd = (Math.floor(h.pos / 16 + 1e-9) + 1) * 16
    const dur = Math.min(h.dur, (next?.pos ?? Infinity) - h.pos, barEnd - h.pos, total - h.pos)
    if (dur < 0.25 - 1e-9) continue
    hits.push({ ...h, dur })
    hits.sort((a, b) => a.pos - b.pos)
    added++
  }
  return { bars, phaseBar: base.phaseBar, hits, added }
}

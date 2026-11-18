/**
 * La escala de una canción (spec 038). Un campo **opcional** del archivo/canción: `{ tonic: 0–11, mode: 'major' | 'minor' }` (menor natural). Sin él, todo
 * funciona como siempre. Sirve para saber contra qué escala ajustar lo que se canta (spec 039) y para avisar de las notas que se salen. Puro.
 */
export type ScaleMode = 'major' | 'minor'
export interface SongScale {
  /** clase de altura de la tónica: 0 = do … 11 = si */
  tonic: number
  mode: ScaleMode
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const SOLFEGE = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si']
/** como se escribe una escala cuyo nombre lleva bemol (do♯ menor se escribe así, pero si♭ mayor no «la♯ mayor») */
const FLAT_TONICS = new Set([1, 3, 6, 8, 10])
const SOLFEGE_FLAT = ['do', 're♭', 're', 'mi♭', 'mi', 'fa', 'sol♭', 'sol', 'la♭', 'la', 'si♭', 'si']

/** ¿Es una escala válida? Forma exacta: nada de campos de más (lo que se carga son datos, no código). */
export function isSongScale(x: unknown): x is SongScale {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false
  const s = x as Record<string, unknown>
  const keys = Object.keys(s)
  return keys.length === 2 && Number.isInteger(s.tonic) && (s.tonic as number) >= 0 && (s.tonic as number) <= 11 && (s.mode === 'major' || s.mode === 'minor')
}

/** Las 7 clases de altura de la escala (0–11), empezando por la tónica. */
export const scalePcs = (s: SongScale): number[] => (s.mode === 'major' ? MAJOR : MINOR).map((d) => (s.tonic + d) % 12)

const mod12 = (m: number): number => ((Math.round(m) % 12) + 12) % 12
/** ¿Esta nota (MIDI) está en la escala? */
export const inScale = (midi: number, s: SongScale): boolean => scalePcs(s).includes(mod12(midi))

/** «sol menor», «si♭ mayor» (en español, con ♭ en las tonalidades de bemol). */
export function scaleLabel(s: SongScale): string {
  const names = s.mode === 'minor' && !FLAT_TONICS.has(s.tonic) ? SOLFEGE : s.mode === 'major' && s.tonic !== 1 && s.tonic !== 6 ? SOLFEGE_FLAT : SOLFEGE
  return `${names[s.tonic]} ${s.mode === 'major' ? 'mayor' : 'menor'}`
}

const LETTER_PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }
const SOLFEGE_PC: Record<string, number> = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 }

/**
 * Lee una escala escrita a mano: «sol menor», «Gm», «La mayor», «G minor», «F#m», «si bemol mayor», «C». Sin modo, mayor.
 * `null` si no se entiende (el conversor avisa y no adivina).
 */
export function parseScale(text: string): SongScale | null {
  const raw = text.trim()
  if (!raw || raw.length > 40) return null
  let rest = raw.replace(/\s+/g, ' ')
  let pc: number | null = null
  // solfeo (do re mi fa sol la si) o letra (A–G); la «b» y la «B» de una letra sola se distinguen por la mayúscula/contexto
  const sol = /^(do|re|mi|fa|sol|la|si)(?![a-z])/i.exec(rest)
  if (sol) {
    pc = SOLFEGE_PC[sol[1]!.toLowerCase()]!
    rest = rest.slice(sol[0].length)
  } else {
    const l = /^([A-Ga-g])/.exec(rest)
    if (!l) return null
    pc = LETTER_PC[l[1]!.toLowerCase()]!
    rest = rest.slice(1)
  }
  // alteración pegada (# ♯ b ♭) o escrita (sostenido, bemol)
  const acc = /^\s*(#|♯|♭|b(?=m|\s|$)|sostenido|bemol)/i.exec(rest)
  if (acc) {
    const a = acc[1]!.toLowerCase()
    pc += a === '#' || a === '♯' || a === 'sostenido' ? 1 : -1
    rest = rest.slice(acc[0].length)
  }
  rest = rest.trim().toLowerCase()
  let mode: ScaleMode | null = null
  if (rest === '') mode = 'major'
  else if (['m', 'min', 'minor', 'menor', 'm.'].includes(rest)) mode = 'minor'
  else if (['maj', 'major', 'mayor'].includes(rest)) mode = 'major'
  if (!mode) return null
  // «GM» (M mayúscula) es mayor y «Gm» menor
  if (/^[A-G][#♯♭b]?M$/.test(raw)) mode = 'major'
  return { tonic: ((pc % 12) + 12) % 12, mode }
}

export interface WeightedNote {
  midi: number
  /** duración (o peso) de la nota */
  weight: number
}

/**
 * La escala que mejor encaja con unas notas (los acordes de la canción): la que deja menos peso fuera; si dos empatan (una mayor y su relativa menor
 * tienen las mismas notas), gana la que tiene la tónica en la nota más grave del primero y del último acorde. `null` si no hay notas.
 * `firstChord` y `lastChord` son las notas del primer y del último acorde (para desempatar).
 */
export function inferScale(notes: readonly WeightedNote[], firstChord: readonly number[] = [], lastChord: readonly number[] = []): SongScale | null {
  const total = notes.reduce((s, n) => s + Math.max(0, n.weight), 0)
  if (!notes.length || total <= 0) return null
  const lowestPc = (c: readonly number[]): number | null => (c.length ? mod12(Math.min(...c)) : null)
  const roots = [lowestPc(firstChord), lowestPc(lastChord)].filter((x): x is number => x !== null)
  let best: { s: SongScale; out: number; tonic: number } | null = null
  for (let tonic = 0; tonic < 12; tonic++)
    for (const mode of ['major', 'minor'] as const) {
      const s: SongScale = { tonic, mode }
      const pcs = scalePcs(s)
      const out = notes.reduce((a, n) => a + (pcs.includes(mod12(n.midi)) ? 0 : Math.max(0, n.weight)), 0)
      const tonicHits = roots.filter((r) => r === tonic).length
      if (!best || out < best.out - 1e-9 || (Math.abs(out - best.out) <= 1e-9 && tonicHits > best.tonic)) best = { s, out, tonic: tonicHits }
    }
  return best!.s
}

/** Las notas (MIDI) de una lista que se salen de la escala, sin repetir. */
export const outOfScale = (midis: readonly number[], s: SongScale): number[] => [...new Set(midis.filter((m) => !inScale(m, s)))]

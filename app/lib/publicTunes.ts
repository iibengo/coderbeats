/**
 * Melodías de **dominio público**, escritas como notas (sin arreglos modernos): Korobeiniki (canción popular rusa, siglo XIX), «En la gruta del rey de la montaña» (Grieg, 1875),
 * «Para Elisa» (Beethoven, 1810) y la Habanera de Carmen (Bizet, 1875, sobre «El arreglito» de Iradier).
 * ⚠ **Todas están escritas de memoria: revisar con la partitura** (IMSLP). Cada una en 8 compases (dos frases de 4: A y B); negra = 4 pasos, corchea = 2.
 */
export type Note = readonly [pos: number, dur: number, midi: number]

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
/** «E5:4 C#5:2 r:2 Bb4:8» → notas con su posición (los silencios, `r:n`, solo avanzan). */
export function parseTune(text: string): Note[] {
  const out: Note[] = []
  let pos = 0
  for (const tok of text.trim().split(/\s+/)) {
    const [name, d] = tok.split(':')
    const dur = Number(d)
    if (!name || !Number.isInteger(dur) || dur <= 0) throw new Error(`nota mal escrita: ${tok}`)
    if (name !== 'r') {
      const m = /^([A-G])(#|b)?(\d)$/.exec(name)
      if (!m) throw new Error(`nota mal escrita: ${tok}`)
      out.push([pos, dur, (Number(m[3]) + 1) * 12 + PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)] as const)
    }
    pos += dur
  }
  return out
}
/** Las mismas notas, `semitones` más arriba. */
export const shift = (notes: readonly Note[], semitones: number): Note[] => notes.map(([p, d, m]) => [p, d, m + semitones] as const)
/** Las mismas notas **más deprisa** (`k` = 2 o 4): el tema de 4 compases cabe `k` veces en 4 compases (para «acelerar» sin cambiar el tempo). */
export function fast(notes: readonly Note[], k: 2 | 4): Note[] {
  const out: Note[] = []
  for (let rep = 0; rep < k; rep++) for (const [p, d, m] of notes) out.push([p / k + rep * (64 / k), Math.max(1, d / k), m] as const)
  return out
}

// ── Korobeiniki (La menor): la primera frase y la segunda ──
export const KOROBEINIKI_A = parseTune('E5:4 B4:2 C5:2 D5:4 C5:2 B4:2  A4:4 A4:2 C5:2 E5:4 D5:2 C5:2  B4:6 C5:2 D5:4 E5:4  C5:4 A4:4 A4:8')
export const KOROBEINIKI_B = parseTune('D5:6 F5:2 A5:4 G5:2 F5:2  E5:6 C5:2 E5:4 D5:2 C5:2  B4:6 C5:2 D5:4 E5:4  C5:4 A4:4 A4:8')
// ── En la gruta del rey de la montaña (Si menor) ──
export const GRIEG_A = parseTune('B4:4 C#5:4 D5:4 E5:4  F#5:4 D5:4 F#5:8  F5:4 C#5:4 F5:8  E5:4 C5:4 E5:8')
export const GRIEG_B = parseTune('B4:4 C#5:4 D5:4 E5:4  F#5:4 D5:4 F#5:8  B5:4 A5:4 F#5:4 D5:4  F#5:8 B4:8')
// ── Para Elisa (La menor): el tema, en corcheas (el 3/8 original se pasa a compases de 8 corcheas) ──
export const ELISA_A = parseTune('E5:2 D#5:2 E5:2 D#5:2 E5:2 B4:2 D5:2 C5:2  A4:4 r:2 C4:2 E4:2 A4:2 B4:4  E4:2 G#4:2 B4:2 C5:4 r:6  E5:2 D#5:2 E5:2 D#5:2 E5:2 B4:2 D5:2 C5:2')
export const ELISA_B = parseTune('A4:4 r:2 C4:2 E4:2 A4:2 B4:4  E4:2 C5:2 B4:2 A4:8 r:2  E4:2 G#4:2 B4:2 C5:4 r:6  A4:16')
// ── Habanera de Carmen (Re menor): el descenso cromático, con el ritmo de habanera (corchea con puntillo + semicorchea) ──
export const HABANERA_A = parseTune('D5:6 C#5:2 C5:6 B4:2  Bb4:6 A4:2 A4:8  G#4:6 G4:2 F#4:6 F4:2  E4:6 Eb4:2 D4:8')
export const HABANERA_B = parseTune('D5:6 C#5:2 C5:6 B4:2  Bb4:6 A4:2 A4:8  A4:6 G4:2 F4:6 E4:2  D4:16')

// ── Lacrimosa (Mozart, Requiem K. 626, 1791; dominio público), en Re menor ──
/**
 * Como `parseTune`, pero en **corcheas de un compás de 12/8** (`C#5:1` = una corchea; `r:n` = silencio): cada compás de 12/8 son 12 corcheas y ocupa **2 compases de 4/4
 * (32 pasos)** a medio tiempo, así que una corchea dura 8/3 de paso (tercios de paso: el formato de la spec 028 §3 ya los admite).
 */
export function parseTune128(text: string): Note[] {
  const E = 8 / 3
  return parseTune(text).map(([p, d, m]) => [p * E, d * E, m] as const)
}
// Copiado de la partitura de Breitkopf & Härtel (IMSLP n.º 26746, escaneada; espejo en Wikimedia Commons; dominio público), página «7. Lacrymosa etc.», compases 1–4 de
// 12/8 (Larghetto, Re menor). Las notas del violín I (compases 1–2) coinciden con el MIDI de Wikimedia Commons («Mozart's Lacrimosa full.mid»). Las del Canto (3–4), leídas
// de la imagen midiendo la posición de cada cabeza respecto al pentagrama (clave de do en primera). No se han oído en la app.
/** el «suspiro» de los violines: dos corcheas ligadas en cada pulso (la primera cae en la corchea 2 de cada grupo de 3) */
export const LACRIMOSA_A = parseTune128('r:1 C#5:1 D5:1  r:1 G5:1 F#5:1  r:1 Bb5:1 A5:1  r:1 D6:1 C6:1  r:1 Bb5:1 G5:1  r:1 G5:1 D5:1  r:1 D5:1 Bb4:1  r:1 Bb4:1 G4:1')
/** el canto («La-cry-mo-sa di-es il-la»): la4 larga, fa5, re5, re5 larga y do♯5; dos veces */
export const LACRIMOSA_B = parseTune128('A4:4 F5:1 D5:1 D5:3 C#5:1 r:2  A4:4 F5:1 D5:1 D5:3 C#5:1 r:2')

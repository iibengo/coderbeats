/**
 * Nombres de nota del Órgano (spec 037). Sin el interruptor, el rótulo de las filas es el de siempre (`C4`, `F♯4`); con él,
 * sigue el idioma de la app: do re mi… en español y euskera, C D E… en inglés. Lógica pura.
 */
const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const SOLFEGE = ['do', 'do♯', 're', 're♯', 'mi', 'fa', 'fa♯', 'sol', 'sol♯', 'la', 'la♯', 'si']

const pc = (m: number): number => ((Math.round(m) % 12) + 12) % 12
const octave = (m: number): number => Math.floor(Math.round(m) / 12) - 1

/** ¿Este idioma nombra las notas con letras? (inglés); el resto, con do re mi */
export const usesLetters = (lang: string): boolean => lang.toLowerCase().startsWith('en')

/** El nombre de la nota con su octava: `sol4` o `G4`. */
export function noteName(midi: number, lang: string): string {
  return `${(usesLetters(lang) ? LETTERS : SOLFEGE)[pc(midi)]}${octave(midi)}`
}

/** El rótulo de una fila: sin el interruptor, exactamente el de siempre (`C4`, `F♯4`). */
export function rowLabel(midi: number, lang: string, namesOn: boolean): string {
  return namesOn ? noteName(midi, lang) : `${LETTERS[pc(midi)]}${octave(midi)}`
}

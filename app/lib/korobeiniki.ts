/**
 * Korobeiniki en techno (spec 053): **arreglo propio de coderbeats**. Solo la melodía popular rusa (siglo XIX, dominio público; notas de memoria, `publicTunes.ts`) es de otro:
 * el bajo, los acordes, el ritmo, el fraseo y la forma son nuestros y **no copian el arreglo de Tetris** (Nintendo, 1989), que sí tiene derechos.
 *
 * Cómo se aparta del original: el tema **no se toca de seguido**, sino en trozos; suena **corto y picado** (staccato, como un pluck de techno), no ligado; el bajo late **a contratiempo**
 * (el «oontz» entre bombos) y no hace el vaivén de bajo y acorde del original; los acordes son stabs sincopados sobre una progresión propia (Do menor – La♭ – Si♭), y el segundo drop
 * **recombina** las dos frases (la primera y la segunda mezcladas), cosa que el original no hace.
 * Todo en Do menor (la tonalidad del estilo `techno2`): la melodía, tres semitonos más arriba que en La menor.
 */
import { KOROBEINIKI_A, KOROBEINIKI_B, shift, type Note } from './publicTunes'

/** pasos de un compás de 4/4 (semicorcheas) */
const BAR = 16
/** semitonos que se sube la melodía: La menor → Do menor */
export const KORO_SHIFT = 3

/** Las notas que empiezan en `[from, to)` pasos, contadas desde `from`; lo que se pasa del final se recorta. */
export function cut(notes: readonly Note[], from: number, to: number): Note[] {
  const out: Note[] = []
  for (const [p, d, m] of notes) if (p >= from && p < to) out.push([p - from, Math.min(d, to - p), m] as const)
  return out
}
/** Las mismas notas, cada una como mucho de `max` pasos (picado). */
export const staccato = (notes: readonly Note[], max = 2): Note[] => notes.map(([p, d, m]) => [p, Math.min(d, max), m] as const)
/** Las notas de `a` seguidas de las de `b` desplazadas `at` pasos. */
const then = (a: readonly Note[], b: readonly Note[], at: number): Note[] => [...a, ...b.map(([p, d, m]) => [p + at, d, m] as const)]

const A = shift(KOROBEINIKI_A, KORO_SHIFT)
const B = shift(KOROBEINIKI_B, KORO_SHIFT)

/** el gancho: solo el primer compás y medio de la primera frase (el «suspiro»), y luego aire; abre y cierra la canción */
export const KORO_HOOK: readonly Note[] = cut(A, 0, 2 * BAR)
/** el tema de las estrofas y del primer drop: la primera frase entera, **picada** */
export const KORO_TUNE: readonly Note[] = staccato(A)
/** la subida: la segunda frase (la que salta hasta el agudo), **ligada**: cambia la melodía antes del drop */
export const KORO_CLIMB: readonly Note[] = B
/** el segundo drop: la primera frase y la segunda **mezcladas** (compás 1 de la primera, compás 2 de la segunda, y el final que comparten), picadas */
export const KORO_TUNE2: readonly Note[] = staccato(then(then(cut(A, 0, BAR), cut(B, BAR, 2 * BAR), BAR), cut(A, 2 * BAR, 4 * BAR), 2 * BAR))
/** el respiro del break: la segunda frase, sin picar (suena a pad) */
export const KORO_BREAK: readonly Note[] = B

/** Raíces del bajo y de los acordes, un compás cada una (progresión propia): Do – Do – La♭ – Si♭ en el loop de 4 compases, o su cambio para la subida. */
const ROOTS_A = [36, 36, 32, 34] as const
const ROOTS_CLIMB = [36, 36, 34, 34] as const
const CHORDS: Record<number, readonly number[]> = { 36: [60, 63, 67], 32: [56, 60, 63], 34: [58, 62, 65] }

/** El bajo **a contratiempo** (pasos 2, 6, 10 y 14: entre los bombos): una nota de dos pasos por golpe. */
export function koroBass(roots: readonly number[]): Note[] {
  return roots.flatMap((root, b) => [2, 6, 10, 14].map((s) => [b * BAR + s, 2, root] as const))
}
/** Los acordes: stabs cortos y sincopados (pasos 6 y 14 de cada compás). */
export function koroStabs(roots: readonly number[]): Note[] {
  return roots.flatMap((root, b) => [6, 14].flatMap((s) => CHORDS[root]!.map((m) => [b * BAR + s, 1, m] as const)))
}
export const KORO_BASS = koroBass(ROOTS_A)
export const KORO_BASS_CLIMB = koroBass(ROOTS_CLIMB)
export const KORO_STABS = koroStabs(ROOTS_A)

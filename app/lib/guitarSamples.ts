/**
 * La guitarra sampleada (spec 036): 7 notas sueltas de una Hofner Club (Black And Green Guitars, Karoryfer, CC0), una cada 5 semitonos; el motor
 * (superdough) sube o baja la más cercana. Strudel solo descarga una muestra cuando suena por primera vez: una canción sin guitarra no las pide.
 */
export const GUITAR_SAMPLE = 'hofner'
export const GUITAR_NOTES = ['e3', 'a3', 'd4', 'g4', 'c5', 'f5', 'a5'] as const
/** el mapa para `samples()`: nota → archivo (relativo a la carpeta de samples, o al repositorio de kits en strudel.cc) */
export const guitarMap = (prefix = 'guitar/'): Record<string, string[]> => Object.fromEntries(GUITAR_NOTES.map((n) => [n, [`${prefix}${n}.wav`]]))
/** donde las encuentra strudel.cc (etiqueta v2 de coderbeats-kits, que publica Ion) */
export const GUITAR_SAMPLES_URL = 'github:iibengo/coderbeats-kits/v2'

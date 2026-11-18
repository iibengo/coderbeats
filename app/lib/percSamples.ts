/**
 * La percusión del minimal (spec 045): cinco sonidos del uzu-drumkit (Unlicense; el kit por defecto de strudel.cc), en `public/samples/techno/`. Son **sintes de melodía** de muestra (como `guitarSample`):
 * un loop `mel` con su patrón propio de pasos (cualquiera, también fuera de tiempo) y la nota fija. Se llaman con los nombres de strudel (`rim`, `cb`, `mt`, `sh`, `misc`), así que **el código mostrado suena igual
 * pegado en strudel.cc**, sin `samples()` ni avisos. No son capas de la melodía: el Órgano, el aviso de «melodías apiladas» y el tope de melodías no los cuentan.
 */
export const PERC_SYNTHS = ['rim', 'click', 'cowbell', 'tom', 'shaker'] as const
export type PercSynth = (typeof PERC_SYNTHS)[number]
export const isPercSynth = (s: string | undefined): boolean => !!s && (PERC_SYNTHS as readonly string[]).includes(s)
/** la nota con la que suenan (C2: la muestra a su altura original) */
export const PERC_MIDI = 36
/** lo que registra el motor (nombre de strudel → archivos de `public/samples/`); `misc` repite el clic para que `.n(1)` caiga en él, como en el kit de strudel */
export const PERC_SAMPLES: Record<string, string[]> = {
  rim: ['techno/rim.wav'],
  cb: ['techno/cb.wav'],
  mt: ['techno/tom.wav'],
  sh: ['techno/sh.wav'],
  misc: ['techno/click.wav', 'techno/click.wav'],
}

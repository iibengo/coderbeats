/**
 * La frontera del motor (spec 017 §4): lo reutilizable, separado de la interfaz del Estudio.
 * El Laboratorio (`app/components/lab`, `app/pages/lab`) importa **solo** de aquí (y de `~/lib/lab`), nunca de los componentes del Estudio:
 * lo comprueba `tests/unit/engineBoundary.test.ts`.
 *
 * Audio: `useAudioEngine` (Strudel/superdough, reloj, melodías de dedo, efectos). Estilos y kits: `STYLES`, `KITS`, `STYLE_MUSIC`.
 * Melodías: biblioteca de temas adaptados al estilo. Guardado y compartir: biblioteca de canciones y enlaces. Vídeo: `useVideoExport`.
 */
export { useAudioEngine } from '~/composables/useAudioEngine'
export { STYLES, KITS } from '~/lib/constants'
export { STYLE_MUSIC } from '~/lib/styles'
export { scaleNotes } from '~/lib/waterKeys'
export { TUNES, tunesFor, adaptTune, type Tune } from '~/lib/tuneLibrary'
export { DEMOS } from '~/lib/demos'
export { LIBRARY_KEY } from '~/lib/library'
export { encodeShare, shareUrl } from '~/lib/shareLink'
export { useVideoExport } from '~/composables/useVideoExport'
export { VOICE_HEX } from '~/lib/palette'
export type { StyleId, KitId, Instrument } from '~/lib/types'

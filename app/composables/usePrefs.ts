import type { BackgroundMode, Parts } from '~/lib/background'
import { isSong, songFromLoops, storableSong } from '~/lib/cells'
import { kitFromSaved } from '~/lib/constants'
import type { LoopsState } from '~/lib/freeLoops'
import { restoreImageDelay } from '~/lib/imageDelay'
import { readJson, writeJson } from '~/lib/storage'
import { migrateRepeatMode } from '~/lib/prefsMigration'
import { isStoredPrefs } from '~/lib/prefsGuard'
import type { LoopLength } from '~/lib/phrases'
import type { SongFx } from '~/lib/song'
import { modeFromSaved, type Mode } from '~/lib/modes'
import type { KitId, StyleId } from '~/lib/types'
import type { PhraseMode, RepeatMode } from './useAudioEngine'

const PREFS_KEY = 'coderbeats:prefs:v1'
/** antes de la spec 005: solo loops; se migra a una canción de una célula y se deja de escribir */
const LOOPS_KEY = 'coderbeats:loops:v1'
const SONG_KEY = 'coderbeats:song:v1'

export interface StudioPrefs {
  version: 1
  kit: KitId
  style: StyleId
  assist: boolean
  metronome: boolean
  bgMode: BackgroundMode
  bgManual?: Parts
  phraseMode: PhraseMode
  repeatMode: RepeatMode
  phraseCloseBeats: 1 | 2 | 4
  maxPhraseBars: LoopLength
  fx: SongFx
  theme: string
  /** guardadas con "completa" como valor por defecto (§16.21): un "sustituye" guardado es elegido */
  completeDefault?: boolean
  /** retraso de imagen (spec 003, E6): automático según la calibración y ajuste fino (ms); por dispositivo */
  imageAuto?: boolean
  imageFineMs?: number
  /** melodía con la voz (spec 002, F1; beta, apagada por defecto) */
  melody?: boolean
  /** el modo (spec 011): Jugar o Componer; por dispositivo, no se guarda con la canción */
  mode?: Mode
  /** sugerencias (spec 012, §3.4): melodía sugerida y variaciones; por defecto encendidas */
  suggestions?: boolean
  /** producción (spec 014): swing y matices; por defecto apagada */
  production?: boolean
}

const isPrefs = (x: unknown): x is StudioPrefs => isStoredPrefs(x)
const isLoops = (x: unknown): x is LoopsState =>
  !!x && typeof x === 'object' && Array.isArray((x as LoopsState).loops) && typeof (x as LoopsState).nextId === 'number'

/**
 * Persistencia de ajustes y loops (§16.16). Al montar el estudio carga lo guardado en el motor
 * y desde entonces guarda cada cambio.
 */
export function usePrefs() {
  const engine = useAudioEngine()

  function load() {
    const p = readJson(PREFS_KEY, isPrefs)
    if (p) {
      engine.kit.value = kitFromSaved(p.kit) ?? 'electro'
      engine.style.value = p.style
      engine.setAssist(p.assist)
      engine.metronome.value = p.metronome && !engine.echo.value?.bleed
      engine.bgMode.value = p.bgMode
      engine.mode.value = modeFromSaved(p.mode)
      engine.suggestions.value = p.suggestions ?? true
      engine.production.value = p.production === true
      if (p.bgManual) engine.setBackgroundManual(p.bgManual)
      engine.setPhraseOptions({ mode: p.phraseMode, closeBeats: p.phraseCloseBeats, maxBars: p.maxPhraseBars })
      // 'accumulate' (antes de §16.19) y el "sustituye" por defecto de antes de §16.21 pasan a 'complete'
      engine.setRepeatMode(migrateRepeatMode(p.repeatMode, p.completeDefault))
      engine.setFx(p.fx)
      // sin lo guardado (antes de E6): automático y sin ajuste fino
      engine.setImageDelay(restoreImageDelay(p))
      engine.setMelody(p.melody === true)
      // los bajos editados de antes de E3.8 se borran: vuelve el de cada estilo (spec 003, E1.4)
      if ('bassEdits' in p) {
        const { bassEdits: _old, ...rest } = p as StudioPrefs & { bassEdits?: unknown }
        writeJson(PREFS_KEY, rest)
      }
    }
    if (engine.loops.value.loops.length) return
    const song = readJson(SONG_KEY, isSong)
    if (song) return engine.setSong(song)
    const l = readJson(LOOPS_KEY, isLoops)
    if (l) engine.setSong(songFromLoops(l, p?.bgManual))
  }

  function startSaving() {
    watch(
      () =>
        ({
          version: 1,
          kit: engine.kit.value,
          style: engine.style.value,
          assist: engine.assist.value,
          metronome: engine.metronome.value,
          bgMode: engine.bgMode.value,
          bgManual: { ...engine.bgManual.value },
          phraseMode: engine.phraseMode.value,
          repeatMode: engine.repeatMode.value,
          phraseCloseBeats: engine.phraseCloseBeats.value,
          maxPhraseBars: engine.maxPhraseBars.value,
          fx: { ...engine.fx },
          theme: 'water',
          completeDefault: true,
          imageAuto: engine.imageAuto.value,
          imageFineMs: engine.imageFineMs.value,
          melody: engine.melodyOn.value,
          mode: engine.mode.value,
          suggestions: engine.suggestions.value,
          production: engine.production.value,
        }) satisfies StudioPrefs,
      (p) => writeJson(PREFS_KEY, p),
      { deep: true },
    )
    watch([engine.song, engine.loops, engine.bgManual], () => writeJson(SONG_KEY, storableSong(engine.liveSong())))
  }

  return { load, startSaving }
}

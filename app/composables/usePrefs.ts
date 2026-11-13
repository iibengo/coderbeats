import type { BackgroundMode, Parts } from '~/lib/background'
import type { BassPattern } from '~/lib/bass'
import type { LoopsState } from '~/lib/freeLoops'
import { migrateRepeatMode } from '~/lib/prefsMigration'
import type { LoopLength } from '~/lib/phrases'
import type { SongFx } from '~/lib/song'
import type { KitId, StyleId } from '~/lib/types'
import type { PhraseMode, RepeatMode } from './useAudioEngine'

const PREFS_KEY = 'coderbeats:prefs:v1'
const LOOPS_KEY = 'coderbeats:loops:v1'

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
  /** bajo editado en el aro, por estilo (spec 003, E1.4) */
  bassEdits?: Partial<Record<StyleId, BassPattern>>
}

function read<T>(key: string, valid: (x: unknown) => x is T): T | null {
  try {
    const raw = localStorage.getItem(key)
    const v: unknown = raw ? JSON.parse(raw) : null
    return valid(v) ? v : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sin almacenamiento (modo privado): solo vale para esta sesión
  }
}

const isPrefs = (x: unknown): x is StudioPrefs => !!x && typeof x === 'object' && (x as StudioPrefs).version === 1
const isLoops = (x: unknown): x is LoopsState =>
  !!x && typeof x === 'object' && Array.isArray((x as LoopsState).loops) && typeof (x as LoopsState).nextId === 'number'

/**
 * Persistencia de ajustes y loops (§16.16). Al montar el estudio carga lo guardado en el motor
 * y desde entonces guarda cada cambio.
 */
export function usePrefs() {
  const engine = useAudioEngine()

  function load() {
    const p = read(PREFS_KEY, isPrefs)
    if (p) {
      engine.kit.value = p.kit
      engine.style.value = p.style
      engine.setAssist(p.assist)
      engine.metronome.value = p.metronome && !engine.echo.value?.bleed
      engine.bgMode.value = p.bgMode
      if (p.bgManual) engine.setBackgroundManual(p.bgManual)
      engine.setPhraseOptions({ mode: p.phraseMode, closeBeats: p.phraseCloseBeats, maxBars: p.maxPhraseBars })
      // 'accumulate' (antes de §16.19) y el "sustituye" por defecto de antes de §16.21 pasan a 'complete'
      engine.setRepeatMode(migrateRepeatMode(p.repeatMode, p.completeDefault))
      engine.setFx(p.fx)
      if (p.bassEdits) engine.bassEdits.value = p.bassEdits
    }
    const l = read(LOOPS_KEY, isLoops)
    if (l && !engine.loops.value.loops.length) engine.setLoops(l)
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
          bassEdits: engine.bassEdits.value,
          completeDefault: true,
        }) satisfies StudioPrefs,
      (p) => write(PREFS_KEY, p),
      { deep: true },
    )
    watch(engine.loops, (l) => write(LOOPS_KEY, { ...l, loops: l.loops.map(({ prev: _prev, ...rest }) => rest) }))
  }

  return { load, startSaving }
}

// Laboratorio de instrumentos: lo común de las pantallas (sin micro, sin tocar lo guardado). Reutiliza el motor tal cual: estilo, bajo y acordes del fondo, loops de batería.
import { DEMOS } from '~/lib/demos'
import type { Parts } from '~/lib/background'
import type { FreeLoop } from '~/lib/freeLoops'
import { drumLoop, LAB_INSTRUMENTS } from '~/lib/lab'
import { adaptTune, tunesFor, TUNES, type Tune } from '~/lib/tuneLibrary'
import type { Instrument, StyleId } from '~/lib/types'

export const LAB_STYLES: { id: StyleId; label: string }[] = [
  { id: 'hiphop90', label: 'hip hop' },
  { id: 'house', label: 'house' },
  { id: 'dnb', label: 'dnb' },
  { id: 'dembow', label: 'dembow' },
  { id: 'techno', label: 'techno' },
]

/** los pasos (0..15) de la demo de un estilo para un instrumento */
export const demoSteps = (style: StyleId, inst: Instrument): number[] =>
  DEMOS[style][inst].split(' ').map((t, i) => (t === '~' ? -1 : i)).filter((s) => s >= 0)

/** la melodía del estilo (la primera que encaje; si ninguna encaja, la primera de la biblioteca) como loop de 4 compases */
export function tuneFor(style: StyleId, idx = 0): Tune {
  const list = tunesFor(style)
  return list.length ? list[idx % list.length]! : TUNES[0]!
}

export function useLab() {
  const engine = useAudioEngine()
  const ready = computed(() => engine.ready.value)
  const playing = engine.playing
  const style = engine.style

  /** entra al audio sin micro (si no estaba ya) */
  async function begin() {
    if (!engine.ready.value) await engine.start(null, { noMic: true })
  }

  /**
   * Pone una escena: las capas de batería indicadas (con sus pasos), el fondo y, si `melody`, el tema del estilo como loop de melodía.
   * Siempre una sola célula; sonando, entra en el siguiente compás.
   */
  async function scene(opts: { drums?: Partial<Record<Instrument, number[]>>; muted?: Partial<Record<Instrument, boolean>>; parts?: Parts; melody?: boolean | 'muted'; extra?: FreeLoop[] }): Promise<number[]> {
    await begin()
    await engine.clearAll()
    const loops: FreeLoop[] = []
    let id = 1
    for (const inst of LAB_INSTRUMENTS) {
      const steps = opts.drums?.[inst]
      if (steps) loops.push(drumLoop(id++, inst, steps, !!opts.muted?.[inst]))
    }
    if (opts.melody) {
      const hits = adaptTune(tuneFor(style.value), style.value)
      loops.push({ id: id++, instrument: 'mel', bars: 4, phaseBar: 0, hits: hits.map((h) => ({ pos: h.pos, strength: 0.8, midi: h.midi, dur: h.dur })), muted: opts.melody === 'muted', bornAt: 0, fromTemplate: false })
    }
    // capas propias (spec 018): llegan hechas y con su estado; reciben ids nuevos, que se devuelven en el mismo orden
    const extraIds: number[] = []
    for (const e of opts.extra ?? []) {
      extraIds.push(id)
      loops.push({ ...e, id: id++ })
    }
    engine.setBackgroundMode('manual')
    engine.setBackgroundManual(opts.parts ?? { bass: false, chords: false })
    engine.editLoops({ loops, nextId: id })
    return extraIds
  }

  async function changeStyle(id: StyleId) {
    await begin()
    await engine.setStyle(id)
  }

  /** el primer toque pone a sonar la base (la persona decide cuándo empieza, principio 4) */
  async function start() {
    await begin()
    if (!engine.playing.value) await engine.play()
  }
  const stopAll = () => engine.stopAll()

  return { engine, ready, playing, style, begin, scene, changeStyle, start, stopAll }
}

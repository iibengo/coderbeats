import { STYLES, KITS } from './constants'
import { loopGains, fmtGain } from './mix'
import { filterDjf, spaceParams, warmthShape } from './gestures'
import { STYLE_MUSIC } from './styles'
import { tokensToMini } from './strudel'
import type { FreeLoop } from './freeLoops'
import type { KitId, StyleId } from './types'
import { anyPart, type BackgroundMode, type Parts } from './background'
import { bassCode } from './bass'

export interface SongFx {
  /** 0..1 (1 = abierto) */
  filter: number
  space: number
  warmth: number
}

export interface SongState {
  loops: FreeLoop[]
  style: StyleId
  kit: KitId
  /** modo del fondo y partes que han entrado (o están entrando) */
  background: { mode: BackgroundMode; parts: Parts }
  metronome: boolean
  fx: SongFx
}

/**
 * - display: el código que se enseña y se copia (valores fijos, sin metrónomo ni ganchos).
 * - engine: el que se evalúa: igual, pero los efectos van por ref(), lleva siempre las dos partes del
 *   fondo (las abre/cierra el motor con nodos nativos), metrónomo, pulso, etiquetas y onTrigger.
 */
export type SongMode = 'display' | 'engine'

/** Nombre global con el que el motor expone valores y callbacks al código evaluado. */
export const ENGINE_GLOBAL = '__cb'

const mod = (a: number, n: number) => ((a % n) + n) % n
const round3 = (x: number) => Math.round(x * 1000) / 1000
const IND = '  '

export const DUCK = '.duckorbit("2:3").duckdepth(0.6).duckattack(0.15)'

/** Tokens de s() y de nudge() (rotados a la fase global) de un loop. */
export function loopTokens(
  loop: Pick<FreeLoop, 'bars' | 'phaseBar' | 'hits' | 'instrument'>,
  stepSeconds: number,
): { s: string[]; nudge: string[] | null } {
  const total = loop.bars * 16
  const slots: (string | null)[] = new Array(total).fill(null)
  const nudges: number[] = new Array(total).fill(0)
  for (const h of loop.hits) {
    const step = mod(Math.round(h.pos), total)
    if (slots[step] !== null) continue
    slots[step] = loop.instrument
    nudges[step] = round3((h.pos - Math.round(h.pos)) * stepSeconds)
  }
  // ciclo j de Strudel (j mod bars) ← compás (j − phaseBar) mod bars del loop
  const rot = (arr: string[]) =>
    Array.from({ length: loop.bars }, (_, j) => {
      const k = mod(j - loop.phaseBar, loop.bars)
      return arr.slice(k * 16, k * 16 + 16)
    }).flat()
  const s = rot(slots.map((x) => x ?? '~'))
  const hasNudge = nudges.some((n) => n !== 0)
  return { s, nudge: hasNudge ? rot(nudges.map((n) => String(n))) : null }
}

function loopLine(
  loop: FreeLoop,
  st: SongState,
  gain: number,
  stepSeconds: number,
  mode: SongMode,
  duck: boolean,
  version: 'current' | 'prev' = 'current',
): string {
  const kit = KITS[st.kit]
  const src = version === 'prev' && loop.prev ? { ...loop, ...loop.prev } : loop
  const { s, nudge } = loopTokens(src, stepSeconds)
  let line = `s("${tokensToMini(s)}").bank("${kit.strudelBank}")`
  const n = kit.sampleIndex[loop.instrument]
  if (n !== 0) line += `.n(${n})`
  if (nudge) line += `.nudge("${tokensToMini(nudge)}")`
  if (Math.abs(gain - 1) > 0.005) line += `.gain(${fmtGain(gain)})`
  if (loop.instrument === 'bd' && duck) line += DUCK
  if (mode === 'engine') {
    const cond = version === 'prev' ? `h.whole.begin < ${loop.bornAt}` : `h.whole.begin >= ${loop.bornAt}`
    line += `.color("l${loop.id}").filterHaps((h) => ${cond})`
  }
  return loop.muted ? `// ${line}` : line
}

/** Código Strudel completo del estado. Determinista. */
export function songCode(st: SongState, mode: SongMode = 'display'): string {
  const style = STYLES[st.style]
  const music = STYLE_MUSIC[st.style]
  const stepSeconds = 60 / style.bpm / 4
  const engine = mode === 'engine'
  const g = ENGINE_GLOBAL
  const gains = loopGains(st.loops)
  const out: string[] = [`setcpm(${style.bpm}/4)`, 'stack(']

  const bgOn = st.background.mode !== 'off'
  const showBass = engine ? bgOn : st.background.parts.bass
  const showChords = engine ? bgOn : st.background.parts.chords
  if (showBass || showChords) {
    out.push(`${IND}// fondo · ${style.label.toLowerCase()} · ${music.key}`)
    if (showBass) out.push(`${IND}${bassCode(music.background.bass)}.orbit(2)${engine ? '.color("bass")' : ''},`)
    if (showChords)
      for (const l of music.background.chords) out.push(`${IND}${l}.orbit(3)${engine ? '.color("chords")' : ''},`)
  }
  if (engine) {
    out.push(`${IND}note("c0").s("sine").gain(0).color("pulse"),`)
    if (st.metronome) out.push(`${IND}note("[g6 c6 c6 c6]").s("sine").decay(0.03).sustain(0).gain(0.25).orbit(4).color("click"),`)
  }
  const duck = engine ? bgOn : anyPart(st.background.parts)

  // efectos sobre tus loops (sub-stack): espacio y calor
  const space = spaceParams(st.fx.space)
  const shape = warmthShape(st.fx.warmth)
  const drumFx = engine
    ? `.room(ref(() => ${g}.fx.room)).delay(ref(() => ${g}.fx.delay)).shape(ref(() => ${g}.fx.shape))`
    : (space.room > 0 ? `.room(${space.room})` : '') +
      (space.delay > 0 ? `.delay(${space.delay})` : '') +
      (shape > 0 ? `.shape(${shape})` : '')

  if (st.loops.length) {
    out.push(`${IND}// tus loops`)
    const lines = st.loops.flatMap((l) => {
      const g = gains.get(l.id) ?? 1
      const current = loopLine(l, st, g, stepSeconds, mode, duck)
      // en el motor, la versión anterior sigue sonando hasta el nacimiento de la nueva
      return engine && l.prev ? [loopLine(l, st, g, stepSeconds, mode, duck, 'prev'), current] : [current]
    })
    if (drumFx) {
      out.push(`${IND}stack(`)
      for (const l of lines) out.push(`${IND}${IND}${l},`)
      out.push(`${IND})${drumFx},`)
    } else for (const l of lines) out.push(`${IND}${l},`)
  }
  if (!showBass && !showChords && !st.loops.length && !engine) out.push(`${IND}silence,`)

  const djf = filterDjf(st.fx.filter)
  let tail = ')'
  if (engine) tail += `.djf(ref(() => ${g}.fx.djf)).onTrigger((hap, ct, cps, t) => ${g}.trig(hap, t), false)`
  else if (djf < 0.5) tail += `.djf(${djf})`
  out.push(tail)
  return out.join('\n')
}

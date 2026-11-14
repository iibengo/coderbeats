import { STYLES, KITS, INSTRUMENTS } from './constants'
import { loopGains, fmtGain } from './mix'
import { filterDjf, spaceParams, warmthShape } from './gestures'
import { STYLE_MUSIC } from './styles'
import { tokensToMini } from './strudel'
import type { FreeLoop } from './freeLoops'
import type { KitId, StyleId } from './types'
import { anyPart, type BackgroundMode, type Parts } from './background'
import { bassCode } from './bass'
import { melodyMini, SYNTH_SOUND, type MelodySynth } from './melody'
import type { Cell, Segment } from './cells'

export interface SongFx {
  /** 0..1 (1 = abierto) */
  filter: number
  space: number
  warmth: number
}

export interface SongState {
  loops: FreeLoop[]
  style: StyleId
  /** tempo de la canción (spec 005, §6); sin él, el del estilo */
  bpm?: number | null
  kit: KitId
  /** sinte de la melodía (spec 002, §6); sin él, el del estilo */
  melodySynth?: MelodySynth
  /** modo del fondo y partes que han entrado (o están entrando) */
  background: { mode: BackgroundMode; parts: Parts }
  metronome: boolean
  fx: SongFx
  /**
   * Canción de varias células (spec 005). Sin ella, o con una sola célula, el código es el de
   * siempre con `loops`. Con ella, `loops` no se usa:
   * - display: la canción entera con `arrange`, en el orden de `order`;
   * - engine: solo los tramos de `window` (la célula que suena y la siguiente), acotados a sus compases.
   */
  cells?: { list: CellCode[]; order: number[]; window: Segment[] }
  /**
   * Grupos de células que suenan en paralelo a la canción (spec 005, enmienda 2, §16). En el motor, de cada
   * uno sus tramos (la célula que suena y la siguiente); en el código que se enseña, su orden entero.
   */
  groups?: { list: CellCode[]; items: { id: number; order: number[]; window: Segment[] }[] }
}

/** Lo que necesita el generador de cada célula. */
export type CellCode = Pick<Cell, 'id' | 'name' | 'loops' | 'parts' | 'turns' | 'lpf' | 'groupOn' | 'groupOff'>

/**
 * - display: el código que se enseña y se copia (valores fijos, sin metrónomo ni ganchos).
 * - engine: el que se evalúa: igual, pero los efectos van por ref(), lleva siempre las dos partes del
 *   fondo (las abre/cierra el motor con nodos nativos), metrónomo, pulso, etiquetas y onTrigger.
 */
export type SongMode = 'display' | 'engine'

/** Nombre global con el que el motor expone valores y callbacks al código evaluado. */
export const ENGINE_GLOBAL = '__cb'

const mod = (a: number, n: number) => ((a % n) + n) % n
/**
 * Defensa en profundidad (spec 006): todo lo que se escribe en el código que se evalúa pasa por aquí.
 * Un número que no es finito (p. ej. un string guardado) se queda en 0 en vez de entrar como texto.
 */
export const safeNum = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
/** Texto para un comentario `//`: sin saltos de línea ni caracteres de control; solo letras, números y puntuación suave. */
export const safeLabel = (v: unknown): string => (typeof v === 'string' ? v.replace(/[^\p{L}\p{N} ·_.,'()-]/gu, '').slice(0, 60) : '')
const round3 = (x: number) => Math.round(x * 1000) / 1000
const IND = '  '

/** Orbit (bus) de la melodía con la voz (spec 002, §6). */
export const MELODY_ORBIT = 5
const duckWith = (orbits: string) => `.duckorbit("${orbits}").duckdepth(0.6).duckattack(0.15)`
/** Sidechain del bombo sobre el bajo y los acordes; con melodía en el mismo bloque, también sobre ella. */
export const DUCK = duckWith('2:3')

/** Tokens de s() y de nudge() (rotados a la fase global) de un loop. */
export function loopTokens(
  loop: Pick<FreeLoop, 'bars' | 'phaseBar' | 'hits'> & { instrument: string },
  stepSeconds: number,
): { s: string[]; nudge: string[] | null } {
  const bars = safeNum(loop.bars)
  const total = bars * 16
  const slots: (string | null)[] = new Array(total).fill(null)
  const nudges: number[] = new Array(total).fill(0)
  const instrument = INSTRUMENTS.includes(loop.instrument as never) ? loop.instrument : null
  for (const h of instrument ? loop.hits : []) {
    if (!Number.isFinite(h.pos)) continue
    const step = mod(Math.round(h.pos), total)
    if (slots[step] !== null) continue
    slots[step] = instrument
    nudges[step] = round3((h.pos - Math.round(h.pos)) * stepSeconds)
  }
  // ciclo j de Strudel (j mod bars) ← compás (j − phaseBar) mod bars del loop
  const rot = (arr: string[]) =>
    Array.from({ length: bars }, (_, j) => {
      const k = mod(j - safeNum(loop.phaseBar), bars)
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
  /** sidechain del bombo (vacío = sin él) */
  duck: string,
  version: 'current' | 'prev' = 'current',
  phaseOffset = 0,
): string {
  const base = version === 'prev' && loop.prev ? { ...loop, ...loop.prev } : loop
  const src = phaseOffset ? { ...base, phaseBar: safeNum(base.phaseBar) + safeNum(phaseOffset) } : base
  let line: string
  if (loop.instrument === 'mel') {
    // melodía con la voz (spec 002): nombres de nota de una tabla, pesos numéricos; nada leído se escribe tal cual
    const synth = loop.synth ?? st.melodySynth ?? STYLE_MUSIC[st.style].synth
    const hits = src.hits.map((h) => ({ pos: h.pos, strength: h.strength, midi: h.midi as number, dur: h.dur as number }))
    line = `note("${melodyMini(hits, safeNum(src.bars), safeNum(src.phaseBar))}")${SYNTH_SOUND[synth] ?? SYNTH_SOUND.piano}.orbit(${MELODY_ORBIT})`
    if (Math.abs(gain - 1) > 0.005) line += `.gain(${fmtGain(gain)})`
  } else {
    const kit = KITS[st.kit]
    const { s, nudge } = loopTokens(src, stepSeconds)
    line = `s("${tokensToMini(s)}").bank("${kit.strudelBank}")`
    const n = kit.sampleIndex[loop.instrument]
    if (n !== 0) line += `.n(${n})`
    if (nudge) line += `.nudge("${tokensToMini(nudge)}")`
    if (Math.abs(gain - 1) > 0.005) line += `.gain(${fmtGain(gain)})`
    if (loop.instrument === 'bd' && duck) line += duck
  }
  if (mode === 'engine') {
    const born = safeNum(loop.bornAt)
    const cond = version === 'prev' ? `h.whole.begin < ${born}` : `h.whole.begin >= ${born}`
    line += `.color("l${safeNum(loop.id)}").filterHaps((h) => ${cond})`
  }
  return loop.muted ? `// ${line}` : line
}

/** Efectos sobre tus loops (sub-stack): espacio y calor. Vacío si son neutros en el mostrado. */
function drumFxOf(st: SongState, mode: SongMode): string {
  const g = ENGINE_GLOBAL
  if (mode === 'engine') return `.room(ref(() => ${g}.fx.room)).delay(ref(() => ${g}.fx.delay)).shape(ref(() => ${g}.fx.shape))`
  const space = spaceParams(st.fx.space)
  const shape = warmthShape(st.fx.warmth)
  return (space.room > 0 ? `.room(${space.room})` : '') + (space.delay > 0 ? `.delay(${space.delay})` : '') + (shape > 0 ? `.shape(${shape})` : '')
}

/**
 * Líneas de unos loops con la sangría `ind` (cada una acabada en coma), dentro de un sub-stack con
 * los efectos si los hay. `phaseOffset`: compás global en el que empieza su célula (motor, spec 005).
 */
function loopsLines(loops: FreeLoop[], st: SongState, mode: SongMode, duck: boolean, ind: string, phaseOffset = 0): string[] {
  if (!loops.length) return []
  // el sidechain del bombo también empuja la melodía si hay una en este bloque (orbit 5)
  const duckStr = duck ? (loops.some((l) => l.instrument === 'mel') ? duckWith(`2:3:${MELODY_ORBIT}`) : DUCK) : ''
  const stepSeconds = 60 / (st.bpm ?? STYLES[st.style].bpm) / 4
  const engine = mode === 'engine'
  const gains = loopGains(loops)
  const lines = loops.flatMap((l) => {
    const g = gains.get(l.id) ?? 1
    const current = loopLine(l, st, g, stepSeconds, mode, duckStr, 'current', phaseOffset)
    // en el motor, la versión anterior sigue sonando hasta el nacimiento de la nueva
    return engine && l.prev ? [loopLine(l, st, g, stepSeconds, mode, duckStr, 'prev', phaseOffset), current] : [current]
  })
  const drumFx = drumFxOf(st, mode)
  if (!drumFx) return lines.map((l) => `${ind}${l},`)
  return [`${ind}stack(`, ...lines.map((l) => `${ind}${IND}${l},`), `${ind})${drumFx},`]
}

/** Líneas del fondo (bajo y acordes) que se muestran, con la sangría `ind`. */
function backgroundLines(st: SongState, bass: boolean, chords: boolean, engine: boolean, ind: string): string[] {
  const music = STYLE_MUSIC[st.style]
  const out: string[] = []
  if (bass) out.push(`${ind}${bassCode(music.background.bass)}.orbit(2)${engine ? '.color("bass")' : ''},`)
  if (chords) for (const l of music.background.chords) out.push(`${ind}${l}.orbit(3)${engine ? '.color("chords")' : ''},`)
  return out
}

/**
 * El filtro paso bajo por vuelta de una célula (spec 008, §5) como código: `.lpf("<a b c d>")`, un valor por vuelta, o
 * `.lpf(v)` si es el mismo. En el código mostrado (`arrange`) cada sección empieza en su ciclo 0 y va tal cual; en el
 * motor los ciclos son los compases globales, así que el patrón se rota al compás `from` en el que empieza la célula
 * (la vuelta 1 de la célula usa el primer valor). Los números se redondean y se acotan: nada leído se escribe tal cual.
 */
export function cellLpf(cell: Pick<Cell, 'lpf' | 'turns'>, mode: SongMode, from = 0): string {
  const raw = cell.lpf
  if (!Array.isArray(raw) || !raw.length) return ''
  const turns = Math.max(1, Math.min(32, Math.round(safeNum(cell.turns))))
  const hz = (v: unknown) => Math.round(Math.min(20000, Math.max(60, safeNum(v))))
  const vals = Array.from({ length: turns }, (_, i) => hz(raw[Math.min(i, raw.length - 1)]))
  if (vals.every((v) => v === vals[0])) return `.lpf(${vals[0]})`
  const shift = Math.round(safeNum(from))
  const items = mode === 'engine' ? vals.map((_, k) => vals[mod(k - shift, turns)]!) : vals
  return `.lpf("<${items.join(' ')}>")`
}

/**
 * Cuándo suena un grupo en paralelo dentro de la vuelta de la canción, según los disparadores de sus células (spec 005,
 * §22): `lead` compases de silencio hasta la primera célula que lo enciende y `span` compases de sonido hasta la que lo
 * apaga (o hasta el final de la vuelta); `total` es lo que dura la vuelta. null si ninguna célula lo enciende.
 */
export function groupSchedule(cells: { list: CellCode[]; order: number[] } | undefined, gid: number): { lead: number; span: number; total: number } | null {
  if (!cells) return null
  let bar = 0
  let lead: number | null = null
  let end: number | null = null
  for (const id of cells.order) {
    const c = cells.list.find((x) => x.id === id)
    if (!c) continue
    const on = !!c.groupOn?.includes(gid)
    const off = !!c.groupOff?.includes(gid) && !on
    if (lead === null && on) lead = bar
    else if (lead !== null && end === null && off) end = bar
    bar += Math.max(1, Math.round(safeNum(c.turns)))
  }
  if (lead === null) return null
  return { lead, span: (end ?? bar) - lead, total: bar }
}

const cellLabel = (c: Pick<Cell, 'id' | 'name'>) => safeLabel(c.name) || `célula ${safeNum(c.id)}`

/**
 * Los grupos de células que suenan en paralelo a la canción (§16): cada uno, su propio `stack` con su fase
 * (cada tramo cuenta desde su compás de inicio). En el motor van acotados a sus compases con `filterHaps`
 * (la célula que suena y la siguiente, como la canción); en el código que se enseña, el grupo entero con su
 * orden: una célula, un `stack`; varias, un `arrange`.
 */
function groupLines(st: SongState, mode: SongMode, duck: boolean, ind: string): string[] {
  if (!st.groups) return []
  const out: string[] = []
  const { list, items } = st.groups
  for (const item of items) {
    if (mode === 'engine') {
      for (const seg of item.window) {
        const cell = list.find((c) => c.id === seg.cellId)
        if (!cell) continue
        const inner = loopsLines(cell.loops, st, mode, duck, ind + IND, seg.from)
        if (!inner.length) continue
        const range = seg.to === null ? `h.whole.begin >= ${safeNum(seg.from)}` : `h.whole.begin >= ${safeNum(seg.from)} && h.whole.begin < ${safeNum(seg.to)}`
        out.push(`${ind}// grupo ${safeNum(item.id)} · ${cellLabel(cell)} · compases ${safeNum(seg.from)}–${seg.to === null ? '…' : safeNum(seg.to) - 1}`)
        out.push(`${ind}stack(`, ...inner, `${ind})${cellLpf(cell, mode, safeNum(seg.from))}.filterHaps((h) => ${range}),`)
      }
      continue
    }
    const cells = item.order.map((id) => list.find((c) => c.id === id)).filter((c): c is CellCode => !!c)
    if (!cells.length) continue
    if (cells.length === 1 && !groupSchedule(st.cells, item.id)) {
      const inner = loopsLines(cells[0]!.loops, st, mode, duck, ind + IND, 0)
      if (!inner.length) continue
      out.push(`${ind}// grupo ${safeNum(item.id)} · ${cellLabel(cells[0]!)}`, `${ind}stack(`, ...inner, `${ind}),`)
      continue
    }
    const sched = groupSchedule(st.cells, item.id)
    out.push(`${ind}// grupo ${safeNum(item.id)}${sched ? ` · entra en el compás ${sched.lead}` : ''}`, `${ind}arrange(`)
    if (sched && sched.lead > 0) out.push(`${ind}${IND}// (silencio hasta que lo enciende su célula)`, `${ind}${IND}[${sched.lead}, silence],`)
    // con disparadores, el grupo suena solo `span` compases (da la vuelta si es más corto) y calla hasta el final de la vuelta
    let left = sched ? sched.span : Infinity
    for (let k = 0; left > 0 && k < 64; k++) {
      const cell = cells[k % cells.length]!
      const turns = Math.min(Math.max(1, Math.round(safeNum(cell.turns))), left)
      const lines = loopsLines(cell.loops, st, mode, duck, ind + IND + IND, 0)
      out.push(`${ind}${IND}// ${cellLabel(cell)} · ${turns} vuelta${turns === 1 ? '' : 's'}`)
      if (!lines.length) out.push(`${ind}${IND}[${turns}, silence],`)
      else out.push(`${ind}${IND}[${turns}, stack(`, ...lines, `${ind}${IND})${cellLpf(cell, 'display')}],`)
      left -= turns
      if (!sched && k + 1 >= cells.length) break
    }
    if (sched && sched.total - sched.lead - sched.span > 0) out.push(`${ind}${IND}[${sched.total - sched.lead - sched.span}, silence],`)
    out.push(`${ind}),`)
  }
  return out
}

/** Código Strudel completo del estado. Determinista. */
export function songCode(st: SongState, mode: SongMode = 'display'): string {
  const multi = !!st.cells && st.cells.order.length > 1
  if (multi && mode === 'display') return songArrangeCode(st)
  const style = STYLES[st.style]
  const music = STYLE_MUSIC[st.style]
  const engine = mode === 'engine'
  const g = ENGINE_GLOBAL
  const out: string[] = [`setcpm(${safeNum(st.bpm ?? style.bpm)}/4)`, 'stack(']

  const bgOn = st.background.mode !== 'off'
  const showBass = engine ? bgOn : st.background.parts.bass
  const showChords = engine ? bgOn : st.background.parts.chords
  if (showBass || showChords) {
    out.push(`${IND}// fondo · ${style.label.toLowerCase()} · ${music.key}`)
    out.push(...backgroundLines(st, showBass, showChords, engine, IND))
  }
  if (engine) {
    out.push(`${IND}note("c0").s("sine").gain(0).color("pulse"),`)
    if (st.metronome) out.push(`${IND}note("[g6 c6 c6 c6]").s("sine").decay(0.03).sustain(0).gain(0.25).orbit(4).color("click"),`)
  }
  const duck = engine ? bgOn : anyPart(st.background.parts)

  if (multi) {
    // motor con varias células: la que suena y la siguiente, cada una acotada a sus compases (§4.2)
    for (const seg of st.cells!.window) {
      const cell = st.cells!.list.find((c) => c.id === seg.cellId)
      if (!cell) continue
      const inner = loopsLines(cell.loops, st, mode, duck, IND + IND, seg.from)
      if (!inner.length) continue
      const range = seg.to === null ? `h.whole.begin >= ${safeNum(seg.from)}` : `h.whole.begin >= ${safeNum(seg.from)} && h.whole.begin < ${safeNum(seg.to)}`
      out.push(`${IND}// ${cellLabel(cell)} · compases ${safeNum(seg.from)}–${seg.to === null ? '…' : safeNum(seg.to) - 1}`)
      out.push(`${IND}stack(`, ...inner, `${IND})${cellLpf(cell, mode, safeNum(seg.from))}.filterHaps((h) => ${range}),`)
    }
  } else if (st.loops.length) {
    out.push(`${IND}// tus loops`)
    out.push(...loopsLines(st.loops, st, mode, duck, IND))
  }
  const extra = groupLines(st, mode, duck, IND)
  out.push(...extra)
  if (!showBass && !showChords && !st.loops.length && !extra.length && !engine && !multi) out.push(`${IND}silence,`)

  const djf = filterDjf(st.fx.filter)
  let tail = ')'
  if (engine) tail += `.djf(ref(() => ${g}.fx.djf)).onTrigger((hap, ct, cps, t) => ${g}.trig(hap, t), false)`
  else if (djf < 0.5) tail += `.djf(${djf})`
  out.push(tail)
  return out.join('\n')
}

/**
 * Código mostrado de una canción de varias células (spec 005, §9): `arrange` con una sección por
 * célula, en orden, cada una con su fondo y sus loops. Suena igual en strudel.cc (sin el barrido).
 */
function songArrangeCode(st: SongState): string {
  const style = STYLES[st.style]
  const music = STYLE_MUSIC[st.style]
  const { list, order } = st.cells!
  const bgOn = st.background.mode !== 'off'
  const out: string[] = [`setcpm(${safeNum(st.bpm ?? style.bpm)}/4)`, `// ${style.label.toLowerCase()} · ${music.key}`, 'arrange(']
  const ind = IND + IND
  const freeBlock = groupLines(st, 'display', bgOn && list.some((c) => c.parts.bass || c.parts.chords), IND)
  for (const id of order) {
    const cell = list.find((c) => c.id === id)
    if (!cell) continue
    const bass = bgOn && cell.parts.bass
    const chords = bgOn && cell.parts.chords
    const lines = [...backgroundLines(st, bass, chords, false, ind), ...loopsLines(cell.loops, st, 'display', bass || chords, ind)]
    out.push(`${IND}// ${cellLabel(cell)} · ${safeNum(cell.turns)} vuelta${safeNum(cell.turns) === 1 ? '' : 's'}`)
    if (!lines.length) out.push(`${IND}[${safeNum(cell.turns)}, silence],`)
    else out.push(`${IND}[${safeNum(cell.turns)}, stack(`, ...lines, `${IND})${cellLpf(cell, 'display')}],`)
  }
  const djf = filterDjf(st.fx.filter)
  if (freeBlock.length) {
    // con grupos en paralelo, la canción y ellos suenan a la vez: un `stack` que los junta
    const head = out.slice(0, 2)
    const body = out.slice(3).map((l) => `${IND}${l}`)
    return [...head, 'stack(', `${IND}arrange(`, ...body, `${IND}),`, ...freeBlock, djf < 0.5 ? `).djf(${djf})` : ')'].join('\n')
  }
  out.push(djf < 0.5 ? `).djf(${djf})` : ')')
  return out.join('\n')
}

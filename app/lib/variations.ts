/**
 * Variaciones de una célula (spec 012, §5): `varyCell(cell, tipo, semilla, estilo)` devuelve **una célula nueva**; la original **no se toca**.
 * Solo reglas sobre los datos (golpes, notas, partes, filtro), sin sonidos nuevos, y **siguen el estilo** (§3.2b): la rejilla y el tempo,
 * los `priors` para los golpes extra, la escala para la melodía. Pura y determinista (misma entrada y semilla = misma variación).
 * También es la base de «Convertir en canción» (011 §14.2, 012 §6).
 */
import { STYLES } from './constants'
import { MAX_LOOPS, type FreeLoop, type LoopHit } from './freeLoops'
import { type Cell } from './cells'
import { MIDI_MAX, MIDI_MIN } from './melody'
import { snapToScale } from './melodyAssist'
import { rangeOf } from './melodyView'
import type { LoopLength } from './phrases'
import { STYLE_MUSIC, templateSteps } from './styles'
import type { Instrument, StyleId } from './types'

export type VariationKind = 'more' | 'less' | 'melody' | 'fill' | 'same'

/** Los chips de Componer (spec 012 §5.1; decisión 7) */
export const VARIATION_LABELS: Record<VariationKind, string> = {
  more: '+ energía',
  less: '− energía',
  melody: 'variar melodía',
  fill: 'redoble',
  same: 'igual',
}

const mod = (a: number, n: number) => ((a % n) + n) % n
const drum = (l: FreeLoop): l is FreeLoop & { instrument: Instrument } => l.instrument !== 'mel'

/** PRNG pequeño y estable (mulberry32). */
function prng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cloneLoop = (l: FreeLoop): FreeLoop => ({ ...l, hits: l.hits.map((h) => ({ ...h })), ...(l.prev ? { prev: { ...l.prev, hits: l.prev.hits.map((h) => ({ ...h })) } } : {}) })
const cloneCell = (c: Cell): Cell => ({
  ...c,
  loops: c.loops.map(cloneLoop),
  parts: { ...c.parts },
  ...(c.lpf ? { lpf: [...c.lpf] } : {}),
  ...(c.wow ? { wow: { ...c.wow } } : {}),
  ...(c.groupOn ? { groupOn: [...c.groupOn] } : {}),
  ...(c.groupOff ? { groupOff: [...c.groupOff] } : {}),
  at: { ...c.at },
})

const nextId = (c: Cell): number => c.loops.reduce((m, l) => Math.max(m, l.id), 0) + 1

/** Un loop de batería nuevo con la plantilla del estilo (un compás). */
function templateLoop(c: Cell, inst: Instrument, style: StyleId, bars: LoopLength = 1): FreeLoop {
  const steps = templateSteps(STYLE_MUSIC[style].templates[inst])
  const hits: LoopHit[] = []
  for (let b = 0; b < bars; b++) for (const s of steps) hits.push({ pos: b * 16 + s, strength: 0.8 })
  return { id: nextId(c), instrument: inst, bars, phaseBar: 0, hits, muted: false, bornAt: 0, fromTemplate: true }
}

/** Repite un loop de 1 compás hasta 4 (para poder poner algo solo en el último). */
function expandTo4(l: FreeLoop): FreeLoop {
  if (l.bars === 4) return l
  const len = l.bars * 16
  const hits: LoopHit[] = []
  for (let off = 0; off < 64; off += len) for (const h of l.hits) hits.push({ ...h, pos: off + h.pos })
  return { ...l, bars: 4, hits }
}

const sortHits = (h: LoopHit[]) => [...h].sort((a, b) => a.pos - b.pos)

/** Pasos libres (0..15) de un compás, de más a menos peso del `prior` del estilo, sin los ya usados. */
function freeStepsByPrior(inst: Instrument, style: StyleId, used: ReadonlySet<number>, grid: number): number[] {
  const prior = STYLE_MUSIC[style].priors[inst]
  return Array.from({ length: 16 }, (_, s) => s)
    .filter((s) => !used.has(s) && s % grid === 0)
    .sort((a, b) => (prior[b] ?? 0) - (prior[a] ?? 0) || a - b)
}

// ── + energía ────────────────────────────────────────────────────────────────────────────────────
function more(c: Cell, style: StyleId, seed: number): void {
  const grid = STYLES[style].quantizeEvery
  // el platillo hasta la rejilla más fina del estilo (los que ya están no se mueven)
  let hh = c.loops.find((l) => l.instrument === 'hh')
  if (!hh && c.loops.length < MAX_LOOPS) {
    hh = templateLoop(c, 'hh', style)
    c.loops.push(hh)
  }
  if (hh) {
    const len = hh.bars * 16
    const have = new Set(hh.hits.map((h) => h.pos))
    for (let p = 0; p < len; p += grid) if (!have.has(p)) hh.hits.push({ pos: p, strength: 0.6 })
    hh.hits = sortHits(hh.hits)
  }
  // un golpe extra de caja o de bombo, donde el estilo más lo pide (y no esté ya)
  const inst: Instrument = seed % 2 === 0 ? 'sd' : 'bd'
  const loop = c.loops.find((l) => l.instrument === inst)
  if (loop) {
    const used = new Set(loop.hits.map((h) => mod(h.pos, 16)))
    const top = freeStepsByPrior(inst, style, used, grid).slice(0, 3)
    if (top.length) {
      const s = top[Math.floor(seed / 2) % top.length]!
      for (let b = 0; b < loop.bars; b++) loop.hits.push({ pos: b * 16 + s, strength: 0.7 })
      loop.hits = sortHits(loop.hits)
    }
  }
  c.parts = { bass: true, chords: true }
  if (c.lpf) c.lpf = c.lpf.map((v) => Math.min(20000, Math.round(v * 1.4)))
}

// ── − energía ────────────────────────────────────────────────────────────────────────────────────
function less(c: Cell): void {
  const hadKick = c.loops.some((l) => l.instrument === 'bd' && l.hits.length)
  // sin bombo; sin bombo de partida, la caja tampoco (la célula ya está pelada); el platillo, a la mitad
  c.loops = c.loops.filter((l) => !(l.instrument === 'bd' || (l.instrument === 'sd' && !hadKick)))
  for (const l of c.loops) if (l.instrument === 'hh') l.hits = sortHits(l.hits).filter((_, i) => i % 2 === 0)
  c.loops = c.loops.filter((l) => l.instrument === 'mel' || l.hits.length)
  c.parts = { ...c.parts, bass: false }
}

// ── redoble ──────────────────────────────────────────────────────────────────────────────────────
function fill(c: Cell, style: StyleId): void {
  let k = c.loops.findIndex((l) => l.instrument === 'sd')
  if (k < 0) {
    if (c.loops.length >= MAX_LOOPS) return
    c.loops.push(templateLoop(c, 'sd', style))
    k = c.loops.length - 1
  }
  const l = expandTo4(c.loops[k]!)
  const grid = STYLES[style].quantizeEvery
  const have = new Set(l.hits.map((h) => h.pos))
  for (let s = 12; s < 16; s += grid) if (!have.has(48 + s)) l.hits.push({ pos: 48 + s, strength: 0.75 })
  l.hits = sortHits(l.hits)
  c.loops[k] = l
}

// ── variar la melodía ────────────────────────────────────────────────────────────────────────────
/** La respuesta a una frase (spec 012 §5.3): mismo ritmo, forma invertida, en la escala; acaba en la tónica si la pregunta acababa en otra nota, y en la quinta si acababa en la tónica. */
export function answerPhrase(hits: readonly LoopHit[], style: StyleId, synth = STYLE_MUSIC[style].synth): LoopHit[] {
  const notes = sortHits([...hits]).filter((h) => typeof h.midi === 'number')
  if (!notes.length) return []
  const music = STYLE_MUSIC[style]
  const [lo, hi] = rangeOf(synth)
  const tonic = music.scale[0]!
  const fifth = music.scale[4] ?? mod(tonic + 7, 12)
  const first = notes[0]!.midi!
  const endsOnTonic = mod(notes[notes.length - 1]!.midi!, 12) === tonic
  const out = notes.map((h, i) => {
    const target = first - (h.midi! - first) // los intervalos, al revés
    const chord = music.chordTones[mod(Math.floor(h.pos / 16), music.chordTones.length)] ?? []
    return { ...h, midi: snapToScale(target, music.scale, chord, i ? null : first) }
  })
  // el final contesta: la tónica (cerrada) o la quinta (abierta), la más cercana en el registro
  const wantPc = endsOnTonic ? fifth : tonic
  const last = out[out.length - 1]!
  const cands = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((m) => mod(m, 12) === wantPc)
  last.midi = cands.sort((x, y) => Math.abs(x - last.midi!) - Math.abs(y - last.midi!))[0] ?? last.midi
  return out.map((h) => ({ ...h, midi: Math.max(MIDI_MIN, Math.min(MIDI_MAX, h.midi!)) }))
}

function melody(c: Cell, style: StyleId, seed: number): void {
  const k = c.loops.findIndex((l) => l.instrument === 'mel')
  if (k < 0) return
  const l = c.loops[k]!
  const synth = l.synth ?? STYLE_MUSIC[style].synth
  const [lo, hi] = rangeOf(synth)
  const mode = seed % 3
  const rand = prng(seed + 7)
  if (mode === 0) {
    // otro ritmo: las mismas notas (su orden) repartidas de otra manera, sobre los golpes de caja y bombo como anclas
    const grid = STYLES[style].quantizeEvery
    const anchors = new Set(c.loops.filter((x) => x.instrument === 'sd' || x.instrument === 'bd').flatMap((x) => x.hits.map((h) => mod(h.pos, 16))))
    const sorted = sortHits(l.hits)
    const out: LoopHit[] = []
    for (let b = 0; b < l.bars; b++) {
      const inBar = sorted.filter((h) => Math.floor(h.pos / 16) === b)
      if (!inBar.length) continue
      const slots = Array.from({ length: 16 }, (_, s) => s).filter((s) => s % grid === 0)
      const w = (s: number) => (anchors.has(s) ? 4 : s % 4 === 0 ? 1.5 : s % 2 === 0 ? 1 : 0.4) * (0.6 + rand())
      const chosen: number[] = []
      const pool = [...slots]
      while (chosen.length < Math.min(inBar.length, slots.length) && pool.length) {
        const total = pool.reduce((s, x) => s + w(x), 0)
        let r = rand() * total
        let idx = 0
        for (let i = 0; i < pool.length; i++) {
          r -= w(pool[i]!)
          if (r <= 0) {
            idx = i
            break
          }
        }
        chosen.push(pool.splice(idx, 1)[0]!)
      }
      chosen.sort((a, b2) => a - b2)
      chosen.forEach((s, i) => {
        const src = inBar[i]!
        const next = chosen[i + 1] ?? 16
        out.push({ ...src, pos: b * 16 + s, dur: Math.max(1, Math.min(src.dur ?? 2, next - s)) })
      })
    }
    l.hits = out
  } else if (mode === 1) {
    // octava: arriba si cabe, y si no, abajo (según la semilla, la primera opción)
    const ms = l.hits.map((h) => h.midi ?? 60)
    const up = Math.max(...ms) + 12 <= hi
    const down = Math.min(...ms) - 12 >= lo
    const dir = seed % 2 === 0 ? (up ? 12 : down ? -12 : 0) : down ? -12 : up ? 12 : 0
    if (dir) l.hits = l.hits.map((h) => ({ ...h, midi: (h.midi ?? 60) + dir }))
  } else {
    l.hits = answerPhrase(l.hits, style, synth)
  }
}

/**
 * Una variación de la célula. `seed` (0, 1, 2…) elige entre las posibilidades del tipo (el golpe extra, el modo de variar la melodía…): la secuencia es fija.
 * `same` es una copia exacta. Siempre devuelve una célula nueva (la original no cambia). Una variación imposible (melodía sin melodía) la deja igual.
 */
export function varyCell(cell: Cell, kind: VariationKind, seed: number, style: StyleId): Cell {
  const c = cloneCell(cell)
  switch (kind) {
    case 'more':
      more(c, style, seed)
      break
    case 'less':
      less(c)
      break
    case 'melody':
      melody(c, style, seed)
      break
    case 'fill':
      fill(c, style)
      break
    case 'same':
      break
  }
  return c
}

/** ¿Tiene sentido ofrecer esta variación para esta célula? (p. ej. variar la melodía solo si hay melodía). */
export function canVary(cell: Cell, kind: VariationKind): boolean {
  switch (kind) {
    case 'melody':
      return cell.loops.some((l) => l.instrument === 'mel' && l.hits.length > 0)
    case 'less':
      return cell.loops.some((l) => drum(l) && l.hits.length > 0) || cell.parts.bass
    default:
      return true
  }
}

/** Qué variaciones se ofrecen y en qué orden (la que más ayuda a avanzar primero; spec 012 §5.1). `lastOfGroup`: es la última de su grupo (va hacia el drop). */
export function variationOrder(cell: Cell, lastOfGroup = false): VariationKind[] {
  const full = (['bd', 'sd', 'hh'] as const).every((i) => cell.loops.some((l) => l.instrument === i && l.hits.length)) && cell.parts.bass && cell.parts.chords
  const base: VariationKind[] = lastOfGroup ? ['more', 'fill', 'melody', 'less', 'same'] : full ? ['less', 'melody', 'fill', 'more', 'same'] : cell.loops.some((l) => l.instrument === 'mel') ? ['melody', 'more', 'less', 'fill', 'same'] : ['more', 'less', 'fill', 'melody', 'same']
  return base.filter((k) => canVary(cell, k))
}

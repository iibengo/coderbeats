/**
 * Variantes del sonido de la melodía para compararlas de oído (spec 002, §17). Solo las usa el laboratorio
 * (`/lab/sonido`): **no cambian el sonido de la app**. Puro.
 *
 * Qué se compara: la duración (redondeada a celdas, como hoy, o la real), el legato (huecos rellenos y solape), el glide
 * (una envolvente de altura `penv` por nota que parte de la nota anterior) y sintes más ricos con reverb y delay.
 */
import { isMidi, STRUDEL_NOTE, SYNTH_SOUND, type MelodyHit, type MelodySynth } from './melody'

export type Timbre = 'actual' | 'b' | 'c'
export type LegatoMode = 'no' | 'huecos' | 'solapado'
/** `penv`: envolvente de altura de Strudel; `webaudio`: un sinte propio con portamento (no es Strudel) */
export type GlideMode = 'no' | 'penv' | 'webaudio'
export type DurMode = 'cuantizada' | 'real'

export interface SoundConfig {
  timbre: Timbre
  dur: DurMode
  legato: LegatoMode
  glide: GlideMode
  /** cuánto dura el deslizamiento (ms) */
  glideMs: number
  /** reverb y delay extra, 0..1 (se añaden a la línea del sinte; 0 = nada) */
  room: number
  delay: number
}

export const CURRENT_SOUND: SoundConfig = { timbre: 'actual', dur: 'cuantizada', legato: 'no', glide: 'no', glideMs: 80, room: 0, delay: 0 }

/**
 * Líneas de cada sinte. `actual` es la de la app hoy (`SYNTH_SOUND`); `b` y `c` son propuestas con más cuerpo, reverb
 * y delay. Solo usan controles que existen en Strudel y en superdough 1.3. Se afinan de oído.
 */
export const TIMBRES: Record<'piano' | 'lead' | 'pad', Record<Timbre, string>> = {
  piano: {
    actual: SYNTH_SOUND.piano,
    // más cuerpo: FM con caída, filtro suave, sala y un eco corto
    b: '.s("triangle").fm(1.2).fmh(2).decay(0.8).sustain(0.15).lpf(3200).room(0.45).roomsize(3).delay(0.22).delaytime(0.25).delayfeedback(0.35)',
    // más brillante y ancho: dos voces desafinadas, con fase
    c: '.s("triangle").fm(2).fmh(3).decay(0.5).sustain(0.25).detune(0.15).unison(2).spread(0.5).lpf(4000).room(0.35).roomsize(2.5).phaser(0.4)',
  },
  lead: {
    actual: SYNTH_SOUND.lead,
    // supersaw con filtro con envolvente: el clásico del house
    b: '.s("supersaw").detune(0.3).unison(3).spread(0.6).lpf(2400).lpenv(2.5).lpa(0.005).lpd(0.18).decay(0.22).sustain(0.5).delay(0.3).delaytime(0.24).delayfeedback(0.4).room(0.25)',
    // más ácido y con vibrato suave al sostener
    c: '.s("sawtooth").lpf(1600).lpq(8).lpenv(3).lpd(0.15).decay(0.2).sustain(0.55).vib(5.5).vibmod(0.15).delay(0.35).delaytime(0.375).delayfeedback(0.45).room(0.2)',
  },
  pad: {
    actual: SYNTH_SOUND.pad,
    // más lento y con una sala grande
    b: '.s("supersaw").detune(0.4).unison(4).spread(0.9).attack(0.18).release(1).lpf(1400).room(0.9).roomsize(5).phaser(0.25)',
    // pad con eco largo y movimiento en el filtro
    c: '.s("supersaw").detune(0.3).unison(3).spread(0.8).attack(0.12).release(0.9).lpf(1100).lpenv(1.5).lpa(0.3).lpd(0.8).room(0.8).roomsize(4).delay(0.35).delaytime(0.5).delayfeedback(0.5)',
  },
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/**
 * Legato: rellena los huecos entre una nota y la siguiente (hasta `maxGap` pasos, dentro del mismo compás) alargando la
 * primera; así no queda silencio entre ellas. Una nota no cruza la línea de compás ni pisa a la siguiente.
 */
export function applyLegato(hits: readonly MelodyHit[], maxGap = 2): MelodyHit[] {
  const sorted = [...hits].sort((a, b) => a.pos - b.pos)
  return sorted.map((h, i) => {
    const next = sorted[i + 1]
    if (!next) return { ...h }
    const gap = next.pos - (h.pos + h.dur)
    const sameBar = Math.floor(next.pos / 16 + 1e-9) === Math.floor(h.pos / 16 + 1e-9)
    return gap > 1e-9 && gap <= maxGap && sameBar ? { ...h, dur: next.pos - h.pos } : { ...h }
  })
}

/**
 * Glide: de cada nota, los semitonos que hay que bajar el inicio para partir de la nota anterior (la altura de la nota
 * anterior menos la suya), o 0 si la anterior no está pegada (hueco de más de `maxGap` pasos, otro compás o la primera).
 * Entero y acotado a ±12: es lo que se escribe como `penv`.
 */
export function glideOffsets(hits: readonly MelodyHit[], maxGap = 0.01): number[] {
  const sorted = [...hits].sort((a, b) => a.pos - b.pos)
  return sorted.map((h, i) => {
    const p = sorted[i - 1]
    if (!p) return 0
    const connected = h.pos - (p.pos + p.dur) <= maxGap && Math.floor(h.pos / 16 + 1e-9) === Math.floor(p.pos / 16 + 1e-9)
    if (!connected) return 0
    return Math.max(-12, Math.min(12, p.midi - h.midi))
  })
}

/** Menor periodo (divisor del nº de compases) con el que se repiten los compases. */
function period(bars: string[]): number {
  for (let p = 1; p < bars.length; p++) {
    if (bars.length % p !== 0) continue
    if (bars.every((b, i) => b === bars[i % p])) return p
  }
  return bars.length
}

/**
 * La estructura de `melodyMini` con otro valor por nota: cada nota `valor@peso`, los huecos `~@peso`, compases
 * repetidos contraídos y la fase rotada. Sirve para escribir un patrón de `penv` con el mismo ritmo que `note()`.
 */
export function variantMini(hits: readonly MelodyHit[], bars: number, phaseBar: number, value: (h: MelodyHit, i: number) => string): string {
  const sorted = [...hits].filter((h) => isMidi(h.midi) && Number.isFinite(h.pos) && Number.isFinite(h.dur) && h.dur > 0).sort((a, b) => a.pos - b.pos)
  const fine = sorted.some((h) => !Number.isInteger(h.pos) || !Number.isInteger(h.dur))
  const res = fine ? 4 : 1
  const w = (n: number) => (n === 1 ? '' : `@${n}`)
  const perBar: string[] = []
  for (let b = 0; b < bars; b++) {
    const tokens: string[] = []
    let at = 0
    sorted.forEach((h, i) => {
      if (Math.floor(h.pos / 16 + 1e-9) !== b) return
      const start = Math.round((h.pos - b * 16) * res)
      const dur = Math.max(1, Math.round(Math.min(h.dur, (b + 1) * 16 - h.pos) * res))
      if (start > at) tokens.push(`~${w(start - at)}`)
      tokens.push(`${value(h, i)}${w(dur)}`)
      at = start + dur
    })
    if (at < 16 * res) tokens.push(`~${w(16 * res - at)}`)
    perBar.push(tokens.join(' '))
  }
  const rot = Array.from({ length: bars }, (_, j) => perBar[mod(j - (Number.isFinite(phaseBar) ? phaseBar : 0), bars)]!)
  const unique = rot.slice(0, period(rot))
  return unique.length === 1 ? unique[0]! : `<${unique.map((b) => `[${b}]`).join(' ')}>`
}

const r2 = (x: number) => Math.round(x * 100) / 100

/** Reverb y delay extra (0..1) como controles de Strudel; el eco va a una corchea con puntillo del tempo. */
export function fxSuffix(room: number, delay: number, bpm: number): string {
  let out = ''
  if (room > 0.01) out += `.room(${r2(Math.min(1, room))}).roomsize(${r2(2 + 3 * Math.min(1, room))})`
  if (delay > 0.01) out += `.delay(${r2(Math.min(1, delay) * 0.6)}).delaytime(${r2(0.75 * (60 / bpm))}).delayfeedback(0.4)`
  return out
}

export interface VariantInput {
  hits: readonly MelodyHit[]
  bars: number
  phaseBar: number
  synth: 'piano' | 'lead' | 'pad'
  bpm: number
}

/** El código Strudel de una variante: la melodía con su sinte, legato, glide por `penv` y efectos. */
export function variantCode(cfg: SoundConfig, i: VariantInput): string {
  const hits = cfg.legato === 'no' ? [...i.hits].sort((a, b) => a.pos - b.pos) : applyLegato(i.hits)
  let line = `note("${variantMini(hits, i.bars, i.phaseBar, (h) => STRUDEL_NOTE[h.midi] ?? 'c4')}")${TIMBRES[i.synth][cfg.timbre]}`
  if (cfg.legato === 'solapado') line += '.clip(1.15)'
  if (cfg.glide === 'penv') {
    const off = glideOffsets(hits)
    const secs = r2(Math.max(0.02, Math.min(0.4, cfg.glideMs / 1000)))
    line += `.penv("${variantMini(hits, i.bars, i.phaseBar, (_h, k) => String(Math.round(off[k]!)))}").pattack(0.001).pdecay(${secs}).psustain(0)`
  }
  line += fxSuffix(cfg.room, cfg.delay, i.bpm)
  return `setcpm(${Math.round(i.bpm)}/4)\n${line}.orbit(5)`
}

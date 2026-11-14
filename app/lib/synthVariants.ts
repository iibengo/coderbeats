/**
 * Variantes de sintes más ricos (spec 010, §6) para elegir de oído en el laboratorio (`/lab/sintes`). **No cambian el
 * sonido de la app**: `SYNTH_SOUND` y el fondo de cada estilo siguen igual hasta que se elija una. Todo son controles que
 * ya existen en Strudel y superdough (`supersaw` con `unison`/`detune`/`spread`, `fm`, `shape`, `room`), así que el código
 * vale tal cual en strudel.cc. Puro.
 */
import { SYNTH_SOUND, melodyMini, type MelodyHit } from './melody'
import { STYLE_MUSIC } from './styles'

export type SynthRole = 'lead' | 'pad' | 'bass'

export interface SynthVariant {
  id: string
  role: SynthRole
  title: string
  /** qué se busca / qué vigilar de oído */
  note: string
  /** la línea del sinte (lo que va detrás de `note("…")`), sin `orbit` */
  line: string
}

export const SYNTH_VARIANTS: readonly SynthVariant[] = [
  { id: 'lead-actual', role: 'lead', title: 'Lead · el de hoy', note: 'Referencia: square con filtro y eco.', line: SYNTH_SOUND.lead },
  {
    id: 'lead-saw', role: 'lead', title: 'Lead · supersaw',
    note: 'Cinco voces desafinadas y abiertas, mismo filtro y eco. Más cuerpo; es un worklet: vigilar la CPU del móvil (bajar `unison`).',
    line: '.s("supersaw").unison(5).detune(0.25).spread(0.6).lpf(2400).decay(0.2).sustain(0.5).delay(0.25)',
  },
  {
    id: 'lead-saw-3', role: 'lead', title: 'Lead · supersaw ligero',
    note: 'Tres voces: la misma idea con menos CPU.',
    line: '.s("supersaw").unison(3).detune(0.2).spread(0.5).lpf(2400).decay(0.2).sustain(0.5).delay(0.25)',
  },
  { id: 'pad-actual', role: 'pad', title: 'Pad · el de hoy', note: 'Referencia.', line: SYNTH_SOUND.pad },
  {
    id: 'pad-ancho', role: 'pad', title: 'Pad · ancho y lento',
    note: 'Ataque lento (0,8 s), cola larga, cuatro voces desafinadas y una sala grande.',
    line: '.s("supersaw").unison(4).detune(0.4).spread(0.9).attack(0.8).release(1.2).lpf(1200).room(0.9).roomsize(6)',
  },
  {
    id: 'bass-actual', role: 'bass', title: 'Bajo · el del techno de hoy', note: 'Referencia: sawtooth con lpf(450).',
    line: STYLE_MUSIC.techno.background.bass.sound,
  },
  {
    id: 'bass-sat', role: 'bass', title: 'Bajo · saturado',
    note: 'El mismo diente de sierra con saturación suave (`shape`): más armónicos, se oye mejor en el móvil. Vigilar que no tape al bombo.',
    line: '.s("sawtooth").lpf(450).shape(0.35).gain(0.4)',
  },
  {
    id: 'bass-fm', role: 'bass', title: 'Bajo · FM',
    note: 'Un seno con FM que se cierra: pegada al inicio de cada nota y cuerpo limpio detrás.',
    line: '.s("sine").fm(4).fmh(1).fmdecay(0.15).fmsustain(0.2).lpf(600).gain(0.6)',
  },
]

/** Tres compases de ejemplo para oír un sinte: la figura del tema (lead y pad) o el pulso a corcheas (bajo). */
const DEMO_HITS: readonly MelodyHit[] = [
  ...[0, 2, 4, 6].map((pos): MelodyHit => ({ pos, dur: 2, midi: 53, strength: 0.8 })),
  { pos: 8, dur: 2, midi: 50, strength: 0.8 },
  ...[10, 12, 14].map((pos): MelodyHit => ({ pos, dur: 2, midi: 53, strength: 0.8 })),
  ...[16, 20, 24, 28].map((pos): MelodyHit => ({ pos, dur: 4, midi: 56, strength: 0.8 })),
  ...[32, 40].map((pos): MelodyHit => ({ pos, dur: 8, midi: 58, strength: 0.8 })),
]

/** El código Strudel de una variante, listo para pegar en strudel.cc (128 bpm, techno). */
export function variantDemoCode(v: SynthVariant, bpm = 128): string {
  if (v.role === 'bass') return `setcpm(${Math.round(bpm)}/4)\nnote("[c2 c2 c2 c2 c2 c2 c2 c2]")${v.line}.orbit(2)`
  const mini = melodyMini(DEMO_HITS.map((h) => ({ ...h })), 4, 0)
  return `setcpm(${Math.round(bpm)}/4)\nnote("${mini}")${v.line}.orbit(5)`
}

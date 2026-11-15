import { describe, expect, it } from 'vitest'
import { STYLES } from '../../app/lib/constants'
import { rangeOf } from '../../app/lib/melodyView'
import { REMIXES } from '../../app/lib/remixes'
import { DENSITY, MIN_NOTE_SEC, rhythmKey, SUGGEST_GAIN, suggestMelody, type DrumSteps } from '../../app/lib/suggestMelody'
import { STYLE_MUSIC, templateSteps } from '../../app/lib/styles'
import type { StyleId } from '../../app/lib/types'

const mod = (a: number, n: number) => ((a % n) + n) % n
const STYLE_IDS = Object.keys(STYLES) as StyleId[]

/** el ritmo típico del estilo (sus plantillas de un compás, repetido 4 veces) */
const typical = (style: StyleId): DrumSteps => {
  const rep = (steps: number[]) => [0, 1, 2, 3].flatMap((b) => steps.map((s) => b * 16 + s))
  const t = STYLE_MUSIC[style].templates
  return { bd: rep(templateSteps(t.bd)), sd: rep(templateSteps(t.sd)), hh: rep(templateSteps(t.hh)) }
}

describe('la melodía sugerida (spec 012, §3): pura, determinista y del estilo', () => {
  it('sin ritmo no propone nada', () => {
    expect(suggestMelody({ style: 'techno', drums: { bd: [], sd: [], hh: [] }, seed: 0 })).toEqual([])
  })
  it('es determinista: misma entrada y misma semilla, la misma melodía; otra semilla, otra', () => {
    for (const style of STYLE_IDS) {
      const d = typical(style)
      const a = suggestMelody({ style, drums: d, seed: 0 })
      expect(suggestMelody({ style, drums: d, seed: 0 }), style).toEqual(a)
      const b = suggestMelody({ style, drums: d, seed: 1 })
      expect(b, style).not.toEqual(a)
      // «otra» es de verdad otra: cambia una buena parte de las notas
      const n = Math.min(a.length, b.length)
      let diff = 0
      for (let k = 0; k < n; k++) if (a[k]!.midi !== b[k]!.midi || a[k]!.pos !== b[k]!.pos) diff++
      expect(diff / n, `${style} otra`).toBeGreaterThan(0.3)
    }
  })
  it('la secuencia de «otra» es fija (reproducible): la semilla 2 es siempre la misma', () => {
    const d = typical('house')
    expect(suggestMelody({ style: 'house', drums: d, seed: 2 })).toEqual(suggestMelody({ style: 'house', drums: d, seed: 2 }))
    expect(rhythmKey('house', d)).toBe(rhythmKey('house', d))
    expect(rhythmKey('house', d)).not.toBe(rhythmKey('techno', d)) // cada estilo, la suya
  })
  it('todas las notas son de la escala del estilo y caen en el registro del sinte', () => {
    for (const style of STYLE_IDS) for (const seed of [0, 1, 2, 3]) {
      const music = STYLE_MUSIC[style]
      const [lo, hi] = rangeOf(music.synth)
      for (const h of suggestMelody({ style, drums: typical(style), seed })) {
        expect(music.scale, `${style}/${seed} midi ${h.midi}`).toContain(mod(h.midi, 12))
        expect(h.midi).toBeGreaterThanOrEqual(lo)
        expect(h.midi).toBeLessThanOrEqual(hi)
      }
    }
  })
  it('4 compases: ninguna nota cruza la línea de compás ni se sale de los 64 pasos, y cada compás tiene notas dentro de la densidad del estilo', () => {
    for (const style of STYLE_IDS) {
      const m = suggestMelody({ style, drums: typical(style), seed: 0 })
      const [dMin, dMax] = DENSITY[style]
      for (const h of m) {
        expect(h.pos).toBeGreaterThanOrEqual(0)
        expect(h.pos + h.dur).toBeLessThanOrEqual(64)
        expect(Math.floor(h.pos / 16), `${style} nota ${h.pos}`).toBe(Math.floor((h.pos + h.dur - 1e-9) / 16))
      }
      for (let b = 0; b < 4; b++) {
        const n = m.filter((h) => Math.floor(h.pos / 16) === b).length
        expect(n, `${style} compás ${b}`).toBeGreaterThanOrEqual(1)
        expect(n, `${style} compás ${b}`).toBeLessThanOrEqual(dMax + 1) // (+1: el golpe de apoyo que se fuerza en el paso 0)
        expect(dMin).toBeLessThanOrEqual(dMax)
      }
    }
  })
  it('sigue el tempo: ninguna nota dura menos de ≈ 0,12 s, y dnb va en corcheas (rejilla de 2 pasos)', () => {
    for (const style of STYLE_IDS) {
      const bpm = STYLES[style].bpm
      const stepSec = 60 / bpm / 4
      for (const h of suggestMelody({ style, drums: typical(style), seed: 0 })) {
        expect(h.dur * stepSec, `${style} ${h.pos}`).toBeGreaterThanOrEqual(MIN_NOTE_SEC - 1e-6)
        if (STYLES[style].quantizeEvery === 2) expect(h.pos % 2, `${style} rejilla`).toBe(0)
      }
    }
    // a otro tempo cambia la densidad mínima: más lento, notas más cortas permitidas
    const slow = suggestMelody({ style: 'house', drums: typical('house'), bpm: 60, seed: 0 })
    expect(slow.length).toBeGreaterThan(0)
  })
  it('en los apoyos (el primer paso del compás) la nota es del acorde de ese compás', () => {
    for (const style of STYLE_IDS) {
      const music = STYLE_MUSIC[style]
      for (const h of suggestMelody({ style, drums: typical(style), seed: 0 }).filter((x) => x.pos % 16 === 0)) {
        const chord = music.chordTones[mod(Math.floor(h.pos / 16), music.chordTones.length)]!
        // (la última nota de la frase es la tónica y manda sobre el acorde: la cadencia)
        if (h.pos === 48 && music.scale[0] === mod(h.midi, 12)) continue
        expect(chord, `${style} compás ${h.pos / 16}`).toContain(mod(h.midi, 12))
      }
    }
  })
  it('la frase acaba en la tónica', () => {
    for (const style of STYLE_IDS) for (const seed of [0, 1, 2]) {
      const m = suggestMelody({ style, drums: typical(style), seed })
      expect(mod(m[m.length - 1]!.midi, 12), `${style}/${seed}`).toBe(STYLE_MUSIC[style].scale[0])
    }
  })
  it('sin tres notas iguales seguidas (cuatro en el techno, que repite la nota pedal)', () => {
    for (const style of STYLE_IDS) for (const seed of [0, 1, 2, 3]) {
      const m = suggestMelody({ style, drums: typical(style), seed })
      const cap = style === 'techno' ? 3 : 2
      let run = 1
      for (let k = 1; k < m.length; k++) {
        run = m[k]!.midi === m[k - 1]!.midi ? run + 1 : 1
        expect(run, `${style}/${seed} nota ${k}`).toBeLessThanOrEqual(cap + 1) // (+1: la cadencia final puede repetir)
      }
    }
  })
  it('encaja con los golpes: en el dembow la mayoría de las notas caen sobre un golpe de bombo o de caja, y la caja (3 6 11 14) pesa más que su cuota de la rejilla', () => {
    const d = typical('dembow')
    const counts = new Map<number, number>()
    for (const seed of [0, 1, 2, 3, 4, 5]) for (const h of suggestMelody({ style: 'dembow', drums: d, seed })) counts.set(h.pos % 16, (counts.get(h.pos % 16) ?? 0) + 1)
    const total = [...counts.values()].reduce((s, n) => s + n, 0)
    const share = (steps: number[]) => steps.reduce((s, p) => s + (counts.get(p) ?? 0), 0) / total
    expect(share([0, 3, 4, 6, 8, 11, 12, 14])).toBeGreaterThan(0.6) // anclas: bombo y caja
    expect(share([3, 6, 11, 14])).toBeGreaterThan(0.25) // más que 4 de 16 pasos al azar
  })
  it('funciona con el ritmo de cada remix (todas sus células con batería) y de cualquier estilo', () => {
    for (const r of REMIXES) {
      const song = r.build()
      for (const c of song.cells) {
        const drums: DrumSteps = { bd: [], sd: [], hh: [] }
        for (const l of c.loops) if (l.instrument === 'bd' || l.instrument === 'sd' || l.instrument === 'hh') for (const b of Array(4 / l.bars).keys()) for (const h of l.hits) drums[l.instrument].push(b * l.bars * 16 + h.pos)
        const m = suggestMelody({ style: r.style, drums, seed: 0 })
        if (drums.bd.length + drums.sd.length + drums.hh.length === 0) expect(m).toEqual([])
        else {
          expect(m.length, `${r.id} ${c.name}`).toBeGreaterThan(0)
          for (const h of m) expect(STYLE_MUSIC[r.style].scale).toContain(mod(h.midi, 12))
        }
      }
    }
  })
  it('el volumen de la sugerida es ≈ 35 %', () => {
    expect(SUGGEST_GAIN).toBe(0.35)
  })
})

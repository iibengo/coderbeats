import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LiveMelody, MELODY_DECISION_SEC } from '../../app/lib/liveMelody'
import { midiName } from '../../app/lib/noteScore'
import { detectOnsets } from '../../app/lib/onsets'
import { decodeWav } from '../../app/lib/wav'
import { sound } from '../helpers/synth'
import { voice } from '../helpers/voice'

const SR = 48000
const CHUNK = 512

/** Alimenta el audio como lo haría el micro (bloques de 512) y avisa de las notas nacidas, con su tiempo de aviso. */
function run(x: Float32Array, onsets: number[] = [], offsetFrames = 0) {
  const lm = new LiveMelody(SR)
  const born: { name: string; start: number; at: number }[] = []
  const pending = [...onsets].sort((a, b) => a - b)
  const decisions: { onset: number; melodic: boolean }[] = []
  for (let i = 0; i < x.length; i += CHUNK) {
    lm.push(offsetFrames + i, x.subarray(i, Math.min(x.length, i + CHUNK)))
    const now = (offsetFrames + i + CHUNK) / SR
    // los onsets ya vistos se pasan al registro
    for (const o of onsets) if (o <= now && !(lm as unknown as { _seen?: Set<number> })._seen?.has(o)) {
      ;((lm as unknown as { _seen?: Set<number> })._seen ??= new Set()).add(o)
      lm.addOnset(o)
    }
    for (const n of lm.scan()) born.push({ name: midiName(n.midi), start: n.start, at: lm.time })
    while (pending.length && lm.time >= pending[0]! + MELODY_DECISION_SEC) decisions.push({ onset: pending[0]!, melodic: lm.isMelodic(pending.shift()!) })
  }
  return { lm, born, decisions }
}

describe('LiveMelody (sintético)', () => {
  it('una nota cantada se avisa unos 0,1 s después de empezar, con su altura', () => {
    const x = voice(SR, [{ silence: 0.5 }, { midi: 60, sec: 0.8 }, { silence: 0.5 }])
    const { born, lm } = run(x)
    expect(born.map((b) => b.name)).toEqual(['C4'])
    expect(born[0]!.at - born[0]!.start).toBeLessThan(0.35)
    expect(born[0]!.at - born[0]!.start).toBeGreaterThan(0.09)
    const [n] = lm.notesBetween(0, 3)
    expect(n!.end - n!.start).toBeGreaterThan(0.6)
  })

  it('una escala de 4 notas: 4 notas, cada una se avisa una sola vez', () => {
    const g = { silence: 0.15 }
    const x = voice(SR, [{ silence: 0.3 }, { midi: 57, sec: 0.5 }, g, { midi: 59, sec: 0.5 }, g, { midi: 60, sec: 0.5 }, g, { midi: 62, sec: 0.5 }, { silence: 0.5 }])
    const { born, lm } = run(x)
    expect(born).toHaveLength(4)
    expect(lm.notesBetween(0, 10).map((n) => midiName(n.midi))).toEqual(['A3', 'B3', 'C4', 'D4'])
  })

  it('una nota más larga que la ventana de análisis (3 s) sigue siendo una', () => {
    const x = voice(SR, [{ silence: 0.3 }, { midi: 64, sec: 4.5 }, { silence: 0.5 }])
    const { born, lm } = run(x)
    expect(born).toHaveLength(1)
    const notes = lm.notesBetween(0, 10)
    expect(notes).toHaveLength(1)
    expect(notes[0]!.end - notes[0]!.start).toBeGreaterThan(4)
  })

  it('un "bum", un "pff" y un "ts" no son melodía; un "na" cantado entre ellos, sí', () => {
    const x = new Float32Array(Math.round(SR * 4))
    const put = (s: Float32Array, at: number) => x.set(s, Math.round(at * SR))
    put(sound('bum', SR, 0.8), 0.5)
    put(sound('pff', SR, 0.8), 1.0)
    put(sound('ts', SR, 0.8), 1.5)
    put(voice(SR, [{ midi: 60, sec: 0.6 }]), 2.0)
    put(sound('bum', SR, 0.8), 3.2)
    const onsets = detectOnsets(x, SR).map((o) => o.time)
    const { decisions, born } = run(x, onsets)
    expect(born.map((b) => b.name)).toEqual(['C4'])
    const verdict = (t: number) => decisions.find((d) => Math.abs(d.onset - t) < 0.12)?.melodic
    expect(verdict(0.5)).toBe(false)
    expect(verdict(1.0)).toBe(false)
    expect(verdict(1.5)).toBe(false)
    expect(verdict(2.0)).toBe(true)
    expect(verdict(3.2)).toBe(false)
  })

  it('silencio y ruido: nada', () => {
    expect(run(new Float32Array(SR * 2)).born).toEqual([])
  })

  it('reset vacía el registro', () => {
    const x = voice(SR, [{ midi: 60, sec: 0.8 }, { silence: 0.3 }])
    const { lm } = run(x)
    expect(lm.notesBetween(0, 5).length).toBe(1)
    lm.reset()
    expect(lm.notesBetween(0, 5)).toEqual([])
    expect(lm.scan()).toEqual([])
  })

  it('con los frames empezando muy tarde (índice absoluto alto) los tiempos son absolutos', () => {
    const off = SR * 100
    const x = voice(SR, [{ silence: 0.3 }, { midi: 60, sec: 0.6 }, { silence: 0.3 }])
    const { lm } = run(x, [], off)
    const [n] = lm.notesBetween(99, 102)
    expect(n!.start).toBeGreaterThan(100.2)
    expect(n!.start).toBeLessThan(100.6)
  })
})

const DIR = join(__dirname, '..', 'fixtures', 'voice')
const take = (prefix: string) => {
  if (!existsSync(DIR)) return null
  const f = require('node:fs').readdirSync(DIR).find((n: string) => n.startsWith(prefix) && n.endsWith('.wav'))
  return f ? decodeWav(readFileSync(join(DIR, f)).buffer.slice(0) as ArrayBuffer) : null
}

describe.skipIf(!take('t8-'))('LiveMelody con tus tomas (en vivo, causal)', () => {
  const analyze = (prefix: string) => {
    const w = take(prefix)!
    const onsets = detectOnsets(w.samples, w.sampleRate).map((o) => o.time)
    const r = run(w.samples, onsets)
    return { ...r, onsets }
  }
  it('toma 8 (solo beatbox): ni una nota ni un onset de melodía', () => {
    const r = analyze('t8-')
    console.info(`[voz en vivo] t8: onsets ${r.onsets.length}, notas ${r.born.length}, melódicos ${r.decisions.filter((d) => d.melodic).length}`)
    expect(r.born).toEqual([])
    expect(r.decisions.filter((d) => d.melodic)).toEqual([])
  })
  it('tomas 1 y 2: las notas esperadas, como en la segmentación offline', () => {
    const final = (r: ReturnType<typeof analyze>) => r.lm.notesBetween(0, 1e6).map((n) => midiName(n.midi))
    const t1 = analyze('t1-escala_pc')
    console.info(`[voz en vivo] t1: avisadas ${t1.born.length}, registro ${final(t1).join(' ')}`)
    expect(final(t1)).toEqual(['A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'])
    expect(t1.born.length).toBeGreaterThanOrEqual(8)
    const t2 = analyze('t2-')
    console.info(`[voz en vivo] t2: avisadas ${t2.born.length}, registro ${final(t2).join(' ')}`)
    expect(final(t2)).toEqual(['A2', 'C3', 'E3', 'D3', 'C3'])
    expect(t2.born.length).toBeGreaterThanOrEqual(5)
  })
  it('toma 7 (mezcla): informa cuántas notas y onsets de melodía', () => {
    const r = analyze('t7-')
    console.info(`[voz en vivo] t7: onsets ${r.onsets.length}, notas ${r.born.length} [${r.born.map((b) => b.name).join(' ')}], melódicos ${r.decisions.filter((d) => d.melodic).length}`)
    expect(r.born.length).toBeGreaterThanOrEqual(6)
  })
})

import { describe, expect, it } from 'vitest'
import { assistMelody } from '../../app/lib/melodyAssist'
import { inScale } from '../../app/lib/songScale'
import { hitsFromSung, MAX_PART_MELODIES } from '../../app/lib/singPart'

const SR = 24000
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)
/** una voz sintética: una nota por (midi, segundos), con un poco de vibrato y silencio entre notas */
function voice(notes: [number, number][], gapSec = 0.06): Float32Array {
  const total = notes.reduce((s, [, d]) => s + d + gapSec, 0)
  const out = new Float32Array(Math.round(total * SR))
  let t = 0
  for (const [m, d] of notes) {
    const n = Math.round(d * SR)
    const off = Math.round(t * SR)
    let ph = 0
    for (let i = 0; i < n; i++) {
      const f = hz(m) * (1 + 0.004 * Math.sin((2 * Math.PI * 5 * i) / SR))
      ph += (2 * Math.PI * f) / SR
      const env = Math.min(1, i / (0.02 * SR), (n - i) / (0.03 * SR))
      out[off + i] = 0.3 * env * (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph))
    }
    t += d + gapSec
  }
  return out
}
const O = { stepSeconds: 60 / 100 / 4, bars: 2, register: 'lead' as const }
const GMIN = { tonic: 7, mode: 'minor' as const }

describe('cantar una parte (spec 039)', () => {
  it('silencio: no crea nada', () => {
    expect(hitsFromSung(new Float32Array(SR * 2), SR, { ...O, scale: GMIN })).toEqual({ hits: [], heard: 0 })
  })
  it('una frase cantada sale como notas de la escala de la canción, ordenadas y en la rejilla de semicorcheas', () => {
    // sol la si♭ do (en sol menor) a negra y media (0,6 s a 100 bpm = una negra)
    const x = voice([[67, 0.6], [69, 0.6], [70, 0.6], [72, 0.6]])
    const { hits, heard } = hitsFromSung(x, SR, { ...O, scale: GMIN })
    expect(heard).toBeGreaterThanOrEqual(3)
    expect(hits.length).toBeGreaterThanOrEqual(3)
    for (const h of hits) {
      expect(inScale(h.midi, GMIN), `midi ${h.midi}`).toBe(true)
      expect(Number.isInteger(h.pos), `pos ${h.pos}`).toBe(true)
      expect(h.pos).toBeGreaterThanOrEqual(0)
      expect(h.pos).toBeLessThan(2 * 16)
    }
    expect([...hits].sort((a, b) => a.pos - b.pos)).toEqual(hits)
  })
  it('una nota desafinada se ajusta a la escala: un fa♯ cantado en sol menor acaba en sol o en fa, no en fa♯', () => {
    const x = voice([[66.1, 0.8], [66.1, 0.8]], 0.2)
    const { hits } = hitsFromSung(x, SR, { ...O, scale: GMIN })
    expect(hits.length).toBeGreaterThan(0)
    for (const h of hits) expect(h.midi % 12).not.toBe(6)
  })
  it('la misma frase en otra escala da otras notas (la escala manda)', () => {
    const x = voice([[66, 0.8], [66, 0.8]], 0.2)
    const gmin = hitsFromSung(x, SR, { ...O, scale: GMIN }).hits
    const dmaj = hitsFromSung(x, SR, { ...O, scale: { tonic: 2, mode: 'major' } }).hits
    expect(gmin.every((h) => h.midi % 12 !== 6)).toBe(true)
    expect(dmaj.some((h) => h.midi % 12 === 6)).toBe(true) // fa♯ sí está en re mayor
  })
  it('la escala propia solo cambia lo que se pide: sin ella, la ayuda de siempre usa la del estilo', () => {
    const raw = [{ step: 0, dur: 4, midi: 66.4, strength: 0.8 }]
    const base = { assist: true, style: 'techno2' as const, startBar: 0, bars: 1, register: 'lead' as const, stepSeconds: 0.15 }
    const sin = assistMelody(raw, base)
    const con = assistMelody(raw, { ...base, scale: [7, 9, 10, 0, 2, 3, 5] })
    expect(sin.length).toBe(1)
    expect(con.length).toBe(1)
    expect(con[0]!.midi % 12).not.toBe(6)
  })
  it('el tope de melodías por parte', () => {
    expect(MAX_PART_MELODIES).toBe(3)
  })
})

import { melodyCount } from '../../app/lib/singPart'
describe('contar las melodías de una parte', () => {
  const mel = (id: number, synth?: string) => ({ id, instrument: 'mel' as const, bars: 2 as const, phaseBar: 0, hits: [{ pos: 0, strength: 0.8, midi: 60, dur: 4 }], muted: false, bornAt: 0, fromTemplate: false, ...(synth ? { synth: synth as never } : {}) })
  it('no cuenta efectos ni el bajo y los acordes propios', () => {
    expect(melodyCount([mel(1), mel(2, 'guitar'), mel(3, 'bass'), mel(4, 'keys'), mel(5, 'riser'), mel(6, 'crash')])).toBe(2)
    expect(melodyCount([])).toBe(0)
  })
})

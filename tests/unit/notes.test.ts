import { describe, expect, it } from 'vitest'
import { segmentNotes, toneGate } from '../../app/lib/notes'
import { midiName, parseExpected, scoreNotes, shiftExpected } from '../../app/lib/noteScore'
import { trackPitch } from '../../app/lib/pitch'
import { detectOnsets } from '../../app/lib/onsets'
import { sound } from '../helpers/synth'
import { voice } from '../helpers/voice'

const SR = 48000
const gap = { silence: 0.08 }
const names = (x: Float32Array, o = {}) => {
  const t = trackPitch(x, SR)
  return segmentNotes(t, detectOnsets(x, SR), o).map((n) => midiName(n.midi))
}

describe('segmentNotes', () => {
  it('una escala de 4 notas separadas: 4 notas con su altura', () => {
    const x = voice(SR, [
      { midi: 57, sec: 0.3 }, gap, { midi: 59, sec: 0.3 }, gap, { midi: 60, sec: 0.3 }, gap, { midi: 62, sec: 0.3 },
    ])
    expect(names(x)).toEqual(['A3', 'B3', 'C4', 'D4'])
  })

  it('"na-na-na" sin pausa entre dos alturas distintas, con onsets: 3 notas', () => {
    const x = voice(SR, [{ midi: 60, sec: 0.25 }, { midi: 64, sec: 0.25 }, { midi: 67, sec: 0.25 }])
    expect(names(x)).toEqual(['C4', 'E4', 'G4'])
  })

  it('el vibrato de ±40 cents no parte una nota larga', () => {
    const x = voice(SR, [{ midi: 69, sec: 1.5, vibrato: 0.4 }])
    const t = trackPitch(x, SR)
    const notes = segmentNotes(t)
    expect(notes).toHaveLength(1)
    expect(notes[0]!.midi).toBeCloseTo(69, 0)
    expect(notes[0]!.end - notes[0]!.start).toBeGreaterThan(1.2)
  })

  it('un glissando de 120 ms entre dos notas no crea una nota intermedia', () => {
    const x = voice(SR, [{ midi: 60, sec: 0.4 }, { midi: [60, 67], sec: 0.12 }, { midi: 67, sec: 0.4 }])
    const notes = segmentNotes(trackPitch(x, SR))
    expect(notes.map((n) => midiName(n.midi))).toEqual(['C4', 'G4'])
  })

  it('una nota a −35 dBFS con ruido se encuentra', () => {
    const x = voice(SR, [{ midi: 62, sec: 0.5 }], { peakDb: -35, noiseDb: -60 })
    expect(names(x)).toEqual(['D4'])
  })

  it('un tramo más corto que la duración mínima se ignora', () => {
    const x = voice(SR, [{ midi: 60, sec: 0.02 }, gap, { midi: 62, sec: 0.3 }])
    expect(names(x)).toEqual(['D4'])
  })

  it('un hueco muy corto (consonante) no parte la nota; con un onset dentro, sí', () => {
    const x = voice(SR, [{ midi: 64, sec: 0.3 }, { silence: 0.02 }, { midi: 64, sec: 0.3 }])
    const t = trackPitch(x, SR)
    expect(segmentNotes(t)).toHaveLength(1)
    expect(segmentNotes(t, [0.32])).toHaveLength(2)
  })

  it('el inicio de la nota usa el onset de energía si está justo antes', () => {
    const x = voice(SR, [{ silence: 0.3 }, { midi: 60, sec: 0.4 }])
    const t = trackPitch(x, SR)
    const [n] = segmentNotes(t, [0.3])
    expect(n!.start).toBeCloseTo(0.3, 2)
  })

  it('silencio: ninguna nota', () => expect(names(new Float32Array(SR))).toEqual([]))
})

describe('toneGate', () => {
  it('un "na" sostenido pasa y da su altura', () => {
    const x = voice(SR, [{ silence: 0.1 }, { midi: 62, sec: 0.4 }])
    const g = toneGate(trackPitch(x, SR), 0.1)
    expect(g.pass).toBe(true)
    expect(g.midi).toBeCloseTo(62, 0)
    expect(g.sec).toBeGreaterThan(0.15)
  })

  it('un "pff", un "ts" y un "bum" sintéticos no pasan', () => {
    for (const kind of ['pff', 'ts', 'bum'] as const) {
      const x = new Float32Array(SR / 2)
      x.set(sound(kind, SR, 0.8), 4800)
      expect(toneGate(trackPitch(x, SR), 0.1).pass, kind).toBe(false)
    }
  })

  it('un tono corto (50 ms) no pasa; uno de 100 ms, sí', () => {
    const short = voice(SR, [{ silence: 0.1 }, { midi: 60, sec: 0.05 }, { silence: 0.3 }])
    const longer = voice(SR, [{ silence: 0.1 }, { midi: 60, sec: 0.12 }, { silence: 0.3 }])
    expect(toneGate(trackPitch(short, SR), 0.1).pass).toBe(false)
    expect(toneGate(trackPitch(longer, SR), 0.1).pass).toBe(true)
  })

  it('un deslizamiento largo (más de ±1 semitono) no pasa', () => {
    const x = voice(SR, [{ silence: 0.1 }, { midi: [55, 70], sec: 0.3 }])
    expect(toneGate(trackPitch(x, SR), 0.1, { minSec: 0.2 }).pass).toBe(false)
  })
})

describe('noteScore', () => {
  it('parseExpected: nombres, sostenidos, bemoles, octavas y @paso', () => {
    expect(parseExpected('A3 C4 e4')!.map((n) => n.midi)).toEqual([57, 60, 64])
    expect(parseExpected('bb3 F#2 Db4')!.map((n) => n.midi)).toEqual([58, 42, 61])
    expect(parseExpected('A3@0 C4@4')).toEqual([{ midi: 57, step: 0 }, { midi: 60, step: 4 }])
    expect(parseExpected('A3 hola')).toBeNull()
    expect(parseExpected('')).toEqual([])
    expect(midiName(57)).toBe('A3')
    expect(midiName(61)).toBe('C#4')
  })

  const notes = (...m: number[]) => m.map((midi, i) => ({ start: i * 0.5, end: i * 0.5 + 0.3, midi, rms: 0.1 }))

  it('todo bien: 100 %', () => {
    const s = scoreNotes(parseExpected('A3 C4 E4')!, notes(57, 60, 64))
    expect(s.pitchClassRate).toBe(1)
    expect(s.exactRate).toBe(1)
    expect(s.missed).toEqual([])
    expect(s.extra).toEqual([])
  })

  it('un error de octava cuenta como clase correcta pero no exacta', () => {
    const s = scoreNotes(parseExpected('A3 C4 E4')!, notes(57, 72, 64))
    expect(s.pitchClassRate).toBe(1)
    expect(s.exactRate).toBeCloseTo(2 / 3)
  })

  it('una nota perdida y una de más se alinean en orden', () => {
    const s = scoreNotes(parseExpected('A3 C4 E4 D4')!, notes(57, 64, 62, 55))
    expect(s.missed).toEqual([1])
    expect(s.extra).toEqual([3])
    expect(s.pitchClassRate).toBe(3 / 4)
  })

  it('una nota equivocada no cuenta', () => {
    const s = scoreNotes(parseExpected('A3 C4')!, notes(57, 61))
    expect(s.pitchClassRate).toBe(0.5)
  })

  it('el inicio a ≤ 1 semicorchea, con @paso', () => {
    // paso = 0,125 s: las notas empiezan en 0, 0,5 (paso 4), 1,0 (paso 8)
    const s = scoreNotes(parseExpected('A3@0 C4@4 E4@10')!, notes(57, 60, 64), 0.125, 0)
    expect(s.matches.map((m) => m.startError)).toEqual([0, 0, 2])
    expect(s.startRate).toBeCloseTo(2 / 3)
    expect(scoreNotes(parseExpected('A3 C4')!, notes(57, 60)).startRate).toBeNull()
  })

  it('nada esperado o nada detectado', () => {
    expect(scoreNotes([], notes(60)).pitchClassRate).toBe(0)
    expect(scoreNotes(parseExpected('A3')!, []).missed).toEqual([0])
  })
})

describe('shiftExpected', () => {
  it('sube y baja una octava y conserva los @paso', () => {
    expect(shiftExpected('A3 C4 E4', -12)).toBe('A2 C3 E3')
    expect(shiftExpected('A2@0 C3@4', 12)).toBe('A3@0 C4@4')
    expect(shiftExpected('A3 Bb3', -12)).toBe('A2 A#2')
    expect(shiftExpected('', 12)).toBe('')
  })
  it('si no se entiende, lo deja como está', () => expect(shiftExpected('A3 hola', 12)).toBe('A3 hola'))
})

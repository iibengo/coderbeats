import { describe, expect, it } from 'vitest'
import { melodicOnsets, segmentNotes, toneGate } from '../../app/lib/notes'
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
    // con silencio alrededor, como en una toma real (de ahí sale el piso de ruido)
    const x = voice(SR, [{ silence: 0.4 }, { midi: 62, sec: 0.5 }, { silence: 0.4 }], { peakDb: -35, noiseDb: -60 })
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

describe('fragmentos al empezar y terminar una nota', () => {
  const run = (segs: Parameters<typeof voice>[1], onsets: number[] = []) => segmentNotes(trackPitch(voice(SR, segs), SR), onsets)

  it('la voz que entra por debajo (3 semitonos, 80 ms) no deja una nota de más', () => {
    const n = run([{ midi: 57, sec: 0.08 }, { midi: 60, sec: 0.6 }])
    expect(n.map((x) => midiName(x.midi))).toEqual(['C4'])
    expect(n[0]!.start).toBeLessThan(0.1)
  })

  it('una cadena de fragmentos al principio se absorbe entera', () => {
    const n = run([{ midi: 61, sec: 0.07 }, { midi: 62, sec: 0.1 }, { midi: 60, sec: 0.6 }])
    expect(n.map((x) => midiName(x.midi))).toEqual(['C4'])
  })

  it('la voz que cae al final (medio semitono, 0,25 s) se absorbe', () => {
    const n = run([{ midi: 60, sec: 0.6 }, { midi: 59.4, sec: 0.25 }])
    expect(n.map((x) => midiName(x.midi))).toEqual(['C4'])
    expect(n[0]!.end - n[0]!.start).toBeGreaterThan(0.8)
  })

  it('una nota corta de verdad entre dos largas (no está en el borde) se conserva', () => {
    const n = run([{ midi: 60, sec: 0.5 }, { midi: 64, sec: 0.15 }, { midi: 60, sec: 0.5 }])
    expect(n.map((x) => midiName(x.midi))).toEqual(['C4', 'E4', 'C4'])
  })

  it('dos notas, cada una con su propio ataque de energía, no se funden; sin el segundo ataque, sí', () => {
    const x = voice(SR, [{ midi: 60, sec: 0.15 }, { midi: 61, sec: 0.6 }])
    const t = trackPitch(x, SR)
    expect(segmentNotes(t, [0.0, 0.16]).map((n) => midiName(n.midi))).toEqual(['C4', 'C#4'])
    expect(segmentNotes(t, [0.0]).map((n) => midiName(n.midi))).toEqual(['C#4'])
  })

  it('una cola una octava más abajo (voz quebrada, 0,1 s) se absorbe', () => {
    expect(run([{ midi: 60, sec: 0.6 }, { midi: 48, sec: 0.1 }]).map((x) => midiName(x.midi))).toEqual(['C4'])
  })

  it('un fragmento largo (0,5 s) o muy lejano (6 semitonos) es una nota', () => {
    expect(run([{ midi: 54, sec: 0.5 }, { midi: 60, sec: 0.6 }]).map((x) => midiName(x.midi))).toEqual(['F#3', 'C4'])
    expect(run([{ midi: 54, sec: 0.08 }, { midi: 60, sec: 0.6 }]).map((x) => midiName(x.midi))).toEqual(['C4'])
  })
})

describe('fondo por los altavoces', () => {
  it('un fondo constante con tono (piso alto) no da notas flojas; lo cantado, más fuerte, sí', () => {
    // fondo: sierra grave + triángulos, a un volumen que el micro oye (piso ~0,005); voz 4 veces más fuerte
    const bg = voice(SR, [{ midi: 79, sec: 3 }], { peakDb: -44, noiseDb: -70 })
    const mix = Float32Array.from(bg)
    const sung = voice(SR, [{ silence: 1.4 }, { midi: 48, sec: 0.8 }])
    for (let i = 0; i < mix.length && i < sung.length; i++) mix[i] = mix[i]! + sung[i]! * 0.12
    const notes = segmentNotes(trackPitch(mix, SR)).map((n) => midiName(n.midi))
    expect(notes).toEqual(['C3'])
  })
  it('sin ese criterio, el fondo flojo sí daría nota (la regla del piso es la que lo evita)', () => {
    const bg = voice(SR, [{ midi: 79, sec: 1 }], { peakDb: -44, noiseDb: -70 })
    expect(segmentNotes(trackPitch(bg, SR), [], { floorFactor: 0, minPeakRms: 0, minMeanProb: 0 }).length).toBeGreaterThan(0)
  })
})

describe('zumbidos de fondo', () => {
  it('un tono flojo y constante (pico de volumen bajo) no es nota; con pico suficiente, sí', () => {
    const quiet = voice(SR, [{ midi: 37, sec: 0.5 }], { peakDb: -62 })
    expect(segmentNotes(trackPitch(quiet, SR))).toEqual([])
    const sung = voice(SR, [{ midi: 48, sec: 0.5 }], { peakDb: -24 })
    expect(segmentNotes(trackPitch(sung, SR)).map((n) => midiName(n.midi))).toEqual(['C3'])
  })
})

describe('melodicOnsets', () => {
  const note = (start: number, end: number) => ({ start, end, midi: 60, rms: 0.1 })
  it('un onset es melodía si cae dentro de una nota (con margen para el ataque)', () => {
    const m = melodicOnsets([0.15, 0.45, 1.0, 1.55, 2.5], [note(0.3, 0.4), note(1.7, 2.2)])
    expect(m).toEqual([true, false, false, true, false])
  })
  it('sin notas, ninguno', () => expect(melodicOnsets([0.1, 0.5], [])).toEqual([false, false]))
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

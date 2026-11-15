import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decideOnset, DRUM_GATE_CONF, LiveMelody, MAX_DRUM_NOTE_SEC, MELODY_DECISION_SEC, NoteGate, RELEASE_AFTER_SEC } from '../../app/lib/liveMelody'
import { DEFAULT_PITCH_OPTIONS } from '../../app/lib/pitch'
import { voice } from '../helpers/voice'

/**
 * La melodía que no se cantó (spec 012, §2): el bajo y el bombo del kit Electrónico, por el micro, salían como notas; y un «bum» con tono de ≥ 0,2 s
 * era una nota que además se tragaba el golpe. Señales sintéticas y los WAV reales del kit.
 */
const SR = 44100
const CHUNK = 512

function feed(sig: Float32Array, onsets: number[] = []) {
  const m = new LiveMelody(SR)
  for (const o of onsets) m.addOnset(o)
  const notes: { start: number; end: number; midi: number }[] = []
  for (let i = 0; i < sig.length; i += CHUNK) {
    m.push(i, sig.subarray(i, i + CHUNK))
    for (const n of m.scan()) notes.push(n)
  }
  return { m, notes }
}

/** WAV de 16/24/32 bits (mono o estéreo → mono), como en los samples del kit */
function wav(path: string): Float32Array {
  const b = readFileSync(path)
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  let ch = 1
  let bits = 16
  let p = 12
  while (p < b.length - 8) {
    const id = b.toString('ascii', p, p + 4)
    const size = dv.getUint32(p + 4, true)
    if (id === 'fmt ') {
      ch = dv.getUint16(p + 10, true)
      bits = dv.getUint16(p + 22, true)
    }
    if (id === 'data') {
      const n = size / (bits / 8) / ch
      const out = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const o = p + 8 + i * ch * (bits / 8)
        out[i] = bits === 16 ? dv.getInt16(o, true) / 32768 : bits === 24 ? (((b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16)) << 8) >> 8) / 8388608 : dv.getInt32(o, true) / 2147483648
      }
      return out
    }
    p += 8 + size
  }
  return new Float32Array(0)
}

/** el bajo del techno: sierra en do₂ (65,4 Hz), corcheas a 128 bpm */
function bassLeak(sec: number, amp: number): Float32Array {
  const sig = new Float32Array(Math.round(sec * SR))
  for (let i = 0; i < sig.length; i++) {
    const t = i / SR
    if (t % 0.2345 >= 0.15) continue
    let v = 0
    for (let h = 1; h <= 8; h++) v += Math.sin(2 * Math.PI * 65.4 * h * t) / h
    sig[i] = amp * v
  }
  return sig
}

/** un bombo del kit repetido cada tiempo a 128 bpm */
function kickLeak(path: string, sec: number, gain: number): { sig: Float32Array; onsets: number[] } {
  const s = wav(path)
  const sig = new Float32Array(Math.round(sec * SR))
  const onsets: number[] = []
  for (let t0 = 0.5; t0 < sec - 0.5; t0 += 0.469) {
    onsets.push(t0)
    for (let i = 0; i < s.length && Math.round(t0 * SR) + i < sig.length; i++) sig[Math.round(t0 * SR) + i]! += s[i]! * gain
  }
  return { sig, onsets }
}

/** un «bum» con tono: voz grave con armónicos, ataque rápido y caída de tono, cada 0,47 s */
function bum(sec: number, f0: number, dur: number, amp = 0.2): { sig: Float32Array; onsets: number[] } {
  const sig = new Float32Array(Math.round(sec * SR))
  const onsets: number[] = []
  for (let t0 = 0.5; t0 < sec - 0.3; t0 += 0.469) {
    onsets.push(t0)
    let ph = 0
    for (let i = 0; i < dur * SR; i++) {
      const t = i / SR
      ph += (2 * Math.PI * f0 * (1.08 - (0.35 * t) / dur)) / SR
      const env = Math.min(1, t / 0.01) * Math.exp(-t / 0.12)
      let v = 0
      for (let h = 1; h <= 6; h++) v += Math.sin(h * ph) / h
      sig[Math.round(t0 * SR) + i]! += amp * env * v * 0.6
    }
  }
  return { sig, onsets }
}

describe('F1: el mínimo de YIN sube a 80 Hz (la fuga grave ya no es melodía)', () => {
  it('el mínimo es 80 Hz', () => {
    expect(DEFAULT_PITCH_OPTIONS.fmin).toBe(80)
  })
  it('el bajo del techno (do₂, 65 Hz) por el micro: ninguna nota, ni con poco ni con mucho volumen', () => {
    for (const amp of [0.02, 0.15]) expect(feed(bassLeak(4, amp)).notes, `amp ${amp}`).toHaveLength(0)
  })
  it('el bombo del kit Electrónico (uzu, ≈ 63 Hz) por el micro: ninguna nota', () => {
    const { sig, onsets } = kickLeak('public/samples/electro/bd.wav', 4, 0.4)
    expect(feed(sig, onsets).notes).toHaveLength(0)
  })
  it('el bombo 808 y el del Vinilo, tampoco (como antes)', () => {
    for (const p of ['public/samples/808/bd.wav', 'public/samples/vinyl/bd.wav']) {
      const { sig, onsets } = kickLeak(p, 4, 0.4)
      expect(feed(sig, onsets).notes, p).toHaveLength(0)
    }
  })
  it('la voz cantada sigue detectándose: do₃ grave (130 Hz), re₃–do₄ y semicorcheas', () => {
    const grave = voice(SR, [{ silence: 0.4 }, { midi: 48, sec: 0.5 }, { silence: 0.2 }, { midi: 48, sec: 0.5 }, { silence: 0.4 }])
    expect(feed(grave).notes.filter((n) => Math.abs(n.midi - 48) < 1)).toHaveLength(2)
    const sube = voice(SR, [{ silence: 0.4 }, { midi: 50, sec: 0.4 }, { midi: 53, sec: 0.4 }, { midi: 57, sec: 0.4 }, { midi: 60, sec: 0.4 }, { silence: 0.4 }])
    expect(feed(sube).notes.map((n) => Math.round(n.midi))).toEqual([50, 53, 57, 60])
  })
})

describe('F2: la puerta de batería (un «bum» con tono es el golpe, no una nota)', () => {
  it('un «buum» con tono de 0,3 s sigue viéndose como nota de menos de 0,2 s (la causa B): por eso hace falta la puerta', () => {
    const { sig, onsets } = bum(5, 120, 0.3)
    const m = new LiveMelody(SR)
    for (const o of onsets) m.addOnset(o)
    let born = 0
    for (let i = 0; i < sig.length; i += CHUNK) {
      m.push(i, sig.subarray(i, i + CHUNK))
      for (const n of m.scan()) {
        born++
        expect(n.end - n.start).toBeLessThan(MAX_DRUM_NOTE_SEC) // corta: cae dentro de la puerta
        const o = onsets.find((t) => t >= n.start - 0.2 && t <= n.start + 0.1)
        expect(o, 'el ataque de la nota es un onset de batería').toBeDefined()
        expect(m.noteAt(o!)).not.toBeNull() // y ese onset cae dentro de la nota (antes: «absorbido» como melodía)
      }
    }
    expect(born).toBeGreaterThan(0)
  })
  it('un «bum» corto (0,22 s) ya ni se avisa como nota (F3 + F1)', () => {
    const { sig, onsets } = bum(5, 120, 0.22)
    expect(feed(sig, onsets).notes).toHaveLength(0)
  })
  it('decideOnset: nota corta + batería con confianza = golpe; nota larga o sin batería = melodía', () => {
    const corta = { start: 1, end: 1.2 }
    const larga = { start: 1, end: 1.6 }
    expect(decideOnset(corta, { instrument: 'bd', confidence: 0.9 })).toBe('drum')
    expect(decideOnset(corta, { instrument: 'bd', confidence: DRUM_GATE_CONF - 0.01 })).toBe('melody')
    expect(decideOnset(corta, { instrument: 'unknown', confidence: 0.95 })).toBe('melody')
    expect(decideOnset(corta, null)).toBe('melody')
    expect(decideOnset(larga, { instrument: 'bd', confidence: 0.95 })).toBe('melody') // un «na» largo no es un bombo
    expect(MAX_DRUM_NOTE_SEC).toBe(0.3)
  })
  it('la puerta retiene el aviso y suelta solo las notas que no eran golpe', () => {
    const g = new NoteGate()
    const bumNote = { start: 1, end: 1.2, midi: 46, rms: 0.06 }
    const sung = { start: 3, end: 3.5, midi: 50, rms: 0.2 }
    g.hold([bumNote, sung])
    expect(g.release(1.2)).toEqual([]) // todavía no se ha decidido (se espera)
    g.drumAt(1.01) // el ataque del «bum» se reconoció como bombo
    expect(g.release(1 + RELEASE_AFTER_SEC)).toEqual([]) // la nota era el golpe: no sale
    expect(g.release(3 + RELEASE_AFTER_SEC)).toEqual([sung]) // la cantada sí
    expect(RELEASE_AFTER_SEC).toBeGreaterThan(MELODY_DECISION_SEC)
  })
  it('un golpe de batería lejos de una nota no la quita', () => {
    const g = new NoteGate()
    const n = { start: 5, end: 5.5, midi: 55, rms: 0.2 }
    g.hold([n])
    g.drumAt(4) // un golpe un segundo antes
    expect(g.release(5 + RELEASE_AFTER_SEC)).toEqual([n])
  })
})

describe('F3: no se avisa una nota de menos de 0,15 s', () => {
  it('unas semicorcheas cantadas muy rápidas (0,1 s) ya no salen como notas sueltas', () => {
    const rapido = voice(SR, [{ silence: 0.4 }, { midi: 55, sec: 0.1 }, { midi: 57, sec: 0.1 }, { midi: 59, sec: 0.1 }, { silence: 0.4 }])
    expect(feed(rapido).notes.filter((n) => n.end - n.start < 0.15)).toHaveLength(0)
  })
})

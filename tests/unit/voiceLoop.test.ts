import { describe, expect, it } from 'vitest'
import { cutBars, envelope, fadeEdges, fromPcm16, hasVoice, isVoiceId, loopSamples, newVoiceId, normalizePeak, prepareTake, resample, toPcm16, unusedAudio } from '../../app/lib/voiceLoop'

const SR = 48000
const tone = (n: number, f = 220, amp = 0.5) => Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / SR))

describe('pista de voz: partes puras (spec 007)', () => {
  it('el identificador: el patrón y los que genera la app lo cumplen; la inyección, no', () => {
    for (let i = 0; i < 50; i++) expect(isVoiceId(newVoiceId())).toBe(true)
    for (const bad of ['', 'v', 'vABCDEFG', 'x123456789', 'v"); hush(); //', 'v12345 6', 'v1234567890123456789012', 1, null]) expect(isVoiceId(bad)).toBe(false)
  })
  it('la longitud del bucle son compases enteros exactos', () => {
    expect(loopSamples(1, 120, SR)).toBe(96000)
    expect(loopSamples(2, 90, SR)).toBe(256000)
    expect(loopSamples(4, 120, 24000)).toBe(192000)
  })
  it('cutBars corrige la latencia: lo cantado en `start` está en la captura `latencySec` más tarde', () => {
    // un impulso cantado justo en la línea de compás (t = 2 s) llega a la captura en 2,08 s con 80 ms de ida y vuelta
    const buf = new Float32Array(SR * 6)
    buf[Math.round(2.08 * SR)] = 1
    const out = cutBars(buf, 0, SR, 2, 1, 120, 0.08)
    expect(out.length).toBe(96000)
    expect(out.indexOf(1)).toBe(0)
  })
  it('cutBars rellena de silencio lo que no se capturó (captura corta o que empezó tarde)', () => {
    const out = cutBars(tone(SR / 2), 10, SR, 9.5, 1, 120, 0)
    expect(out.length).toBe(96000)
    expect(out.slice(0, 24000).every((v) => v === 0)).toBe(true) // antes de la captura
    expect(out.slice(24000 + 24000).every((v) => v === 0)).toBe(true) // después
    expect(out.slice(24000, 48000).some((v) => v !== 0)).toBe(true)
  })
  it('fundidos: el primero y el último valen 0 y el medio no cambia', () => {
    const s = fadeEdges(new Float32Array(SR).fill(1), SR)
    expect(s[0]).toBe(0)
    expect(s[s.length - 1]).toBe(0)
    expect(s[SR >> 1]).toBe(1)
  })
  it('normalizar baja el pico a −3 dBFS pero no sube lo flojo', () => {
    const loud = normalizePeak(tone(1000, 220, 1))
    expect(Math.max(...loud)).toBeCloseTo(10 ** (-3 / 20), 3)
    const quiet = normalizePeak(tone(1000, 220, 0.1))
    expect(Math.max(...quiet)).toBeCloseTo(0.1, 3)
  })
  it('remuestrear a 24 kHz da la mitad de muestras y conserva el tono', () => {
    const low = resample(tone(SR), SR, 24000)
    expect(low.length).toBe(24000)
    // 220 Hz → ~220 cruces ascendentes por segundo
    let up = 0
    for (let i = 1; i < low.length; i++) if (low[i - 1]! < 0 && low[i]! >= 0) up++
    expect(Math.abs(up - 220)).toBeLessThanOrEqual(2)
  })
  it('PCM de 16 bits: ida y vuelta con error < 1/32767 y satura sin desbordar', () => {
    const s = tone(1000)
    const back = fromPcm16(toPcm16(s))
    for (let i = 0; i < s.length; i++) expect(Math.abs(back[i]! - s[i]!)).toBeLessThan(1 / 30000)
    expect(toPcm16(Float32Array.of(2, -2))).toEqual(Int16Array.of(32767, -32767))
  })
  it('la envolvente tiene los tramos pedidos y sigue el volumen', () => {
    const s = new Float32Array(1800)
    s.fill(0.5, 900)
    const e = envelope(s, 18)
    expect(e.length).toBe(18)
    expect(e[0]).toBe(0)
    expect(e[17]).toBeCloseTo(0.5, 5)
  })
  it('una toma de silencio no se guarda; una con voz sí, a 24 kHz y de longitud exacta', () => {
    expect(hasVoice(new Float32Array(1000))).toBe(false)
    const cap = { buffer: tone(SR * 4), startTime: 0, sampleRate: SR }
    expect(prepareTake({ ...cap, buffer: new Float32Array(SR * 4) }, 1, 2, 120, 0.05)).toBeNull()
    const t = prepareTake(cap, 1, 2, 120, 0.05)!
    expect(t.sampleRate).toBe(24000)
    expect(t.pcm.length).toBe(loopSamples(2, 120, 24000))
    expect(t.envelope.length).toBe(180)
  })
  it('un compás de 4 a 60 bpm a 24 kHz pesa menos de 3 MB; uno enorme se rechaza', () => {
    const t = prepareTake({ buffer: tone(SR * 20), startTime: 0, sampleRate: SR }, 0, 4, 60, 0)!
    expect(t.pcm.byteLength).toBeLessThan(3 * 1024 * 1024)
    expect(prepareTake({ buffer: tone(SR * 20), startTime: 0, sampleRate: SR }, 0, 4, 20, 0, 48000)).toBeNull()
  })
  it('recuento de referencias: se borran los audios que no usa ninguna canción', () => {
    expect(unusedAudio(['va', 'vb', 'vc'], ['vb'])).toEqual(['va', 'vc'])
    expect(unusedAudio([], ['vb'])).toEqual([])
  })
})

import { emptySong, isFreeLoop, isSong, type Song } from '../../app/lib/cells'
import { songCode, type SongState } from '../../app/lib/song'
import { WOW_PRELUDE } from '../../app/lib/wowPrelude'
import { events } from '../helpers/strudelEval'

const voz = (over: Record<string, unknown> = {}) => ({ id: 1, instrument: 'voz', bars: 2, phaseBar: 0, hits: [], muted: false, bornAt: 0, fromTemplate: false, voice: { audio: 'vabc123def', bpm: 120, sampleRate: 24000 }, ...over })

describe('el loop de voz: modelo, validación y código (spec 007 §7)', () => {
  it('un loop de voz válido pasa; lo raro, no', () => {
    expect(isFreeLoop(voz())).toBe(true)
    expect(isFreeLoop(voz({ voice: undefined }))).toBe(false)
    expect(isFreeLoop(voz({ hits: [{ pos: 0, strength: 1 }] }))).toBe(false)
    expect(isFreeLoop(voz({ voice: { audio: 'v"); hush(); //', bpm: 120, sampleRate: 24000 } }))).toBe(false)
    expect(isFreeLoop(voz({ voice: { audio: 'vabc123def', bpm: 5, sampleRate: 24000 } }))).toBe(false)
    expect(isFreeLoop(voz({ voice: { audio: 'vabc123def', bpm: 120, sampleRate: 100 } }))).toBe(false)
    expect(isFreeLoop(voz({ voice: { audio: 'vabc123def', bpm: 120, sampleRate: 24000.5 } }))).toBe(false)
    expect(isFreeLoop(voz({ synth: 'lead' }))).toBe(false)
    // y un loop de batería no puede llevar `voice`
    expect(isFreeLoop({ id: 1, instrument: 'bd', bars: 1, phaseBar: 0, hits: [], muted: false, bornAt: 0, fromTemplate: false, voice: { audio: 'vabc123def', bpm: 120, sampleRate: 24000 } })).toBe(false)
  })
  const state = (loop: unknown): SongState => ({
    loops: [loop as never], style: 'techno', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 },
  })
  it('el código mostrado lleva una línea comentada (no suena en strudel.cc)', () => {
    const code = songCode(state(voz()), 'display')
    expect(code).toContain('// voz: audio guardado en este navegador')
    expect(code).not.toContain('vabc123def')
  })
  it('el del motor pide la muestra, en bucle de sus compases, y evalúa', async () => {
    ;(globalThis as Record<string, unknown>).__cb = new Proxy({ fx: { djf: 0, room: 0, delay: 0, shape: 0 } }, { get: (t, k) => (k in t ? (t as never)[k] : () => 1) })
    const code = songCode(state(voz()), 'engine')
    expect(code).toContain('s("vabc123def").slow(2).loopAt(2).clip(1)')
    const ev = await events(`${WOW_PRELUDE}\n${code}`, 4)
    expect(ev.some((e) => e.value.s === 'vabc123def')).toBe(true)
  })
  it('silenciado, la línea va comentada; con un id inválido no se escribe nada raro', () => {
    expect(songCode(state(voz({ muted: true })), 'engine')).toContain('// s("vabc123def")')
    const bad = songCode(state(voz({ voice: { audio: 'v"); hush(); //', bpm: 120, sampleRate: 24000 } })), 'engine')
    expect(bad).not.toContain('hush')
  })
  it('una canción con voz es válida', () => {
    const s: Song = emptySong()
    s.cells[0]!.loops = [voz() as never]
    expect(isSong(s)).toBe(true)
  })
})

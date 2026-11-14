import { describe, expect, it } from 'vitest'
import { isMidi, melodyMini, REGISTER, STRUDEL_NOTE, type MelodyHit } from '../../app/lib/melody'
import { assistMelody, fitRegister, fixOctaveErrors, melodyOfPhrase, snapToScale, type AssistOptions, type RawNote } from '../../app/lib/melodyAssist'
import { STYLE_MUSIC } from '../../app/lib/styles'

const opts = (o: Partial<AssistOptions> = {}): AssistOptions => ({ assist: true, style: 'hiphop90', startBar: 0, bars: 1, register: 'piano', stepSeconds: 60 / 90 / 4, ...o })
const n = (step: number, dur: number, midi: number, strength = 0.5): RawNote => ({ step, dur, midi, strength })
const midis = (h: MelodyHit[]) => h.map((x) => x.midi)
const pcs = (h: MelodyHit[]) => h.map((x) => x.midi % 12)

describe('escalas por estilo', () => {
  it('los tres estilos tienen su escala de 7 grados y sus acordes', () => {
    expect(STYLE_MUSIC.hiphop90.scale).toEqual([9, 11, 0, 2, 4, 5, 7]) // la menor
    expect(STYLE_MUSIC.house.scale).toEqual([5, 7, 8, 10, 0, 1, 3]) // fa menor
    expect(STYLE_MUSIC.dnb.scale).toEqual([2, 4, 5, 7, 9, 10, 0]) // re menor
    for (const s of Object.values(STYLE_MUSIC)) expect(s.chordTones.every((c) => c.every((pc) => s.scale.includes(pc)))).toBe(true)
  })
})

describe('errores de octava', () => {
  it('una nota una octava arriba de dos vecinas parecidas baja', () => {
    expect(fixOctaveErrors([57, 69, 59])).toEqual([57, 57, 59])
    expect(fixOctaveErrors([60, 48, 62])).toEqual([60, 60, 62])
  })
  it('un salto de octava real (una vecina cerca) se respeta', () => {
    expect(fixOctaveErrors([57, 69, 70])).toEqual([57, 69, 70])
    expect(fixOctaveErrors([57, 62, 59])).toEqual([57, 62, 59])
    expect(fixOctaveErrors([57, 69])).toEqual([57, 69])
  })
})

describe('escala del estilo', () => {
  const A = STYLE_MUSIC.hiphop90.scale
  it('cada nota va al grado más cercano', () => {
    expect(snapToScale(60.4, A, [], null)).toBe(60) // do
    expect(snapToScale(61.2, A, [], null)).toBe(62) // do#: a 0,8 de re y a 1,2 de do (la menor no tiene do#)
    expect(snapToScale(63.2, A, [], null)).toBe(64) // re#: más cerca de mi
    expect(snapToScale(66.1, A, [], null)).toBe(67) // fa#: más cerca de sol
  })
  it('en un empate gana la nota del acorde del compás', () => {
    // 61 está a 1 de do (60) y a 1 de re (62): con acorde de Am (la do mi sol) gana do; con un acorde de re fa la gana re
    expect(snapToScale(61, A, [9, 0, 4, 7], null)).toBe(60)
    expect(snapToScale(61, A, [2, 5, 9], null)).toBe(62)
  })
  it('sin nota de acorde en el empate, la más cercana a la nota anterior', () => {
    expect(snapToScale(61, A, [], 64)).toBe(62)
    expect(snapToScale(61, A, [], 57)).toBe(60)
  })
  it('todo lo que sale de la ayuda está en la escala de cada estilo', () => {
    const raw = Array.from({ length: 12 }, (_, i) => n(i * 1.3, 1.2, 55 + i * 1.37))
    for (const style of ['hiphop90', 'house', 'dnb'] as const) {
      const out = assistMelody(raw, opts({ style }))
      expect(out.length).toBeGreaterThan(3)
      for (const h of out) expect(STYLE_MUSIC[style].scale).toContain(h.midi % 12)
    }
  })
})

describe('ritmo con ayuda', () => {
  it('el inicio va a la semicorchea y la duración a celdas (mínimo 1)', () => {
    const out = assistMelody([n(0.2, 3.7, 57), n(4.4, 2.2, 60), n(8.9, 0.6, 64)], opts({ register: 'piano' }))
    expect(out.map((h) => [h.pos, h.dur])).toEqual([[0, 4], [4, 2], [9, 1]])
  })
  it('una nota muy corta (< media celda o 60 ms) pegada a otra se funde; aislada, desaparece', () => {
    const merged = assistMelody([n(0, 3, 57), n(3.1, 0.3, 58), n(4, 2, 59)], opts())
    expect(merged.length).toBe(2)
    expect(assistMelody([n(0, 3, 57), n(10, 0.3, 64)], opts()).length).toBe(1)
  })
  it('un hueco de menos de una celda alarga la nota anterior (legato)', () => {
    const out = assistMelody([n(0, 3.4, 57), n(4, 3, 60)], opts())
    expect(out[0]).toMatchObject({ pos: 0, dur: 4 })
  })
  it('monofonía: dos notas en el mismo paso, queda la más larga; la anterior se corta donde empieza la siguiente', () => {
    const out = assistMelody([n(0, 2, 57), n(0.3, 4, 60), n(2, 4, 64)], opts())
    expect(out.map((h) => h.pos)).toEqual([0, 2])
    expect(out[0]!.dur).toBe(2)
  })
  it('una nota no cruza la línea de compás', () => {
    const out = assistMelody([n(12, 8, 57)], opts({ bars: 2 }))
    expect(out[0]).toMatchObject({ pos: 12, dur: 4 })
  })
  it('lo que cae fuera de la frase no entra; los compases cuentan desde el inicio de la frase', () => {
    const out = assistMelody([n(32, 2, 57), n(33, 2, 60), n(80, 2, 64)], opts({ startBar: 2, bars: 1 }))
    expect(out.map((h) => h.pos)).toEqual([0, 1])
  })
})

describe('sin ayuda', () => {
  it('altura al semitono (sin escala) y ritmo en la rejilla fina de un cuarto de paso', () => {
    const out = assistMelody([n(0.1, 2.6, 61.3), n(3.3, 1.1, 66.4)], opts({ assist: false }))
    expect(out.map((h) => h.midi % 12)).toEqual([1, 6]) // do# y fa#, fuera de la menor: se respeta
    expect(out.map((h) => h.pos)).toEqual([0, 3.25])
    expect(out.map((h) => h.dur)).toEqual([2.5, 1])
  })
  it('el registro se corrige igual', () => {
    const out = assistMelody([n(0, 2, 36), n(2, 2, 38)], opts({ assist: false, register: 'piano' }))
    expect(midis(out).every((m) => m >= 48 && m <= 72)).toBe(true)
  })
})

describe('registro', () => {
  it('la mediana cae en el rango de cada sinte, por octavas', () => {
    for (const reg of ['lead', 'piano', 'pad', 'bass'] as const) {
      const [lo, hi] = REGISTER[reg]
      for (const base of [24, 40, 57, 70, 90]) {
        const out = fitRegister([base, base + 2, base + 4], REGISTER[reg])
        const m = out[1]!
        expect(m >= lo && m <= hi, `${reg} ${base} → ${m}`).toBe(true)
        // solo octavas: las clases de altura no cambian
        expect(out.map((v) => v % 12)).toEqual([base % 12, (base + 2) % 12, (base + 4) % 12])
      }
    }
  })
  it('un loop entero vacío o con datos raros no rompe', () => {
    expect(assistMelody([], opts())).toEqual([])
    expect(assistMelody([n(NaN, 1, 60), n(0, 0, 60), n(0, 1, NaN)], opts())).toEqual([])
    expect(fitRegister([], REGISTER.lead)).toEqual([])
  })
})

describe('melodyMini y nombres de nota', () => {
  const h = (pos: number, dur: number, midi: number): MelodyHit => ({ pos, dur, midi, strength: 1 })
  it('nombres con bemoles y octava de Strudel', () => {
    expect(STRUDEL_NOTE[60]).toBe('c4')
    expect(STRUDEL_NOTE[58]).toBe('bb3')
    expect(STRUDEL_NOTE[57]).toBe('a3')
    expect(STRUDEL_NOTE[24]).toBe('c1')
    expect(isMidi(60)).toBe(true)
    expect(isMidi(23)).toBe(false)
    expect(isMidi(60.5)).toBe(false)
    expect(isMidi('60')).toBe(false)
  })
  it('un compás: notas con duración y silencios', () => {
    expect(melodyMini([h(0, 2, 57), h(4, 1, 60), h(6, 6, 64)], 1, 0)).toBe('a3@2 ~@2 c4 ~ e4@6 ~@4')
  })
  it('varios compases iguales se contraen; distintos van entre <>', () => {
    expect(melodyMini([h(0, 4, 57), h(16, 4, 57)], 2, 0)).toBe('a3@4 ~@12')
    expect(melodyMini([h(0, 4, 57), h(16, 4, 60)], 2, 0)).toBe('<[a3@4 ~@12] [c4@4 ~@12]>')
  })
  it('la fase rota los compases como en la batería', () => {
    expect(melodyMini([h(0, 4, 57), h(16, 4, 60)], 2, 1)).toBe('<[c4@4 ~@12] [a3@4 ~@12]>')
  })
  it('con rejilla fina los pesos van en cuartos de paso', () => {
    expect(melodyMini([h(0, 2.75, 57), h(3.25, 1, 60)], 1, 0)).toBe('a3@11 ~@2 c4@4 ~@47')
  })
  it('una nota que cruza el compás se recorta; un MIDI inválido no se escribe', () => {
    expect(melodyMini([h(12, 8, 57)], 2, 0)).toBe('<[~@12 a3@4] [~@16]>')
    expect(melodyMini([h(0, 4, 999), h(4, 4, 60)], 1, 0)).toBe('~@4 c4@4 ~@8')
  })
})

describe('melodyOfPhrase (de lo que oye el worker al loop)', () => {
  // 90 bpm: una semicorchea = 0,1667 s; el compás 4 empieza en el segundo 4 * 16 * 0,1667 = 10,667
  const step = 60 / 90 / 4
  const globalStep = (t: number) => t / step
  const heard = (startStep: number, durSteps: number, midi: number) => ({ start: startStep * step, end: (startStep + durSteps) * step, midi, rms: 0.05 })
  const base = { ...opts({ startBar: 4, bars: 1 }), globalStep, latencySec: 0 }

  it('pasa los segundos a pasos de la frase y aplica la ayuda', () => {
    const r = melodyOfPhrase([heard(64, 3.8, 56.9), heard(68.1, 2, 60.2)], base)
    expect(r.raw).toHaveLength(2)
    expect(r.hits.map((h) => [h.pos, h.dur, h.midi % 12])).toEqual([[0, 4, 9], [4, 2, 0]]) // la y do
  })

  it('las notas de otras frases (antes o después) no entran', () => {
    const r = melodyOfPhrase([heard(40, 4, 57), heard(66, 2, 60), heard(80, 2, 64)], base)
    expect(r.raw).toHaveLength(1)
    expect(r.hits).toHaveLength(1)
  })

  it('una nota que empezó un poco antes del compás (el ataque) sí entra', () => {
    expect(melodyOfPhrase([heard(63.7, 4, 57)], base).hits[0]!.pos).toBe(0)
  })

  it('la latencia de entrada adelanta el inicio de cada nota', () => {
    // el worker la oyó 0,1667 s (1 paso) tarde: con la latencia corregida cae en el paso 4, no en el 5
    const r = melodyOfPhrase([heard(69, 2, 60)], { ...base, latencySec: step })
    expect(r.hits[0]!.pos).toBe(4)
  })

  it('el volumen pasa a fuerza (0..1) y sin notas no hay nada', () => {
    expect(melodyOfPhrase([{ ...heard(64, 2, 57), rms: 0.5 }], base).raw[0]!.strength).toBe(1)
    expect(melodyOfPhrase([], base)).toEqual({ raw: [], hits: [] })
  })
})

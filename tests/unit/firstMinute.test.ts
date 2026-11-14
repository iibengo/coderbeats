import { describe, expect, it } from 'vitest'
import { advanceGuide, GUIDE_DONE, GUIDE_START, guideLine, guideVisible, type GuideFacts, type GuideState } from '../../app/lib/firstMinute'

const f = (o: Partial<GuideFacts> = {}): GuideFacts => ({ bar: 0, playing: true, drumLoops: 0, melLoops: 0, heard: 0, ...o })
const run = (s: GuideState, ...facts: GuideFacts[]) => facts.reduce((acc, x) => advanceGuide(acc, x), s)

describe('el primer minuto guiado (spec 011, §12.2)', () => {
  it('espera a que suene; parado, no hay guía', () => {
    expect(advanceGuide(GUIDE_START, f({ playing: false }))).toBe(GUIDE_START)
    expect(guideVisible(GUIDE_START)).toBe(false)
  })
  it('el camino entero: escucha → haz bum-pff-ts → aparecen tus golpes → canta → fin', () => {
    let s = advanceGuide(GUIDE_START, f({ bar: 10 }))
    expect(s).toEqual({ step: 'listen', sinceBar: 10 })
    expect(guideLine(s.step, false)).toBe('Escucha')
    s = advanceGuide(s, f({ bar: 10 })) // todavía el mismo compás: sigue escuchando
    expect(s.step).toBe('listen')
    s = advanceGuide(s, f({ bar: 11 })) // un compás de fondo
    expect(s).toEqual({ step: 'play', sinceBar: 11 })
    expect(guideLine(s.step, false)).toBe('Haz bum · pff · ts')
    s = advanceGuide(s, f({ bar: 12 })) // nada oído: sigue pidiendo golpes (no avanza solo)
    expect(s.step).toBe('play')
    s = advanceGuide(s, f({ bar: 12, heard: 1 })) // se oyó un golpe
    expect(s).toEqual({ step: 'appear', sinceBar: 12 })
    expect(guideLine(s.step, false)).toBe('En la siguiente vuelta aparecen tus golpes')
    s = advanceGuide(s, f({ bar: 13 })) // aún no hay loop: espera
    expect(s.step).toBe('appear')
    s = advanceGuide(s, f({ bar: 13, drumLoops: 1 })) // el loop acaba de aparecer: se deja un compás para que se aprecie
    expect(s).toEqual({ step: 'appear', sinceBar: 12, mark: 13 })
    s = advanceGuide(s, f({ bar: 14, drumLoops: 1 }))
    expect(s).toEqual({ step: 'sing', sinceBar: 14 })
    expect(guideLine(s.step, true)).toBe('Ahora canta «na»')
    expect(guideLine(s.step, false)).toBe('Toca la franja de la melodía')
    s = advanceGuide(s, f({ bar: 15, drumLoops: 1, melLoops: 1 }))
    expect(s.step).toBe('done')
    expect(guideVisible(s)).toBe(false)
  })
  it('nunca bloquea: si no canta, a los 2 compases se acaba; si hace otra cosa, el paso se da por cumplido', () => {
    expect(run({ step: 'sing', sinceBar: 20 }, f({ bar: 21, drumLoops: 1 }))).toEqual({ step: 'sing', sinceBar: 20 })
    expect(run({ step: 'sing', sinceBar: 20 }, f({ bar: 22, drumLoops: 1 })).step).toBe('done')
    // ya tenía golpes antes de la guía en el paso 1: salta al 2 (y de ahí, según lo que haya)
    expect(advanceGuide({ step: 'listen', sinceBar: 5 }, f({ bar: 5, drumLoops: 1 })).step).toBe('appear')
    // si crea una melodía en cualquier momento, se cumple todo
    expect(advanceGuide({ step: 'play', sinceBar: 5 }, f({ bar: 5, melLoops: 1 })).step).toBe('done')
  })
  it('con una canción ya hecha (loops al empezar, una demo, un remix) no hay guía', () => {
    expect(advanceGuide(GUIDE_START, f({ drumLoops: 3 }))).toEqual({ step: 'done', sinceBar: 0 })
    expect(advanceGuide(GUIDE_START, f({ melLoops: 1 })).step).toBe('done')
  })
  it('una vez terminada, no vuelve', () => {
    expect(advanceGuide(GUIDE_DONE, f({ drumLoops: 0 }))).toBe(GUIDE_DONE)
  })
  it('devuelve el mismo objeto si no cambia nada (no repinta)', () => {
    const s: GuideState = { step: 'play', sinceBar: 3 }
    expect(advanceGuide(s, f({ bar: 4 }))).toBe(s)
  })
})

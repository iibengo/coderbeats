import { describe, expect, it } from 'vitest'
import { PORTADA_LINE, portadaStep, type PortadaFacts } from '../../app/lib/portadaGuide'

const f = (o: Partial<PortadaFacts> = {}): PortadaFacts => ({ picked: false, fingered: false, rhythm: false, finished: false, ...o })

describe('guía de la portada (spec 016 §4)', () => {
  it('va de uno en uno, con la voz primero: estilo → voz → dedo → guardar → hecho', () => {
    expect(portadaStep(f())).toBe('estilo')
    expect(portadaStep(f({ picked: true }))).toBe('voz')
    expect(portadaStep(f({ picked: true, rhythm: true }))).toBe('dedo')
    expect(portadaStep(f({ picked: true, fingered: true, rhythm: true }))).toBe('guardar')
    expect(portadaStep(f({ picked: true, fingered: true, rhythm: true, finished: true }))).toBe('hecho')
  })
  it('nunca bloquea: si pone el dedo antes que el ritmo, sigue pidiendo la voz; y «hecho» manda sobre todo', () => {
    expect(portadaStep(f({ picked: true, fingered: true }))).toBe('voz')
    expect(portadaStep(f({ finished: true }))).toBe('hecho')
  })
  it('cada paso tiene una sola frase corta y «hecho» ninguna', () => {
    for (const [k, v] of Object.entries(PORTADA_LINE)) {
      if (k === 'hecho') expect(v).toBe('')
      else {
        expect(v.length).toBeGreaterThan(5)
        expect(v.length).toBeLessThan(50)
      }
    }
  })
})

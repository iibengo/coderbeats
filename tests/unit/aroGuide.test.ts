import { describe, expect, it } from 'vitest'
import { ghostTarget, suggestions } from '../../app/lib/aro/guide'

const help = { assist: true, quantizeEvery: 1 as const }
const dnb = { assist: true, quantizeEvery: 2 as const }
const free = { assist: false, quantizeEvery: 1 as const }

describe('ghostTarget (fantasma, E3.3)', () => {
  it('donde caerá con el imán, en la franja bajo el dedo', () => {
    expect(ghostTarget('bd', 0.5, 6.4, 'sd', help)).toEqual({ voice: 'sd', step: 6 })
    expect(ghostTarget('bd', 0.5, 5.2, 'bd', dnb)).toEqual({ voice: 'bd', step: 6 })
  })
  it('fuera de la gota: en la franja de fuera (platillo)', () => {
    expect(ghostTarget('sd', 1.4, 3, null, help)).toEqual({ voice: 'hh', step: 3 })
  })
  it('sin fantasma si se borraría (centro) o volvería a su sitio', () => {
    expect(ghostTarget('bd', -0.1, 3, null, help)).toBeNull()
    expect(ghostTarget('bd', 0.3, 3, 'bass', help)).toBeNull()
    expect(ghostTarget('bass', 0.3, 3, 'bass', help)).toBeNull()
  })
  it('sin ayuda, ni fantasma', () => {
    expect(ghostTarget('bd', 0.5, 6.4, 'bd', free)).toBeNull()
  })
})

describe('suggestions (sugerencias del estilo, E3.3)', () => {
  it('house en franjas vacías: bombo en los 4 tiempos, caja en 2 y 4, platillo a contratiempo', () => {
    const s = suggestions('house', new Set(), help)
    const of = (v: string) => s.filter((x) => x.voice === v).map((x) => x.step)
    expect(of('bd')).toEqual([0, 4, 8, 12])
    expect(of('sd')).toEqual([4, 12])
    expect(of('hh')).toEqual([2, 6, 10, 14])
  })
  it('desaparecen en cuanto la franja tiene un golpe', () => {
    const s = suggestions('house', new Set(['bd', 'hh'] as const), help)
    expect(new Set(s.map((x) => x.voice))).toEqual(new Set(['sd']))
  })
  it('sin ayuda, ni sugerencias', () => {
    expect(suggestions('house', new Set(), free)).toEqual([])
  })
})

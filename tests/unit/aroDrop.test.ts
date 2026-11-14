import { describe, expect, it } from 'vitest'
import { dropAction } from '../../app/lib/aro/drop'

describe('dropAction (E1.4, E2.2)', () => {
  it('al centro se borra', () => {
    expect(dropAction('bd', -0.2, null)).toEqual({ kind: 'delete' })
  })
  it('fuera de la gota no se borra: va con el imán a la franja de fuera (platillo)', () => {
    expect(dropAction('bd', 1.05, null)).toEqual({ kind: 'move', to: 'hh' })
    expect(dropAction('sd', 1.8, null)).toEqual({ kind: 'move', to: 'hh' })
  })
  it('entre baterías cambia de franja; al bajo o la melodía, vuelve', () => {
    expect(dropAction('bd', 0.5, 'sd')).toEqual({ kind: 'move', to: 'sd' })
    expect(dropAction('bd', 0.3, 'bass')).toEqual({ kind: 'bounce' })
    expect(dropAction('hh', 0.7, 'mel')).toEqual({ kind: 'bounce' })
  })
  it('la melodía se mueve dentro de su franja, se borra en el centro y en otra franja o fuera vuelve (spec 002, F2)', () => {
    expect(dropAction('mel', 0.6, 'mel')).toEqual({ kind: 'move', to: 'mel' })
    expect(dropAction('mel', -0.1, null)).toEqual({ kind: 'delete' })
    expect(dropAction('mel', 0.3, 'bd')).toEqual({ kind: 'bounce' })
    expect(dropAction('mel', 1.4, null)).toEqual({ kind: 'bounce' })
    expect(dropAction('mel', 0.5, null)).toEqual({ kind: 'bounce' })
  })
  it('el bajo solo se ve (E1.4): siempre vuelve a su sitio', () => {
    expect(dropAction('bass', 1.4, null)).toEqual({ kind: 'bounce' })
    expect(dropAction('bass', -0.1, null)).toEqual({ kind: 'bounce' })
    expect(dropAction('bass', 0.3, 'bass')).toEqual({ kind: 'bounce' })
  })
})

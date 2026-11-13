import { describe, expect, it } from 'vitest'
import { dropAction } from '../../app/lib/aro/drop'

describe('dropAction (E1.4, E2.2)', () => {
  it('al centro se borra', () => {
    expect(dropAction('bd', -0.2, -100, null)).toEqual({ kind: 'delete' })
  })
  it('fuera de la gota, a más de 16 px del borde, se borra', () => {
    expect(dropAction('sd', 1.3, 40, null)).toEqual({ kind: 'delete' })
  })
  it('justo en el borde de fuera va a la franja de fuera (platillo)', () => {
    expect(dropAction('bd', 1.05, 8, null)).toEqual({ kind: 'move', to: 'hh' })
  })
  it('entre baterías cambia de franja; al bajo o la melodía, vuelve', () => {
    expect(dropAction('bd', 0.5, -50, 'sd')).toEqual({ kind: 'move', to: 'sd' })
    expect(dropAction('bd', 0.3, -60, 'bass')).toEqual({ kind: 'bounce' })
    expect(dropAction('hh', 0.7, -30, 'mel')).toEqual({ kind: 'bounce' })
  })
  it('el bajo no se borra: fuera o en el centro vuelve; en su franja se mueve', () => {
    expect(dropAction('bass', 1.4, 50, null)).toEqual({ kind: 'bounce' })
    expect(dropAction('bass', -0.1, -90, null)).toEqual({ kind: 'bounce' })
    expect(dropAction('bass', 0.3, -60, 'bass')).toEqual({ kind: 'move', to: 'bass' })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_UI, isUiPrefs, needsPick, UI_KEY } from '../../app/lib/ui'
import { FakeStorage } from '../helpers/fakeStorage'

let ls: FakeStorage
async function fresh(pre?: (s: FakeStorage) => void) {
  vi.resetModules()
  ls = new FakeStorage()
  pre?.(ls)
  vi.stubGlobal('localStorage', ls)
  const mod = await import('../../app/composables/useUi')
  return mod.useUi()
}
beforeEach(() => vi.unstubAllGlobals())

describe('preferencia de interfaz (spec 016)', () => {
  it('la guarda con la forma exacta y rechaza lo raro', () => {
    expect(isUiPrefs(DEFAULT_UI)).toBe(true)
    expect(isUiPrefs({ ...DEFAULT_UI, ui: 'otra' })).toBe(false)
    expect(isUiPrefs({ version: 1, ui: 'simple' })).toBe(false)
    expect(isUiPrefs(null)).toBe(false)
  })
  it('sin nada guardado, la portada; elegir el Estudio se recuerda; no toca otras claves', async () => {
    const u = await fresh((s) => {
      s.setItem('coderbeats:song:v1', '{"x":1}')
      s.setItem('coderbeats:prefs:v1', '{"y":2}')
    })
    expect(u.state.ui).toBe('simple')
    u.setUi('estudio')
    expect(JSON.parse(ls.getItem(UI_KEY)!).ui).toBe('estudio')
    expect(ls.getItem('coderbeats:song:v1')).toBe('{"x":1}')
    expect(ls.getItem('coderbeats:prefs:v1')).toBe('{"y":2}')
    const again = await fresh((s) => s.setItem(UI_KEY, JSON.stringify({ version: 1, ui: 'estudio', syncMelody: false })))
    expect(again.state.ui).toBe('estudio')
    expect(again.state.syncMelody).toBe(false)
  })
  it('una preferencia rota se ignora (vuelve la portada) y no se borra', async () => {
    const u = await fresh((s) => s.setItem(UI_KEY, '{"version":9}'))
    expect(u.state.ui).toBe('simple')
    expect(ls.getItem(UI_KEY)).toBe('{"version":9}')
  })
  it('la portada pide estilo solo con la canción vacía y parada', () => {
    expect(needsPick({ loops: 0, cells: 1, playing: false })).toBe(true)
    expect(needsPick({ loops: 2, cells: 1, playing: false })).toBe(false)
    expect(needsPick({ loops: 0, cells: 1, playing: true })).toBe(false)
    expect(needsPick({ loops: 0, cells: 5, playing: false })).toBe(false)
  })
})

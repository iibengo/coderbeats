import { computed, nextTick, ref, reactive, watch } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeStorage } from '../helpers/fakeStorage'

const KEY = 'coderbeats:tutorial:v1'
const GUIDE = 'coderbeats:guide:v1'
const hit = (pos: number) => ({ pos, strength: 1 })
const loop = (id: number, ...pos: number[]) => ({ id, instrument: 'bd', bars: 1, phaseBar: 0, hits: pos.map(hit), muted: false, bornAt: 0, fromTemplate: false })

/** el motor de mentira: solo lo que mira el composable */
async function fresh() {
  vi.resetModules()
  const ls = new FakeStorage()
  ls.setItem(GUIDE, JSON.stringify({ done: true }))
  vi.stubGlobal('localStorage', ls)
  const engine = {
    loops: ref({ loops: [loop(1, 0, 4, 8)], nextId: 2 }),
    mode: ref('jugar'),
    playing: ref(true),
    song: ref({ cells: [{}] }),
  }
  vi.stubGlobal('useAudioEngine', () => engine)
  vi.stubGlobal('usePilotState', () => reactive({ active: false }))
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('watch', watch)
  const mod = await import('../../app/composables/useTutorial')
  const t = mod.useTutorial(() => null, async () => {})
  return { engine, t, ls, mod }
}
beforeEach(() => vi.unstubAllGlobals())

describe('useTutorial (spec 001 §14.1)', () => {
  it('con la guía hecha y un loop sonando enseña «Arrastra un golpe» (2/3)', async () => {
    const { engine, t } = await fresh()
    expect(t.text.value).toBeNull() // aún no ha anotado cómo está todo
    engine.loops.value = { loops: [loop(1, 0, 4, 8)], nextId: 2 }
    await nextTick()
    expect(t.text.value).toEqual({ big: 'Arrastra un golpe', count: '2/3' })
  })
  it('mover un golpe pasa al paso de borrar y quitar uno lo termina; todo se guarda', async () => {
    const { engine, t, ls } = await fresh()
    engine.loops.value = { loops: [loop(1, 0, 4, 8)], nextId: 2 }
    await nextTick()
    engine.loops.value = { loops: [loop(1, 0, 4, 10)], nextId: 2 } // mover
    await nextTick()
    expect(JSON.parse(ls.getItem(KEY)!).step).toBe('delete')
    expect(t.text.value?.big).toBe('Llévalo al centro para borrarlo')
    engine.loops.value = { loops: [loop(1, 0, 4)], nextId: 2 } // borrar
    await nextTick()
    expect(JSON.parse(ls.getItem(KEY)!).step).toBe('done')
    expect(t.text.value).toBeNull()
  })
  it('sin guía hecha o con el piloto, no hay texto; saltar lo apaga y guarda; reiniciar lo vuelve a empezar', async () => {
    const { t, ls, mod } = await fresh()
    t.skip()
    expect(JSON.parse(ls.getItem(KEY)!).step).toBe('done')
    expect(t.text.value).toBeNull()
    mod.restartTutorial()
    expect(JSON.parse(ls.getItem(KEY)!)).toMatchObject({ step: 'drag', baseCount: -1, seen: [] })
  })
})

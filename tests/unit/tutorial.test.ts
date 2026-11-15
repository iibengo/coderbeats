import { describe, expect, it } from 'vitest'
import { advanceTutorial, hintFor, isTutorialState, markSeen, TUTORIAL_DONE, TUTORIAL_START, type TutorialFacts } from '../../app/lib/tutorial'

const f = (o: Partial<TutorialFacts> = {}): TutorialFacts => ({ ready: true, hits: 4, sig: '0,4,8,12', loops: 1, cells: 1, ...o })

describe('tutorial jugando (spec 001 §14.1)', () => {
  it('no avanza hasta que la guía acabó y hay golpes', () => {
    expect(advanceTutorial(TUTORIAL_START, f({ ready: false }))).toBe(TUTORIAL_START)
    expect(advanceTutorial(TUTORIAL_START, f({ hits: 0 }))).toBe(TUTORIAL_START)
  })
  it('anota cómo estaba al empezar el paso, y mover un golpe pasa de «arrastra» a «borra»', () => {
    let s = advanceTutorial(TUTORIAL_START, f())
    expect(s).toMatchObject({ step: 'drag', baseCount: 4, baseSig: '0,4,8,12' })
    expect(advanceTutorial(s, f())).toBe(s)
    s = advanceTutorial(s, f({ sig: '1,4,8,12' }))
    expect(s.step).toBe('delete')
    expect(s.baseSig).toBe('1,4,8,12')
  })
  it('borrar un golpe termina; añadir uno no cuenta como mover', () => {
    let s = advanceTutorial(advanceTutorial(TUTORIAL_START, f()), f({ hits: 5, sig: '0,2,4,8,12' }))
    expect(s.step).toBe('drag')
    s = advanceTutorial(advanceTutorial(TUTORIAL_START, f()), f({ sig: '1,4,8,12' }))
    s = advanceTutorial(s, f({ hits: 3, sig: '4,8,12' }))
    expect(s.step).toBe('done')
  })
  it('si mientras tanto se graban golpes, la referencia se pone al día y mover sigue valiendo', () => {
    let s = advanceTutorial(TUTORIAL_START, f())
    s = advanceTutorial(s, f({ hits: 6, sig: '0,2,4,8,10,12' }))
    expect(s).toMatchObject({ step: 'drag', baseCount: 6 })
    expect(advanceTutorial(s, f({ hits: 6, sig: '1,2,4,8,10,12' })).step).toBe('delete')
  })
  it('las pistas: solo tras los pasos, una sola vez y en orden', () => {
    expect(hintFor(TUTORIAL_START, f({ loops: 3 }))).toBeNull()
    const d = { ...TUTORIAL_DONE, seen: [] }
    expect(hintFor(d, f({ loops: 1 }))).toBeNull()
    expect(hintFor(d, f({ loops: 2 }))).toBe('lane')
    expect(hintFor(markSeen(d, 'lane'), f({ loops: 2 }))).toBeNull()
    expect(hintFor(markSeen(d, 'lane'), f({ loops: 2, cells: 2 }))).toBe('zoom')
    expect(hintFor(markSeen(markSeen(d, 'lane'), 'zoom'), f({ loops: 2, cells: 2 }))).toBeNull()
    expect(hintFor(d, f({ loops: 2, ready: false }))).toBeNull()
  })
  it('lo guardado se valida', () => {
    expect(isTutorialState(TUTORIAL_START)).toBe(true)
    expect(isTutorialState({ step: 'x', baseCount: 0, baseSig: '', seen: [] })).toBe(false)
    expect(isTutorialState({ step: 'done', baseCount: 0, baseSig: '', seen: ['hack'] })).toBe(false)
    expect(isTutorialState(null)).toBe(false)
  })
})

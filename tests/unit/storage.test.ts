import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasStorage, readJson, readText, removeKey, writeJson, writeText } from '../../app/lib/storage'

const g = globalThis as { localStorage?: unknown }
const fake = (init: Record<string, string> = {}, o: { throwGet?: boolean; throwSet?: boolean } = {}) => {
  const m = new Map(Object.entries(init))
  return {
    m,
    getItem: (k: string) => {
      if (o.throwGet) throw new Error('bloqueado')
      return m.get(k) ?? null
    },
    setItem: (k: string, v: string) => {
      if (o.throwSet) throw new Error('lleno')
      m.set(k, v)
    },
    removeItem: (k: string) => void m.delete(k),
  }
}
const isNum = (x: unknown): x is { n: number } => !!x && typeof (x as { n?: unknown }).n === 'number'

let saved: unknown
beforeEach(() => (saved = g.localStorage))
afterEach(() => {
  if (saved === undefined) delete g.localStorage
  else g.localStorage = saved
})

describe('storage', () => {
  it('sin localStorage (servidor): todo en silencio', () => {
    delete g.localStorage
    expect(hasStorage()).toBe(false)
    expect(readText('a')).toBeNull()
    expect(readJson('a', isNum)).toBeNull()
    expect(writeText('a', 'x')).toBe(false)
    expect(writeJson('a', {})).toBe(false)
    expect(removeKey('a')).toBe(false)
  })

  it('lee y escribe texto y JSON', () => {
    const f = fake()
    g.localStorage = f
    expect(hasStorage()).toBe(true)
    expect(writeJson('k', { n: 3 })).toBe(true)
    expect(f.m.get('k')).toBe('{"n":3}')
    expect(readJson('k', isNum)).toEqual({ n: 3 })
    expect(removeKey('k')).toBe(true)
    expect(readText('k')).toBeNull()
  })

  it('JSON roto o que no pasa el guard da null y no borra nada', () => {
    const f = fake({ roto: '{no', otro: '{"n":"3"}', arr: '[1]' })
    g.localStorage = f
    expect(readJson('roto', isNum)).toBeNull()
    expect(readJson('otro', isNum)).toBeNull()
    expect(readJson('arr', isNum)).toBeNull()
    expect([...f.m.keys()].sort()).toEqual(['arr', 'otro', 'roto'])
  })

  it('un valor guardado con __proto__ no contamina nada', () => {
    g.localStorage = fake({ k: '{"__proto__":{"polluted":true},"n":1}' })
    expect(readJson('k', isNum)).not.toBeNull()
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('almacenamiento que lanza al leer o al escribir (privado, lleno): no tira', () => {
    g.localStorage = fake({ k: '{"n":1}' }, { throwGet: true, throwSet: true })
    expect(readText('k')).toBeNull()
    expect(readJson('k', isNum)).toBeNull()
    expect(writeText('k', 'x')).toBe(false)
    expect(writeJson('k', { n: 1 })).toBe(false)
  })

  it('acceso a localStorage bloqueado (el getter lanza)', () => {
    Object.defineProperty(globalThis, 'localStorage', { get: () => { throw new Error('SecurityError') }, configurable: true })
    expect(hasStorage()).toBe(false)
    expect(readText('a')).toBeNull()
    delete g.localStorage
  })

  it('JSON con valores no serializables no tira', () => {
    g.localStorage = fake()
    const circ: Record<string, unknown> = {}
    circ.self = circ
    expect(writeJson('k', circ)).toBe(false)
  })
})

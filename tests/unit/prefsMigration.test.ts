import { describe, expect, it } from 'vitest'
import { migrateRepeatMode } from '../../app/lib/prefsMigration'

describe('migrateRepeatMode (§16.21)', () => {
  it('"sustituye" guardado antes de §16.21 pasa a "completa" una vez', () => {
    expect(migrateRepeatMode('replace', undefined)).toBe('complete')
  })
  it('"sustituye" elegido después se respeta', () => {
    expect(migrateRepeatMode('replace', true)).toBe('replace')
  })
  it('"acumula" (antes de §16.19) es "completa"; sin valor, "completa"', () => {
    expect(migrateRepeatMode('accumulate', undefined)).toBe('complete')
    expect(migrateRepeatMode('complete', true)).toBe('complete')
    expect(migrateRepeatMode(undefined, undefined)).toBe('complete')
  })
})

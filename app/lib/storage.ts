/**
 * Única puerta a localStorage (auditoría M2/C1). Todo lo que se lee de ahí es dato no fiable: nunca tira
 * (almacenamiento bloqueado, modo privado, JSON roto) y `readJson` solo devuelve lo que pasa un guard con la
 * forma exacta. Leer nunca borra nada. Sin DOM propio: usa `globalThis.localStorage`, que los tests sustituyen.
 */

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function store(): Store | null {
  try {
    return (globalThis as { localStorage?: Store }).localStorage ?? null
  } catch {
    return null
  }
}

/** ¿Hay almacenamiento? (en el servidor o con el acceso bloqueado, no) */
export const hasStorage = (): boolean => store() !== null

/** El texto guardado, o null si no hay nada o no se puede leer. */
export function readText(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null
  } catch {
    return null
  }
}

/** Guarda un texto. false si no se puede (lleno, modo privado…); el que llama decide qué hacer. */
export function writeText(key: string, text: string): boolean {
  try {
    const s = store()
    if (!s) return false
    s.setItem(key, text)
    return true
  } catch {
    return false
  }
}

/** Quita una clave. false si no se puede. */
export function removeKey(key: string): boolean {
  try {
    const s = store()
    if (!s) return false
    s.removeItem(key)
    return true
  } catch {
    return false
  }
}

/** Lee y parsea JSON; solo devuelve el valor si pasa `guard` (si no, null). No modifica lo guardado. */
export function readJson<T>(key: string, guard: (x: unknown) => x is T): T | null {
  const raw = readText(key)
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    return guard(v) ? v : null
  } catch {
    return null
  }
}

/** Guarda un valor como JSON. false si no se puede. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeText(key, JSON.stringify(value))
  } catch {
    return false
  }
}

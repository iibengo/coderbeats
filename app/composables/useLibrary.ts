import { shallowRef, ref } from 'vue'
import {
  emptyLibrary,
  LIBRARY_BROKEN_KEY,
  LIBRARY_CURRENT_KEY,
  LIBRARY_KEY,
  parseLibrary,
  serializeLibrary,
  type Library,
} from '~/lib/library'

/**
 * Mis canciones (spec 006): la parte del navegador. Lee y escribe `coderbeats:library:v1` con la lógica
 * segura de `lib/library.ts`. Un estado para toda la app.
 */
const lib = shallowRef<Library>(emptyLibrary())
/** último fallo al guardar, para enseñarlo en el panel */
const error = ref<string | null>(null)
/** la canción guardada de la que viene lo de ahora (para "guardar cambios" y el aviso al abrir) */
const currentId = ref<string | null>(null)
let loaded = false
/** el texto roto que se leyó: hay que guardarlo aparte antes de escribir encima */
let brokenText: string | null = null

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Lee la lista (una sola vez). Leer nunca borra nada. */
function load() {
  if (loaded || typeof localStorage === 'undefined') return
  loaded = true
  const text = readKey(LIBRARY_KEY)
  const parsed = parseLibrary(text)
  lib.value = parsed
  brokenText = parsed.broken ? text : null
  currentId.value = readKey(LIBRARY_CURRENT_KEY)
}

/** Escribe la lista. Devuelve false (y deja `error`) si no se puede, sin perder lo que había. */
function persist(next: Library): boolean {
  try {
    if (brokenText !== null) {
      // antes de escribir encima de un texto que no se pudo leer, una copia aparte
      const key = readKey(LIBRARY_BROKEN_KEY) === null ? LIBRARY_BROKEN_KEY : `${LIBRARY_BROKEN_KEY}:${Date.now()}`
      localStorage.setItem(key, brokenText)
      brokenText = null
    }
    localStorage.setItem(LIBRARY_KEY, serializeLibrary(next))
  } catch {
    error.value = 'No se ha podido guardar: el navegador no deja escribir (¿almacenamiento lleno o modo privado?).'
    return false
  }
  lib.value = { ...next, broken: false }
  error.value = null
  return true
}

/** Recuerda (o olvida) de qué guardada viene lo de ahora. */
function setCurrent(id: string | null) {
  currentId.value = id
  try {
    if (id) localStorage.setItem(LIBRARY_CURRENT_KEY, id)
    else localStorage.removeItem(LIBRARY_CURRENT_KEY)
  } catch {
    // sin almacenamiento: solo vale esta sesión
  }
}

export function useLibrary() {
  return { lib, error, currentId, load, persist, setCurrent }
}

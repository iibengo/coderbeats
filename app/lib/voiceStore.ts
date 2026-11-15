/**
 * Almacén del audio de voz (spec 007 §9): IndexedDB, un almacén `voz` con `{ id, pcm, sampleRate, envelope, createdAt }`. El audio **nunca** va a `localStorage`.
 * Todo con `try/catch`: sin IndexedDB (modo privado) la voz vale solo para la sesión (la toma se queda en memoria).
 */
import { MAX_VOICE_BYTES_TOTAL, MAX_VOICE_BYTES_PER_TAKE, isVoiceId, unusedAudio } from './voiceLoop'

export interface StoredVoice {
  id: string
  pcm: ArrayBuffer
  sampleRate: number
  envelope: Float32Array
  createdAt: number
}

const DB = 'coderbeats-voz'
const STORE = 'voz'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

const done = <T>(req: IDBRequest<T>): Promise<T | null> =>
  new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
  })

/** Las tomas de esta sesión que no se pudieron guardar (sin IndexedDB o sin cupo): siguen sonando hasta recargar. */
const memory = new Map<string, StoredVoice>()

export type SaveResult = 'saved' | 'memory' | 'rejected'

/** Guarda una toma. `rejected` si pasa de 3 MB (o el cupo total de 60 MB): no se guarda ni en memoria; `memory` si no hay IndexedDB. */
export async function saveVoice(v: StoredVoice): Promise<SaveResult> {
  if (!isVoiceId(v.id) || v.pcm.byteLength > MAX_VOICE_BYTES_PER_TAKE) return 'rejected'
  const db = await openDb()
  if (!db) {
    memory.set(v.id, v)
    return 'memory'
  }
  try {
    const all = (await done(db.transaction(STORE).objectStore(STORE).getAll())) as StoredVoice[] | null
    const used = (all ?? []).reduce((n, x) => n + x.pcm.byteLength, 0)
    if (used + v.pcm.byteLength > MAX_VOICE_BYTES_TOTAL) return 'rejected'
    await done(db.transaction(STORE, 'readwrite').objectStore(STORE).put(v))
    return 'saved'
  } catch {
    memory.set(v.id, v)
    return 'memory'
  } finally {
    db.close()
  }
}

export async function loadVoice(id: string): Promise<StoredVoice | null> {
  if (!isVoiceId(id)) return null
  const m = memory.get(id)
  if (m) return m
  const db = await openDb()
  if (!db) return null
  try {
    return ((await done(db.transaction(STORE).objectStore(STORE).get(id))) as StoredVoice | null) ?? null
  } catch {
    return null
  } finally {
    db.close()
  }
}

export async function listVoiceIds(): Promise<string[]> {
  const db = await openDb()
  if (!db) return [...memory.keys()]
  try {
    const keys = ((await done(db.transaction(STORE).objectStore(STORE).getAllKeys())) as string[] | null) ?? []
    return [...new Set([...keys, ...memory.keys()])]
  } catch {
    return [...memory.keys()]
  } finally {
    db.close()
  }
}

/** Recolección (spec 007 §9): borra los audios que no usa ninguna canción guardada ni la sesión actual (`used`). Devuelve los borrados. */
export async function collectVoice(used: Iterable<string>): Promise<string[]> {
  const gone = unusedAudio(await listVoiceIds(), used)
  if (!gone.length) return []
  for (const id of gone) memory.delete(id)
  const db = await openDb()
  if (db) {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      for (const id of gone) tx.objectStore(STORE).delete(id)
      await new Promise<void>((r) => {
        tx.oncomplete = () => r()
        tx.onerror = () => r()
      })
    } catch {
      /* se queda para la próxima */
    } finally {
      db.close()
    }
  }
  return gone
}

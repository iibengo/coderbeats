import type { Instrument, Kit, KitId, Style, StyleId } from './types'

export const INSTRUMENTS: readonly Instrument[] = ['bd', 'sd', 'hh']

export const INSTRUMENT_LABELS: Record<Instrument, { name: string; vocal: string }> = {
  bd: { name: 'Bombo', vocal: 'bum' },
  sd: { name: 'Caja', vocal: 'pff' },
  hh: { name: 'Platillo', vocal: 'ts' },
}

export const STYLES: Record<StyleId, Style> = {
  hiphop90: { id: 'hiphop90', label: 'Hip hop 90', bpm: 90, quantizeEvery: 1 },
  house: { id: 'house', label: 'House', bpm: 124, quantizeEvery: 1, legacy: true },
  house2: { id: 'house2', label: 'House', bpm: 124, quantizeEvery: 1 },
  dnb: { id: 'dnb', label: 'Drum and bass', bpm: 174, quantizeEvery: 2 },
  dembow: { id: 'dembow', label: 'Dembow', bpm: 120, quantizeEvery: 1 },
  reggaeton: { id: 'reggaeton', label: 'Reggaetón', bpm: 95, quantizeEvery: 1 },
  drill: { id: 'drill', label: 'Drill', bpm: 140, quantizeEvery: 1 },
  techno: { id: 'techno', label: 'Techno', bpm: 128, quantizeEvery: 1, legacy: true },
  techno2: { id: 'techno2', label: 'Techno', bpm: 132, quantizeEvery: 1 },
}

export const KITS: Record<KitId, Kit> = {
  // «Electrónico» (spec 010): el uzu-drumkit (Unlicense), el kit por defecto de strudel.cc: sin `.bank()`, solo `s("bd")`
  // y `.n(k)`, y suena igual al copiar el código. Índices: bd 0 (10_bd_switchangel), sd 1 (11_sd_switchangel_3), hh 3 (13_hh_switchangel).
  electro: { id: 'electro', label: 'Electrónico', strudelBank: null, sampleIndex: { bd: 0, sd: 1, hh: 3 } },
  // «Vinilo» (spec 010): el kit «Soulful Vintage» de Boochi44 (CC0), 808 bajados de calidad. Para que valga en strudel.cc,
  // el código mostrado lleva su `samples('github:…')` (el repositorio sale de `kits/coderbeats-kits/`).
  vinyl: { id: 'vinyl', label: 'Vinilo', strudelBank: 'Vinyl', samples: 'github:iibengo/coderbeats-kits/v1', sampleIndex: { bd: 0, sd: 0, hh: 0 } },
  '808': { id: '808', label: '808', strudelBank: 'RolandTR808', sampleIndex: { bd: 1, sd: 1, hh: 0 } },
  // «Batería» (spec 034): batería acústica real, Big Rusty Drums de Karoryfer (CC0): bombo 24", caja 14" (golpe al centro), charles cerrado.
  // Su id no es `acoustic` (nombre antiguo que pasa a `electro`). Solo suena en la app (`appOnly`): en strudel.cc el código mostrado usa los sonidos de strudel.
  drums: { id: 'drums', label: 'Batería', strudelBank: 'Drums', appOnly: true, sampleIndex: { bd: 0, sd: 0, hh: 0 } },
  // «Techno» (spec 043): del uzu-drumkit (Unlicense): un bombo gordo con cola, la palmada como caja y el charle cerrado del kit Electrónico. Solo suena en la app.
  techno: { id: 'techno', label: 'Techno', strudelBank: 'Techno', appOnly: true, appOnlyNote: 'el kit de techno solo suena en la app', sampleIndex: { bd: 0, sd: 0, hh: 0 } },
}

/** Orden de la UI (las claves numéricas de un objeto se reordenan solas). */
export const KIT_ORDER: readonly KitId[] = ['electro', 'vinyl', '808', 'drums', 'techno']

/**
 * Kits que ya no existen y a cuál pasan al leerlos de lo guardado (spec 010): el `909` y el `acoustic` (samples sin licencia
 * clara) pasan a «Electrónico». Sin esto, las canciones y los ajustes guardados con ellos dejarían de abrirse.
 */
const LEGACY_KITS: Readonly<Record<string, KitId>> = { '909': 'electro', acoustic: 'electro' }

/** El kit de un valor guardado (de ahora o de antes), o `null` si no se conoce. */
export function kitFromSaved(x: unknown): KitId | null {
  if (typeof x !== 'string') return null
  if (Object.hasOwn(KITS, x)) return x as KitId
  return Object.hasOwn(LEGACY_KITS, x) ? LEGACY_KITS[x]! : null
}

export const RECORD_BPM = 90
export const TAKES_PER_INSTRUMENT = 5


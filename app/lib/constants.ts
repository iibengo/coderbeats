import type { Instrument, Kit, KitId, Style, StyleId } from './types'

export const INSTRUMENTS: readonly Instrument[] = ['bd', 'sd', 'hh']

export const INSTRUMENT_LABELS: Record<Instrument, { name: string; vocal: string }> = {
  bd: { name: 'Bombo', vocal: 'bum' },
  sd: { name: 'Caja', vocal: 'pff' },
  hh: { name: 'Platillo', vocal: 'ts' },
}

export const STYLES: Record<StyleId, Style> = {
  hiphop90: { id: 'hiphop90', label: 'Hip hop 90', bpm: 90 },
  house: { id: 'house', label: 'House', bpm: 124 },
  dnb: { id: 'dnb', label: 'Drum and bass', bpm: 174 },
}

export const KITS: Record<KitId, Kit> = {
  '909': { id: '909', label: '909', strudelBank: 'RolandTR909' },
  '808': { id: '808', label: '808', strudelBank: 'RolandTR808' },
  acoustic: { id: 'acoustic', label: 'Acústico', strudelBank: 'AkaiMPC60' },
}

/** Orden de la UI (las claves numéricas de un objeto se reordenan solas). */
export const KIT_ORDER: readonly KitId[] = ['909', '808', 'acoustic']

export const RECORD_BPM = 90
export const STEPS_PER_BAR = 16
export const RECORD_BARS = 4
export const TAKES_PER_INSTRUMENT = 5

export const sixteenthSeconds = (bpm: number): number => 60 / bpm / 4
export const barSeconds = (bpm: number): number => (60 / bpm) * 4

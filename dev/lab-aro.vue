<script setup lang="ts">
// Banco de pruebas visual del aro y del órgano de la melodía (spec 002, F2). Solo en desarrollo (`nuxt dev`).
// Monta la capa visual con una canción de ejemplo y sin audio: para ver el dibujo y probar los gestos.
import { emptySong, type Song } from '~/lib/cells'
import type { FreeLoop } from '~/lib/freeLoops'
import VisualStage from '~/components/visual/VisualStage.vue'

const engine = useAudioEngine()
const query = useRoute().query
const drum = (id: number, instrument: 'bd' | 'sd' | 'hh', pos: number[]): FreeLoop => ({
  id, instrument, bars: 1, phaseBar: 0, hits: pos.map((p) => ({ pos: p, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false,
})
const mel = (id: number, notes: [number, number, number][]): FreeLoop => ({
  id, instrument: 'mel', bars: 1, phaseBar: 0, hits: notes.map(([pos, dur, midi]) => ({ pos, dur, midi, strength: 0.8 })), muted: false, bornAt: 0, fromTemplate: false,
})

onMounted(() => {
  const s = emptySong()
  const loops: FreeLoop[] = [drum(1, 'bd', [0, 8, 10]), drum(2, 'sd', [4, 12]), drum(3, 'hh', [0, 2, 4, 6, 8, 10, 12, 14])]
  if (query.mel !== '0') loops.push(mel(4, [[0, 4, 57], [4, 2, 60], [6, 2, 62], [8, 3, 64], [11, 1, 62], [12, 4, 60]]))
  const song: Song = { ...s, cells: [{ ...s.cells[0]!, loops, parts: { bass: false, chords: false } }], nextLoopId: 10 }
  engine.setSong(song)
  engine.setMelody(true)
})
</script>

<template>
  <div class="fixed inset-0 bg-[#0B0B0F]"><VisualStage /></div>
</template>

import { describe, expect, it } from 'vitest'
import { labRemixById } from '~/lib/labRemixes'
import { songCode, type SongState } from '~/lib/song'
import { events } from '../helpers/strudelEval'

describe('Lacrimosa: el código Strudel', () => {
  it('lleva 140 bpm y las notas del suspiro caen en sextos de compás (tresillos), re5 incluido', async () => {
    const r = labRemixById('lacrimosa-drill')!
    const song = r.song
    const cell = song.cells[0]! // Intro: el suspiro de los violines
    const st: SongState = {
      loops: cell.loops, style: 'drill', kit: '808', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false,
      fx: { filter: 1, space: 0, warmth: 0 }
    } as unknown as SongState
    const code = songCode(st, 'display')
    expect(code).toContain('setcpm(140/4)')
    const ev = (await events(code, 4)).filter((e) => e.value.note !== undefined && e.value.s !== undefined && e.begin < 1)
    // en el primer compás de 4/4 (= medio compás de 12/8): do♯5 en 1/6 y re5 en 2/6 de compás, la primera corchea del grupo en silencio
    const first = ev.filter((e) => typeof e.value.note === 'number' || typeof e.value.note === 'string')
    expect(first.length).toBeGreaterThan(0)
    for (const e of first) expect(Math.abs(e.begin * 6 - Math.round(e.begin * 6))).toBeLessThan(1e-6)
  })
})

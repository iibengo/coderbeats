import { describe, expect, it } from 'vitest'
import { emptyCell, type Cell } from '../../app/lib/cells'
import { groupSchedule, songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

const cell = (id: number, turns: Cell['turns'], o: Partial<Cell> = {}): Cell => ({ ...emptyCell(id), turns, ...o })
/** un loop de un bombo (bd) o de platillo (hh) en el paso 0 de 1 compás */
const loop = (id: number, instrument: 'bd' | 'hh'): Cell['loops'][number] => ({
  id, instrument, bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 0.8 }], muted: false, bornAt: 0, fromTemplate: false,
})

describe('groupSchedule: cuándo suena el grupo dentro de la vuelta', () => {
  const list = [cell(1, 4), cell(2, 8, { groupOn: [1] }), cell(3, 4, { groupOff: [1] }), cell(4, 2)]
  const order = [1, 2, 3, 4]
  it('silencio hasta la célula que lo enciende y sonido hasta la que lo apaga', () => {
    expect(groupSchedule({ list, order }, 1)).toEqual({ lead: 4, span: 8, total: 18 })
  })
  it('sin apagado suena hasta el final de la vuelta; sin encendido, null', () => {
    expect(groupSchedule({ list: [cell(1, 4), cell(2, 4, { groupOn: [1] })], order: [1, 2] }, 1)).toEqual({ lead: 4, span: 4, total: 8 })
    expect(groupSchedule({ list, order }, 2)).toBeNull()
    expect(groupSchedule(undefined, 1)).toBeNull()
  })
})

describe('el código mostrado: el grupo entra en su célula y se apaga en la suya (evaluado en Strudel)', () => {
  // canción de 3 + 4 + 2 compases; el grupo (platillo en su 1.ª célula y bombo en la 2.ª, 2 compases cada una) entra en la célula 2 y sale en la 3
  const list = [cell(1, 3), cell(2, 4, { groupOn: [1] }), cell(3, 2, { groupOff: [1] }), cell(4, 2, { loops: [loop(1, 'hh')] }), cell(5, 2, { loops: [loop(2, 'bd')] })]
  const st: SongState = {
    loops: [], style: 'dembow', kit: '808', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, bpm: null,
    fx: { filter: 1, space: 0, warmth: 0 }, cells: { list, order: [1, 2, 3], window: [] },
    groups: { list, items: [{ id: 1, order: [4, 5], window: [] }] },
  }
  const code = songCode(st, 'display')
  const at = async (name: string) => (await events(code, 18)).filter((e) => e.value.s === name || e.value.sound === name)

  it('lleva el silencio previo y el que cierra la vuelta', () => {
    expect(code).toContain('[3, silence]')
    expect(code).toContain('entra en el compás 3')
  })
  it('suena en los compases 3–4 el platillo, en el 5–6 el bombo y calla en el 7 y en los compases 0–2', async () => {
    const hh = (await at('hh')).map((e) => Math.floor(e.begin))
    const bd = (await at('bd')).map((e) => Math.floor(e.begin))
    expect(hh.filter((b) => b < 9)).toEqual([3, 4])
    expect(bd.filter((b) => b < 9)).toEqual([5, 6])
  })
  it('la vuelta siguiente lo vuelve a encender (9 compases por vuelta)', async () => {
    const hh = (await at('hh')).map((e) => Math.floor(e.begin))
    expect(hh.filter((b) => b >= 9 && b < 18)).toEqual([12, 13])
  })
})

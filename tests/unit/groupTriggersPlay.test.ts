import { describe, expect, it } from 'vitest'
import { emptyCell, emptySong, stepPlay, type Cell, type Play, type Song } from '../../app/lib/cells'
import { applyTriggers, isRunning, stepGroup, type GroupPlay } from '../../app/lib/groups'
import { groupSong } from '../../app/lib/cells'

const cell = (id: number, turns: Cell['turns'], o: Partial<Cell> = {}): Cell => ({ ...emptyCell(id), turns, ...o })
/** Canción de 3 células (1: 2 vueltas · 2: 4 y enciende el grupo 1 · 3: 2 y lo apaga) y un grupo en paralelo de 2 células de 2 vueltas (4 y 5). */
const song = (o: { c2?: Partial<Cell>; c3?: Partial<Cell>; on?: boolean } = {}): Song => ({
  ...emptySong(),
  cells: [cell(1, 2), cell(2, 4, { groupOn: [1], ...o.c2 }), cell(3, 2, { groupOff: [1], ...o.c3 }), cell(4, 2), cell(5, 2)],
  order: [1, 2, 3],
  groups: [{ id: 1, order: [4, 5], on: o.on ?? false }],
  nextCellId: 6,
  nextGroupId: 2,
})

interface Row { bar: number; main: number; group: number | null }

/** El motor, compás a compás y sin audio: la canción avanza, entrar en otra célula dispara y los grupos avanzan por su cuenta. */
function run(s: Song, bars: number, o: { loop?: boolean } = {}): Row[] {
  let play: Play = { cursor: { cellId: s.order[0]!, startBar: 0 }, loop: !!o.loop, jump: null }
  let plays = new Map<number, GroupPlay>()
  // al dar a Play: los grupos encendidos desde el compás 0 y los disparadores de la primera célula
  for (const g of s.groups) if (g.on) plays.set(g.id, { play: { cursor: { cellId: g.order[0]!, startBar: 0 }, loop: false, jump: null }, from: 0, to: null })
  plays = applyTriggers(plays, s, play.cursor.cellId, 0)
  const rows: Row[] = []
  for (let bar = 0; bar < bars; bar++) {
    if (bar > 0) {
      const next = stepPlay(s, play, bar)
      if (next.cursor.cellId !== play.cursor.cellId) plays = applyTriggers(plays, s, next.cursor.cellId, next.cursor.startBar)
      play = next
    }
    for (const [gid, gp] of [...plays]) {
      const n = stepGroup(groupSong(s, gid), gp, bar)
      if (n === null) plays.delete(gid)
      else plays.set(gid, n)
    }
    const gp = plays.get(1)
    rows.push({ bar, main: play.cursor.cellId, group: gp && isRunning(gp) ? gp.play.cursor.cellId : gp ? gp.play.cursor.cellId : null })
  }
  return rows
}
const col = (rows: Row[], k: 'main' | 'group') => rows.map((r) => r[k])

describe('los grupos se encienden y apagan al entrar en una célula (spec 005, §22)', () => {
  it('el grupo no suena hasta la célula que lo enciende, avanza solo por sus células y se apaga al llegar la que lo apaga', () => {
    const rows = run(song(), 8)
    expect(col(rows, 'main')).toEqual([1, 1, 2, 2, 2, 2, 3, 3])
    // sin grupo en 0–1; a partir del 2: célula 4 (2 vueltas), 5 (2 vueltas); en el 6 la célula 3 lo apaga
    expect(col(rows, 'group')).toEqual([null, null, 4, 4, 5, 5, null, null])
  })

  it('la canción es cíclica: cada vuelta vuelve a encenderlo desde su primera célula', () => {
    const rows = run(song(), 20)
    expect(col(rows, 'main').slice(8, 14)).toEqual([1, 1, 2, 2, 2, 2])
    expect(col(rows, 'group').slice(0, 16)).toEqual([null, null, 4, 4, 5, 5, null, null, null, null, 4, 4, 5, 5, null, null])
  })

  it('un grupo más corto que la célula que lo enciende da la vuelta (sigue en bucle) hasta que lo apagan', () => {
    const s = { ...song(), cells: song().cells.map((c) => (c.id === 2 ? { ...c, turns: 8 as const } : c)) }
    const rows = run(s, 12)
    expect(col(rows, 'group').slice(2, 10)).toEqual([4, 4, 5, 5, 4, 4, 5, 5])
  })

  it('en bucle sobre la célula (no entra en otra) el grupo no se reinicia: sigue avanzando', () => {
    // la canción empieza en la célula 2 y se queda en bucle ahí: el grupo se enciende al empezar y luego solo avanza
    const s = { ...song(), order: [2, 1, 3] }
    const rows = run(s, 10, { loop: true })
    expect(col(rows, 'main')).toEqual(Array(10).fill(2))
    expect(col(rows, 'group')).toEqual([4, 4, 5, 5, 4, 4, 5, 5, 4, 4]) // sin reiniciarse a la 4 en cada vuelta de la célula
  })

  it('la primera célula también dispara (al dar a Play, en el compás 0)', () => {
    const s = { ...song(), order: [2, 3, 1] }
    expect(col(run(s, 4), 'group')).toEqual([4, 4, 5, 5])
  })

  it('un grupo en las dos listas de una célula se reinicia al entrar en ella', () => {
    // la célula 3 enciende y apaga el 1: gana encenderlo (reinicia); como la 2 también lo enciende, no hay hueco
    const s = song({ c3: { groupOn: [1], groupOff: [1] } })
    const rows = run(s, 8)
    expect(col(rows, 'group')).toEqual([null, null, 4, 4, 5, 5, 4, 4])
  })

  it('un grupo marcado como encendido desde el compás 0 también lo puede apagar una célula', () => {
    const s = song({ on: true, c2: { groupOn: undefined } })
    const rows = run(s, 8)
    expect(col(rows, 'group')).toEqual([4, 4, 5, 5, 4, 4, null, null]) // suena desde 0 y la célula 3 (compás 6) lo apaga
  })

  it('no toca la marca "encendido" de la canción (lo que se guarda): apply es puro', () => {
    const s = song()
    const before = JSON.stringify(s)
    applyTriggers(new Map(), s, 2, 2)
    expect(JSON.stringify(s)).toBe(before)
    expect(s.groups[0]!.on).toBe(false)
  })

  it('sin disparadores no cambia nada (la misma instancia de mapa de contenido)', () => {
    const s = { ...song(), cells: song().cells.map((c) => ({ ...c, groupOn: undefined, groupOff: undefined })) }
    expect(col(run(s, 6), 'group')).toEqual(Array(6).fill(null))
  })
})

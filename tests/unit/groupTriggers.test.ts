import { describe, expect, it } from 'vitest'
import { emptyCell, emptySong, groupTriggers, isSong, normalizeSong, withoutCell, withoutDeadTriggers, withCopy, type Cell, type Song } from '../../app/lib/cells'

const J = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const cell = (id: number, o: Partial<Cell> = {}): Cell => ({ ...emptyCell(id), turns: 4, ...o })
/** Una canción de 3 células (1 2 3) y dos grupos en paralelo: el 1 con las células 4 y 5, el 2 con la 6. */
const song = (o: { c1?: Partial<Cell>; c2?: Partial<Cell>; c3?: Partial<Cell> } = {}): Song => ({
  ...emptySong(),
  cells: [cell(1, o.c1), cell(2, o.c2), cell(3, o.c3), cell(4), cell(5), cell(6)],
  order: [1, 2, 3],
  groups: [{ id: 1, order: [4, 5], on: false }, { id: 2, order: [6], on: false }],
  nextCellId: 7,
  nextGroupId: 3,
})

describe('validación de groupOn y groupOff', () => {
  it('listas de ids de grupo válidas pasan, también por JSON', () => {
    const s = song({ c2: { groupOn: [1], groupOff: [2] }, c3: { groupOn: [1, 2] } })
    expect(isSong(s)).toBe(true)
    expect(isSong(J(s))).toBe(true)
    expect(isSong(song())).toBe(true) // sin disparadores, como siempre
  })
  it('rechaza lo que no son enteros mayores que 0, las listas vacías o muy largas y lo que no es una lista', () => {
    for (const bad of [[], [0], [-1], [1.5], ['1'], [NaN], [null], '1', 1, { 0: 1 }, null, ['1); evil()//'], Array(17).fill(1)]) {
      for (const field of ['groupOn', 'groupOff'] as const) {
        const s = song()
        ;(s.cells[1] as unknown as Record<string, unknown>)[field] = bad
        expect(isSong(s), `${field} ${JSON.stringify(bad)}`).toBe(false)
      }
    }
    expect(isSong(song({ c2: { groupOn: Array(16).fill(1) } }))).toBe(true)
  })
})

describe('groupTriggers: qué enciende y qué apaga una célula al empezar', () => {
  it('lo que dice su lista, solo de grupos que existen', () => {
    const s = song({ c2: { groupOn: [1], groupOff: [2] }, c3: { groupOff: [1, 9] } })
    expect(groupTriggers(s, 2)).toEqual({ on: [1], off: [2] })
    expect(groupTriggers(s, 3)).toEqual({ on: [], off: [1] }) // el 9 no existe
    expect(groupTriggers(s, 1)).toEqual({ on: [], off: [] })
  })
  it('un grupo en las dos listas se enciende (se reinicia), no se apaga; sin repetidos', () => {
    expect(groupTriggers(song({ c2: { groupOn: [1, 1], groupOff: [1, 2] } }), 2)).toEqual({ on: [1], off: [2] })
  })
  it('solo vale en las células de la canción: una de un grupo en paralelo o una que no existe no disparan nada', () => {
    const s = song()
    s.cells[3] = cell(4, { groupOn: [2] })
    expect(groupTriggers(s, 4)).toEqual({ on: [], off: [] })
    expect(groupTriggers(s, 99)).toEqual({ on: [], off: [] })
  })
})

describe('limpieza: un grupo que desaparece no deja disparadores colgando', () => {
  const s = song({ c2: { groupOn: [1, 2], groupOff: [2] }, c3: { groupOn: [2] } })

  it('normalizar quita los ids de grupos que no existen y las listas que se quedan vacías', () => {
    const raw = { ...s, groups: [{ id: 1, order: [4, 5], on: false }] } // el grupo 2 ya no está
    const n = normalizeSong(raw)
    expect(n.cells.find((c) => c.id === 2)).toMatchObject({ groupOn: [1] })
    expect(n.cells.find((c) => c.id === 2)!.groupOff).toBeUndefined()
    expect(n.cells.find((c) => c.id === 3)!.groupOn).toBeUndefined()
  })
  it('borrar la única célula de un grupo borra el grupo y sus disparadores', () => {
    const r = withoutCell(s, 6) // la 6 era todo el grupo 2
    expect(r.groups.map((g) => g.id)).toEqual([1])
    expect(r.cells.find((c) => c.id === 2)).toMatchObject({ groupOn: [1] })
    expect(r.cells.find((c) => c.id === 2)!.groupOff).toBeUndefined()
    expect(r.cells.find((c) => c.id === 3)!.groupOn).toBeUndefined()
  })
  it('borrar una célula de un grupo que sigue con otras no toca los disparadores', () => {
    const r = withoutCell(s, 4)
    expect(r.groups.map((g) => g.id)).toEqual([1, 2])
    expect(r.cells.find((c) => c.id === 2)).toMatchObject({ groupOn: [1, 2], groupOff: [2] })
  })
  it('withoutDeadTriggers deja intactas las células sin disparadores (la misma referencia)', () => {
    const plain = cell(1)
    expect(withoutDeadTriggers([plain], [{ id: 1 }])[0]).toBe(plain)
  })
  it('copiar una célula conserva sus disparadores (sin efecto mientras la copia no esté en la canción)', () => {
    const r = withCopy(s, 2, { x: 5, y: 5 })!
    const copy = r.song.cells.find((c) => c.id === r.id)!
    expect(copy.groupOn).toEqual([1, 2])
    expect(groupTriggers(r.song, r.id)).toEqual({ on: [], off: [] }) // suelta: no está en el orden
  })
})

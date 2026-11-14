import { describe, expect, it } from 'vitest'
import { emptySong, isSong, type Cell, type Song } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { cellLpf, songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

const J = <T>(x: T): T => JSON.parse(JSON.stringify(x))
const drum = (id: number): FreeLoop => ({ id, instrument: 'hh', bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 1 }, { pos: 8, strength: 1 }], muted: false, bornAt: 0, fromTemplate: false })
const cell = (id: number, turns: Cell['turns'], lpf?: number[], loops: FreeLoop[] = [drum(id)]): Cell => ({ id, loops, parts: { bass: false, chords: false }, turns, at: { x: id, y: 0, depth: 0 }, ...(lpf ? { lpf } : {}) })
const songOf = (...cells: Cell[]): Song => ({ ...emptySong(), cells, order: cells.map((c) => c.id), nextCellId: cells.length + 1, nextLoopId: 20 })
const state = (song: Song, window: { cellId: number; from: number; to: number | null }[] = []): SongState => ({
  loops: [], style: 'dembow', kit: '808', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 },
  cells: { list: song.cells, order: song.order, window },
})

describe('validación del filtro por vuelta (Cell.lpf)', () => {
  const ok = songOf(cell(1, 4, [600, 1000, 2000, 6000]))
  it('una lista válida pasa, también por JSON', () => {
    expect(isSong(ok)).toBe(true)
    expect(isSong(J(ok))).toBe(true)
    expect(isSong(songOf(cell(1, 1)))).toBe(true) // sin lpf, como siempre
  })
  it('rechaza lo que no son números en rango, listas vacías o demasiado largas y lo que no es una lista', () => {
    for (const bad of [[], ['500'], [NaN], [Infinity], [59], [20001], [-5], '500', 500, { 0: 500 }, null, ['1000); evil()//'], Array(33).fill(500)]) {
      const s = songOf(cell(1, 4))
      ;(s.cells[0] as unknown as Record<string, unknown>).lpf = bad
      expect(isSong(s), JSON.stringify(bad)).toBe(false)
    }
    expect(isSong(songOf(cell(1, 4, Array(32).fill(500))))).toBe(true)
  })
})

describe('cellLpf: el código del filtro por vuelta', () => {
  const c = (turns: Cell['turns'], lpf?: number[]) => ({ turns, lpf })
  it('un valor por vuelta, en orden (en el código mostrado, cada sección empieza en su ciclo 0)', () => {
    expect(cellLpf(c(4, [600, 1000, 2000, 6000]), 'display')).toBe('.lpf("<600 1000 2000 6000>")')
  })
  it('con menos valores que vueltas vale el último; con más, sobran', () => {
    expect(cellLpf(c(4, [600, 1000]), 'display')).toBe('.lpf("<600 1000 1000 1000>")')
    expect(cellLpf(c(2, [600, 1000, 2000]), 'display')).toBe('.lpf("<600 1000>")')
  })
  it('un valor constante es un número solo; sin lpf o vacío, nada', () => {
    expect(cellLpf(c(4, [800]), 'display')).toBe('.lpf(800)')
    expect(cellLpf(c(1, [800, 900]), 'display')).toBe('.lpf(800)')
    expect(cellLpf(c(4), 'display')).toBe('')
    expect(cellLpf(c(4, []), 'display')).toBe('')
  })
  it('redondea y acota; un valor raro no se escribe tal cual', () => {
    expect(cellLpf(c(2, [599.6, 99999]), 'display')).toBe('.lpf("<600 20000>")')
    expect(cellLpf(c(2, ['x' as never, 100]), 'display')).toBe('.lpf("<60 100>")')
  })
  it('en el motor, rotado al compás en el que empieza la célula', async () => {
    const vals = [600, 1000, 2000, 6000]
    expect(cellLpf(c(4, vals), 'engine', 16)).toBe('.lpf("<600 1000 2000 6000>")') // 16 mod 4 = 0
    expect(cellLpf(c(4, vals), 'engine', 18)).toBe('.lpf("<2000 6000 600 1000>")')
    // y suena como debe: en los ciclos globales 18..21, la vuelta 1 de la célula usa el primer valor
    for (const from of [0, 1, 18, 33]) {
      const code = `note("c4").slow(1)${cellLpf(c(4, vals), 'engine', from)}`
      const ev = await events(code, from + 4)
      const got = ev.filter((e) => e.begin >= from && e.begin < from + 4).map((e) => e.value.cutoff)
      expect(got, `from ${from}`).toEqual(vals)
    }
  })
})

describe('en la canción', () => {
  const song = songOf(cell(1, 2), cell(2, 4, [500, 900, 2000, 6000]))

  it('el código mostrado lleva el filtro de la célula que lo tiene y se evalúa en Strudel con su valor en cada vuelta', async () => {
    const code = songCode(state(song), 'display')
    expect(code).toMatch(/\n\s*\)\],/) // la célula 1 cierra su stack sin filtro
    expect(code).toMatch(/\n\s*\)\.lpf\("<500 900 2000 6000>"\)\],/)
    const ev = await events(code, 6)
    const cutoff = (cycle: number) => ev.find((e) => e.begin >= cycle && e.begin < cycle + 1)?.value.cutoff
    expect([0, 1].map(cutoff)).toEqual([undefined, undefined])
    expect([2, 3, 4, 5].map(cutoff)).toEqual([500, 900, 2000, 6000])
  })

  it('en el motor va antes del filtro de la ventana y rotado a su compás de inicio', () => {
    const code = songCode(state(song, [{ cellId: 2, from: 2, to: 6 }]), 'engine')
    expect(code).toContain('.lpf("<2000 6000 500 900>").filterHaps((h) => h.whole.begin >= 2 && h.whole.begin < 6)')
  })

  it('una célula sin filtro no cambia el código de siempre (el motor pone el lpf abierto para la marca del wowo)', () => {
    const plain = songOf(cell(1, 2), cell(2, 4))
    // (el fondo del dembow lleva su propio lpf dentro de sus líneas; lo que no debe haber es un lpf tras el stack de la célula)
    expect(songCode(state(plain), 'display')).not.toMatch(/\n\s*\)\.lpf\(/)
    // en el motor, el `lpf(20000)` es el filtro abierto con el que superdough ya suena: no cambia nada por sí solo
    const engine = songCode(state(plain, [{ cellId: 2, from: 2, to: 6 }]), 'engine')
    expect(engine).toContain(').lpf(20000).filterHaps((h) => h.whole.begin >= 2 && h.whole.begin < 6)')
    expect(engine).not.toMatch(/lpq|lpenv/)
  })
})

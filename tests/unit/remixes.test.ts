import { noteToMidi } from '@strudel/core'
import { describe, expect, it } from 'vitest'
import { groupTriggers, isSong, normalizeSong, songBars } from '../../app/lib/cells'
import { ODE_A, ODE_A2, ODE_B, remixBars, remixById, REMIXES } from '../../app/lib/remixes'
import { songCode, type SongState } from '../../app/lib/song'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { events, type Ev } from '../helpers/strudelEval'

const remix = remixById('oda-alegria-dembow')!
const song = remix.build()
const code = () =>
  songCode(
    {
      loops: [], style: remix.style, kit: remix.kit, background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false,
      fx: { filter: 1, space: 0, warmth: 0 }, cells: { list: song.cells, order: song.order, window: [] },
      groups: { list: song.cells, items: song.groups.map((g) => ({ id: g.id, order: g.order, window: [] })) },
    } satisfies SongState,
    'display',
  )

describe('la lista de remixes', () => {
  it('hay un remix con su atribución a la vista y su estilo, kit y tonalidad', () => {
    expect(REMIXES).toHaveLength(1)
    expect(remix).toMatchObject({ title: 'Himno de la alegría', composer: 'Ludwig van Beethoven', years: '1770–1827', style: 'dembow', kit: '808', key: 'Re mayor' })
    expect(remix.publicDomain).toMatch(/dominio público/)
    expect(new Set(REMIXES.map((r) => r.id)).size).toBe(REMIXES.length)
    expect(remixById('no existe')).toBeUndefined()
  })
  it('dura 34 compases, con una línea por célula', () => {
    expect(remixBars(remix)).toBe(34)
    expect(remix.info.cells.map((c) => c.name)).toEqual(['Intro', 'Despierta', 'Entra el ritmo', 'Dembow', 'Subida', 'Subidón', 'Final'])
  })
})

describe('la canción: siete células que crecen', () => {
  const byName = (n: string) => song.cells.find((c) => c.name === n)!
  const songCells = song.order.map((id) => song.cells.find((c) => c.id === id)!)
  const kinds = (n: string) => byName(n).loops.map((l) => l.instrument)

  it('vueltas en orden: 4 4 4 8 4 8 2', () => {
    expect(songCells.map((c) => c.turns)).toEqual([4, 4, 4, 8, 4, 8, 2])
    expect(song.order).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(songBars(song)).toBe(34)
  })
  it('qué lleva cada célula', () => {
    expect(kinds('Intro')).toEqual([])
    expect(kinds('Despierta')).toEqual(['hh', 'mel'])
    expect(kinds('Entra el ritmo')).toEqual(['bd', 'hh', 'mel'])
    expect(kinds('Dembow')).toEqual(['bd', 'sd', 'hh']) // la melodía clara viene del grupo del Himno
    expect(kinds('Subida')).toEqual(['sd', 'hh']) // sin bombo
    expect(kinds('Subidón')).toEqual(['bd', 'sd', 'hh'])
    expect(kinds('Final')).toEqual([])
  })
  it('partes del fondo: acordes siempre; el bajo solo en el Subidón', () => {
    expect(songCells.map((c) => [c.name, c.parts.bass, c.parts.chords])).toEqual([
      ['Intro', false, true], ['Despierta', false, true], ['Entra el ritmo', false, true], ['Dembow', false, true], ['Subida', false, true], ['Subidón', true, true], ['Final', false, true],
    ])
  })
  it('el filtro: suave en la intro, se abre en la subida y se cierra al final; el resto sin él', () => {
    expect(songCells.map((c) => c.lpf)).toEqual([[800, 900, 1000, 1200], undefined, undefined, undefined, [600, 1000, 2000, 6000], undefined, [1500, 350]])
  })
  it('la melodía lejana es un pad y la clara un lead; la caja de la subida es un loop de 4 compases', () => {
    const mel = (n: string) => byName(n).loops.find((l) => l.instrument === 'mel')!
    expect([mel('Despierta').synth, mel('Entra el ritmo').synth]).toEqual(['pad', 'pad'])
    for (const c of song.groups[0]!.order) expect(song.cells.find((x) => x.id === c)!.loops.map((l) => [l.instrument, l.synth])).toEqual([['mel', 'lead']])
    const roll = byName('Subida').loops.find((l) => l.instrument === 'sd')!
    expect(roll.bars).toBe(4)
    expect(roll.hits).toHaveLength(4 + 8 + 16 + 16)
  })
  it('es una canción válida, sobrevive a JSON y a la normalización, y cada llamada da una nueva con ids únicos', () => {
    expect(isSong(song)).toBe(true)
    expect(isSong(JSON.parse(JSON.stringify(song)))).toBe(true)
    expect(isSong(normalizeSong(song))).toBe(true)
    const ids = song.cells.flatMap((c) => c.loops.map((l) => l.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(song.nextLoopId).toBeGreaterThan(Math.max(...ids))
    expect(remix.build()).toEqual(song)
    expect(remix.build()).not.toBe(song)
  })
})

describe('el grupo en paralelo del Himno (spec 005, §22)', () => {
  const cellOf = (id: number) => song.cells.find((c) => c.id === id)!
  const group = song.groups[0]!
  const names = group.order.map((id) => cellOf(id).name)
  it('un grupo de 5 células de 4 compases (20 = 8 + 4 + 8), en orden: A, A′, B, A↑, A′↑', () => {
    expect(song.groups).toHaveLength(1)
    expect(names).toEqual(['Himno A', 'Himno A2', 'Puente B', 'Himno A agudo', 'Himno A2 agudo'])
    expect(group.order.map((id) => cellOf(id).turns)).toEqual([4, 4, 4, 4, 4])
    expect(group.on).toBe(false) // lo enciende el Dembow, no Play
    expect(song.cells).toHaveLength(12)
    expect(song.nextCellId).toBe(13)
  })
  it('la célula Dembow lo enciende y la Final lo apaga; el resto de la canción no dispara nada', () => {
    const t = (n: string) => groupTriggers(song, song.cells.find((c) => c.name === n)!.id)
    expect(t('Dembow')).toEqual({ on: [1], off: [] })
    expect(t('Final')).toEqual({ on: [], off: [1] })
    for (const n of ['Intro', 'Despierta', 'Entra el ritmo', 'Subida', 'Subidón']) expect(t(n)).toEqual({ on: [], off: [] })
  })
  it('lo que dura el grupo cubre justo Dembow + Subida + Subidón', () => {
    const lasts = (n: string) => song.cells.find((c) => c.name === n)!.turns
    expect(group.order.length * 4).toBe(lasts('Dembow') + lasts('Subida') + lasts('Subidón'))
  })
  it('el puente lleva el filtro que se abre; las demás frases, ninguno', () => {
    expect(song.cells.find((c) => c.name === 'Puente B')!.lpf).toEqual([600, 1000, 2000, 6000])
    for (const n of ['Himno A', 'Himno A2', 'Himno A agudo', 'Himno A2 agudo']) expect(song.cells.find((c) => c.name === n)!.lpf).toBeUndefined()
  })
  it('un grupo sin disparadores no existiría: se borra el grupo y los disparadores desaparecen al normalizar', () => {
    const n = normalizeSong({ ...song, groups: [] })
    expect(n.cells.some((c) => c.groupOn || c.groupOff)).toBe(false)
  })
})

describe('la melodía: el tema de la Oda a la alegría en re mayor', () => {
  const midis = (n: readonly (readonly [number, number, number])[]) => n.map((x) => x[2])
  // F# F# G A | A G F# E | D D E F# | F#. E E        (D4=62 E4=64 F#4=66 G4=67 A4=69)
  it('frase A: la melodía conocida, con la cadencia abierta', () => {
    expect(midis(ODE_A)).toEqual([66, 66, 67, 69, 69, 67, 66, 64, 62, 62, 64, 66, 66, 64, 64])
    expect(ODE_A.slice(-3).map((x) => x[1])).toEqual([6, 2, 8]) // negra con puntillo, corchea y blanca
  })
  it('frase A′: igual, pero acaba en re (cadencia cerrada)', () => {
    expect(midis(ODE_A2).slice(0, 12)).toEqual(midis(ODE_A).slice(0, 12))
    expect(midis(ODE_A2).slice(-3)).toEqual([64, 62, 62])
  })
  it('cada frase ocupa exactamente 4 compases, sin huecos ni solapes, y ninguna nota cruza la línea de compás', () => {
    for (const phrase of [ODE_A, ODE_A2, ODE_B]) {
      let at = 0
      for (const [pos, dur] of phrase) {
        expect(pos).toBe(at)
        expect(Math.floor(pos / 16)).toBe(Math.floor((pos + dur - 1) / 16))
        at += dur
      }
      expect(at).toBe(64)
    }
  })
  it('frase B (el puente): E E F♯ D | E F♯G F♯ D | E F♯G F♯ E | D E A', () => {
    expect(midis(ODE_B)).toEqual([64, 64, 66, 62, 64, 66, 67, 66, 62, 64, 66, 67, 66, 64, 62, 64, 57])
  })
  it('todas las notas son de la escala del dembow (si menor = re mayor), también una octava más aguda', () => {
    const scale = STYLE_MUSIC.dembow.scale
    for (const m of [...midis(ODE_A), ...midis(ODE_A2), ...midis(ODE_B)]) expect(scale).toContain(m % 12)
    const hi = song.cells.find((c) => c.name === 'Himno A2 agudo')!.loops.find((l) => l.instrument === 'mel')!
    expect(hi.hits.map((h) => h.midi)).toEqual(midis(ODE_A2).map((m) => m + 12))
    expect(Math.max(...hi.hits.map((h) => h.midi!))).toBeLessThanOrEqual(84) // dentro del registro del lead
  })
})

describe('el código que sale, evaluado en Strudel (34 ciclos)', async () => {
  const ev = await events(code(), 34)
  const inCycles = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to)
  const countBy = (list: Ev[], key: string) => list.filter((e) => e.value.s === key).length
  const perCycle = (key: string, from: number, to: number) => Array.from({ length: to - from }, (_, i) => countBy(inCycles(from + i, from + i + 1), key))
  const notesOf = (s: string, from: number, to: number) => inCycles(from, to).filter((e) => e.value.s === s).map((e) => noteToMidi(String(e.value.note)))

  it('empieza con la sintaxis de la demo del dembow', () => {
    expect(code().startsWith('setcpm(120/4)\n')).toBe(true)
    expect(code()).toContain('arrange(')
    expect(code()).toContain('.bank("RolandTR808")')
  })
  it('Intro y Final: solo los acordes (nada de batería ni de melodía)', () => {
    for (const [from, to] of [[0, 4], [32, 34]] as const) {
      const sounds = new Set(inCycles(from, to).map((e) => String(e.value.s)))
      expect([...sounds]).toEqual(['triangle'])
    }
  })
  it('Despierta (ciclos 4–7): + platillo en corcheas y la melodía lejana (pad)', () => {
    expect(perCycle('hh', 4, 8)).toEqual([8, 8, 8, 8])
    expect(countBy(inCycles(4, 8), 'bd')).toBe(0)
    expect(notesOf('supersaw', 4, 8)).toEqual(ODE_A.map((x) => x[2]))
  })
  it('Entra el ritmo (8–11): + bombo a negras', () => {
    expect(perCycle('bd', 8, 12)).toEqual([4, 4, 4, 4])
    expect(countBy(inCycles(8, 12), 'sd')).toBe(0)
  })
  it('Dembow (12–19): + caja 3 6 11 14, platillo en semicorcheas y entra el Himno claro: A y A′', () => {
    expect(perCycle('sd', 12, 20)).toEqual(Array(8).fill(4))
    expect(perCycle('hh', 12, 20)).toEqual(Array(8).fill(16))
    expect(perCycle('bd', 12, 20)).toEqual(Array(8).fill(4))
    expect(notesOf('square', 12, 20)).toEqual([...ODE_A, ...ODE_A2].map((x) => x[2]))
    const sdSteps = inCycles(12, 13).filter((e) => e.value.s === 'sd').map((e) => Math.round((e.begin - 12) * 16))
    expect(sdSteps).toEqual([3, 6, 11, 14])
  })
  it('Subida (20–23): sin bombo, la caja se acelera (4, 8, 16, 16 golpes) y suena el puente (B)', () => {
    expect(countBy(inCycles(20, 24), 'bd')).toBe(0)
    expect(perCycle('sd', 20, 24)).toEqual([4, 8, 16, 16])
    expect(notesOf('square', 20, 24)).toEqual(ODE_B.map((x) => x[2]))
  })
  it('Subidón (24–31): todo, con el bajo, y el Himno una octava más aguda: A↑ y A′↑', () => {
    expect(perCycle('bd', 24, 32)).toEqual(Array(8).fill(4))
    expect(perCycle('sd', 24, 32)).toEqual(Array(8).fill(4))
    expect(perCycle('sawtooth', 24, 32)).toEqual(Array(8).fill(4)) // el bajo: 4 notas por compás
    expect(notesOf('square', 24, 32)).toEqual([...ODE_A, ...ODE_A2].map((x) => x[2] + 12))
    expect(countBy(inCycles(0, 24), 'sawtooth')).toBe(0) // antes no hay bajo
  })
  it('el filtro por vuelta: intro suave, subida que se abre, final que se cierra; el resto, el de siempre', () => {
    const chordCutoffs = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => inCycles(from + i, from + i + 1).find((e) => e.value.s === 'triangle')!.value.cutoff)
    expect(chordCutoffs(0, 4)).toEqual([800, 900, 1000, 1200])
    expect(chordCutoffs(4, 20)).toEqual(Array(16).fill(2000))
    expect(chordCutoffs(20, 24)).toEqual([600, 1000, 2000, 6000])
    expect(chordCutoffs(24, 32)).toEqual(Array(8).fill(2000))
    expect(chordCutoffs(32, 34)).toEqual([1500, 350])
    // el filtro de la subida también se lo lleva el puente (la melodía del grupo) en esa vuelta
    expect(inCycles(22, 23).filter((e) => e.value.s === 'square').every((e) => e.value.cutoff === 2000)).toBe(true)
    // y el bajo del Subidón conserva el suyo
    expect(new Set(inCycles(24, 32).filter((e) => e.value.s === 'sawtooth').map((e) => e.value.cutoff))).toEqual(new Set([350]))
  })
})

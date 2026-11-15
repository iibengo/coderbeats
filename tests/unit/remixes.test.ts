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
    expect(REMIXES).toHaveLength(4)
    expect(remix).toMatchObject({ title: 'Himno de la alegría', composer: 'Ludwig van Beethoven', years: '1770–1827', style: 'dembow', kit: '808', key: 'Re mayor' })
    expect(remix.publicDomain).toMatch(/dominio público/)
    const techno = remixById('dies-irae-techno')!
    expect(techno).toMatchObject({ title: 'Dies Irae', style: 'techno', kit: 'electro', key: 'Do menor' })
    expect(techno.publicDomain).toMatch(/dominio público/)
    expect(new Set(REMIXES.map((r) => r.id)).size).toBe(REMIXES.length)
    expect(remixById('no existe')).toBeUndefined()
  })
  it('dura 56 compases (≈ 1 min 52 s), con una línea por célula', () => {
    expect(remixBars(remix)).toBe(56)
    expect(remix.info.cells.map((c) => c.name)).toEqual(['Intro', 'Despierta', 'Entra el ritmo', 'Dembow', 'Subida', 'Riser', 'Subidón', 'Break', 'Subida 2', 'Riser 2', 'Subidón 2', 'Final'])
  })
})

describe('la canción: doce células, dos drops (spec 008, §13)', () => {
  const byName = (n: string) => song.cells.find((c) => c.name === n)!
  const songCells = song.order.map((id) => song.cells.find((c) => c.id === id)!)
  const kinds = (n: string) => byName(n).loops.map((l) => l.instrument)

  it('vueltas en orden: 4 4 4 8 4 2 8 4 4 2 8 4 = 56 compases', () => {
    expect(songCells.map((c) => c.turns)).toEqual([4, 4, 4, 8, 4, 2, 8, 4, 4, 2, 8, 4])
    expect(song.order).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(songBars(song)).toBe(56)
  })
  it('qué lleva cada célula', () => {
    expect(kinds('Intro')).toEqual([])
    expect(kinds('Despierta')).toEqual(['hh', 'mel'])
    expect(kinds('Entra el ritmo')).toEqual(['bd', 'hh', 'mel'])
    expect(kinds('Dembow')).toEqual(['bd', 'sd', 'hh']) // la melodía clara viene del grupo del Himno
    expect(kinds('Subida')).toEqual(['sd', 'hh', 'mel']) // sin bombo, con el puente
    expect(kinds('Riser')).toEqual(['sd', 'mel', 'mel']) // caja, ruido y pad
    expect(kinds('Subidón')).toEqual(['bd', 'sd', 'hh', 'mel']) // + el platillo
    expect(kinds('Break')).toEqual(['mel'])
    expect(kinds('Subidón 2')).toEqual(['bd', 'sd', 'hh', 'mel', 'mel']) // + el platillo y el pad de las raíces
    expect(kinds('Final')).toEqual([])
  })
  it('partes del fondo: acordes siempre; el bajo desde el Dembow, y en los risers, el Break y el Final no suena', () => {
    expect(songCells.map((c) => [c.name, c.parts.bass, c.parts.chords])).toEqual([
      ['Intro', false, true], ['Despierta', false, true], ['Entra el ritmo', false, true], ['Dembow', true, true], ['Subida', true, true], ['Riser', false, false],
      ['Subidón', true, true], ['Break', false, true], ['Subida 2', true, true], ['Riser 2', false, false], ['Subidón 2', true, true], ['Final', false, true],
    ])
  })
  it('el filtro: suave en la intro, se abre en las subidas y los risers, se cierra al final; el resto sin él', () => {
    expect(songCells.map((c) => c.lpf)).toEqual([
      [800, 900, 1000, 1200], undefined, undefined, undefined, [600, 1000, 2000, 6000], [3000, 12000],
      undefined, [1200, 1800, 2800, 4200], [1000, 2000, 4000, 8000], [3000, 12000], undefined, [1800, 1100, 650, 350],
    ])
  })
  it('el wowo: en las dos subidas (house y acid); el motor admite 4', () => {
    expect(songCells.filter((c) => c.wow).map((c) => c.name)).toEqual(['Subida', 'Subida 2'])
  })
  it('la melodía lejana es un pad y la clara un lead; la caja de la subida es un loop de 4 compases', () => {
    const mel = (n: string) => byName(n).loops.find((l) => l.instrument === 'mel')!
    expect([mel('Despierta').synth, mel('Entra el ritmo').synth]).toEqual(['pad', 'pad'])
    for (const g of song.groups) for (const c of g.order) expect(song.cells.find((x) => x.id === c)!.loops.map((l) => [l.instrument, l.synth])).toEqual([['mel', 'lead']])
    const roll = byName('Subida').loops.find((l) => l.instrument === 'sd')!
    expect(roll.bars).toBe(4)
    expect(roll.hits).toHaveLength(4 + 8 + 16 + 16)
  })
  it('el redoble de caja al final de cada 4 compases (Dembow y Subidón) y el platillo al entrar el drop', () => {
    const sd = byName('Dembow').loops.find((l) => l.instrument === 'sd')!
    expect(sd.bars).toBe(4)
    const inBar = (b: number) => sd.hits.filter((h) => h.pos >= b * 16 && h.pos < b * 16 + 16).map((h) => h.pos - b * 16)
    expect([0, 1, 2].map(inBar)).toEqual(Array(3).fill([3, 6, 11, 14]))
    expect(inBar(3)).toEqual([3, 6, 11, 12, 13, 14, 15]) // el redoble desde el paso 11
    expect(byName('Subidón').loops.some((l) => l.synth === 'crash')).toBe(true)
    expect(byName('Subidón 2').loops.some((l) => l.synth === 'crash')).toBe(true)
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

describe('los dos grupos en paralelo del Himno (spec 005, §22)', () => {
  const cellOf = (id: number) => song.cells.find((c) => c.id === id)!
  const names = (g: (typeof song.groups)[number]) => g.order.map((id) => cellOf(id).name)
  it('dos grupos de 2 células de 4 compases: A, A′ (claros) y A↑, A′↑ (una octava más aguda); 12 + 4 = 16 células', () => {
    expect(song.groups).toHaveLength(2)
    expect(names(song.groups[0]!)).toEqual(['Himno A', 'Himno A2'])
    expect(names(song.groups[1]!)).toEqual(['Himno A agudo', 'Himno A2 agudo'])
    for (const g of song.groups) expect(g.order.map((id) => cellOf(id).turns)).toEqual([4, 4])
    expect(song.groups.every((g) => !g.on)).toBe(true) // los encienden las células, no Play
    expect(song.cells).toHaveLength(16)
    expect(song.nextCellId).toBe(17)
  })
  it('el Dembow enciende el primero y la Subida lo apaga; cada Subidón enciende el segundo; el Break y el Final lo apagan', () => {
    const t = (n: string) => groupTriggers(song, song.cells.find((c) => c.name === n)!.id)
    expect(t('Dembow')).toEqual({ on: [1], off: [] })
    expect(t('Subida')).toEqual({ on: [], off: [1] })
    expect(t('Subidón')).toEqual({ on: [2], off: [] })
    expect(t('Subidón 2')).toEqual({ on: [2], off: [] })
    expect(t('Break')).toEqual({ on: [], off: [2] })
    expect(t('Final')).toEqual({ on: [], off: [2] })
    for (const n of ['Intro', 'Despierta', 'Entra el ritmo', 'Riser', 'Subida 2', 'Riser 2']) expect(t(n)).toEqual({ on: [], off: [] })
  })
  it('lo que dura cada grupo cubre justo su tramo: Dembow (8) y cada Subidón (8)', () => {
    const lasts = (n: string) => song.cells.find((c) => c.name === n)!.turns
    expect(song.groups[0]!.order.length * 4).toBe(lasts('Dembow'))
    expect(song.groups[1]!.order.length * 4).toBe(lasts('Subidón'))
    expect(song.groups[1]!.order.length * 4).toBe(lasts('Subidón 2'))
  })
  it('las frases de los grupos van sin filtro (el puente, con su wowo, es de la célula Subida)', () => {
    for (const g of song.groups) for (const id of g.order) expect(cellOf(id).lpf).toBeUndefined()
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

describe('el código que sale, evaluado en Strudel (56 ciclos)', async () => {
  const ev = await events(code(), 56)
  const inCycles = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to)
  const countBy = (list: Ev[], key: string) => list.filter((e) => e.value.s === key).length
  const perCycle = (key: string, from: number, to: number) => Array.from({ length: to - from }, (_, i) => countBy(inCycles(from + i, from + i + 1), key))
  const notesOf = (s: string, from: number, to: number) => inCycles(from, to).filter((e) => e.value.s === s).map((e) => noteToMidi(String(e.value.note)))
  // dónde empieza cada célula (compases): Intro 0, Despierta 4, Entra 8, Dembow 12, Subida 20, Riser 24, Subidón 26, Break 34, Subida 2 38, Riser 2 42, Subidón 2 44, Final 52

  it('empieza con la sintaxis de la demo del dembow', () => {
    expect(code().startsWith('setcpm(120/4)\n')).toBe(true)
    expect(code()).toContain('arrange(')
    expect(code()).toContain('.bank("RolandTR808")')
  })
  it('Intro (0–3) y Final (52–55): solo los acordes (nada de batería ni de melodía)', () => {
    for (const [from, to] of [[0, 4], [52, 56]] as const) {
      const sounds = new Set(inCycles(from, to).map((e) => String(e.value.s)))
      expect([...sounds]).toEqual(['triangle'])
    }
  })
  it('Despierta (4–7): + platillo en corcheas y la melodía lejana (pad)', () => {
    expect(perCycle('hh', 4, 8)).toEqual([8, 8, 8, 8])
    expect(countBy(inCycles(4, 8), 'bd')).toBe(0)
    expect(notesOf('supersaw', 4, 8)).toEqual(ODE_A.map((x) => x[2]))
  })
  it('Entra el ritmo (8–11): + bombo a negras', () => {
    expect(perCycle('bd', 8, 12)).toEqual([4, 4, 4, 4])
    expect(countBy(inCycles(8, 12), 'sd')).toBe(0)
  })
  it('Dembow (12–19): + bajo, caja 3 6 11 14 con redoble en el 4.º compás, platillo en semicorcheas y el Himno claro: A y A′', () => {
    expect(perCycle('sd', 12, 20)).toEqual([4, 4, 4, 7, 4, 4, 4, 7])
    expect(perCycle('hh', 12, 20)).toEqual(Array(8).fill(16))
    expect(perCycle('bd', 12, 20)).toEqual(Array(8).fill(4))
    expect(perCycle('sawtooth', 12, 20)).toEqual(Array(8).fill(4)) // el bajo: 4 notas por compás
    expect(notesOf('square', 12, 20)).toEqual([...ODE_A, ...ODE_A2].map((x) => x[2]))
    const sdSteps = inCycles(12, 13).filter((e) => e.value.s === 'sd').map((e) => Math.round((e.begin - 12) * 16))
    expect(sdSteps).toEqual([3, 6, 11, 14])
    expect(countBy(inCycles(0, 12), 'sawtooth')).toBe(0) // antes no hay bajo
  })
  it('el bombo 808 va afinado a la raíz del acorde: mi (si) y do (sol) en compases alternos', () => {
    expect(STYLE_MUSIC.dembow.kickTune).toBe('<e2 c2>')
    // el sample suena a ≈ 50 Hz = midi 31,4; midi(nota) − 36 lo mueve: e2 (40) → +4 = 35,4 ≈ si1 (35); c2 (36) → 31,4 ≈ sol1 (31)
    expect(noteToMidi('e2') - 36 + 31.4).toBeCloseTo(35, 0)
    expect(noteToMidi('c2') - 36 + 31.4).toBeCloseTo(31, 0)
    const note = (bar: number) => [...new Set(inCycles(bar, bar + 1).filter((e) => e.value.s === 'bd').map((e) => String(e.value.note)))]
    expect([8, 9, 10, 11].map(note)).toEqual([['e2'], ['c2'], ['e2'], ['c2']])
  })
  it('Subida (20–23): sin bombo, la caja se acelera (4, 8, 16, 16 golpes) y suena el puente (B) con el wowo', () => {
    expect(countBy(inCycles(20, 24), 'bd')).toBe(0)
    expect(perCycle('sd', 20, 24)).toEqual([4, 8, 16, 16])
    expect(notesOf('square', 20, 24)).toEqual(ODE_B.map((x) => x[2]))
    expect(inCycles(20, 24).filter((e) => e.value.s === 'square').every((e) => e.value.resonance === 6 && e.value.lpenv === 2.5)).toBe(true)
  })
  it('Riser (24–25): ruido, pad y caja; el último compás en silencio; y el drop cae justo después', () => {
    expect(countBy(inCycles(24, 25), 'pink') > 0 && countBy(inCycles(24, 25), 'supersaw') > 0).toBe(true)
    expect(perCycle('sd', 24, 26)).toEqual([16, 0])
    expect(inCycles(25, 26)).toEqual([])
    expect(countBy(inCycles(26, 27), 'bd')).toBe(4)
  })
  it('Subidón (26–33): todo, con el platillo al entrar y el Himno una octava más aguda: A↑ y A′↑', () => {
    expect(perCycle('bd', 26, 34)).toEqual(Array(8).fill(4))
    expect(perCycle('sd', 26, 34)).toEqual([4, 4, 4, 7, 4, 4, 4, 7])
    expect(perCycle('sawtooth', 26, 34)).toEqual(Array(8).fill(4))
    expect(notesOf('square', 26, 34)).toEqual([...ODE_A, ...ODE_A2].map((x) => x[2] + 12))
    expect([26, 30].map((b) => countBy(inCycles(b, b + 1), 'white') > 0)).toEqual([true, true]) // el platillo al entrar y a los 4
    expect([27, 28, 29].map((b) => countBy(inCycles(b, b + 1), 'white'))).toEqual([0, 0, 0])
  })
  it('Break (34–37): un respiro, sin batería ni bajo; Subida 2 (38–41) vuelve con el roll y el wowo acid', () => {
    expect(countBy(inCycles(34, 38), 'bd') + countBy(inCycles(34, 38), 'sd') + countBy(inCycles(34, 38), 'sawtooth')).toBe(0)
    expect(countBy(inCycles(34, 38), 'supersaw')).toBeGreaterThan(0) // el Himno en pad
    expect(perCycle('sd', 38, 42)).toEqual([4, 8, 16, 16])
    expect(inCycles(38, 42).filter((e) => e.value.s === 'square').every((e) => e.value.resonance === 8 && e.value.lpenv === 3)).toBe(true)
  })
  it('Riser 2 (42–43): el último compás en silencio; Subidón 2 (44–51): más fuerte, con el pad de las raíces', () => {
    expect(inCycles(43, 44)).toEqual([])
    expect(countBy(inCycles(42, 43), 'pink')).toBeGreaterThan(0)
    expect(perCycle('bd', 44, 52)).toEqual(Array(8).fill(4))
    // el pad de las raíces (supersaw: si3, sol3 en compases alternos) solo en el drop final
    expect(countBy(inCycles(26, 34), 'supersaw')).toBe(0)
    expect(notesOf('supersaw', 44, 48).slice(0, 4)).toEqual([59, 55, 59, 55])
    expect([44, 48].map((b) => countBy(inCycles(b, b + 1), 'white') > 0)).toEqual([true, true])
  })
  it('el filtro por vuelta: intro suave, subidas que se abren, final que se cierra; el resto, el de siempre', () => {
    const chordCutoffs = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => inCycles(from + i, from + i + 1).find((e) => e.value.s === 'triangle')!.value.cutoff)
    expect(chordCutoffs(0, 4)).toEqual([800, 900, 1000, 1200])
    expect(chordCutoffs(4, 20)).toEqual(Array(16).fill(2000))
    expect(chordCutoffs(20, 24)).toEqual([600, 1000, 2000, 6000])
    expect(chordCutoffs(26, 34)).toEqual(Array(8).fill(2000))
    expect(chordCutoffs(34, 38)).toEqual([1200, 1800, 2800, 4200])
    expect(chordCutoffs(38, 42)).toEqual([1000, 2000, 4000, 8000])
    expect(chordCutoffs(52, 56)).toEqual([1800, 1100, 650, 350])
    // el bajo, fuera del filtro de las subidas (el wowo solo afecta a la melodía), conserva el suyo
    expect(new Set(inCycles(20, 24).filter((e) => e.value.s === 'sawtooth').map((e) => e.value.cutoff))).toEqual(new Set([350]))
  })
})

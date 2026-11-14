import { describe, expect, it } from 'vitest'
import { isSong, MAX_CELLS, normalizeSong, songBars } from '../../app/lib/cells'
import { groupSchedule, songCode, type SongState } from '../../app/lib/song'
import { remixBars, remixById } from '../../app/lib/remixes'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { events } from '../helpers/strudelEval'

const remix = remixById('sinfonia-40-techno')!
const song = remix.build()
const byName = (n: string) => song.cells.find((c) => c.name === n)!
const songCells = () => song.order.map((id) => song.cells.find((c) => c.id === id)!)
const state = (): SongState => ({
  loops: [], style: remix.style, kit: remix.kit, background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false,
  fx: { filter: 1, space: 0, warmth: 0 }, cells: { list: song.cells, order: song.order, window: [] },
  groups: { list: song.cells, items: song.groups.map((g) => ({ id: g.id, order: g.order, window: [] })) },
})
const code = () => songCode(state(), 'display')
/** compás de inicio de cada célula de la canción */
const starts = () => {
  let bar = 0
  const out: Record<string, [number, number]> = {}
  for (const c of songCells()) {
    out[c.name] = [bar, bar + c.turns]
    bar += c.turns
  }
  return out
}

describe('el remix de la Sinfonía n.º 40 de Mozart en techno (spec 008, §12)', () => {
  it('es de Mozart, dominio público, en techno con el kit Electrónico y en do menor', () => {
    expect(remix).toMatchObject({ title: 'Sinfonía n.º 40', composer: 'Wolfgang Amadeus Mozart', years: '1756–1791', style: 'techno', kit: 'electro', key: 'Do menor' })
    expect(remix.publicDomain).toMatch(/dominio público/)
    expect(remix.publicDomain).toMatch(/sol menor a do menor/)
  })
  it('doce células de la canción en la estructura pedida, 126 compases (≈ 3 min 56 s a 128 bpm)', () => {
    expect(songCells().map((c) => [c.name, c.turns])).toEqual([
      ['Intro', 16], ['Entra el tema', 16], ['Groove', 16], ['Break', 8], ['Build', 8], ['Riser', 4], ['Drop 1', 16], ['Break corto', 4], ['Build 2', 4], ['Riser 2', 2], ['Drop 2', 16], ['Salida', 16],
    ])
    expect(remixBars(remix)).toBe(126)
    expect(songBars(song)).toBe(126)
    const seconds = 126 * 16 * (60 / 128 / 4)
    expect(seconds).toBeGreaterThan(180)
    expect(seconds).toBeLessThan(240)
  })
  it('cabe en el modelo: 12 + 4 células de los grupos = 16 (el máximo), la canción es válida y da la vuelta por JSON', () => {
    expect(song.cells).toHaveLength(16)
    expect(song.cells.length).toBeLessThanOrEqual(MAX_CELLS)
    expect(isSong(song)).toBe(true)
    expect(isSong(normalizeSong(JSON.parse(JSON.stringify(song))))).toBe(true)
  })
  it('dos bloques de 16 compases por cada uno de los dos drops y de la entrada: Intro → tema → Groove → Break → Build → Riser → Drop 1 → … → Drop 2 → Salida', () => {
    const names = songCells().map((c) => c.name)
    for (const [a, b] of [['Break', 'Build'], ['Build', 'Riser'], ['Riser', 'Drop 1'], ['Break corto', 'Build 2'], ['Build 2', 'Riser 2'], ['Riser 2', 'Drop 2'], ['Drop 2', 'Salida']]) {
      expect(names.indexOf(b!) - names.indexOf(a!), `${a} → ${b}`).toBe(1)
    }
    for (const n of ['Intro', 'Entra el tema', 'Groove', 'Drop 1', 'Drop 2', 'Salida']) expect(byName(n).turns, n).toBe(16)
    expect(byName('Break').turns).toBe(8)
    expect(byName('Build').turns).toBe(8)
  })
  it('cada bloque cambia algo: lo que entra y sale', () => {
    const has = (n: string, k: string) => byName(n).loops.some((l) => l.instrument === k)
    expect(['bd', 'sd', 'hh'].map((k) => has('Intro', k))).toEqual([true, false, false]) // solo el bombo
    expect(byName('Intro').lpf).toHaveLength(16) // y el filtro se abre a partir del compás 9
    expect(byName('Intro').lpf!.slice(0, 8)).toEqual([200, 200, 200, 200, 260, 260, 260, 260])
    expect(byName('Intro').lpf!.at(-1)).toBe(20000)
    expect(byName('Entra el tema').parts.bass).toBe(true)
    expect(byName('Entra el tema').wow).toBeDefined()
    expect(has('Break', 'bd')).toBe(false) // sin bombo
    expect(has('Build', 'bd')).toBe(false)
    expect(byName('Drop 1').parts).toEqual({ bass: true, chords: true })
    expect(byName('Drop 2').loops.length).toBeGreaterThan(byName('Drop 1').loops.length) // «más fuerte»: más capas
    expect(byName('Salida').parts).toEqual({ bass: false, chords: true })
  })
  it('el tema va en grupos en paralelo que avanzan entero: A, B (plano) en el Groove, y una octava más alta en cada drop', () => {
    expect(song.groups).toHaveLength(2)
    const g1 = song.groups[0]!
    const g2 = song.groups[1]!
    const mel = (id: number) => song.cells.find((c) => c.id === id)!.loops.find((l) => l.instrument === 'mel')!
    expect(g1.order.map((id) => song.cells.find((c) => c.id === id)!.name)).toEqual(['Tema A', 'Tema B'])
    expect(g2.order.map((id) => song.cells.find((c) => c.id === id)!.name)).toEqual(['Tema A↑', 'Tema B↑'])
    // una octava más alta
    expect(mel(g2.order[0]!).hits.map((h) => h.midi)).toEqual(mel(g1.order[0]!).hits.map((h) => (h.midi as number) + 12))
    // se encienden con el Groove y con cada drop, y se apagan en el Break y los siguientes
    expect(byName('Groove').groupOn).toEqual([g1.id])
    expect(byName('Break').groupOff).toEqual([g1.id])
    expect(byName('Drop 1').groupOn).toEqual([g2.id])
    expect(byName('Drop 2').groupOn).toEqual([g2.id])
    expect(byName('Break corto').groupOff).toEqual([g2.id])
    expect(byName('Salida').groupOff).toEqual([g2.id])
    expect(song.groups.every((g) => !g.on)).toBe(true)
    // el tema de A y de B, en 4 compases cada uno y por vueltas: 16 compases de Groove = A B A B
    expect(g1.order.length * 4).toBe(8)
    expect(groupSchedule({ list: song.cells, order: song.order }, g1.id)).toEqual({ lead: 32, span: 16, total: 126 })
  })
  it('el tema: la célula «mi♭ re re» (en do menor: la♭ sol sol), el salto de sexta, todo en do menor (con sensible)', () => {
    const a = byName('Entra el tema').loops.find((l) => l.instrument === 'mel')!
    const notes = a.hits.map((h) => h.midi as number)
    expect(notes.slice(0, 6)).toEqual([68, 67, 67, 68, 67, 67]) // la♭ sol sol · la♭ sol sol
    expect(notes.slice(9, 11)).toEqual([75, 74]) // el salto: mi♭ re (era si♭ la)
    expect(a.bars).toBe(4)
    for (const h of a.hits) expect(h.pos + (h.dur as number)).toBeLessThanOrEqual(64)
    // do menor: la escala natural y la sensible (si natural, de la menor armónica del tema)
    const scale = new Set([...STYLE_MUSIC.techno.scale, 11])
    for (const c of song.cells) for (const h of c.loops.filter((l) => l.instrument === 'mel' && l.synth !== 'riser' && l.synth !== 'crash').flatMap((l) => l.hits)) {
      if (c.name.startsWith('Riser')) continue
      expect(scale.has((h.midi as number) % 12), `${c.name} ${h.midi}`).toBe(true)
    }
  })
  it('máximo 4 células con wowo y los 4 tipos de sinte nuevos (ruido y platillo) solo donde toca', () => {
    expect(song.cells.filter((c) => c.wow).map((c) => c.name)).toEqual(['Entra el tema', 'Build', 'Build 2'])
    const synths = (n: string) => byName(n).loops.filter((l) => l.instrument === 'mel').map((l) => l.synth)
    expect(synths('Drop 1')).toContain('crash')
    expect(synths('Drop 2')).toContain('crash')
    expect(synths('Riser')).toContain('riser')
    expect(synths('Groove')).not.toContain('crash')
  })
  it('el kickTune encaja: el bombo sigue las raíces de los acordes de la tonalidad del remix (Cm A♭ B♭ Gm)', () => {
    expect(STYLE_MUSIC.techno.kickTune).toBe('<c2 ab1 bb1 g1>')
    expect(STYLE_MUSIC.techno.chordTones.map((t) => t[0])).toEqual([0, 8, 10, 7]) // c, a♭, b♭, g
  })
})

describe('el código mostrado del Mozart se evalúa en Strudel y suena como se dijo', () => {
  it('lleva el kit Electrónico (sin .bank()), el bombo afinado, el wowo y se evalúa entero', async () => {
    const c = code()
    expect(c.startsWith('setcpm(128/4)\n')).toBe(true)
    expect(c).not.toContain('.bank(')
    expect(c).toContain('.note("<c2 ab1 bb1 g1>")')
    expect(c).toContain('.lpq(8).lpenv(3)') // el wowo acid de la entrada
    const ev = await events(c, 126)
    expect(ev.length).toBeGreaterThan(1000)
  })
  it('el bombo afinado: c, la♭, si♭, sol por compás; el Intro solo con bombo; el Break y el Build sin él', async () => {
    const ev = await events(code(), 126)
    const s = starts()
    const kicks = ev.filter((e) => e.value.s === 'bd')
    const noteIn = (bar: number) => [...new Set(kicks.filter((e) => Math.floor(e.begin) === bar).map((e) => String(e.value.note)))]
    // el ciclo del bombo y el de los acordes empiezan juntos en cada sección: c2 ab1 bb1 g1
    expect([0, 1, 2, 3, 4].map((k) => noteIn(s['Intro']![0] + k))).toEqual([['c2'], ['ab1'], ['bb1'], ['g1'], ['c2']])
    const inRange = (from: number, to: number, key: string) => ev.filter((e) => e.begin >= from && e.begin < to && e.value.s === key).length
    expect(inRange(...s['Intro']!, 'sd') + inRange(...s['Intro']!, 'hh')).toBe(0)
    expect(inRange(...s['Break']!, 'bd')).toBe(0)
    expect(inRange(...s['Build']!, 'bd')).toBe(0)
    expect(inRange(...s['Drop 1']!, 'bd')).toBe(16 * 4)
    expect(inRange(...s['Drop 2']!, 'bd')).toBe(16 * 4)
  })
  it('el redoble de caja al final de cada 4 compases y el platillo al entrar cada drop', async () => {
    const ev = await events(code(), 126)
    const s = starts()
    const at = (from: number, to: number, key: string) => ev.filter((e) => e.begin >= from && e.begin < to && e.value.s === key)
    const d1 = s['Drop 1']![0]
    // el 4.º compás del loop: palmada en el 2 y redoble (4 semicorcheas) desde el paso 12: en el compás 4 hay 1 + 4 = 5 golpes de caja, en los demás 2
    expect([0, 1, 2, 3].map((k) => at(d1 + k, d1 + k + 1, 'sd').length)).toEqual([2, 2, 2, 5])
    // el platillo (ruido blanco) en el primer compás de cada 4 del drop, y no en medio
    for (const k of [0, 4, 8, 12]) expect(at(d1 + k, d1 + k + 1, 'white').length, `compás ${k}`).toBeGreaterThan(0)
    for (const k of [1, 2, 3, 5]) expect(at(d1 + k, d1 + k + 1, 'white').length, `compás ${k}`).toBe(0)
    const d2 = s['Drop 2']![0]
    expect(at(d2, d2 + 1, 'white').length).toBeGreaterThan(0)
  })
  it('los dos risers: el último compás en silencio total, y el drop cae justo después', async () => {
    const ev = await events(code(), 126)
    const s = starts()
    const bar = (b: number) => ev.filter((e) => e.begin >= b && e.begin < b + 1)
    const [r1, r1end] = s['Riser']!
    expect(bar(r1end - 1)).toEqual([]) // compás 67
    expect(bar(r1).some((e) => e.value.s === 'pink')).toBe(true)
    expect(bar(s['Drop 1']![0]).some((e) => e.value.s === 'bd')).toBe(true)
    const [r2, r2end] = s['Riser 2']!
    expect(r2end - r2).toBe(2)
    expect(bar(r2end - 1)).toEqual([])
    expect(bar(s['Drop 2']![0]).some((e) => e.value.s === 'bd')).toBe(true)
  })
  it('sidechain bombo–bajo en los drops: el bombo lleva duckorbit hacia el bajo y los acordes, y el bajo suena', async () => {
    const c = code()
    expect(c).toContain('.duckorbit("2:3')
    const ev = await events(c, 126)
    const s = starts()
    expect(ev.filter((e) => e.begin >= s['Drop 1']![0] && e.begin < s['Drop 1']![1] && e.value.s === 'sawtooth').length).toBeGreaterThan(0)
  })
  it('el tema avanza entero: en el Groove suena A, B, A, B (el lead en grupo) sin repetir el mismo trozo', async () => {
    const ev = await events(code(), 126)
    const s = starts()
    const [g0] = s['Groove']!
    const lead = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to && e.value.s === 'square')
    // compases 0–3 del Groove = A (empieza la♭ sol sol), 4–7 = B; las dos mitades no son iguales
    const first = (from: number) => lead(from, from + 4).map((e) => String(e.value.note))
    expect(first(g0).slice(0, 3)).toEqual(['ab4', 'g4', 'g4'])
    expect(first(g0)).not.toEqual(first(g0 + 4))
    expect(first(g0)).toEqual(first(g0 + 8)) // vuelve A
    // y en el Drop 1 el tema entra una octava más alto (la♭5 sol5 sol5…)
    const d1 = s['Drop 1']![0]
    expect(lead(d1, d1 + 4).map((e) => String(e.value.note)).slice(0, 3)).toEqual(['ab5', 'g5', 'g5'])
  })
})

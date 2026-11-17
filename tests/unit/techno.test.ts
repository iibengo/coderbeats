import { describe, expect, it } from 'vitest'
import { isSong, normalizeSong, songBars } from '../../app/lib/cells'
import { remixBars, remixById } from '../../app/lib/remixes'
import { songCode, type SongState } from '../../app/lib/song'
import { STYLES } from '../../app/lib/constants'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { isWow, WOW_LIMITS, WOW_PRESETS, wowCode, wowControls } from '../../app/lib/wow'
import { events } from '../helpers/strudelEval'

const remix = remixById('dies-irae-techno')!
const song = remix.build()
const byName = (n: string) => song.cells.find((c) => c.name === n)!
const songCells = () => song.order.map((id) => song.cells.find((c) => c.id === id)!)
const code = () =>
  songCode(
    {
      loops: [], style: remix.style, kit: remix.kit, background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false,
      fx: { filter: 1, space: 0, warmth: 0 }, cells: { list: song.cells, order: song.order, window: [] },
      groups: { list: song.cells, items: song.groups.map((g) => ({ id: g.id, order: g.order, window: [] })) },
    } satisfies SongState,
    'display',
  )

describe('el estilo techno (spec 008, §9)', () => {
  it('128 bpm, do menor, kit 909 en el remix', () => {
    expect(STYLES.techno).toMatchObject({ label: 'Techno', bpm: 128, quantizeEvery: 1 })
    expect(STYLE_MUSIC.techno.key).toBe('do menor')
    expect(STYLE_MUSIC.techno.scale).toEqual([0, 2, 3, 5, 7, 8, 10])
  })
  it('el bajo a corcheas y los acordes en la escala', () => {
    const bass = STYLE_MUSIC.techno.background.bass
    expect(bass.notes.map((n) => n.pos)).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    expect(new Set(bass.notes.map((n) => n.note))).toEqual(new Set(['c2']))
    for (const tones of STYLE_MUSIC.techno.chordTones) for (const t of tones) expect(STYLE_MUSIC.techno.scale).toContain(t)
  })
})

describe('el wowo (Cell.wow)', () => {
  it('valida los cuatro números en rango', () => {
    expect(isWow(WOW_PRESETS.acid)).toBe(true)
    for (const bad of [null, 3, 'acid', {}, { ...WOW_PRESETS.acid, q: -1 }, { ...WOW_PRESETS.acid, depth: 9 }, { ...WOW_PRESETS.acid, decay: 0 }, { ...WOW_PRESETS.acid, attack: NaN }])
      expect(isWow(bad)).toBe(false)
  })
  it('el código es Strudel normal, y sin wowo no sale nada', () => {
    expect(wowCode(WOW_PRESETS.acid)).toBe('.lpq(8).lpenv(3).lpa(0.005).lpd(0.15)')
    expect(wowCode(undefined)).toBe('')
    expect(wowCode({ depth: 99, q: 99, attack: 0, decay: 0 })).toBe('')
    expect(wowControls({ depth: 2.456, q: 7.1234, attack: 0.01, decay: 0.5 })).toEqual({ lpq: 7.12, lpenv: 2.46, lpa: 0.01, lpd: 0.5 })
    // acotado: nada se escribe tal cual
    expect(wowControls({ depth: WOW_LIMITS.depth[0], q: WOW_LIMITS.q[1], attack: WOW_LIMITS.attack[0], decay: WOW_LIMITS.decay[1] })).toEqual({ lpq: 20, lpenv: 0.5, lpa: 0.001, lpd: 2 })
  })
  it('una canción con wowo se valida, y sin wowo no cambia nada', () => {
    expect(isSong(song)).toBe(true)
    expect(isSong(JSON.parse(JSON.stringify(song)))).toBe(true)
    const bad = JSON.parse(JSON.stringify(song))
    bad.cells[2].wow = { nope: true }
    expect(isSong(bad)).toBe(false)
    // al normalizar, un wowo inválido se descarta (el filtro se queda como estaba) en vez de tirar la canción
    const n = normalizeSong(bad)
    expect(n.cells[2].wow).toBeUndefined()
    expect(isSong(n)).toBe(true)
  })
})

describe('el remix Dies Irae en techno', () => {
  it('11 células, 56 compases, en el orden de la historia', () => {
    expect(remixBars(remix)).toBe(56)
    expect(songBars(song)).toBe(56)
    expect(songCells().map((c) => [c.name, c.turns])).toEqual([
      ['Pulso', 4], ['Hats', 4], ['Entra el tema', 8], ['Build', 8], ['Riser', 4], ['DROP', 8], ['Groove', 4], ['Build 2', 4], ['Riser 2', 2], ['DROP 2', 8], ['Salida', 2],
    ])
  })
  it('entra poco a poco: pulso → hats → tema con wowo → build sin bombo → drop con bajo y acordes', () => {
    const parts = (n: string) => byName(n).parts
    expect(parts('Pulso')).toEqual({ bass: true, chords: false })
    expect(parts('Hats')).toEqual({ bass: true, chords: false })
    expect(parts('Entra el tema')).toEqual({ bass: true, chords: false }) // el bajo va por fuera del filtro del wowo
    expect(parts('Groove')).toEqual({ bass: true, chords: false })
    expect(parts('Build')).toEqual({ bass: true, chords: false }) // el build se queda sin bombo
    expect(parts('DROP')).toEqual({ bass: true, chords: true })
    expect(parts('Salida')).toEqual({ bass: false, chords: true })
  })
  it('el wowo va en las células de entrada y en los dos builds, con el filtro subiendo', () => {
    for (const n of ['Entra el tema', 'Build', 'Groove', 'Build 2']) expect(byName(n).wow, n).toBeDefined()
    for (const n of ['Pulso', 'Hats', 'DROP', 'DROP 2', 'Salida']) expect(byName(n).wow, n).toBeUndefined()
    const buildLpf = byName('Build').lpf!
    expect(buildLpf).toHaveLength(8)
    expect(buildLpf.every((v, i) => i === 0 || v > buildLpf[i - 1]!)).toBe(true) // sube vuelta a vuelta
    expect(buildLpf.at(-1)).toBe(8000)
  })
  it('la melodía: la nota repetida del Dies Irae y todas las notas en do menor (melódica)', () => {
    const mel = (n: string) => byName(n).loops.find((l) => l.instrument === 'mel')!
    expect(mel('Entra el tema').bars).toBe(4)
    expect(mel('Entra el tema').hits.map((h) => h.midi).slice(0, 4)).toEqual([53, 53, 53, 53]) // F F F F
    const scale = STYLE_MUSIC.techno.scale
    for (const c of songCells()) for (const h of c.loops.filter((l) => l.instrument === 'mel').flatMap((l) => l.hits)) expect(scale).toContain(h.midi! % 12)
  })
  it('el código mostrado lleva el wowo en la célula y se evalúa en Strudel con su filtro por vuelta', async () => {
    const c = code()
    expect(c.startsWith('setcpm(128/4)\n')).toBe(true)
    expect(c).toContain('.lpf("<500 700 900 1200 1600 2100 2800 3600>").lpq(8).lpenv(3).lpa(0.005).lpd(0.15)')
    expect(c).toContain('')
    const ev = await events(c, 56)
    // el filtro de la célula "Entra el tema" (compases 8–15) sube vuelta a vuelta, y la resonancia de cada hap es la del wowo
    const melIn = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to && e.value.s === 'square')
    const cutoffs = new Map(melIn(8, 16).map((e) => [Math.floor(e.begin - 8), e.value.cutoff]))
    // (la frase ocupa 2 de los 4 compases de su loop: en sus compases 2 y 3 no hay melodía, y no hay vuelta que contar)
    expect([...cutoffs.keys()].sort((a, b) => a - b)).toEqual([0, 1, 4, 5])
    expect([0, 1, 4, 5].map((k) => cutoffs.get(k))).toEqual([500, 700, 1600, 2100])
    expect(melIn(8, 16).every((e) => e.value.resonance === 8 && e.value.lpenv === 3)).toBe(true)
    // en el drop no hay wowo: el filtro de siempre del sintetizador (aquí, el 0.5 de superdough)
    expect([...new Set(melIn(28, 36).map((e) => e.value.cutoff))]).toEqual([1800])
  })
  it('el bajo va por fuera del filtro y del wowo: conserva su lpf, la melodía lleva el de la vuelta', async () => {
    const c = code()
    // el bajo (sawtooth) de "Entra el tema" (compases 8–15) y del build (16–23) mantiene el lpf(450) de siempre
    const ev = await events(c, 56)
    const bass = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to && e.value.s === 'sawtooth')
    expect([...new Set(bass(8, 16).map((e) => e.value.cutoff))]).toEqual([450])
    expect([...new Set(bass(16, 24).map((e) => e.value.cutoff))]).toEqual([450])
    // y la melodía sigue con el filtro por vuelta y el wowo
    const mel = ev.filter((e) => e.begin >= 8 && e.begin < 16 && e.value.s === 'square')
    expect(mel.every((e) => e.value.resonance === 8 && e.value.lpenv === 3)).toBe(true)
    // el bombo, la caja y el platillo también van limpios: sin el filtro del wowo ni su resonancia
    for (const key of ['bd', 'sd', 'hh']) {
      const hits = ev.filter((e) => e.begin >= 8 && e.begin < 16 && e.value.s === key)
      expect(hits.length, key).toBeGreaterThan(0)
      expect(hits.every((e) => e.value.cutoff === undefined && e.value.resonance === undefined), key).toBe(true)
    }
    // en el código: el bajo y la batería fuera del `stack` que lleva el filtro, que solo tiene la melodía
    const cell = c.slice(c.indexOf('// Entra el tema'), c.indexOf('// Build'))
    const filtered = cell.slice(cell.indexOf('    stack('))
    expect(cell.indexOf('sawtooth')).toBeLessThan(cell.indexOf('.lpf("<500'))
    expect(filtered).not.toMatch(/s\("[~bdsh ]+"\)/) // sin batería (sus `s("bd ~ …")`)
    expect(filtered).not.toContain('sawtooth')
    expect(filtered).toContain('square')
  })
  it('el bombo va afinado a la raíz del acorde de cada compás (Cm A♭ B♭ Gm)', async () => {
    expect(STYLE_MUSIC.techno.kickTune).toBe('<c2 ab1 bb1 g1>')
    const c = code()
    expect(c).toContain('.note("<c2 ab1 bb1 g1>")')
    const ev = await events(c, 56)
    const kicks = ev.filter((e) => e.value.s === 'bd' && e.begin >= 0 && e.begin < 8)
    const noteOf = (bar: number) => [...new Set(kicks.filter((e) => Math.floor(e.begin) === bar).map((e) => String(e.value.note)))]
    expect([0, 1, 2, 3, 4].map(noteOf)).toEqual([['c2'], ['ab1'], ['bb1'], ['g1'], ['c2']])
  })
  it('el Riser: ruido y un pad de otro color que se abren, la caja en roll y el último compás en silencio', async () => {
    const riser = byName('Riser')
    expect(riser.turns).toBe(4)
    expect(riser.parts).toEqual({ bass: false, chords: false })
    expect(riser.wow).toBeUndefined() // los 4 wowos del motor ya están en las otras células
    expect(riser.lpf).toEqual([600, 1500, 4000, 12000])
    const synths = riser.loops.filter((l) => l.instrument === 'mel').map((l) => l.synth)
    expect(synths).toEqual(['riser', 'pad']) // ruido + pad (el tema va con 'lead')
    expect(songCells().map((c) => c.name).indexOf('Riser')).toBe(songCells().map((c) => c.name).indexOf('DROP') - 1) // justo antes del drop
    const ev = await events(code(), 56)
    const at = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to)
    // compases 24–27: el ruido y el pad en los tres primeros, la caja aprieta, y el cuarto (27) en silencio total
    for (const bar of [24, 25, 26]) {
      expect(at(bar, bar + 1).some((e) => e.value.s === 'pink'), `ruido ${bar}`).toBe(true)
      expect(at(bar, bar + 1).some((e) => e.value.s === 'supersaw'), `pad ${bar}`).toBe(true)
    }
    expect(at(27, 28)).toEqual([])
    const snares = (bar: number) => at(bar, bar + 1).filter((e) => e.value.s === 'sd').length
    expect([24, 25, 26, 27].map(snares)).toEqual([8, 16, 16, 0])
    // el filtro sube compás a compás (el del ruido)
    expect([24, 25, 26].map((bar) => at(bar, bar + 1).find((e) => e.value.s === 'pink')!.value.cutoff)).toEqual([600, 1500, 4000])
    // y el drop cae justo después, con todo
    expect(at(28, 29).some((e) => e.value.s === 'bd')).toBe(true)
  })
  it('el Riser 2, la versión corta antes del DROP 2: un compás que se abre y otro en silencio', async () => {
    const r = byName('Riser 2')
    expect(r.turns).toBe(2)
    expect(r.lpf).toEqual([3000, 12000])
    expect(r.wow).toBeUndefined()
    const names = songCells().map((c) => c.name)
    expect(names.indexOf('Riser 2')).toBe(names.indexOf('DROP 2') - 1)
    const ev = await events(code(), 56)
    const at = (from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to)
    // Build 2 ocupa 40–43, el Riser 2 el 44 (suena) y el 45 (silencio), y el DROP 2 cae en el 46
    expect(at(44, 45).some((e) => e.value.s === 'pink') && at(44, 45).some((e) => e.value.s === 'supersaw')).toBe(true)
    expect(at(44, 45).filter((e) => e.value.s === 'sd')).toHaveLength(16)
    expect(at(45, 46)).toEqual([])
    expect(at(46, 47).some((e) => e.value.s === 'bd')).toBe(true)
  })
  it('el afinado deja el bombo en la raíz de cada acorde, no una octava más arriba (c2 = sin cambio; c3 = +12)', async () => {
    const { noteToMidi } = await import('@strudel/core')
    // el bombo del Electrónico (bd 0 de uzu-drumkit) suena a ≈ 63 Hz = midi 35,5 (medido); `.note(x)` lo mueve midi(x) − 36
    const KICK_MIDI = 35.5
    const roots = [36, 32, 34, 31] // do, la♭, si♭, sol (graves)
    const tune = STYLE_MUSIC.techno.kickTune!.replace(/[<>]/g, '').split(' ')
    expect(tune).toHaveLength(4)
    tune.forEach((n, i) => {
      const pitch = KICK_MIDI + (noteToMidi(n) - 36)
      expect(Math.abs(pitch - roots[i]!), n).toBeLessThanOrEqual(1) // a menos de un semitono de la raíz
    })
    expect(noteToMidi('c3') - 36).toBe(12) // la trampa: c3 sube una octava
  })
  it('la estructura suena: el build sin bombo y el drop con él', async () => {
    const ev = await events(code(), 56)
    const count = (key: string, from: number, to: number) => ev.filter((e) => e.begin >= from && e.begin < to && e.value.s === key).length
    expect(count('bd', 0, 8)).toBe(4 * 4 + 4 * 4) // Pulso y Hats: 4 por compás
    expect(count('bd', 16, 24)).toBe(0) // el Build no lleva bombo
    expect(count('bd', 24, 28)).toBe(0) // el Riser tampoco
    expect(count('bd', 28, 36)).toBe(8 * 4) // el DROP sí
    expect(count('sawtooth', 0, 8)).toBeGreaterThan(0) // el bajo a corcheas
    expect(count('sawtooth', 8, 16)).toBeGreaterThan(0) // en "Entra el tema" también hay bajo (fuera del filtro del wowo)
    expect(count('sawtooth', 16, 24)).toBeGreaterThan(0) // en el build sí
    expect(count('sawtooth', 28, 36)).toBeGreaterThan(0) // y en el drop
  })
})

describe('el motor: otra vez el remix del Himno', () => {
  it('el código del motor de una canción sin wowo no menciona el wowo y lleva el lpf de siempre en su sitio', () => {
    const himno = remixById('oda-alegria-dembow')!.build()
    // sin wowo, el lpf de la célula va con su filterHaps, como siempre
    const st: SongState = {
      loops: [], style: 'dembow', kit: '808', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 },
      cells: { list: himno.cells, order: himno.order, window: [{ cellId: himno.order[0]!, from: 0, to: 4 }, { cellId: himno.order[1]!, from: 4, to: 8 }] },
    }
    const code = songCode(st, 'engine')
    expect(code).not.toMatch(/wowo|lpq/)
    // (la ventana es la célula que suena y la siguiente: aquí la célula 2, sin lpf, con el de siempre)
    expect(code).toContain('.lpf(20000).filterHaps((h) => h.whole.begin >= 4 && h.whole.begin < 8)')
  })
  it('el código del motor del techno: wowoPlan con la marca de cada compás y los colores de las células con wowo', () => {
    const st: SongState = {
      loops: [], style: 'techno', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 },
      cells: { list: song.cells, order: song.order, window: [{ cellId: song.order[2]!, from: 8, to: 16 }] },
    }
    const engine = songCode(st, 'engine')
    // la marca por compás: ninguna en Pulso y Hats (4 + 4), el wowo de las células 3 y 4 en lo suyo, ninguna en el Riser
    expect(engine).toContain('"~@4 ~@4 3@8 4@8 ~@4 ~@8 ~@4 ~@4 ~@2 ~@8 ~@2"')
    expect(engine).toContain('{"bus":3,"wow":{"lpq":8,"lpenv":3,"lpa":0.005,"lpd":0.15},"lpf":[500,700,900,1200,1600,2100,2800,3600]}')
    // la compuerta del motor se engancha en el bus de la célula (su `bus` es el id de la célula), y el plan va en un
    // comentario (el motor no deja llamar a una función que no es de Strudel)
    expect(engine).toContain('wowPlan); esto es su plan')
    // la célula con wowo lleva su color; sin wowo, no
    expect(engine).toContain('.lpq(8).lpenv(3).lpa(0.005).lpd(0.15).color("w3")')
    expect(engine).toMatch(/\.lpf\("<500 700 900 1200 1600 2100 2800 3600>"\)\.lpq/)
    // y el color y el filtro solo van sobre la melodía: la batería queda fuera de ese `stack` (spec 008, §10)
    const cellCode = engine.slice(engine.indexOf('// Entra el tema'), engine.indexOf('.color("w3")'))
    const filtered = cellCode.slice(cellCode.lastIndexOf('    stack('))
    expect(filtered).toContain('square')
    expect(filtered).not.toMatch(/s\("[~bdsh ]+"\)/) // sin batería (sus `s("bd ~ …")`)
    expect(cellCode).toMatch(/s\("bd ~/) // la batería sigue en la célula, por fuera
  })
})

import { STYLES as ALL_STYLES } from '../../app/lib/constants'
import { DEMOS as ALL_DEMOS } from '../../app/lib/demos'
import { STYLE_MUSIC as ALL_MUSIC } from '../../app/lib/styles'
describe('house y techno nuevos (spec 023): distintos entre sí y los clásicos no cambian', () => {
  it('house2 y techno2 se diferencian por patrones, no solo por la tonalidad', () => {
    const h = ALL_MUSIC.house2
    const t = ALL_MUSIC.techno2
    expect(ALL_DEMOS.house2.sd).not.toBe(ALL_DEMOS.techno2.sd) // palmada en 2 y 4 frente a un solo golpe
    expect(ALL_DEMOS.house2.hh).not.toBe(ALL_DEMOS.techno2.hh)
    expect(h.background.bass.notes.length).toBeLessThan(t.background.bass.notes.length + 1) // bajo sincopado frente a rodante
    expect(t.background.bass.notes.length).toBe(12) // semicorcheas, sin los pasos del bombo
    expect(t.background.chords.length).toBe(1) // casi sin acordes
    expect(t.background.chords[0]).toMatch(/gain\(0\.1\)/)
    expect(h.scale).not.toEqual(t.scale)
  })
  it('tempos: house ≈ 124, techno ≈ 132; los clásicos siguen en 124 y 128', () => {
    expect([ALL_STYLES.house2.bpm, ALL_STYLES.techno2.bpm]).toEqual([124, 132])
    expect([ALL_STYLES.house.bpm, ALL_STYLES.techno.bpm]).toEqual([124, 128])
    expect(ALL_STYLES.house.legacy && ALL_STYLES.techno.legacy).toBe(true)
    expect(ALL_STYLES.house2.legacy || ALL_STYLES.techno2.legacy).toBeFalsy()
  })
  it('lo guardado con house o techno genera exactamente el mismo fondo que antes (datos clásicos intactos)', () => {
    expect(ALL_MUSIC.house.key).toBe('fa menor')
    expect(ALL_MUSIC.techno.key).toBe('do menor')
    expect(ALL_MUSIC.techno.kickTune).toBe('<c2 ab1 bb1 g1>')
    expect(ALL_MUSIC.techno.background.bass.notes.length).toBe(8)
    expect(ALL_MUSIC.house.background.bass.notes.length).toBe(4)
    const st = (style: 'techno' | 'techno2') => ({ loops: [], style, kit: 'electro' as const, background: { mode: 'manual' as const, parts: { bass: true, chords: true } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0.5 } })
    const old = songCode(st('techno'), 'display')
    expect(old).toContain('setcpm(128/4)')
    expect(old).toContain('c2')
    expect(songCode(st('techno2'), 'display')).toContain('setcpm(132/4)')
  })
})

import { DEMOS as DEMOS_R } from '../../app/lib/demos'
import { STYLE_MUSIC as MUSIC_R } from '../../app/lib/styles'
import { STYLES as STYLES_R } from '../../app/lib/constants'
import { songCode as songCodeR } from '../../app/lib/song'
import { adaptTune as adaptR, tunesFor as tunesForR } from '../../app/lib/tuneLibrary'
describe('reggaetón (spec 032)', () => {
  it('~95 bpm, sol menor, y su ritmo es el dembow pero con aire (platillo a contratiempo)', () => {
    expect(STYLES_R.reggaeton.bpm).toBe(95)
    expect(STYLES_R.reggaeton.legacy).toBeFalsy()
    expect(MUSIC_R.reggaeton.key).toBe('sol menor')
    expect(MUSIC_R.reggaeton.scale[0]).toBe(7)
    expect(DEMOS_R.reggaeton.sd).toBe(DEMOS_R.dembow.sd) // la caja del dembow
    expect(DEMOS_R.reggaeton.hh).not.toBe(DEMOS_R.dembow.hh) // pero con aire
    expect(MUSIC_R.reggaeton.background.bass.bars).toBe(4)
  })
  it('el dembow no ha cambiado (lo guardado suena igual)', () => {
    expect(STYLES_R.dembow.bpm).toBe(120)
    expect(MUSIC_R.dembow.key).toBe('si menor')
    expect(MUSIC_R.dembow.kickTune).toBe('<e2 c2>')
  })
  it('el código de una canción de reggaetón lleva su tempo y su fondo', () => {
    const st = { loops: [], style: 'reggaeton' as const, kit: '808' as const, background: { mode: 'manual' as const, parts: { bass: true, chords: true } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0.5 } }
    const c = songCodeR(st, 'display')
    expect(c).toContain('setcpm(95/4)')
    expect(c).toContain('g1')
    expect(c).toContain('g3,bb3,d4')
  })
  it('tiene melodías de dominio público que le pegan, todas dentro de su escala', () => {
    const list = tunesForR('reggaeton')
    expect(list.length).toBeGreaterThanOrEqual(2)
    for (const t of list) for (const h of adaptR(t, 'reggaeton')) expect(MUSIC_R.reggaeton.scale).toContain(h.midi % 12)
  })
})

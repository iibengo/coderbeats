import { describe, expect, it } from 'vitest'
import { DEMO_KIT, demoSong, isSong } from '../../app/lib/cells'
import { KITS, STYLES } from '../../app/lib/constants'
import { demoState } from '../../app/lib/demos'
import { assistMelody } from '../../app/lib/melodyAssist'
import { songCode, type SongState } from '../../app/lib/song'
import { STYLE_MUSIC } from '../../app/lib/styles'
import { events, type Ev } from '../helpers/strudelEval'

/** El código de la demo tal como lo escribió el usuario (2026-11-14). */
const USER_CODE = `setcpm(120/4)
const acordes = note("<[b3,d4,f#4] [g3,b3,d4]>").s("triangle").attack(0.02).release(0.4).lpf(2000).room(0.4).gain(0.3)
const bajo = note("<b1 g1>").struct("x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~").s("sawtooth").lpf(350).gain(0.5)
const bateria = stack(
  s("bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~"),
  s("~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~"),
  s("hh*16").gain(0.25),
).bank("RolandTR808")
const ambiente = stack(
  s("hh*8").gain(0.12).room(0.8),
  note("<b2 g2>").s("sine").room(0.9).gain(0.15),
)
arrange([4, ambiente], [8, stack(acordes, bajo, bateria)])`

const appCode = (): string => {
  const demo = demoSong('dembow')!
  const st: SongState = {
    loops: [],
    style: 'dembow',
    kit: DEMO_KIT.dembow!,
    background: { mode: 'manual', parts: { bass: false, chords: false } },
    metronome: false,
    fx: { filter: 1, space: 0, warmth: 0 },
    cells: { list: demo.cells, order: demo.order, window: [] },
  }
  return songCode(st, 'display')
}

const DRUMS = ['bd', 'sd', 'hh']
const r = (x: number) => Math.round(x * 1e6) / 1e6
/** Lo que tiene que coincidir: de la batería, cuándo y cuál; de lo que tiene nota, además su duración, nombre y sinte. */
const key = (e: Ev): string => {
  const s = String(e.value.s)
  return DRUMS.includes(s) ? `${r(e.begin)} bateria ${s}` : `${r(e.begin)}-${r(e.end)} ${s} ${String(e.value.note)}`
}
const keys = (evs: Ev[]) => evs.map(key).sort()

describe('estilo dembow', () => {
  it('120 bpm, semicorcheas, si menor y su kit 808', () => {
    expect(STYLES.dembow).toMatchObject({ bpm: 120, quantizeEvery: 1, label: 'Dembow' })
    expect(STYLE_MUSIC.dembow.key).toBe('si menor')
    expect(STYLE_MUSIC.dembow.scale).toEqual([11, 1, 2, 4, 6, 7, 9]) // B C# D E F# G A
    expect(DEMO_KIT.dembow).toBe('808')
    expect(KITS['808'].strudelBank).toBe('RolandTR808')
  })

  it('la rejilla de la ayuda: bombo 0 4 8 12, caja 3 6 11 14, platillo en semicorcheas', () => {
    const q = (inst: 'bd' | 'sd' | 'hh') => STYLE_MUSIC.dembow.priors[inst].map((p, i) => (p >= 0.9 ? i : -1)).filter((i) => i >= 0)
    expect(q('bd')).toEqual([0, 4, 8, 12])
    expect(q('sd')).toEqual([3, 6, 11, 14])
    expect(q('hh')).toHaveLength(16)
  })

  it('la ayuda lleva una melodía cantada a la escala de si menor', () => {
    const out = assistMelody(
      [0, 2, 4, 6].map((s, i) => ({ step: s, dur: 1.5, midi: 59 + i * 1.3, strength: 0.5 })),
      { assist: true, style: 'dembow', startBar: 0, bars: 1, register: 'lead', stepSeconds: 60 / 120 / 4 },
    )
    expect(out.length).toBeGreaterThan(2)
    for (const h of out) expect(STYLE_MUSIC.dembow.scale).toContain(h.midi % 12)
  })
})

describe('demo del dembow: "Cargar demo"', () => {
  const demo = demoSong('dembow')!

  it('dos células: Intro (4 vueltas) y Principal (8), en ese orden, y una canción válida', () => {
    expect(demo.cells.map((c) => [c.name, c.turns])).toEqual([['Intro', 4], ['Principal', 8]])
    expect(demo.order).toEqual([1, 2])
    expect(isSong(JSON.parse(JSON.stringify(demo)))).toBe(true)
  })

  it('Intro: platillo en corcheas y el sine; Principal: bombo, caja, platillo, con bajo y acordes', () => {
    const [intro, main] = demo.cells
    expect(intro!.loops.map((l) => l.instrument)).toEqual(['hh', 'mel'])
    expect(intro!.parts).toEqual({ bass: false, chords: false })
    expect(intro!.loops[0]!.hits.map((h) => h.pos)).toEqual([0, 2, 4, 6, 8, 10, 12, 14])
    expect(intro!.loops[1]).toMatchObject({ bars: 2, synth: 'drone' })
    expect(main!.loops.map((l) => l.instrument)).toEqual(['bd', 'sd', 'hh'])
    expect(main!.parts).toEqual({ bass: true, chords: true })
    expect(main!.loops.find((l) => l.instrument === 'bd')!.hits.map((h) => h.pos)).toEqual([0, 4, 8, 12])
    expect(main!.loops.find((l) => l.instrument === 'sd')!.hits.map((h) => h.pos)).toEqual([3, 6, 11, 14])
    expect(main!.loops.find((l) => l.instrument === 'hh')!.hits).toHaveLength(16)
  })

  it('la demo de una célula (sin canción) también existe, con el patrón del dembow', () => {
    const s = demoState('dembow', 1, 0)
    expect(s.loops.map((l) => l.hits.length)).toEqual([4, 4, 16])
  })

  it('el código que se enseña es un arrange de 4 y 8 vueltas con el kit 808 y el sine', () => {
    const code = appCode()
    expect(code.startsWith('setcpm(120/4)\n')).toBe(true)
    expect(code).toContain('arrange(')
    expect(code).toContain('// Intro · 4 vueltas')
    expect(code).toContain('// Principal · 8 vueltas')
    expect(code).toContain('.bank("RolandTR808")')
    expect(code).toContain('note("<[b2@16] [g2@16]>").s("sine").room(0.9)')
  })

  it('toca LO MISMO que el código original: mismos eventos en los 12 ciclos (cuándo, qué nota, qué sonido)', async () => {
    const [user, app] = await Promise.all([events(USER_CODE, 12), events(appCode(), 12)])
    const u = keys(user)
    const a = keys(app)
    const missing = u.filter((k) => !a.includes(k))
    const extra = a.filter((k) => !u.includes(k))
    expect({ missing: missing.slice(0, 8), extra: extra.slice(0, 8) }).toEqual({ missing: [], extra: [] })
    expect(a).toEqual(u)
    // y no es un resultado vacío por error
    expect(u.length).toBeGreaterThan(250)
  })

  it('lo que no se iguala son los efectos y las ganancias (documentado en la spec 005, §20)', async () => {
    const [user, app] = await Promise.all([events(USER_CODE, 12), events(appCode(), 12)])
    const hhIntroUser = user.find((e) => e.value.s === 'hh' && e.begin < 4)!
    const hhIntroApp = app.find((e) => e.value.s === 'hh' && e.begin < 4)!
    expect(hhIntroUser.value.gain).toBe(0.12)
    expect(hhIntroUser.value.room).toBe(0.8)
    expect(hhIntroApp.value.room).toBeUndefined() // la reverb por loop no existe en la app
    // los timbres sí: filtro, ataque y release de los acordes, y el filtro del bajo
    const chordUser = user.find((e) => e.value.note === 'b3')!.value
    const chordApp = app.find((e) => e.value.note === 'b3')!.value
    for (const k of ['s', 'attack', 'release', 'cutoff', 'room'] as const) expect(chordApp[k], k).toEqual(chordUser[k])
    const bassUser = user.find((e) => e.value.note === 'b1')!.value
    const bassApp = app.find((e) => e.value.note === 'b1')!.value
    for (const k of ['s', 'cutoff'] as const) expect(bassApp[k], k).toEqual(bassUser[k])
  })
})

describe('los kits (spec 010)', () => {
  it('Electrónico (uzu-drumkit) va sin .bank(); el 808 con su banco; solo dos kits en la UI', async () => {
    const { KIT_ORDER, KITS: K, kitFromSaved } = await import('../../app/lib/constants')
    expect(KIT_ORDER).toEqual(['electro', '808'])
    expect(K.electro.strudelBank).toBeNull()
    expect(K['808'].strudelBank).toBe('RolandTR808')
    // los índices son los del uzu-drumkit de strudel.cc (el orden de su strudel.json)
    expect(K.electro.sampleIndex).toEqual({ bd: 0, sd: 1, hh: 3 })
  })
  it('los kits que ya no existen pasan a Electrónico al leer lo guardado (para que no se pierdan canciones ni ajustes)', async () => {
    const { kitFromSaved } = await import('../../app/lib/constants')
    expect(kitFromSaved('909')).toBe('electro')
    expect(kitFromSaved('acoustic')).toBe('electro')
    expect(kitFromSaved('808')).toBe('808')
    expect(kitFromSaved('electro')).toBe('electro')
    expect(kitFromSaved('nope')).toBeNull()
    expect(kitFromSaved(3)).toBeNull()
    expect(kitFromSaved('toString')).toBeNull()
  })
  it('los samples del kit existen y tienen su licencia en CREDITS.md', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const credits = readFileSync('public/samples/CREDITS.md', 'utf8')
    for (const dir of readdirSync('public/samples', { withFileTypes: true }).filter((d) => d.isDirectory())) {
      for (const f of readdirSync(`public/samples/${dir.name}`)) expect(credits, `${dir.name}/${f}`).toContain(`${dir.name}/${f}`)
    }
  })
})

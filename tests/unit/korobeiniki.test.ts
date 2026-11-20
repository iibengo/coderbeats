import { describe, expect, it } from 'vitest'
import { labRemixById, LAB_REMIXES, remixBars, remixBpm, remixSeconds } from '../../app/lib/labRemixes'
import { MELODY_SYNTHS, REGISTER, SYNTH_SOUND } from '../../app/lib/melody'
import { MAX_LOOPS } from '../../app/lib/freeLoops'
import { cut, KORO_HAT, KORO_OPEN, KORO_BASS, KORO_BREAK, KORO_CLIMB, KORO_HOOK, KORO_STABS, KORO_TUNE, KORO_TUNE2, koroBass, staccato } from '../../app/lib/korobeiniki'
import { KOROBEINIKI_A, shift } from '../../app/lib/publicTunes'

const midis = (n: readonly (readonly [number, number, number])[]) => n.map((x) => x[2])
// do menor natural (la tonalidad de techno2): do re mi♭ fa sol la♭ si♭
const IN_C_MINOR = new Set([0, 2, 3, 5, 7, 8, 10])

describe('Korobeiniki en techno: el arreglo propio (spec 053)', () => {
  it('cut recorta por pasos y cuenta desde el principio', () => {
    expect(cut([[0, 4, 60], [4, 8, 62], [12, 4, 64]], 4, 12)).toEqual([[0, 8, 62]])
    expect(cut([[2, 20, 60]], 0, 8)).toEqual([[2, 6, 60]])
    expect(staccato([[0, 8, 60], [8, 1, 62]], 2)).toEqual([[0, 2, 60], [8, 1, 62]])
  })
  it('la melodía es la popular, tres semitonos más arriba (do menor) y toda dentro de la escala', () => {
    expect(midis(KORO_TUNE)).toEqual(midis(shift(KOROBEINIKI_A, 3)))
    for (const t of [KORO_HOOK, KORO_TUNE, KORO_CLIMB, KORO_TUNE2, KORO_BREAK]) for (const m of midis(t)) expect(IN_C_MINOR.has(m % 12)).toBe(true)
    // cabe en el registro del sinte agudo
    expect(Math.max(...midis(KORO_CLIMB))).toBeLessThanOrEqual(84)
  })
  it('es un arreglo propio: el tema va picado (no ligado), el gancho es un trozo y el drop 2 mezcla las dos frases', () => {
    expect(Math.max(...KORO_TUNE.map((n) => n[1]))).toBeLessThanOrEqual(2) // picado: ninguna nota pasa de 2 pasos
    expect(Math.max(...KORO_CLIMB.map((n) => n[1]))).toBeGreaterThan(2) // la subida va ligada
    expect(Math.max(...KORO_HOOK.map((n) => n[0]))).toBeLessThan(32) // el gancho: dos compases y luego aire
    expect(JSON.stringify(KORO_TUNE2)).not.toBe(JSON.stringify(KORO_TUNE))
    expect(midis(KORO_TUNE2).slice(0, 6)).toEqual(midis(KORO_TUNE).slice(0, 6)) // abre como la primera frase
    expect(midis(KORO_TUNE2).slice(6, 12)).not.toEqual(midis(KORO_TUNE).slice(6, 12)) // y sigue con la segunda
  })
  it('el bajo late a contratiempo (nunca cae en el bombo), en do menor y en su registro; los stabs, sincopados', () => {
    expect(KORO_BASS.length).toBe(16)
    for (const [p, , m] of KORO_BASS) {
      expect(p % 4).toBe(2) // entre los bombos (0, 4, 8, 12)
      expect(IN_C_MINOR.has(m % 12)).toBe(true)
      expect(m).toBeGreaterThanOrEqual(28)
      expect(m).toBeLessThanOrEqual(40)
    }
    expect(koroBass([36])).toEqual([[2, 2, 36], [6, 2, 36], [10, 2, 36], [14, 2, 36]])
    for (const [p, , m] of KORO_STABS) {
      expect([6, 14]).toContain(p % 16)
      expect(IN_C_MINOR.has(m % 12)).toBe(true)
    }
  })
})

describe('Korobeiniki en techno: el remix', () => {
  const r = labRemixById('korobeiniki-techno')!
  it('mismo id de siempre (lo guardado sigue abriendo), techno nuevo, 8 partes y ≈ 2 min', () => {
    expect(r.style).toBe('techno2')
    expect(r.kit).toBe('electro')
    expect(r.key).toBe('Do menor')
    expect(r.unverified).toBe(true) // notas de memoria
    expect(r.parts.map((p) => p.name)).toEqual(['Intro', 'Estrofa', 'Subida', 'Drop', 'Break', 'Puente', 'Drop 2', 'Final'])
    expect(r.parts.map((p) => p.bars)).toEqual([4, 8, 4, 16, 8, 4, 16, 4])
    expect(remixBars(r)).toBe(64)
    expect(remixBpm(r)).toBe(132)
    expect(remixSeconds(r)).toBeGreaterThan(110)
    expect(remixSeconds(r)).toBeLessThanOrEqual(120)
    expect(LAB_REMIXES.filter((x) => x.id === 'korobeiniki-techno')).toHaveLength(1)
  })
  it('el gancho abre y cierra, la subida cambia la melodía y cada drop trae la suya', () => {
    const theme = (n: string) => JSON.stringify(r.parts.find((p) => p.name === n)!.layers.find((l) => l.key === 'tema')!.mel![0]!.notes)
    expect(theme('Intro')).toBe(theme('Final'))
    expect(theme('Intro')).toBe(theme('Puente'))
    expect(theme('Drop')).toBe(theme('Estrofa'))
    expect(theme('Subida')).not.toBe(theme('Drop'))
    expect(theme('Drop 2')).not.toBe(theme('Drop'))
  })
  it('el fondo del estilo va apagado (el bajo y los acordes son los nuestros) y los drops llevan todo', () => {
    for (const c of r.song.cells) expect(c.parts).toEqual({ bass: false, chords: false })
    const keys = (n: string) => r.parts.find((p) => p.name === n)!.layers.map((l) => l.key)
    expect(keys('Drop')).toEqual(['ritmo', 'bajo', 'acordes', 'tema'])
    expect(keys('Subida')).not.toContain('ritmo')
    expect(keys('Intro')).toEqual(['acordes', 'tema'])
  })
})

describe('Korobeiniki en techno: el sonido (spec 056)', () => {
  const r = labRemixById('korobeiniki-techno')!
  it('sintes nuevos: están registrados y los de siempre no cambian', () => {
    for (const k of ['stabW', 'leadW'] as const) {
      expect(MELODY_SYNTHS).toContain(k)
      expect(REGISTER[k]).toBeDefined()
      expect(SYNTH_SOUND[k]).toContain('.pan(') // rebotan entre los dos lados
    }
    // los de siempre, intactos (lo guardado suena igual)
    expect(SYNTH_SOUND.lead).toBe('.s("square").lpf(1800).decay(0.2).sustain(0.5).delay(0.25)')
    expect(SYNTH_SOUND.keys).toBe('.s("triangle").fm(0.8).decay(0.5).sustain(0.15).lpf(2600).room(0.3).gain(0.4)')
    expect(SYNTH_SOUND.hat).toContain('hpf(6500)')
  })
  it('el charles tiene golpes fantasma y un redoble al final del 4.º compás; el abierto, en pasos distintos', () => {
    expect(KORO_HAT.strengths.length).toBe(KORO_HAT.notes.length)
    expect(KORO_HAT.strengths.some((x) => x <= 0.4)).toBe(true) // fantasma
    expect(KORO_HAT.strengths.some((x) => x === 1)).toBe(true)
    const last = KORO_HAT.notes.filter((n) => n[0] >= 48 + 12)
    expect(last.length).toBeGreaterThanOrEqual(4) // el redoble
    const hatPos = new Set(KORO_HAT.notes.map((n) => n[0]))
    for (const [p] of KORO_OPEN) expect(hatPos.has(p)).toBe(false) // el abierto no pisa al cerrado
  })
  it('el drop usa los sintes anchos y cabe en los 8 loops de una parte', () => {
    for (const name of ['Drop', 'Drop 2']) {
      const p = r.parts.find((x) => x.name === name)!
      expect(p.layers.find((l) => l.key === 'acordes')!.mel![0]!.synth).toBe('stabW')
      expect(p.layers.find((l) => l.key === 'tema')!.mel![0]!.synth).toBe('leadW')
      const ritmo = p.layers.find((l) => l.key === 'ritmo')!
      expect(ritmo.mel!.map((m) => m.synth).sort()).toEqual(['crash', 'hat', 'hatOpen'])
      const cell = r.song.cells[r.parts.indexOf(p)]!
      expect(cell.loops.length).toBeLessThanOrEqual(MAX_LOOPS)
    }
  })
})

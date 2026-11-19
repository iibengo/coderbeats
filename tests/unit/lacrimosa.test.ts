import { describe, expect, it } from 'vitest'
import { EIGHTH, LAC, lacSlice, parseEighths } from '../../app/lib/lacrimosa'
import { labRemixById, LAB_REMIXES, remixBars, remixBpm, remixSeconds } from '../../app/lib/labRemixes'
import { subSlide } from '../../app/lib/melodyVariants'
import { isFreeLoop } from '../../app/lib/cells'
import { songCode, type SongState } from '../../app/lib/song'
import { events } from '../helpers/strudelEval'

const midis = (n: readonly (readonly [number, number, number])[]) => n.map((x) => x[2])

describe('Lacrimosa de Mozart: los datos (spec 048)', () => {
  it('una corchea de 12/8 son 8/3 de paso; `lacSlice` corta por compases y cuenta desde el primero', () => {
    const close = (got: readonly (readonly number[])[], want: readonly (readonly number[])[]) => {
      expect(got).toHaveLength(want.length)
      got.forEach((n, i) => n.forEach((v, j) => expect(v).toBeCloseTo(want[i]![j]!, 9)))
    }
    close(parseEighths('1:1:73 4:3:60'), [[EIGHTH, EIGHTH, 73], [4 * EIGHTH, 3 * EIGHTH, 60]])
    expect(() => parseEighths('1:0:73')).toThrow()
    const cut = lacSlice(parseEighths('1:1:73 13:1:74 22:4:75'), 1, 2) // compás 2 de 12/8: corcheas 12 a 23
    close(cut, [[EIGHTH, EIGHTH, 74], [10 * EIGHTH, 2 * EIGHTH, 75]]) // la que sobrepasa el final, recortada
  })
  it('contrastado con la partitura: las 16 notas del violín I de los compases 1–2 y el soprano de los compases 3–5', () => {
    // medidas sobre la imagen de Breitkopf (IMSLP 26746): do♯5 re5 la5 si♭5 re5 do♯5 do6 si♭5 | la5 re6 si♭5 sol5 mi5 fa5 la5 do♯5
    expect(midis(lacSlice(LAC.vln1, 0, 2))).toEqual([73, 74, 81, 82, 74, 73, 84, 82, 81, 86, 82, 79, 76, 77, 81, 73])
    // «La-cry-mo-sa»: la4 larga, fa5, re5, re5 larga, do♯5 (dos veces) | re4 mi4 fa4 sol4 (una por pulso)
    expect(midis(lacSlice(LAC.soprano, 2, 4))).toEqual([69, 77, 74, 74, 73, 69, 77, 74, 74, 73])
    expect(midis(lacSlice(LAC.soprano, 4, 5))).toEqual([62, 64, 65, 67])
    expect(lacSlice(LAC.soprano, 0, 2)).toEqual([]) // el soprano entra en el compás 3
  })
  it('cada voz es monofónica donde debe (violín I, soprano, contrabajo) y está en el rango de la voz', () => {
    for (const v of [LAC.vln1, LAC.soprano, LAC.bajo]) {
      const s = [...v].sort((a, b) => a[0] - b[0])
      for (let i = 1; i < s.length; i++) expect(s[i - 1]![0] + s[i - 1]![1]).toBeLessThanOrEqual(s[i]![0] + 1e-6)
    }
    expect(Math.min(...midis(LAC.bajo))).toBeGreaterThanOrEqual(28)
    expect(Math.max(...midis(LAC.bajo))).toBeLessThanOrEqual(52)
  })
})

describe('Lacrimosa en drill: el remix (spec 048)', () => {
  const r = labRemixById('lacrimosa-drill')!
  it('8 partes: el gancho abre y cierra, el tema vuelve en cada drop (16 compases) y la melodía cambia antes del drop', () => {
    expect(r.style).toBe('drill')
    expect(r.kit).toBe('808')
    expect(r.parts.map((p) => p.name)).toEqual(['Intro', 'Estrofa', 'Subida', 'Drop', 'Break', 'Puente', 'Drop 2', 'Final'])
    expect(r.parts.map((p) => p.bars)).toEqual([8, 8, 4, 16, 8, 4, 16, 8]) // secciones largas, como el tema de referencia
    expect(remixBars(r)).toBe(72)
    expect(remixBpm(r)).toBe(145)
    expect(remixSeconds(r)).toBeGreaterThan(115) // ≈ 2 min
    expect(remixSeconds(r)).toBeLessThanOrEqual(120)
    expect(r.key).toBe('Si menor')
    const theme = (n: string) => JSON.stringify(r.parts.find((p) => p.name === n)!.layers.find((l) => l.key === 'tema')!.mel![0]!.notes)
    expect(theme('Drop')).toBe(theme('Drop 2')) // el tema vuelve igual en cada drop
    expect(theme('Drop')).toBe(theme('Estrofa')) // el que ya se había oído
    expect(theme('Subida')).not.toBe(theme('Drop')) // antes del drop, otra melodía
    expect(theme('Break')).not.toBe(theme('Drop'))
    expect(theme('Intro')).toBe(theme('Final')) // el gancho abre y cierra
    expect(LAB_REMIXES).toContain(r)
  })
  it('el fondo del estilo va apagado (la armonía es la de Mozart) y cada parte lleva sus voces', () => {
    for (const c of r.song.cells) expect(c.parts).toEqual({ bass: false, chords: false })
    const keys = (n: string) => r.parts.find((p) => p.name === n)!.layers.map((l) => l.key)
    expect(keys('Intro')).toEqual(['acordes', 'tema'])
    expect(keys('Puente')).toEqual(['tema']) // el respiro de antes del último drop: solo el gancho
    expect(keys('Drop')).toEqual(['ritmo', 'bajo', 'acordes', 'tema'])
    expect(keys('Break')).toEqual(['acordes', 'tema'])
    expect(r.parts.find((p) => p.name === 'Drop')!.layers.find((l) => l.key === 'ritmo')!.mel!.some((m) => m.synth === 'hat')).toBe(true) // los tresillos
  })
  it('cada parte es una célula válida con sus loops (como mucho 8) y se usan cuatro trozos distintos de la obra', () => {
    const themes = new Set<string>()
    for (const c of r.song.cells) {
      expect(c.loops.length).toBeLessThanOrEqual(8)
      for (const l of c.loops) expect(isFreeLoop(l)).toBe(true)
      const mel = c.loops.find((l) => l.synth === 'cuerdas')!
      themes.add(JSON.stringify(mel.hits.map((h) => h.midi)))
    }
    expect(themes.size).toBe(4) // gancho, tema, escalera y subida
  })
  it('suena preciso: el tema con el sinte `cuerdas` (ataque firme) y el bajo con el 808 `sub`', () => {
    const synths = new Set(r.song.cells.flatMap((c) => c.loops.filter((l) => l.instrument === 'mel').map((l) => l.synth)))
    expect(synths.has('cuerdas')).toBe(true) // cuerdas con ataque firme
    expect(synths.has('sub')).toBe(true)
    expect(synths.has('pad')).toBe(false) // el pad con ataque lento y mucha reverb emborronaba las notas de 0,29 s
  })
  it('tres semitonos más grave que Mozart (si menor): el tema de los drops es el soprano −3', () => {
    const drop = r.song.cells.find((c) => c.name === 'Drop')!
    const mel = drop.loops.find((l) => l.synth === 'cuerdas')!
    expect(mel.hits.map((h) => h.midi)).toEqual([66, 74, 71, 71, 70, 66, 74, 71, 71, 70])
  })
  it('las partes suaves (intro, puente y final) llevan la fuerza más baja; las demás, la de siempre', () => {
    const str = (n: string) => r.song.cells.find((c) => c.name === n)!.loops.filter((l) => l.synth === 'cuerdas' || l.synth === 'keys').map((l) => l.hits[0]!.strength)
    expect(str('Intro')).toEqual([0, 0])
    expect(str('Puente')).toEqual([0])
    expect(str('Final')).toEqual([0, 0])
    expect(str('Drop').every((x) => x === 0.8)).toBe(true)
    // y se conserva al pasar de la canción a las capas del Laboratorio
    expect(r.parts.find((p) => p.name === 'Puente')!.layers[0]!.mel![0]!.strength).toBe(0)
    expect(r.parts.find((p) => p.name === 'Drop')!.layers.find((l) => l.key === 'tema')!.mel![0]!.strength).toBeUndefined()
  })
  it('el código de una parte lleva 145 bpm y Strudel toca el soprano en tresillos de 12/8', async () => {
    const cell = r.song.cells[1]! // Estrofa: compases 3–4 de 12/8
    const st = { loops: cell.loops, bpm: r.song.bpm, style: 'drill', kit: '808', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } } as unknown as SongState
    const code = songCode(st, 'display')
    expect(code).toContain('setcpm(145/4)')
    expect(code).toContain('.s("sine")') // el 808
    const ev = (await events(code, 1)).filter((e) => e.value.s === 'sawtooth') // el tema (cuerdas)
    // compás 1 de 4/4 = primera mitad del compás 3 de 12/8: la4 larga (4 corcheas = 4/6 de compás de 4/4... 2/3) y fa5 y re5 en 4/6 y 5/6
    expect(ev.map((e) => Math.round(e.begin * 6 * 1e6) / 1e6)).toEqual([0, 4, 5])
  })
})

describe('el 808 `sub` se desliza entre notas pegadas (spec 048)', () => {
  const H = (pos: number, dur: number, midi: number) => ({ pos, dur, midi, strength: 0.8 })
  it('cada nota pegada a la anterior parte de su altura (penv = anterior − esta); la primera y las sueltas, 0', () => {
    const code = subSlide([H(0, 5, 38), H(5, 5, 41), H(10, 5, 40)], 1, 0)
    expect(code).toContain('.penv("')
    expect(code).toContain('.pattack(0.001).pdecay(0.15).psustain(0)')
    expect(code).toContain('.penv("0@5 -3@5 1@5')
    // re2 → fa2: parte tres semitonos más abajo (−3); fa2 → mi2: uno más arriba (1)
  })
  it('solo los saltos cortos (hasta 5 semitonos): un salto grande no se desliza, que sonaría a «bloop»', () => {
    const code = subSlide([H(0, 5, 38), H(5, 5, 46), H(10, 5, 44)], 1, 0) // +8 (no) y −2 (sí)
    expect(code).toContain('.penv("0@5 0@5 2@5')
    expect(subSlide([H(0, 5, 38), H(5, 5, 50)], 1, 0)).toBe('')
  })
  it('sin notas pegadas, nada (el código de siempre)', () => {
    expect(subSlide([H(0, 2, 38), H(8, 2, 41)], 1, 0)).toBe('')
  })
})

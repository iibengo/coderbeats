import { describe, expect, it } from 'vitest'
import { EIGHTH, LAC, lacSlice, parseEighths } from '../../app/lib/lacrimosa'
import { labRemixById, LAB_REMIXES, remixBars, remixBpm, remixSeconds } from '../../app/lib/labRemixes'
import { subSlide } from '../../app/lib/melodyVariants'
import { isFreeLoop } from '../../app/lib/cells'
import { songCode, type SongState } from '../../app/lib/song'
import { SYNTH_SOUND } from '../../app/lib/melody'
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
    expect(keys('Puente')).toEqual(['subida', 'tema']) // el respiro de antes del último drop: el gancho y un riser que sube
    expect(keys('Drop')).toEqual(['ritmo', 'bajo', 'acordes', 'tema'])
    expect(keys('Break')).toEqual(['acordes', 'tema'])
    expect(r.parts.find((p) => p.name === 'Drop')!.layers.find((l) => l.key === 'ritmo')!.mel!.some((m) => m.synth === 'hat')).toBe(true) // los tresillos
  })
  it('cada parte es una célula válida con sus loops (como mucho 8) y se usan cuatro trozos distintos de la obra', () => {
    for (const c of r.song.cells) {
      expect(c.loops.length).toBeLessThanOrEqual(8)
      for (const l of c.loops) expect(isFreeLoop(l)).toBe(true)
    }
    const themes = new Set(r.parts.map((p) => JSON.stringify(p.layers.find((l) => l.key === 'tema')!.mel![0]!.notes)))
    expect(themes.size).toBe(4) // gancho, tema, escalera y subida
  })
  it('suena preciso: el tema con el sinte `cuerdas` (ataque firme) y el bajo con el 808 `sub`', () => {
    const synths = new Set(r.song.cells.flatMap((c) => c.loops.filter((l) => l.instrument === 'mel').map((l) => l.synth)))
    expect(synths.has('cuerdas')).toBe(true) // cuerdas con ataque firme y grano
    expect(synths.has('coro')).toBe(true) // el canto de fondo
    expect(synths.has('keys')).toBe(false)
    expect(synths.has('sub')).toBe(true)
    expect(synths.has('pad')).toBe(false) // el pad con ataque lento y mucha reverb emborronaba las notas de 0,29 s
  })
  it('tres semitonos más grave que Mozart (si menor): el tema de los drops es el soprano −3', () => {
    const drop = r.song.cells.find((c) => c.name === 'Drop')!
    const mel = drop.loops.find((l) => l.synth === 'coro')! // el coro canta el soprano
    expect(mel.hits.map((h) => h.midi)).toEqual([66, 74, 71, 71, 70, 66, 74, 71, 71, 70])
  })
  it('la fuerza de las cuerdas sube por partes hasta el drop: suave (intro, puente, final) < baja (estrofa) < media (subida, break) < a tope (drops)', () => {
    const str = (n: string) => r.song.cells.find((c) => c.name === n)!.loops.filter((l) => l.synth === 'cuerdas').map((l) => l.hits[0]!.strength)
    expect(str('Intro')).toEqual([0, 0])
    expect(str('Puente')).toEqual([0])
    expect(str('Final')).toEqual([0, 0])
    expect(str('Drop').every((x) => x === 1)).toBe(true) // a tope
    expect(str('Estrofa').every((x) => x === 0.35)).toBe(true) // más baja: para que el drop dé el salto
    expect(str('Subida').every((x) => x === 0.6)).toBe(true)
    // y se conserva al pasar de la canción a las capas del Laboratorio
    expect(r.parts.find((p) => p.name === 'Puente')!.layers.find((l) => l.key === 'tema')!.mel![0]!.strength).toBe(0)
    expect(r.parts.find((p) => p.name === 'Drop')!.layers.find((l) => l.key === 'tema')!.mel![0]!.strength).toBe(1)
  })
  it('el coro canta el soprano de fondo: la vocal «a» y mucha reverb; las cuerdas llevan el colchón (violines y viola)', () => {
    expect(SYNTH_SOUND.coro).toContain('.vowel("a")')
    expect(SYNTH_SOUND.coro).toContain('.room(0.55)')
    expect(SYNTH_SOUND.coro).toContain('.gain(0.8)') // presente: se oía como un murmullo tapado
    expect(SYNTH_SOUND.cuerdas).toContain('.hpf(200)') // sin graves: dejan sitio al 808
    expect(SYNTH_SOUND.cuerdas).toContain('.attack(0.01)') // ataque firme
    expect(SYNTH_SOUND.cuerdas).toContain('.noise(0.12)') // el roce del arco: una sierra limpia suena a sinte
    const drop = r.parts.find((p) => p.name === 'Drop')!
    expect(drop.layers.find((l) => l.key === 'tema')!.mel![0]!.synth).toBe('coro')
    expect(drop.layers.find((l) => l.key === 'acordes')!.mel![0]!.synth).toBe('cuerdas')
    expect(r.parts.find((p) => p.name === 'Intro')!.layers.find((l) => l.key === 'tema')!.mel![0]!.synth).toBe('cuerdas') // el gancho, solo cuerdas
  })
  it('el código de una parte lleva 145 bpm y Strudel toca el soprano en tresillos de 12/8', async () => {
    const cell = r.song.cells[1]! // Estrofa: compases 3–4 de 12/8
    const st = { loops: cell.loops, bpm: r.song.bpm, style: 'drill', kit: '808', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0 } } as unknown as SongState
    const code = songCode(st, 'display')
    expect(code).toContain('setcpm(145/4)')
    expect(code).toContain('.s("sine")') // el 808
    const ev = (await events(code, 1)).filter((e) => e.value.vowel === 'a') // el tema (el coro)
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

import { everyBeat, labRemixById as byId } from '../../app/lib/labRemixes'
import { melodyGains, STRINGS_GAIN_FLOOR } from '../../app/lib/melody'

describe('el 808 a cada tiempo y las cuerdas suaves de verdad (spec 048)', () => {
  it('cada golpe del bajo que empieza en un pulso se parte en dos: uno en el pulso y otro en el tiempo siguiente, a la misma altura', () => {
    const out = everyBeat([[0, 5.333, 38], [8, 5.333, 41], [18, 5, 40]])
    expect(out).toEqual([[0, 3.5, 38], [4, 3.5, 38], [8, 3.5, 41], [12, 3.5, 41], [18, 5, 40]]) // el de 18 no empieza en un pulso: se queda
  })
  it('en el drop, el 808 late cada tiempo (el doble de golpes que el contrabajo)', () => {
    const r = byId('lacrimosa-drill')!
    const drop = r.song.cells.find((c) => c.name === 'Drop')!
    const bajo = drop.loops.find((l) => l.synth === 'sub')!
    const orig = lacSlice(LAC.bajo, 2, 4).length
    expect(bajo.hits.length).toBeGreaterThanOrEqual(orig * 1.6)
    const starts = bajo.hits.map((h) => h.pos).sort((a, b) => a - b)
    const gaps = starts.slice(1).map((p, i) => p - starts[i]!)
    expect(gaps.filter((g) => Math.abs(g - 4) < 1e-6).length).toBeGreaterThan(gaps.length * 0.4) // muchos golpes a un tiempo (4 pasos) del anterior
  })
  it('las cuerdas suaves bajan hasta el suelo propio: la fuerza 0 sale a 0,33 (antes 0,55) y la de siempre (0,8) a ~0,87', () => {
    const H = (strength: number) => ({ pos: 0, dur: 2, midi: 60, strength })
    expect(melodyGains([H(0)], 1, 0, STRINGS_GAIN_FLOOR)).toBe('0.33@16'.replace('@16', '@2') + ' ~@14'.replace('@14', '@14'))
    expect(melodyGains([H(0.8)], 1, 0, STRINGS_GAIN_FLOOR)).toContain('0.866')
    expect(melodyGains([H(0)], 1, 0)).toContain('0.55') // los demás sintes, como siempre
  })
})

import { legato } from '../../app/lib/labRemixes'
import { DRILL } from '../../app/lib/labRemixes'

describe('legato de las cuerdas y el coro, y el charles abierto (spec 048)', () => {
  it('`legato` alarga cada nota hasta la siguiente si el hueco es corto; los huecos grandes y la última se quedan', () => {
    expect(legato([[0, 4, 60], [6, 2, 62], [20, 2, 64]], 3)).toEqual([[0, 6, 60], [6, 2, 62], [20, 2, 64]])
    expect(legato([[0, 4, 60]])).toEqual([[0, 4, 60]])
    expect(legato([[8, 2, 62], [0, 4, 60]], 4)[0]).toEqual([0, 8, 60]) // ordena por posición
  })
  it('el soprano del coro y el colchón de cuerdas van ligados; el gancho de los violines, no (sus silencios son el «suspiro»)', () => {
    const r = labRemixById('lacrimosa-drill')!
    const intro = r.parts.find((p) => p.name === 'Intro')!.layers.find((l) => l.key === 'tema')!.mel![0]!.notes
    const orig = lacSlice(LAC.vln1, 0, 2).map((n) => n[1])
    expect(intro.map((n) => n[1])).toEqual(orig) // sin legato: mismas duraciones
    // el soprano ya va pegado (sus silencios son de verdad, mayores que el hueco del legato): igual
    const tema = r.parts.find((p) => p.name === 'Drop')!.layers.find((l) => l.key === 'tema')!.mel![0]!.notes
    expect(tema.map((n) => n[1])).toEqual(lacSlice(LAC.soprano, 2, 4).map((n) => n[1]))
    // el colchón de cuerdas (violín II y viola, un golpe por pulso con un hueco de una corchea) sí se alarga
    const acordes = r.parts.find((p) => p.name === 'Drop')!.layers.find((l) => l.key === 'acordes')!.mel![0]!.notes
    const raw = [...lacSlice(LAC.vln2, 2, 4), ...lacSlice(LAC.viola, 2, 4), ...lacSlice(LAC.vln1, 2, 4)]
    expect(acordes.length).toBe(raw.length)
    expect(acordes.reduce((a, n) => a + n[1], 0)).toBeGreaterThan(raw.reduce((a, n) => a + n[1], 0) + 20)
  })
  it('el charles abierto es un acento puntual (dos golpes en 4 compases) con ruido corto, solo en los drops y fuera de la rejilla del cerrado', () => {
    expect(DRILL.open).toHaveLength(2)
    expect(SYNTH_SOUND.hatOpen).toContain('.s("white")')
    expect(SYNTH_SOUND.hatOpen).toContain('.decay(0.16)') // abierto pero breve
    const r = labRemixById('lacrimosa-drill')!
    const has = (n: string) => r.parts.find((p) => p.name === n)!.layers.some((l) => l.mel?.some((m) => m.synth === 'hatOpen'))
    expect(has('Drop')).toBe(true)
    expect(has('Drop 2')).toBe(true)
    expect(has('Estrofa')).toBe(false)
    expect(has('Intro')).toBe(false)
    const closed = DRILL.hat.notes.map((n) => n[0])
    for (const [p] of DRILL.open) expect(closed.some((c) => Math.abs(c - p) < 1e-9)).toBe(false) // no pisa un golpe cerrado
  })
})

describe('transiciones: el platillo estrena cada drop y el riser del puente se corta (spec 048)', () => {
  const r = labRemixById('lacrimosa-drill')!
  it('cada drop lleva un `crash` en su capa de ritmo, en el primer paso, y cabe en los 8 loops', () => {
    for (const name of ['Drop', 'Drop 2']) {
      const c = r.song.cells.find((x) => x.name === name)!
      const crash = c.loops.find((l) => l.synth === 'crash')!
      expect(crash.hits[0]!.pos).toBe(0)
      expect(c.loops.length).toBeLessThanOrEqual(8)
    }
    expect(r.song.cells.find((x) => x.name === 'Subida')!.loops.some((l) => l.synth === 'crash')).toBe(false)
  })
  it('el puente lleva un riser de ruido que sube y deja el último compás vacío: el golpe del Drop 2 llega tras un vacío', () => {
    const c = r.song.cells.find((x) => x.name === 'Puente')!
    const riser = c.loops.find((l) => l.synth === 'riser')!
    expect(riser).toBeDefined()
    expect(Math.max(...riser.hits.map((h) => h.pos + (h.dur ?? 0)))).toBeLessThanOrEqual(48 + 1e-9) // acaba antes del compás 4
    expect(c.loops.some((l) => l.synth === 'pad')).toBe(false) // sin el pad de los otros remixes (otra tonalidad)
  })
  it('el riser no es un tema ni cuenta como melodía en el Laboratorio: la parte lleva «subida» y «tema»', () => {
    const p = r.parts.find((x) => x.name === 'Puente')!
    expect(p.layers.map((l) => l.key)).toEqual(['subida', 'tema'])
    expect(p.layers.length).toBeLessThanOrEqual(4)
  })
})

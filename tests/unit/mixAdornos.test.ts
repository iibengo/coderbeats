import { describe, expect, it } from 'vitest'
import { isFreeLoop } from '../../app/lib/cells'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { INSTRUMENT_BALANCE_DB, dbToGain, isAdorno, loopGains, shareGain } from '../../app/lib/mix'
import { songCode, type SongState } from '../../app/lib/song'

let id = 0
const L = (instrument: FreeLoop['instrument'], extra: Partial<FreeLoop> = {}): FreeLoop => ({ id: ++id, instrument, bars: 1, phaseBar: 0, hits: [{ pos: 0, strength: 0.8, ...(instrument === 'mel' ? { midi: 60, dur: 4 } : {}) }] as FreeLoop['hits'], muted: false, bornAt: 0, fromTemplate: false, ...extra })
/** el reparto de antes de la spec 040, tal cual */
const antes = (loops: FreeLoop[]) => {
  const share = shareGain(loops.filter((l) => !l.muted).length)
  return new Map(loops.map((l) => [l.id, l.muted ? 0 : share * dbToGain(INSTRUMENT_BALANCE_DB[l.instrument])]))
}

describe('los adornos no cuentan en el reparto del volumen (spec 040)', () => {
  it('una canción sin adornos suena exactamente igual que antes (mismas ganancias, todas las combinaciones)', () => {
    const kinds: FreeLoop['instrument'][] = ['bd', 'sd', 'hh', 'mel', 'mel']
    for (let n = 1; n <= 8; n++)
      for (let mut = 0; mut < 3; mut++) {
        const loops = Array.from({ length: n }, (_, i) => L(kinds[i % kinds.length]!, i % 4 === 3 ? { synth: 'bass' } : i % 5 === 4 ? { synth: 'keys' } : {}))
        if (mut === 1 && n > 1) loops[0]!.muted = true
        if (mut === 2 && n > 2) loops[1]!.muted = true
        expect([...loopGains(loops)], `n=${n} mut=${mut}`).toEqual([...antes(loops)])
      }
  })
  it('qué es un adorno: los sintes de efecto o un loop marcado; nada más', () => {
    for (const s of ['riser', 'crash', 'boom', 'impacto', 'downlifter'] as const) expect(isAdorno(L('mel', { synth: s }))).toBe(true)
    expect(isAdorno(L('sd', { adorno: true }))).toBe(true)
    for (const x of [L('bd'), L('sd'), L('mel'), L('mel', { synth: 'bass' }), L('mel', { synth: 'keys' }), L('mel', { synth: 'pad' }), L('mel', { synth: 'guitar' }), L('sd', { adorno: false })]) expect(isAdorno(x)).toBe(false)
  })
  it('el caso del Hobbit: añadir el redoble y el riser no baja el bombo, y los adornos suenan a su fuerza (1)', () => {
    const base = [L('bd'), L('sd'), L('hh'), L('mel'), L('mel', { synth: 'bass' }), L('mel', { synth: 'keys' })]
    const redoble = L('sd', { adorno: true })
    const riser = L('mel', { synth: 'riser' })
    const sin = loopGains(base)
    const con = loopGains([...base, redoble, riser])
    for (const l of base) expect(con.get(l.id), `${l.instrument}`).toBeCloseTo(sin.get(l.id)!, 12)
    expect(con.get(redoble.id)).toBe(1)
    expect(con.get(riser.id)).toBe(1)
    // antes: con 8 loops el bombo bajaba a 1/√8 = 0,35; ahora se queda en 1/√6 = 0,41
    expect(con.get(base[0]!.id)).toBeCloseTo(1 / Math.sqrt(6), 9)
    expect(antes([...base, redoble, riser]).get(base[0]!.id)).toBeCloseTo(1 / Math.sqrt(8), 9)
  })
  it('un adorno silenciado sigue en 0, y solo adornos no rompe nada', () => {
    const r = L('mel', { synth: 'riser', muted: true })
    expect(loopGains([r]).get(r.id)).toBe(0)
    const s = L('sd', { adorno: true })
    expect(loopGains([s]).get(s.id)).toBe(1)
  })
  it('el código de una canción: añadir un riser no cambia la línea del bombo', () => {
    const st = (loops: FreeLoop[]): SongState => ({ loops, style: 'techno2', kit: 'electro', background: { mode: 'off', parts: { bass: false, chords: false } }, metronome: false, fx: { filter: 1, space: 0, warmth: 0.5 } })
    const bd = L('bd', { hits: [0, 4, 8, 12].map((pos) => ({ pos, strength: 0.8 })) })
    const mel = L('mel')
    const lineBd = (code: string) => code.split('\n').find((x) => x.includes('s("bd'))!
    const sin = songCode(st([bd, mel]), 'display')
    const con = songCode(st([bd, mel, L('mel', { synth: 'riser' }), L('sd', { adorno: true })]), 'display')
    expect(lineBd(con)).toBe(lineBd(sin))
  })
  it('el campo se valida como los demás: solo true/false; la voz no lo lleva', () => {
    expect(isFreeLoop(L('sd', { adorno: true }))).toBe(true)
    expect(isFreeLoop(L('sd'))).toBe(true)
    for (const bad of ['si', 1, null, {}, []]) expect(isFreeLoop({ ...L('sd'), adorno: bad }), JSON.stringify(bad)).toBe(false)
  })
  it('la percusión del minimal no cuenta en el reparto: añadirla no baja la base y suena con el reparto de los demás (no casi muda)', () => {
    const base = [L('bd'), L('hh'), L('mel', { synth: 'acid' })]
    const perc = [L('mel', { synth: 'rim' }), L('mel', { synth: 'shaker' }), L('mel', { synth: 'click' })]
    const sin = loopGains(base)
    const con = loopGains([...base, ...perc])
    for (const l of base) expect(con.get(l.id), l.instrument).toBeCloseTo(sin.get(l.id)!, 12)
    for (const l of perc) expect(con.get(l.id)).toBeCloseTo(shareGain(3) * dbToGain(INSTRUMENT_BALANCE_DB.mel), 12)
    expect(isAdorno(perc[0]!)).toBe(false) // no es un adorno: sigue el reparto
  })
})

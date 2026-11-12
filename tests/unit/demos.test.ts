import { describe, expect, it } from 'vitest'
import { DEMOS, demoState } from '../../app/lib/demos'
import { songCode } from '../../app/lib/song'

describe('demos', () => {
  it('cada estilo tiene bombo, caja y platillo de 16 pasos', () => {
    for (const style of ['hiphop90', 'house', 'dnb'] as const)
      for (const inst of ['bd', 'sd', 'hh'] as const) expect(DEMOS[style][inst].split(' ')).toHaveLength(16)
  })

  it('una bola normal por instrumento, con ids nuevos', () => {
    const s = demoState('house', 7, 3)
    expect(s.loops.map((l) => [l.id, l.instrument, l.bars, l.bornAt, l.muted])).toEqual([
      [7, 'bd', 1, 3, false],
      [8, 'sd', 1, 3, false],
      [9, 'hh', 1, 3, false],
    ])
    expect(s.nextId).toBe(10)
  })

  it('dnb = tu primer reel: el código lleva tus líneas de batería y el fondo dnb', () => {
    const code = songCode({
      loops: demoState('dnb', 1, 0).loops,
      style: 'dnb',
      kit: '909',
      background: { mode: 'manual', parts: { bass: true, chords: true } },
      metronome: false,
      fx: { filter: 1, space: 0, warmth: 0 },
    })
    expect(code).toContain('s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909")')
    expect(code).toContain('s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").n(1)')
    expect(code).toContain(`s("${Array(16).fill('hh').join(' ')}").bank("RolandTR909")`)
    expect(code).toContain('note("<d1 d1 f1 c1>").s("sawtooth").lpf(400).distort(0.3).orbit(2)')
    expect(code).toContain('s("[~ oh]*4").gain(0.25).orbit(3)')
  })
})

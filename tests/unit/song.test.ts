import { describe, expect, it } from 'vitest'
import type { FreeLoop } from '../../app/lib/freeLoops'
import { dbToGain, loopGains, shareGain } from '../../app/lib/mix'
import { loopTokens, songCode, type SongState } from '../../app/lib/song'
import type { Instrument } from '../../app/lib/types'

let id = 0
const loop = (instrument: Instrument, pos: number[], o: Partial<FreeLoop> = {}): FreeLoop => ({
  id: ++id,
  instrument,
  bars: 1,
  phaseBar: 0,
  hits: pos.map((p) => ({ pos: p, strength: 0.5 })),
  muted: false,
  bornAt: 0,
  fromTemplate: false,
  ...o,
})
const state = (o: Partial<SongState> = {}): SongState => ({
  loops: [],
  style: 'dnb',
  kit: '909',
  background: { mode: 'off', parts: { bass: false, chords: false } },
  metronome: false,
  fx: { filter: 1, space: 0, warmth: 0 },
  ...o,
})

describe('mix', () => {
  it('1/√n y balance por instrumento; silenciados a 0', () => {
    expect(shareGain(1)).toBe(1)
    expect(shareGain(4)).toBe(0.5)
    const g = loopGains([
      { id: 1, instrument: 'bd', muted: false },
      { id: 2, instrument: 'hh', muted: false },
      { id: 3, instrument: 'sd', muted: true },
    ])
    expect(g.get(1)).toBeCloseTo(1 / Math.SQRT2, 6)
    expect(g.get(2)).toBeCloseTo(dbToGain(-6) / Math.SQRT2, 6)
    expect(g.get(3)).toBe(0)
  })

  it('suma de ganancias acotada: de 1 a 8 loops el nivel varía ≤ ±3 dB (suma en potencia)', () => {
    const levels = [1, 2, 4, 8].map((n) => {
      const g = loopGains(Array.from({ length: n }, (_, i) => ({ id: i, instrument: 'bd' as const, muted: false })))
      return 10 * Math.log10([...g.values()].reduce((a, v) => a + v * v, 0))
    })
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(3)
  })
})

describe('songCode', () => {
  it('loops sin fondo: una línea por loop, .n() según el índice de strudel.cc, .gain por mezcla', () => {
    const code = songCode(state({ loops: [loop('bd', [0, 10]), loop('sd', [4, 12])] }))
    expect(code).toBe(
      [
        'setcpm(174/4)',
        'stack(',
        '  // tus loops',
        '  s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~").bank("RolandTR909").gain(0.71),',
        '  s("~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").n(1).gain(0.63),',
        ')',
      ].join('\n'),
    )
  })

  const both = { mode: 'progressive' as const, parts: { bass: true, chords: true } }

  it('con fondo: bloque de fondo (bajo orbit 2, acordes orbit 3) y sidechain "2:3" solo en el bombo', () => {
    const code = songCode(state({ background: both, loops: [loop('bd', [0]), loop('hh', [2])] }))
    expect(code).toContain('// fondo · drum and bass · re menor')
    // el fondo de tu primer reel, literal + orbit (§16.15)
    expect(code).toContain('  note("<d1 d1 f1 c1>").s("sawtooth").lpf(400).distort(0.3).orbit(2),')
    expect(code).toContain(
      '  note("<[d3,f3,a3] [d3,f3,a3] [f3,a3,c4] [c3,e3,g3]>").s("triangle").room(0.6).gain(0.3).orbit(3),',
    )
    expect(code).toContain('  s("[~ oh]*4").gain(0.25).orbit(3),')
    expect(code).toMatch(/s\("bd[^\n]*\.duckorbit\("2:3"\)\.duckdepth\(0\.6\)\.duckattack\(0\.15\),/)
    expect(code).not.toMatch(/s\("~ ~ hh[^\n]*duckorbit/)
  })

  it('fondo progresivo: el código mostrado solo lleva las partes que han entrado', () => {
    const onlyBass = songCode(state({ background: { mode: 'progressive', parts: { bass: true, chords: false } }, loops: [loop('bd', [0])] }))
    expect(onlyBass).toContain('note("<d1 d1 f1 c1>")')
    // el platillo abierto entra con los acordes, no con el bajo
    expect(onlyBass).not.toMatch(/triangle|oh\]/)
    const none = songCode(state({ background: { mode: 'progressive', parts: { bass: false, chords: false } }, loops: [loop('bd', [0])] }))
    expect(none).not.toMatch(/fondo|duckorbit/)
  })

  it('motor: lleva siempre las dos partes si el fondo no está desactivado, con etiquetas', () => {
    const engine = songCode(state({ background: { mode: 'progressive', parts: { bass: false, chords: false } }, loops: [loop('bd', [0])] }), 'engine')
    expect(engine).toContain('.orbit(2).color("bass")')
    expect(engine).toContain('.orbit(3).color("chords")')
    expect(engine).toContain('duckorbit("2:3")')
    expect(songCode(state({ loops: [loop('bd', [0])] }), 'engine')).not.toMatch(/color\("bass"\)|duckorbit/)
  })

  it('sustitución: el motor toca la versión anterior hasta el nacimiento; el mostrado solo la nueva', () => {
    const l = loop('bd', [0, 8], { bornAt: 12, prev: { hits: [{ pos: 0, strength: 1 }], bars: 1, phaseBar: 0 } })
    const engine = songCode(state({ loops: [l] }), 'engine')
    expect(engine).toContain('s("bd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~")')
    expect(engine).toMatch(/filterHaps\(\(h\) => h\.whole\.begin < 12\)/)
    expect(engine).toMatch(/s\("bd ~ ~ ~ ~ ~ ~ ~ bd[^\n]*filterHaps\(\(h\) => h\.whole\.begin >= 12\)/)
    const display = songCode(state({ loops: [l] }))
    expect(display.match(/s\("/g)).toHaveLength(1)
    expect(display).toContain('s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~")')
  })

  it('silenciados comentados', () => {
    expect(songCode(state({ loops: [loop('bd', [0], { muted: true })] }))).toContain('  // s("bd ~')
  })

  it('fase: un loop de 2 compases nacido en un compás impar se rota al ciclo 0', () => {
    const l = loop('sd', [4, 16 + 12], { bars: 2, phaseBar: 3 })
    const { s } = loopTokens(l, 0.1)
    // ciclo 0 = compás (0 − 3) mod 2 = 1 del loop
    expect(s.slice(0, 16).join(' ')).toBe('~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ sd ~ ~ ~')
    expect(s.slice(16).join(' ')).toBe('~ ~ ~ ~ sd ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~')
  })

  it('ritmo exacto: .nudge() con el desplazamiento en segundos', () => {
    const step = 60 / 174 / 4
    const code = songCode(state({ loops: [loop('bd', [0.25, 7.9])] }))
    const n1 = Math.round(0.25 * step * 1000) / 1000
    const n2 = Math.round(-0.1 * step * 1000) / 1000
    expect(code).toContain(`.nudge("${n1} 0 0 0 0 0 0 0 ${n2} 0 0 0 0 0 0 0")`)
    expect(code).toContain('s("bd ~ ~ ~ ~ ~ ~ ~ bd ~ ~ ~ ~ ~ ~ ~")')
  })

  it('efectos: en el código mostrado solo si no son neutros; filtro con djf', () => {
    const neutral = songCode(state({ loops: [loop('bd', [0])] }))
    expect(neutral).not.toMatch(/room|djf|shape/)
    const fx = songCode(state({ loops: [loop('bd', [0])], fx: { filter: 0.5, space: 0.5, warmth: 1 } }))
    expect(fx).toContain(').room(0.3).delay(0.18).shape(0.5),')
    expect(fx).toMatch(/\)\.djf\(0\.3\)$/)
  })

  it('motor: refs, metrónomo y onTrigger; el mostrado no los lleva', () => {
    const st = state({ metronome: true, loops: [loop('bd', [0])] })
    const engine = songCode(st, 'engine')
    expect(engine).toContain('.djf(ref(() => __cb.fx.djf))')
    expect(engine).toContain('.room(ref(() => __cb.fx.room))')
    expect(engine).toContain('note("[g6 c6 c6 c6]")')
    expect(engine).toContain('.orbit(4).color("click")')
    expect(engine).toContain('note("c0").s("sine").gain(0).color("pulse")')
    expect(engine).toMatch(/\.color\("l\d+"\)\.filterHaps\(\(h\) => h\.whole\.begin >= 0\)/)
    expect(engine).toContain('.onTrigger(')
    const display = songCode(st)
    expect(display).not.toMatch(/ref\(|onTrigger|g6 c6/)
  })

  it('vacío: silence', () => {
    expect(songCode(state())).toBe('setcpm(174/4)\nstack(\n  silence,\n)')
  })

  it('determinista', () => {
    const st = state({ background: both, loops: [loop('hh', [0, 2, 4.4])] })
    expect(songCode(st)).toBe(songCode(st))
  })
})

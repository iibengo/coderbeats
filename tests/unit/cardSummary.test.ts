import { describe, expect, it } from 'vitest'
import { TURNS, isSong } from '../../app/lib/cells'
import { STYLES } from '../../app/lib/constants'
import { LAB_REMIXES } from '../../app/lib/labRemixes'
import { SUMMARY_FADE_SECONDS, cutLoop, planSummary } from '../../app/lib/cardSummary'
import { songFromLoops } from '../../app/lib/cells'

const bpmOf = (r: (typeof LAB_REMIXES)[number]) => r.song.bpm ?? STYLES[r.style].bpm

describe('resumen de 15 s de la tarjeta (spec 061)', () => {
  it('cada remix de la app da un resumen válido, a compases enteros y en torno a 20 s', () => {
    const rows: string[] = []
    for (const r of LAB_REMIXES) {
      const bpm = bpmOf(r)
      const plan = planSummary(r.song, bpm)
      expect(plan, r.id).not.toBeNull()
      const p = plan!
      expect(isSong(p.song), `${r.id}: canción derivada válida`).toBe(true)
      expect(p.cellIds.length).toBeGreaterThanOrEqual(1)
      expect(p.cellIds.length).toBeLessThanOrEqual(3)
      expect(p.song.order).toEqual(p.cellIds)
      expect(p.roles.at(-1)).toBe('drop')
      p.bars.forEach((b, i) => {
        expect(TURNS.includes(b as never), `${r.id}: ${b} compases es un valor de vueltas`).toBe(true)
        const cell = p.song.cells.find((c) => c.id === p.cellIds[i])!
        expect(cell.turns).toBe(b)
        expect(b).toBeGreaterThanOrEqual(2)
        expect(b).toBeLessThanOrEqual(8)
        for (const l of cell.loops) {
          if (l.voice) continue
          expect(l.bars, `${r.id}: el loop no dura más que su tramo (el motor mantiene la célula lo que dura su loop)`).toBeLessThanOrEqual(b)
          for (const h of l.hits) expect(h.pos + (h.dur ?? 0)).toBeLessThanOrEqual(l.bars * 16) // ninguna nota se sale del loop recortado
        }
      })
      expect(p.seconds).toBeCloseTo((p.bars.reduce((s, b) => s + b, 0) * 240) / bpm, 6) // compases enteros
      expect(p.fadeSeconds).toBe(SUMMARY_FADE_SECONDS)
      expect(p.seconds).toBeGreaterThan(17)
      expect(p.seconds).toBeLessThan(24)
      p.song.groups.forEach((g) => expect(g.on).toBe(false))
      rows.push(`${r.id.padEnd(24)} ${String(Math.round(bpm)).padStart(3)} bpm  ${p.roles.map((x, i) => `${x}:${p.bars[i]}`).join(' ')}  ${p.seconds.toFixed(1)} s`)
    }
    console.log('\n' + rows.join('\n'))
  })

  it('recortar un loop: se quedan los compases del principio, la nota que cruza se acorta y lo que ya cabe no cambia', () => {
    const l = { id: 1, instrument: 'mel', bars: 4, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, hits: [{ pos: 0, strength: 1, midi: 60, dur: 4 }, { pos: 30, strength: 1, midi: 62, dur: 6 }, { pos: 32, strength: 1, midi: 64, dur: 4 }, { pos: 60, strength: 1, midi: 65, dur: 4 }] } as never
    const c = cutLoop(l, 2)
    expect(c.bars).toBe(2)
    expect(c.hits.map((h) => h.pos)).toEqual([0, 30])
    expect(c.hits[1]!.dur).toBe(2) // 30 + 6 pasaba de 32
    expect(cutLoop(l, 4)).toBe(l)
    expect(cutLoop(cutLoop(l, 2), 4).bars).toBe(2)
  })

  it('no toca la canción original (es una copia)', () => {
    const r = LAB_REMIXES[0]!
    const antes = JSON.stringify(r.song)
    planSummary(r.song, bpmOf(r))
    expect(JSON.stringify(r.song)).toBe(antes)
  })

  it('una canción de una sola célula también tiene resumen', () => {
    const song = songFromLoops({ nextId: 2, loops: [{ id: 1, instrument: 'bd', bars: 1, phaseBar: 0, muted: false, bornAt: 0, fromTemplate: false, hits: [{ pos: 0, strength: 1 }, { pos: 8, strength: 1 }] }] as never })
    const plan = planSummary(song, 120)
    expect(plan?.cellIds.length).toBe(1)
    expect(plan?.roles).toEqual(['drop'])
    expect(isSong(plan!.song)).toBe(true)
  })

  it('sin células o sin tempo válido no hay resumen', () => {
    const r = LAB_REMIXES[0]!
    expect(planSummary({ ...r.song, order: [] }, 120)).toBeNull()
    expect(planSummary(r.song, 0)).toBeNull()
    expect(planSummary(r.song, Number.NaN)).toBeNull()
  })
})

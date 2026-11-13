import { describe, expect, it } from 'vitest'
import { demoSong, groupSong, withOrderAfter, withGroupOn, withNewGroup, type Song } from '../../app/lib/cells'
import {
  groupEnd,
  groupWindow,
  holdGroup,
  isRunning,
  reconcileGroup,
  releaseGroup,
  retargetMain,
  startGroup,
  stepGroup,
  stopGroup,
  tapGroup,
} from '../../app/lib/groups'

/** un grupo de dos células (vueltas 4 y 8 de la demo: la subida y el drop) en paralelo a la canción */
function twoCellGroup(): { song: Song; gid: number; a: number; b: number; gsong: Song } {
  const demo = demoSong('dnb')!
  const n = withNewGroup(demo)!
  const [, b2, c] = demo.order as [number, number, number, number]
  const song = withGroupOn(withOrderAfter(withOrderAfter(n.song, n.id, b2)!, b2, c)!, n.groupId, true)!
  // grupo: [vacía (1 vuelta), subida (4), drop (8)]
  return { song, gid: n.groupId, a: n.id, b: b2, gsong: groupSong(song, n.groupId) }
}

describe('recorrido de un grupo en paralelo', () => {
  it('un grupo de una célula se repite sin fin: no avanza ni acaba', () => {
    const demo = demoSong('dnb')!
    const n = withNewGroup(demo)!
    const gs = groupSong(n.song, n.groupId)
    const gp = startGroup(n.id, 8)
    expect(isRunning(gp)).toBe(true)
    expect(stepGroup(gs, gp, 100)).toBe(gp)
    expect(groupWindow(gs, gp)).toEqual([{ cellId: n.id, from: 8, to: null }])
    expect(groupEnd(gs, gp)).toBe(Infinity)
  })

  it('uno de varias avanza por su orden, siempre en línea de compás, y vuelve a la primera', () => {
    const { gsong, a, b } = twoCellGroup()
    const [, , c] = gsong.order as [number, number, number]
    const turnsA = gsong.cells.find((x) => x.id === a)!.turns
    const turnsB = gsong.cells.find((x) => x.id === b)!.turns
    const turnsC = gsong.cells.find((x) => x.id === c)!.turns
    let gp = startGroup(a, 10)
    expect(gp.play.cursor).toEqual({ cellId: a, startBar: 10 })
    gp = stepGroup(gsong, gp, 10 + turnsA)!
    expect(gp.play.cursor).toEqual({ cellId: b, startBar: 10 + turnsA })
    gp = stepGroup(gsong, gp, 10 + turnsA + turnsB)!
    expect(gp.play.cursor).toEqual({ cellId: c, startBar: 10 + turnsA + turnsB })
    gp = stepGroup(gsong, gp, 10 + turnsA + turnsB + turnsC)!
    expect(gp.play.cursor).toEqual({ cellId: a, startBar: 10 + turnsA + turnsB + turnsC }) // vuelve a empezar
  })

  it('la ventana lleva la que suena y la siguiente, acotadas', () => {
    const { gsong, a, b } = twoCellGroup()
    const turnsA = gsong.cells.find((x) => x.id === a)!.turns
    const gp = startGroup(a, 4)
    expect(groupWindow(gsong, gp)).toEqual([
      { cellId: a, from: 4, to: 4 + turnsA },
      { cellId: b, from: 4 + turnsA, to: 4 + turnsA + gsong.cells.find((x) => x.id === b)!.turns },
    ])
  })

  it('al apagarlo sigue hasta la siguiente línea de compás y entonces se quita', () => {
    const { gsong, a } = twoCellGroup()
    let gp = startGroup(a, 0)
    gp = stopGroup(gp, 3)
    expect(isRunning(gp)).toBe(false)
    expect(stepGroup(gsong, gp, 2)).not.toBeNull()
    expect(stepGroup(gsong, gp, 3)).toBeNull()
    // su código se acota a esa línea: no suena nada de lo que cae después
    const win = groupWindow(gsong, gp)
    expect(win.every((s) => s.to !== null && s.to <= 3)).toBe(true)
    expect(win.every((s) => s.from < 3)).toBe(true)
    // apagarlo dos veces no lo alarga
    expect(stopGroup(gp, 9).to).toBe(3)
  })

  it('un grupo de una célula apagado también se acota (deja de sonar en esa línea)', () => {
    const n = withNewGroup(demoSong('dnb')!)!
    const gs = groupSong(n.song, n.groupId)
    const gp = stopGroup(startGroup(n.id, 8), 20)
    expect(groupWindow(gs, gp)).toEqual([{ cellId: n.id, from: 8, to: 20 }])
  })
})

describe('tocar una célula de un grupo (§16.4)', () => {
  it('apagado: lo enciende empezando por la célula tocada', () => {
    const { gsong, b } = twoCellGroup()
    const r = tapGroup(gsong, undefined, b, 12)
    expect(r.on).toBe(true)
    expect(r.gp.play.cursor).toEqual({ cellId: b, startBar: 12 })
    // también si se estaba apagando
    const stopping = stopGroup(startGroup(b, 0), 14)
    expect(tapGroup(gsong, stopping, b, 12).gp.to).toBeNull()
  })

  it('encendido: tocar la que suena lo apaga; tocar otra salta a ella en la siguiente línea', () => {
    const { gsong, a, b } = twoCellGroup()
    const gp = startGroup(a, 0)
    const off = tapGroup(gsong, gp, a, 2)
    expect(off.on).toBe(false)
    expect(off.gp.to).toBe(2)
    const jump = tapGroup(gsong, gp, b, 2)
    expect(jump.on).toBe(true)
    expect(jump.gp.play.jump).toEqual({ cellId: b, startBar: 1, loop: false }) // la línea no pasa del final de la célula (1 vuelta)
    // y al llegar su compás, entra
    expect(stepGroup(gsong, jump.gp, 1)!.play.cursor).toEqual({ cellId: b, startBar: 1 })
  })

  it('en un grupo de una célula, un toque lo enciende o lo apaga', () => {
    const n = withNewGroup(demoSong('dnb')!)!
    const gs = groupSong(n.song, n.groupId)
    const on = tapGroup(gs, undefined, n.id, 4)
    expect(on.on).toBe(true)
    expect(tapGroup(gs, on.gp, n.id, 8).on).toBe(false)
  })
})

describe('mientras se ve una célula del grupo, se queda en ella; al dejarla, sigue', () => {
  it('mantener en la que suena: pasa a bucle sin saltar', () => {
    const { gsong, a } = twoCellGroup()
    const held = holdGroup(gsong, startGroup(a, 0), a, 1)
    expect(held.play.loop).toBe(true)
    expect(held.play.jump).toBeNull()
    expect(stepGroup(gsong, held, 99)!.play.cursor).toEqual({ cellId: a, startBar: 0 }) // en bucle no avanza
  })

  it('mantener otra: salta a ella en bucle, en la siguiente línea', () => {
    const { gsong, a, b } = twoCellGroup()
    const held = holdGroup(gsong, startGroup(a, 0), b, 1)
    expect(held.play.jump).toEqual({ cellId: b, startBar: 1, loop: true })
    const at = stepGroup(gsong, held, 1)!
    expect(at.play).toEqual({ cursor: { cellId: b, startBar: 1 }, loop: true, jump: null })
  })

  it('al dejar de verla, esa célula vuelve a empezar y el grupo sigue por su orden', () => {
    const { gsong, a, b } = twoCellGroup()
    const held = stepGroup(gsong, holdGroup(gsong, startGroup(a, 0), b, 1), 1)!
    const free = releaseGroup(held, 20)
    expect(free.play).toEqual({ cursor: { cellId: b, startBar: 20 }, loop: false, jump: null })
    expect(stepGroup(gsong, free, 20 + gsong.cells.find((x) => x.id === b)!.turns)!.play.cursor.cellId).not.toBe(b)
    // si no estaba mantenido, no cambia nada
    const plain = startGroup(a, 0)
    expect(releaseGroup(plain, 5)).toBe(plain)
  })
})

describe('tras cambiar la estructura', () => {
  it('si la célula que suena ya no está en el grupo, empieza por la primera; si sigue, no cambia', () => {
    const { gsong, a, b } = twoCellGroup()
    const gp = startGroup(b, 5)
    expect(reconcileGroup(gsong, gp, 9)).toBe(gp)
    const lost = reconcileGroup({ ...gsong, order: gsong.order.filter((x) => x !== b) }, gp, 9)
    expect(lost.play).toEqual({ cursor: { cellId: gsong.order[0], startBar: 9 }, loop: false, jump: null })
    expect(a).toBe(gsong.order[0])
  })

  it('un salto a una célula que ya no está se olvida', () => {
    const { gsong, a, b } = twoCellGroup()
    const gp = { ...startGroup(a, 0), play: { ...startGroup(a, 0).play, jump: { cellId: b, startBar: 3, loop: false } } }
    const next = reconcileGroup({ ...gsong, order: gsong.order.filter((x) => x !== b) }, gp, 2)
    expect(next.play.jump).toBeNull()
    expect(next.play.cursor.cellId).toBe(a)
  })

  it('si sale de la canción la célula que suena, salta a la primera de las de detrás que sigan', () => {
    expect(retargetMain([1, 2, 3, 4], [1, 2, 4], 3)).toBe(4)
    expect(retargetMain([1, 2, 3, 4], [1, 2], 3)).toBe(1) // detrás ya no queda ninguna: vuelve al principio
    expect(retargetMain([1, 2, 3, 4], [1, 2, 3], 4)).toBe(1)
    expect(retargetMain([1, 2, 3, 4], [1, 2, 3, 4], 2)).toBeNull()
    expect(retargetMain([1, 2, 3], [], 2)).toBeNull()
  })
})

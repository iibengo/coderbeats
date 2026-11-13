/**
 * El recorrido de un grupo en paralelo (spec 005, enmienda 2, §16). Puro y sin DOM.
 *
 * Cada grupo que suena lleva su propia posición (`Play`: la célula que suena, desde qué compás, y un salto
 * pendiente) y avanza por su cuenta, siempre en línea de compás. Los avances usan las mismas funciones que la
 * canción (`stepPlay`, `windowAt`, `endBar`) sobre la canción vista desde ese grupo (`groupSong`).
 */
import { endBar, stepPlay, windowAt, type Play, type Segment, type Song } from './cells'

export interface GroupPlay {
  play: Play
  /** compás global en el que se encendió */
  from: number
  /** null mientras suena; con un compás, se apagó y sigue hasta esa línea de compás */
  to: number | null
}

/** Enciende un grupo en la línea de compás `line`, empezando por `cellId`. */
export const startGroup = (cellId: number, line: number): GroupPlay => ({
  play: { cursor: { cellId, startBar: line }, loop: false, jump: null },
  from: line,
  to: null,
})

/** Apaga un grupo: sigue hasta la línea de compás `line` (si ya se estaba apagando, la que fuera antes). */
export const stopGroup = (gp: GroupPlay, line: number): GroupPlay => ({ ...gp, to: gp.to === null ? line : Math.min(gp.to, line) })

/** ¿Está sonando (no apagándose)? */
export const isRunning = (gp: GroupPlay | undefined): gp is GroupPlay => !!gp && gp.to === null

/**
 * El grupo en el compás global `bar`: avanza a la siguiente célula si le toca, o salta si había un salto
 * pendiente. Devuelve null cuando ya ha pasado la línea en la que se apagó (hay que quitarlo).
 */
export function stepGroup(gsong: Song, gp: GroupPlay, bar: number): GroupPlay | null {
  if (gp.to !== null && bar >= gp.to) return null
  const play = stepPlay(gsong, gp.play, bar)
  return play === gp.play ? gp : { ...gp, play }
}

/** Los tramos del código del motor: la célula que suena y la siguiente, acotados a sus compases y a su apagado. */
export function groupWindow(gsong: Song, gp: GroupPlay): Segment[] {
  const segs = windowAt(gsong, gp.play.cursor, { loop: gp.play.loop, jump: gp.play.jump })
  if (gp.to === null) return segs
  const to = gp.to
  return segs.filter((s) => s.from < to).map((s) => ({ ...s, to: s.to === null ? to : Math.min(s.to, to) }))
}

/** El compás en el que acaba lo que suena ahora en el grupo (o Infinity si se repite sin fin). */
export const groupEnd = (gsong: Song, gp: GroupPlay): number => endBar(gsong, gp.play)

/**
 * Un toque en una célula de un grupo en paralelo (§16.4). Apagado: lo enciende empezando por esa célula.
 * Encendido: en la que suena (o la que está a punto de sonar), lo apaga; en otra, salta a ella en la
 * siguiente línea de compás. `on` es lo que queda marcado.
 */
export function tapGroup(gsong: Song, gp: GroupPlay | undefined, cellId: number, line: number): { gp: GroupPlay; on: boolean } {
  if (!isRunning(gp)) return { gp: startGroup(cellId, line), on: true }
  if (gp.play.cursor.cellId === cellId || gp.play.jump?.cellId === cellId) return { gp: stopGroup(gp, line), on: false }
  const at = Math.min(line, groupEnd(gsong, gp))
  return { gp: { ...gp, play: { ...gp.play, jump: { cellId, startBar: at, loop: gp.play.loop } } }, on: true }
}

/**
 * Mientras se ve una célula de un grupo (para grabar o editarla), el grupo se queda en ella en bucle (§16.2);
 * si sonaba otra, salta a esta en la siguiente línea de compás.
 */
export function holdGroup(gsong: Song, gp: GroupPlay, cellId: number, line: number): GroupPlay {
  if (gp.play.cursor.cellId === cellId && !gp.play.jump) return gp.play.loop ? gp : { ...gp, play: { ...gp.play, loop: true } }
  const at = Math.min(line, groupEnd(gsong, gp))
  return { ...gp, play: { ...gp.play, jump: { cellId, startBar: at, loop: true } } }
}

/** Al dejar de verla, el grupo sigue: la célula en la que estaba vuelve a empezar en la siguiente línea de compás. */
export function releaseGroup(gp: GroupPlay, line: number): GroupPlay {
  if (!gp.play.loop && !gp.play.jump?.loop) return gp
  return { ...gp, play: { cursor: { cellId: gp.play.cursor.cellId, startBar: line }, loop: false, jump: null } }
}

/**
 * Tras cambiar la estructura (juntar, cortar, borrar): si la célula que suena ya no está en el grupo, empieza
 * por la primera en la línea `line`; un salto a una célula que ya no está se olvida.
 */
export function reconcileGroup(gsong: Song, gp: GroupPlay, line: number): GroupPlay {
  const order = gsong.order
  if (!order.length) return gp
  if (!order.includes(gp.play.cursor.cellId))
    return { ...gp, play: { cursor: { cellId: order[0]!, startBar: line }, loop: false, jump: null } }
  if (gp.play.jump && !order.includes(gp.play.jump.cellId)) return { ...gp, play: { ...gp.play, jump: null } }
  return gp
}

/**
 * Si la célula que suena en la canción sale de ella (juntada a otro grupo, cortada o borrada), a cuál saltar:
 * la primera de las que iban detrás que siguen en la canción, o la primera de la canción. null si no hace
 * falta (sigue en la canción).
 */
export function retargetMain(oldOrder: readonly number[], newOrder: readonly number[], cursorCell: number): number | null {
  if (newOrder.includes(cursorCell) || !newOrder.length) return null
  const i = oldOrder.indexOf(cursorCell)
  for (let k = 1; k <= oldOrder.length; k++) {
    const id = oldOrder[(i + k + oldOrder.length) % oldOrder.length]!
    if (newOrder.includes(id)) return id
  }
  return newOrder[0]!
}

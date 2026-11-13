import { describe, expect, it } from 'vitest'
import { useAudioEngine } from '../../app/composables/useAudioEngine'
import { addHit } from '../../app/lib/loopEdit'

/**
 * Las células libres en el motor (spec 005, §13.1), sin audio: lo que no necesita sonar (crear, entrar,
 * encender, borrar, deshacer y qué código sale). El motor es un solo estado para toda la app, así que cada
 * test parte de la canción vacía.
 */
const fresh = () => {
  const e = useAudioEngine()
  e.setSong({ version: 1, cells: [{ id: 1, loops: [], parts: { bass: false, chords: false }, turns: 1, at: { x: 0, y: 0, depth: 0 } }], order: [1], bpm: null, nextCellId: 2, nextLoopId: 1 })
  return e
}
const fill = (e: ReturnType<typeof useAudioEngine>) => {
  const r = addHit(e.loops.value, 'bd', 0, 0, { assist: false, quantizeEvery: 1 })!
  e.editLoops(r.state)
}

describe('células libres en el motor', () => {
  it('crear una libre la deja apagada, fuera del orden, y entra en ella', () => {
    const e = fresh()
    const id = e.addFreeCell()!
    expect(id).toBe(2)
    expect(e.song.value.order).toEqual([1])
    expect(e.song.value.cells.find((c) => c.id === id)).toMatchObject({ free: true, on: false })
    expect(e.viewCellId.value).toBe(id)
    expect(e.viewIsFree.value).toBe(true)
    // una libre no hace de la canción una de varias células
    expect(e.multi.value).toBe(false)
  })

  it('tocarla la enciende y la apaga; el código que se enseña la lleva solo encendida', () => {
    const e = fresh()
    const id = e.addFreeCell()!
    fill(e) // se ve la libre: lo que se edita es ella
    expect(e.displayCode()).not.toContain('célula libre')
    e.toggleFree(id)
    expect(e.song.value.cells.find((c) => c.id === id)!.on).toBe(true)
    expect(e.displayCode()).toContain('// célula libre · célula 2')
    e.toggleFree(id)
    expect(e.song.value.cells.find((c) => c.id === id)!.on).toBe(false)
    expect(e.displayCode()).not.toContain('célula libre')
  })

  it('lo que se llena en la libre no se mezcla con la canción', () => {
    const e = fresh()
    const id = e.addFreeCell()!
    fill(e)
    e.toggleFree(id)
    const code = e.displayCode()
    // la canción (célula 1) sigue vacía: sus loops no tienen golpes; el bombo es de la libre
    expect(code).not.toContain('// tus loops')
    expect(e.liveSong().cells.find((c) => c.id === 1)!.loops).toHaveLength(0)
    expect(e.liveSong().cells.find((c) => c.id === id)!.loops).toHaveLength(1)
  })

  it('una que no es libre no se enciende', () => {
    const e = fresh()
    e.toggleFree(1)
    expect(e.song.value.cells.find((c) => c.id === 1)!.on).toBeUndefined()
  })

  it('volver a la célula de la canción deja la libre como estaba', () => {
    const e = fresh()
    const id = e.addFreeCell()!
    fill(e)
    e.travelTo(1)
    expect(e.viewCellId.value).toBe(1)
    expect(e.viewIsFree.value).toBe(false)
    expect(e.liveSong().cells.find((c) => c.id === id)!.loops).toHaveLength(1)
    e.enterCell(id)
    expect(e.viewCellId.value).toBe(id)
    expect(e.loops.value.loops).toHaveLength(1)
  })

  it('tocar una libre desde el marcador del borde entra en ella, sin tocar la canción', () => {
    const e = fresh()
    const id = e.addFreeCell()!
    e.travelTo(1)
    e.travelTo(id)
    expect(e.viewCellId.value).toBe(id)
    expect(e.song.value.order).toEqual([1])
  })

  it('borrarla (con la vista en ella) vuelve a la canción, y deshacer la devuelve encendida o apagada como estaba', () => {
    const e = fresh()
    const id = e.addFreeCell()!
    fill(e)
    e.toggleFree(id)
    e.removeCell(id)
    expect(e.song.value.cells.map((c) => c.id)).toEqual([1])
    expect(e.viewCellId.value).toBe(1)
    expect(e.undoInfo.value).toBe('cell')
    e.undo()
    const back = e.song.value.cells.find((c) => c.id === id)!
    expect(back).toMatchObject({ free: true, on: true })
    expect(back.loops).toHaveLength(1)
    expect(e.song.value.order).toEqual([1]) // vuelve libre, no entra en la canción
  })

  it('con 16 células no se crea otra libre', () => {
    const e = fresh()
    for (let i = 0; i < 15; i++) expect(e.addFreeCell()).not.toBeNull()
    expect(e.song.value.cells).toHaveLength(16)
    expect(e.addFreeCell()).toBeNull()
  })

  it('cargar una demo estando en una libre vuelve a la canción', async () => {
    const e = fresh()
    e.addFreeCell()
    await e.loadDemo()
    expect(e.viewIsFree.value).toBe(false)
  })
})

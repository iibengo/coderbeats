import { describe, expect, it } from 'vitest'
import { demoSong, emptySong, MAIN, orderOf, type Song } from '../../app/lib/cells'
import { addHit } from '../../app/lib/loopEdit'
import { useAudioEngine } from '../../app/composables/useAudioEngine'

/**
 * Los grupos en paralelo en el motor (spec 005, enmienda 2, §16), sin audio: lo que no necesita sonar (crear,
 * entrar, encender, juntar, cortar, borrar, deshacer y qué código sale). El motor es un solo estado para toda
 * la app, así que cada test parte de una canción nueva.
 */
const fresh = (song: Song = emptySong()) => {
  const e = useAudioEngine()
  e.setSong(song)
  return e
}
const fill = (e: ReturnType<typeof useAudioEngine>) => {
  const r = addHit(e.loops.value, 'bd', 0, 0, { assist: false, quantizeEvery: 1 })!
  e.editLoops(r.state)
}
const group = (e: ReturnType<typeof useAudioEngine>, id: number) => e.song.value.groups.find((g) => g.order.includes(id))

describe('grupos en paralelo en el motor', () => {
  it('crear una libre: un grupo de una célula, apagado, fuera de la canción; y se entra en ella', () => {
    const e = fresh()
    const id = e.addGroupCell()!
    expect(id).toBe(2)
    expect(e.song.value.order).toEqual([1])
    expect(group(e, id)).toMatchObject({ order: [id], on: false })
    expect(e.viewCellId.value).toBe(id)
    expect(e.viewIsFree.value).toBe(true)
    expect(e.viewGroup.value).toBe(group(e, id)!.id)
    expect(e.groupOf(1)).toBe(MAIN)
    expect(e.multi.value).toBe(false) // un grupo en paralelo no hace de la canción una de varias células
  })

  it('un toque (parado) enciende y apaga el grupo; el código que se enseña lo lleva solo encendido', () => {
    const e = fresh()
    const id = e.addGroupCell()!
    fill(e) // se ve la libre: lo que se edita es ella
    expect(e.displayCode()).not.toContain('grupo')
    e.tapGroupCell(id)
    expect(group(e, id)!.on).toBe(true)
    expect(e.displayCode()).toContain('// grupo 1 · célula 2')
    e.tapGroupCell(id)
    expect(group(e, id)!.on).toBe(false)
    expect(e.displayCode()).not.toContain('grupo')
  })

  it('lo que se llena en la libre no se mezcla con la canción', () => {
    const e = fresh()
    const id = e.addGroupCell()!
    fill(e)
    e.tapGroupCell(id)
    expect(e.displayCode()).not.toContain('// tus loops')
    expect(e.liveSong().cells.find((c) => c.id === 1)!.loops).toHaveLength(0)
    expect(e.liveSong().cells.find((c) => c.id === id)!.loops).toHaveLength(1)
  })

  it('una célula de la canción no se enciende ni se apaga como grupo', () => {
    const e = fresh()
    e.tapGroupCell(1)
    expect(e.song.value.groups).toEqual([])
  })

  it('volver a la canción deja el grupo como estaba, y entrar vuelve a él', () => {
    const e = fresh()
    const id = e.addGroupCell()!
    fill(e)
    e.travelTo(1)
    expect(e.viewCellId.value).toBe(1)
    expect(e.viewIsFree.value).toBe(false)
    expect(e.liveSong().cells.find((c) => c.id === id)!.loops).toHaveLength(1)
    e.enterCell(id)
    expect(e.viewCellId.value).toBe(id)
    expect(e.loops.value.loops).toHaveLength(1)
  })

  it('el marcador del borde de una célula de un grupo entra en ella, sin tocar la canción', () => {
    const e = fresh()
    const id = e.addGroupCell()!
    e.travelTo(1)
    e.travelTo(id)
    expect(e.viewCellId.value).toBe(id)
    expect(e.song.value.order).toEqual([1])
  })

  it('copiar (asa → agua) crea otro grupo de una célula, apagado, sin tocar la canción', () => {
    const e = fresh(demoSong('dnb')!)
    const copy = e.copyCell(3, { x: 20, y: 2 })!
    expect(e.song.value.order).toEqual([1, 2, 3, 4])
    expect(group(e, copy)).toMatchObject({ order: [copy], on: false })
    expect(e.displayCode()).not.toContain('grupo')
  })

  it('juntar con el asa: una libre entra en la canción justo detrás; y cortar el hilo la separa en un grupo apagado', () => {
    const e = fresh(demoSong('dnb')!)
    const id = e.addGroupCell()!
    e.orderAfter(2, id)
    expect(e.song.value.order).toEqual([1, 2, id, 3, 4])
    expect(e.song.value.groups).toEqual([])
    e.cutThread(id) // el hilo que lleva a la célula nueva
    expect(e.song.value.order).toEqual([1, 2])
    const g = group(e, id)!
    expect(g).toMatchObject({ order: [id, 3, 4], on: false })
    expect(e.groupOf(4)).toBe(g.id)
  })

  it('cortar parte el grupo en dos y la parte de detrás nace apagada, aunque el grupo suene', () => {
    const e = fresh(demoSong('dnb')!)
    const a = e.addGroupCell()!
    e.orderAfter(a, 3)
    e.orderAfter(3, 4)
    const gid = e.groupOf(a)
    e.tapGroupCell(a) // enciende (parado: solo el interruptor)
    expect(e.song.value.groups.find((g) => g.id === gid)!.on).toBe(true)
    e.cutThread(4)
    expect(orderOf(e.song.value, gid)).toEqual([a, 3])
    expect(e.song.value.groups.find((g) => g.id === gid)!.on).toBe(true)
    expect(group(e, 4)).toMatchObject({ order: [4], on: false })
  })

  it('apagar extras apaga todos los grupos menos la canción', () => {
    const e = fresh(demoSong('dnb')!)
    const a = e.addGroupCell()!
    const b = e.addGroupCell()!
    e.tapGroupCell(a)
    e.tapGroupCell(b)
    expect(e.extrasOn.value).toBe(true)
    e.stopExtras()
    expect(e.extrasOn.value).toBe(false)
    expect(e.song.value.groups.every((g) => !g.on)).toBe(true)
    expect(e.song.value.order).toEqual([1, 2, 3, 4])
  })

  it('borrar una célula de un grupo (con la vista en ella) vuelve a la canción; deshacer la devuelve a su grupo, encendido o apagado como estaba', () => {
    const e = fresh()
    const id = e.addGroupCell()!
    fill(e)
    e.tapGroupCell(id)
    e.removeCell(id)
    expect(e.song.value.cells.map((c) => c.id)).toEqual([1])
    expect(e.song.value.groups).toEqual([])
    expect(e.viewCellId.value).toBe(1)
    expect(e.undoInfo.value).toBe('cell')
    e.undo()
    expect(group(e, id)).toMatchObject({ order: [id], on: true })
    expect(e.liveSong().cells.find((c) => c.id === id)!.loops).toHaveLength(1)
    expect(e.song.value.order).toEqual([1]) // vuelve a su grupo, no entra en la canción
  })

  it('con 16 células no se crea otra', () => {
    const e = fresh()
    for (let i = 0; i < 15; i++) expect(e.addGroupCell()).not.toBeNull()
    expect(e.song.value.cells).toHaveLength(16)
    expect(e.addGroupCell()).toBeNull()
  })

  it('lo guardado antes de los grupos se abre migrado: una libre encendida suena como grupo encendido', () => {
    const base = demoSong('dnb')!
    const { groups: _g, nextGroupId: _n, ...rest } = base
    const old = { ...rest, cells: [...base.cells, { ...base.cells[0]!, id: 9, free: true, on: true }] } as unknown as Song
    const e = fresh(old)
    expect(e.song.value.groups).toEqual([{ id: 1, order: [9], on: true }])
    expect(e.song.value.order).toEqual([1, 2, 3, 4])
    expect(e.displayCode()).toContain('grupo 1')
  })

  it('cargar una demo estando en una célula de un grupo vuelve a la canción', async () => {
    const e = fresh()
    e.addGroupCell()
    await e.loadDemo()
    expect(e.viewIsFree.value).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { remixById } from '../../app/lib/remixes'
import { songCode, type SongState } from '../../app/lib/song'
import { WOW_PRELUDE } from '../../app/lib/wowPrelude'
import { events } from '../helpers/strudelEval'

const cellsOf = (id: string) => remixById(id)!.build()

describe('el preludio del wowo (spec 008, §9)', () => {
  it('define wowPlan y no ejecuta el enganche del motor sin lo de la canción', async () => {
    // sin `__cbWowo`, `wowPlan` no llama a nada: es `silence` (un patrón vacío, que no suena)
    const ev = await events(`${WOW_PRELUDE}\nwowPlan([{ bus: 3, wow: { lpq: 8, lpenv: 3, lpa: 0.005, lpd: 0.15 }, lpf: [500, 700] }], '3@2')`, 4)
    expect(ev).toEqual([])
  })
  it('con el enganche del motor, le pasa los compases en los que cambia el filtro de cada célula', async () => {
    const g = globalThis as Record<string, unknown>
    let got: unknown = null
    g.__cbWowo = (changes: unknown) => {
      got = changes
    }
    await events(`${WOW_PRELUDE}\nwowPlan([{ bus: 3, wow: { lpq: 8, lpenv: 3, lpa: 0.005, lpd: 0.15 }, lpf: [500, 500, 900, 900, 900] }], '~@4 3@5 ~@2')`, 12)
    // (cuatro compases de silencio, luego la célula: su primera vuelta en el compás 4 con 500, la tercera en el 6 con 900)
    expect(got).toEqual([
      { bus: 3, wow: { lpq: 8, lpenv: 3, lpa: 0.005, lpd: 0.15 }, bar: 4, value: 500 },
      { bus: 3, wow: { lpq: 8, lpenv: 3, lpa: 0.005, lpd: 0.15 }, bar: 6, value: 900 },
    ])
    // y se apaga: la siguiente evaluación no vuelve a engancharse
    expect(g.__cbWowo).toBeNull()
    delete g.__cbWowo
  })
  it('la canción del remix con wowo: el código del motor es válido con el preludio delante', async () => {
    const song = cellsOf('dies-irae-techno')
    const engine = songCode(
      {
        loops: [], style: 'techno', kit: 'electro', background: { mode: 'manual', parts: { bass: false, chords: false } }, metronome: false,
        fx: { filter: 1, space: 0, warmth: 0 }, cells: { list: song.cells, order: song.order, window: [] },
      } satisfies SongState,
      'engine',
    )
    // (en Node no hay scheduler ni audio: solo se comprueba que evalúa sin error de sintaxis ni de referencias)
    await expect(events(`${WOW_PRELUDE}\n${engine}`, 1)).resolves.toEqual([])
  })
})

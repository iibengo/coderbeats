/**
 * Evalúa código Strudel en Node (sin audio) y devuelve los eventos de unos ciclos. Sirve para comprobar que el código
 * que genera la app toca lo mismo que otro código escrito a mano (por ejemplo, el de una demo).
 */
import * as core from '@strudel/core'
import * as mini from '@strudel/mini'
import { evaluate } from '@strudel/transpiler'

let ready: Promise<unknown> | null = null
const init = () => (ready ??= core.evalScope(Promise.resolve(core), Promise.resolve(mini)))

export interface Ev {
  begin: number
  end: number
  /** s, note y otros controles (sin los de efectos) */
  value: Record<string, unknown>
}

const num = (f: { valueOf(): unknown }) => Number(f.valueOf())

/** Los eventos de [0, cycles) del código, ordenados por inicio. */
export async function events(code: string, cycles: number): Promise<Ev[]> {
  await init()
  ;(globalThis as Record<string, unknown>).setcpm = () => {}
  ;(globalThis as Record<string, unknown>).setcps = () => {}
  const res = (await evaluate(code)) as { pattern: { queryArc: (a: number, b: number) => { whole?: { begin: { valueOf(): unknown }; end: { valueOf(): unknown } }; value: Record<string, unknown> }[] } }
  return res.pattern
    .queryArc(0, cycles)
    .filter((h) => h.whole)
    .map((h) => ({ begin: num(h.whole!.begin), end: num(h.whole!.end), value: h.value }))
    .sort((a, b) => a.begin - b.begin || String(a.value.s ?? a.value.note).localeCompare(String(b.value.s ?? b.value.note)))
}

/**
 * El preludio del wowo en el motor (spec 008, §9): `wowPlan`, que `songCode` (modo `'engine'`) mete delante de la
 * canción. Es lo único del wowo que no es Strudel puro: en el código mostrado va directo en la célula
 * (`.lpq(…).lpenv(…)`), y en el motor tiene que ir **por compás**, porque dentro de los haps de un `stack` el `lpenv`
 * no se interpola (los haps "abrirían" el filtro uno por golpe, no la vuelta).
 *
 * - **El código** lleva una línea de plan: por célula con wowo, su `bus` (el id de la célula), sus controles (`lpq`,
 *   `lpenv`, `lpa`, `lpd`) y su `lpf` por vuelta; y un compás por vuelta de la canción (`"3@8 ~@4"`: la célula con wowo
 *   que suena y cuánto dura, `~` si ninguna).
 * - **El motor** deja su función de enganche en `__cbWowo` justo antes de evaluar. `wowPlan` calcula los compases en
 *   los que cambia el filtro de cada célula (su primera vuelta y cada vez que el `lpf` cambia de una vuelta a la
 *   siguiente: la misma cuenta que `cellLpf`), llama a esa función con todos los cambios y la borra, de modo que el
 *   código de siempre (sin wowo) no se enganche a nada.
 */
export const WOW_PRELUDE = `
function wowPlan(plan, marks) {
  let bar = 0
  const changes = []
  const prev = new Map()
  for (const m of marks.split(' ')) {
    const [id, n] = m.split('@')
    const turns = Number(n)
    const cell = id === '~' ? undefined : plan.find((x) => String(x.bus) === id)
    for (let t = 0; t < turns; t++) {
      if (cell) {
        const value = cell.lpf[Math.min(t, cell.lpf.length - 1)]
        // cambio si es su primera vuelta (o vuelve tras otra célula), o si el lpf cambia respecto de su última vuelta
        if (prev.get(id) === undefined || prev.get(id) !== value) changes.push({ bus: cell.bus, wow: cell.wow, bar: bar, value: value })
        prev.set(id, value)
      }
      bar++
    }
  }
  const engine = globalThis.__cbWowo
  if (engine) {
    engine(changes)
    globalThis.__cbWowo = null
  }
  return silence
}
`.trim()

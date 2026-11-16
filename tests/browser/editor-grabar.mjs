// Estudio · editor de melodía: «● grabar» a media velocidad: la cuenta, los toques se apuntan y se cuadran, y la toma acaba sola.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
await clickLabel(p, 'editor de melodía'); await sleep(800)
const g = await p.evaluate(() => { const r = document.querySelector('[data-grid]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height] })
const at = (rowFromTop) => [g[0] + g[2] / 2, g[1] + ((rowFromTop + 0.5) / 9) * g[3]]
const st = () => p.evaluate(() => ({ rec: window.__melody.rec(), hits: JSON.stringify(window.__melody.hits()), bars: window.__melody.bars() }))
console.log('grabar:', await clickLabel(p, 'grabar'))
for (let i = 0; i < 40 && (await st()).rec !== 'grabando'; i++) await sleep(250)
console.log('en la toma:', JSON.stringify(await st()))
const rows = [6, 3, 4, 2]
for (const r of rows) { await p.mouse.click(...at(r)); await sleep(1100) }
console.log('tras 4 toques:', JSON.stringify(await st()))
for (let i = 0; i < 60 && (await st()).rec !== ''; i++) await sleep(250)
const end = await st()
console.log('al acabar:', JSON.stringify(end), errs)
await b.close()

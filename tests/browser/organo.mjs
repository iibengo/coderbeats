// Estudio · el Órgano de la melodía mejorado (spec 020): casillas de corchea, «↻ responder» y «● grabar» a media velocidad.
import { open, sleep } from './lib.mjs'
const O = process.env.OUT || '/tmp'
const { b, p, errs } = await open()
await p.evaluate(() => window.__stage().openOrgan(200, 420)); await sleep(1500)
const g = await p.evaluate(() => { const c = document.querySelector('[data-organ-grid]'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, cw: +c.dataset.cellW, rh: +c.dataset.rowH, rows: +c.dataset.rows } })
console.log('cuadrícula:', JSON.stringify(g), '| una corchea mide', g.cw * 2, 'px')
const at = (step, row) => [g.x + (step + 1) * g.cw, g.y + (row + 0.5) * g.rh]
const mel = () => p.evaluate(() => JSON.stringify(window.__engine.loops.value.loops.filter((l) => l.instrument === 'mel').map((l) => ({ bars: l.bars, hits: l.hits.map((h) => [h.pos, h.dur, h.midi]) }))))
await p.mouse.click(...at(0, 6)); await sleep(150)
await p.mouse.click(...at(4, 4)); await sleep(150)
await p.mouse.click(...at(9, 5)); await sleep(150)
console.log('3 toques (se imantan a corcheas):', await mel())
await p.screenshot({ path: `${O}/organo1.png` })
await p.evaluate(() => document.querySelector('[data-organ-respond]').click()); await sleep(300)
console.log('↻ responder:', await mel())
// grabar
await p.evaluate(() => window.__engine.stop()); await sleep(300)
await p.evaluate(() => document.querySelector('[data-organ-rec]').click())
for (let i = 0; i < 40 && !(await p.evaluate(() => /grabando/.test(document.querySelector('[data-organ-rec]').textContent))); i++) await sleep(250)
console.log('en la toma:', await p.evaluate(() => document.querySelector('[data-organ-rec]').textContent.trim()))
for (const r of [7, 4, 5]) { await p.mouse.click(...at(10, r)); await sleep(1300) }
console.log('tras 3 toques:', await mel())
for (let i = 0; i < 60 && !(await p.evaluate(() => /● grabar/.test(document.querySelector('[data-organ-rec]').textContent))); i++) await sleep(250)
// Piano mágico: el ritmo es mío, las notas las pone la melodía del estilo
await p.evaluate(() => document.querySelector('[data-organ-piano]').click())
for (let i = 0; i < 40 && !(await p.evaluate(() => /tocando/.test(document.querySelector('[data-organ-piano]').textContent))); i++) await sleep(250)
for (const r of [3, 3, 3, 3]) { await p.mouse.click(...at(6, r)); await sleep(700) }
console.log('piano mágico (4 toques, las notas las pone la melodía):', await mel())
console.log('acaba sola:', await p.evaluate(() => document.querySelector('[data-organ-rec]').textContent.trim()), await mel(), errs)
await b.close()

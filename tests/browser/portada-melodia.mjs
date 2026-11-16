// Melodía por toques en la portada («Magic Piano»), el ■ que para todo y «Borrar» (spec 016 §16).
import { open, sleep, clickLabel } from './lib.mjs'
const OUT = process.env.OUT || '/tmp'
const { b, p, errs } = await open({ simple: true })
const names = (await p.evaluate(() => 1)) && []
for (const [style, label] of [['hiphop90', 'Hip hop'], ['techno', 'techno']]) {
  await clickLabel(p, label); await sleep(1500)
  await p.evaluate(() => window.__engine.clearAll())
  const box = async (l) => p.evaluate((l) => { const r = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === l).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, l)
  const m = await box('bum'); await p.touchscreen.tap(m.x, m.y); await sleep(1800)
  await p.waitForSelector('[aria-label^="toca el círculo"]', { timeout: 10000 })
  const chip = () => p.evaluate(() => document.querySelector('[aria-label="otra melodía"]')?.textContent.trim().replace(/\s+/g, ' '))
  console.log(style, '· melodía ofrecida:', await chip())
}
// volver a hip hop: toques con ritmo propio
await clickLabel(p, 'Hip hop'); await sleep(1500)
const m = await p.evaluate(() => { const r = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'bum').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })
await p.touchscreen.tap(m.x, m.y); await sleep(1800)
await p.waitForSelector('[aria-label^="toca el círculo"]', { timeout: 10000 })
const times = [0, 400, 800, 1000, 1500, 1900, 2300, 2600]
let last = 0
for (const t of times) { await sleep(t - last); last = t; await p.touchscreen.tap(200, 260) }
console.log('contador tras 8 toques:', await p.evaluate(() => document.querySelector('[aria-label="otra melodía"]')?.textContent.trim().replace(/\s+/g, ' ')))
await sleep(2500)
const mel = await p.evaluate(() => window.__engine.loops.value.loops.filter((l) => l.instrument === 'mel').map((l) => ({ n: l.hits.length, pos: l.hits.map((h) => h.pos).join(','), phase: l.phaseBar })))
console.log('melodía pasada al loop:', JSON.stringify(mel))
await p.screenshot({ path: `${OUT}/portada-melodia.png` })
// ■ para todo
await clickLabel(p, 'parar todo'); await sleep(300)
console.log('tras ■: suena =', await p.evaluate(() => window.__engine.playing.value))
// borrar
await clickLabel(p, 'tocar'); await sleep(800)
await clickLabel(p, 'borrar todo'); await sleep(500)
await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Borrar' && !x.getAttribute('aria-label'))?.click()); await sleep(800)
console.log('tras borrar: loops =', await p.evaluate(() => window.__engine.loops.value.loops.length), '| contador', await p.evaluate(() => document.querySelector('[aria-label="otra melodía"]')?.textContent.trim().replace(/\s+/g, ' ')))
console.log('errores', errs)
await b.close()

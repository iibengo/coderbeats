import { open, labels, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
const E = (f) => p.evaluate(f)
await clickExact(p, 'techno'); await sleep(400)
await p.evaluate(() => window.__engine.loadDemo()); await sleep(800)
await clickExact(p, 'tocar'); await sleep(3000)
await clickExact(p, 'Componer'); await sleep(1500)
const t = p.touchscreen
await t.touchStart(265, 343); await sleep(100)
for (let i = 1; i <= 12; i++) { await t.touchMove(265 - i * 5, 343 + i * 20); await sleep(30) }
await t.touchEnd(); await sleep(700)
console.log(await E(() => ({ cells: window.__engine.song.value.cells.length, proposal: window.__engine.proposal.value && { kind: window.__engine.proposal.value.kind, kinds: window.__engine.proposal.value.kinds } })))
console.log((await labels(p)).filter(x=>/variación|otra|aceptar/.test(x)))
await p.screenshot({ path: 'u3.png' })
console.log('errs', errs)
await b.close()

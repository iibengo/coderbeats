import { open, labels, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'dembow'); await sleep(500)
await clickLabel(p, 'ajustes'); await sleep(600)
await clickLabel(p, 'Ver cómo se construye')
const t0 = Date.now()
while (Date.now() - t0 < 70000) { await sleep(2000); if (!(await p.evaluate(() => !!document.querySelector('.pilot')))) break }
console.log('tiempo', Math.round((Date.now()-t0)/1000))
const r = await p.evaluate(() => { const e = window.__engine; return { loops: e.loops.value.loops.map(l => ({ i: l.instrument, hits: l.hits.map(h => Math.round(h.pos)).sort((a,b)=>a-b) })), bg: e.bgManual.value, kit: e.kit.value, style: e.style.value } })
console.log(JSON.stringify(r))
console.log((await labels(p)).filter(x=>/bajo|acordes/.test(x)))
console.log('errors', errs)
await b.close()

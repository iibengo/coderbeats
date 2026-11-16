// Ritmo en la portada: las pastillas entran en el loop como un golpe de voz, y se ven al instante.
import { open, sleep, clickLabel } from './lib.mjs'
const OUT = process.env.OUT || '/tmp'
const { b, p, errs } = await open({ simple: true })
await clickLabel(p, 'Dembow'); await sleep(2500)
await p.evaluate(() => window.__engine.clearAll?.())
await sleep(500)
const kinds = () => p.evaluate(() => window.__engine.loops.value.loops.map((l) => `${l.instrument}:${l.hits.length}`).join(' '))
console.log('antes:', await kinds())
const pad = async (label, n, gap) => { const box = await p.evaluate((l) => { const r = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === l).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, label); for (let i = 0; i < n; i++) { await p.touchscreen.tap(box.x, box.y); await sleep(gap) } }
// un compás de bum-pff-bum-pff con ts por medio
for (let r = 0; r < 4; r++) { await pad('bum', 1, 300); await pad('ts', 1, 300); await pad('pff', 1, 300); await pad('ts', 1, 300) }
await p.screenshot({ path: `${OUT}/portada-3.png` })
await sleep(6000)
console.log('después:', await kinds())
console.log('errores', errs)
await b.close()

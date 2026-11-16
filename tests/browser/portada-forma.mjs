// «La forma de tu ritmo» y los rótulos de capa de Previsualizar (spec 016 §15).
import { open, sleep, clickLabel } from './lib.mjs'
const OUT = process.env.OUT || '/tmp'
const { b, p, errs } = await open({ simple: true })
await clickLabel(p, 'Dembow'); await sleep(2500)
const box = async (l) => p.evaluate((l) => { const r = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === l).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }, l)
const seq = ['bum', 'ts', 'pff', 'ts', 'bum', 'ts', 'pff', 'ts', 'bum', 'bum', 'pff', 'ts']
for (let r = 0; r < 2; r++) for (const l of seq) { const m = await box(l); await p.touchscreen.tap(m.x, m.y); await sleep(160) }
await sleep(7000)
await p.screenshot({ path: `${OUT}/portada-forma.png` })
console.log('errores', errs)
await b.close()

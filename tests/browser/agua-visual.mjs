// Teclado de agua: se ve el rótulo, las franjas, la onda al tocar y, al grabar, las notas en el aro. Deja capturas en /tmp.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'techno'); await sleep(300)
await clickLabel(p, 'ajustes'); await sleep(400); await clickLabel(p, 'Cargar demo'); await sleep(600)
await clickExact(p, 'tocar'); await sleep(3500)
await p.evaluate(() => window.__engine.pilot.begin())
await clickLabel(p, 'teclado de agua'); await sleep(400)
await p.screenshot({ path: process.env.OUT + '/a1.png' })
console.log('rótulo', await p.evaluate(() => document.querySelector('.wk .tag')?.textContent), 'franjas', await p.evaluate(() => document.querySelectorAll('.wk .bands i').length))
await clickLabel(p, 'grabar lo que toques'); await sleep(300)
for (const [x, y] of [[12, 500], [380, 300], [14, 600], [386, 200]]) { await p.touchscreen.tap(x, y); await sleep(300) }
await p.screenshot({ path: process.env.OUT + '/a2.png' })
console.log('rec', await p.evaluate(() => document.querySelector('.wk .tag')?.textContent), 'ondas', await p.evaluate(() => document.querySelectorAll('.wk .wave').length))
console.log('hits vivos', await p.evaluate(() => window.__engine.keysHits.value.length), errs)
await b.close(); process.exit(0)

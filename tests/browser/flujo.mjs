// Fluido del agua: estela del dedo en Jugar y venas en Componer; el interruptor las apaga. Capturas en OUT.
import { open, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickExact(p, 'techno'); await sleep(300)
await clickLabel(p, 'ajustes'); await sleep(400); await clickLabel(p, 'Cargar demo'); await sleep(600)
await clickExact(p, 'tocar'); await sleep(3000)
await p.evaluate(() => window.__engine.pilot.begin())
const px = () => p.evaluate(() => { const c = [...document.querySelectorAll('canvas')].pop(); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; return n })
const t = await p.touchscreen.touchStart(60, 420)
for (let i = 1; i <= 12; i++) { await p.touchscreen.touchMove(60 + i * 25, 420 + Math.sin(i / 2) * 40); await sleep(30) }
const drag = await px()
await p.screenshot({ path: process.env.OUT + '/f1.png' })
await p.touchscreen.touchEnd(); await sleep(900)
const after = await px()
console.log('estela: píxeles en el gesto', drag, 'tras soltar', after)
await p.evaluate(() => window.__engine.stop?.())
await clickLabel(p, 'remixes'); await sleep(600)
await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Abrir')[0].click()); await sleep(600); await clickExact(p, 'Continuar'); await sleep(2500)
await clickExact(p, 'Componer'); await sleep(2500)
const veins = []
for (let i = 0; i < 4; i++) { veins.push(await px()); await sleep(200) }
await p.screenshot({ path: process.env.OUT + '/f2.png' })
console.log('venas (píxeles)', veins, 'células', await p.evaluate(() => window.__engine.song.value.cells.length))
await p.evaluate(() => window.__engine.setFlow(false)); await sleep(500)
console.log('con el interruptor apagado', await px(), errs)
await b.close(); process.exit(drag > 0 && after === 0 ? 0 : 1)

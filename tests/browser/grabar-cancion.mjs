import { open, labels, sleep, clickLabel, clickExact } from './lib.mjs'
const { b, p, errs } = await open()
await clickLabel(p, 'ajustes'); await sleep(600)
await p.evaluate(() => window.__engine.loadDemo()); await sleep(1000)
await clickExact(p, 'tocar'); await sleep(4000)
await clickLabel(p, 'Escenario'); await sleep(500)
await p.screenshot({ path: 'h1.png' })
await clickLabel(p, 'salir del Escenario'); await sleep(300)
// grabar canción: quitar y poner capas
await clickLabel(p, 'grabar canción'); await sleep(400)
console.log('rec', (await labels(p)).filter(x=>/terminar/.test(x)))
const mute = async (n) => { const r = await p.evaluate((n) => { const q=document.querySelectorAll('.loop-ball')[n].getBoundingClientRect(); return [q.x+q.width/2,q.y+q.height/2] }, n); await p.touchscreen.tap(r[0], r[1]) }
const bar = 60/90*4*1000
await sleep(bar); await mute(0); await sleep(2*bar); await mute(0); await sleep(bar)
await p.screenshot({ path: 'h2.png' })
await clickLabel(p, 'terminar la grabación'); await sleep(2500)
console.log('aviso', await p.$eval('.notice', e => e.textContent).catch(()=>null))
await p.screenshot({ path: 'h3.png' })
console.log('errors', errs)
await b.close()

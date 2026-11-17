// Zoom infinito (prototipo, spec 026): apagado por defecto; encendido, la gota pequeña de la siguiente parte se puede tocar y la cámara se zambulle hasta la línea de compás.
import { labOpen, click, sleep } from './lab-lib.mjs'
const O = process.env.OUT || '/tmp'
const { b, p, errs } = await labOpen(390, 900)
await click(p, 'Remixes'); await sleep(5000); await click(p, 'Mozart'); await sleep(2500)
const z = () => p.evaluate(() => window.__remix.zoom())
console.log('por defecto:', JSON.stringify(await z()))
await click(p, 'Zoom: no'); await sleep(400)
console.log('encendido:', JSON.stringify(await z()), '| texto:', await p.evaluate(() => document.querySelector('[data-zoom-toggle]').textContent))
await p.screenshot({ path: `${O}/zoom1.png` })
const r = await p.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.x, c.y, c.width] })
const k = r[2] / 680
await p.mouse.click(r[0] + 340 * k + 5, r[1] + 340 * k + 40 * k); await sleep(250)
console.log('tras tocar la gota pequeña (en el aire):', JSON.stringify(await z()), '| parte elegida:', await p.evaluate(() => window.__remix.part()))
await p.screenshot({ path: `${O}/zoom2.png` })
await sleep(2500)
console.log('al aterrizar:', JSON.stringify(await z()), '| parte:', await p.evaluate(() => window.__remix.part()))
await p.screenshot({ path: `${O}/zoom3.png` })
// por un botón de parte lejana: atraviesa las intermedias
await p.evaluate(() => document.querySelector('[data-part="Drop 2"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await sleep(300)
console.log('a «Drop 2»:', JSON.stringify(await z())); await sleep(3500)
console.log('aterrizado:', JSON.stringify(await z()), await p.evaluate(() => window.__remix.part()), errs)
await click(p, 'Zoom: sí'); await sleep(300)
console.log('apagado otra vez:', JSON.stringify(await z()))
await b.close()

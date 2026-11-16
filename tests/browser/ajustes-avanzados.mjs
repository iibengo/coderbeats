// Ajustes: el bloque avanzado se abre y se cierra, y cada opción lleva su «i» con la explicación.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
await clickLabel(p, 'ajustes'); await sleep(600)
const rows = () => p.evaluate(() => document.querySelectorAll('[data-info]').length)
console.log('cerrado: «i» visibles', await rows(), '| cerrar visible', await p.evaluate(() => !!document.querySelector('[data-advanced-close]')))
await p.evaluate(() => document.querySelector('[data-advanced-toggle]').click()); await sleep(400)
console.log('abierto: «i» visibles', await rows(), '| cerrar visible', await p.evaluate(() => !!document.querySelector('[data-advanced-close]')))
await p.evaluate(() => [...document.querySelectorAll('[data-info]')][6].click()); await sleep(200)
console.log('tooltip:', await p.evaluate(() => document.querySelector('[data-info-text]')?.textContent))
// pinchar fuera del tooltip (dentro de la hoja, que frena los eventos) lo cierra
const box = await p.evaluate(() => { const r = document.querySelector('section nav').getBoundingClientRect(); return [r.x + r.width - 10, r.y + 10] })
await p.mouse.click(...box); await sleep(300)
console.log('tooltip tras pinchar fuera:', await p.evaluate(() => !!document.querySelector('[data-info-text]')))
await p.evaluate(() => [...document.querySelectorAll('[data-info]')][6].click()); await sleep(200)
await p.evaluate(() => document.querySelector('[data-advanced-close]').click()); await sleep(400)
console.log('tras «Cerrar opciones avanzadas»: «i» visibles', await rows(), '| avanzado activo', await p.evaluate(() => JSON.parse(localStorage.getItem('coderbeats:studio:v2') || '{}').advanced), errs)
await b.close()

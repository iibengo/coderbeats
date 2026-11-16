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
await p.evaluate(() => document.querySelector('[data-advanced-close]').click()); await sleep(400)
console.log('tras «Cerrar opciones avanzadas»: «i» visibles', await rows(), '| avanzado activo', await p.evaluate(() => JSON.parse(localStorage.getItem('coderbeats:studio:v2') || '{}').advanced), errs)
await b.close()

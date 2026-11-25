// Botón «Lab» a la vista y «demo» de cada estilo en la lista de estilos.
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
console.log('botón Lab en la pantalla principal:', await p.evaluate(() => !!document.querySelector('[data-to-lab-main] svg')))
await p.evaluate(() => document.querySelector('[data-style-label]').click()); await sleep(300)
console.log('demos por estilo:', await p.evaluate(() => [...document.querySelectorAll('[data-load-demo]')].map((x) => x.dataset.style)))
await p.evaluate(() => document.querySelector('[data-load-demo][data-style=techno2]').click()); await sleep(1500)
await p.evaluate(() => [...document.querySelectorAll('[role=alertdialog] button')].find((x) => x.textContent.includes('Reemplazar'))?.click()); await sleep(1500)
console.log('tras demo de techno:', await p.evaluate(() => ({ estilo: window.__engine.style.value, loops: window.__engine.loops.value.loops.length, bd: window.__engine.loops.value.loops.find((l) => l.instrument === 'bd')?.hits.length })))
await p.evaluate(() => document.querySelector('[data-to-lab-main]').click()); await sleep(6000)
console.log('Lab con el remix actual:', await p.evaluate(() => ({ url: location.pathname, partes: [...document.querySelectorAll('[data-part]')].map((x) => x.dataset.part) })), errs)
await b.close()

// Botón «Lab» a la vista; «Empezar con una demo» con el Estudio vacío; y elegir un estilo con el Estudio vacío carga su demo (spec 059).
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
console.log('botón Lab en la pantalla principal:', await p.evaluate(() => !!document.querySelector('[data-to-lab-main] svg')))
console.log('demo a la vista con el Estudio vacío:', await p.evaluate(() => !!document.querySelector('[data-demo-start]')))
await p.evaluate(() => document.querySelector('[data-style-label]').click()); await sleep(300)
await p.evaluate(() => [...document.querySelectorAll('[data-style-menu] [role=option]')].find((x) => /techno/i.test(x.textContent))?.click()); await sleep(1500)
console.log('demo a la vista con algo hecho (debe ser false):', await p.evaluate(() => !!document.querySelector('[data-demo-start]')))
console.log('tras demo de techno:', await p.evaluate(() => ({ estilo: window.__engine.style.value, loops: window.__engine.loops.value.loops.length, bd: window.__engine.loops.value.loops.find((l) => l.instrument === 'bd')?.hits.length })))
await p.evaluate(() => document.querySelector('[data-to-lab-main]').click()); await sleep(6000)
console.log('Lab con el remix actual:', await p.evaluate(() => ({ url: location.pathname, partes: [...document.querySelectorAll('[data-part]')].map((x) => x.dataset.part) })), errs)
await b.close()

// Estilos (spec 023): la etiqueta de estilo abre la lista de 5; cambiar de estilo no pregunta (el ritmo y la melodía se quedan).
import { open, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const label = () => p.evaluate(() => document.querySelector('[data-style-label]').textContent.trim())
console.log('etiqueta:', await label())
await p.evaluate(() => window.__engine.loadDemo()); await sleep(500)
await p.evaluate(() => document.querySelector('[data-style-label]').click()); await sleep(300)
console.log('lista:', await p.evaluate(() => [...document.querySelectorAll('[data-style-menu] button')].map((x) => x.textContent.trim().replace(/\s+/g, ' '))))
await p.evaluate(() => [...document.querySelectorAll('[data-style-menu] button')].find((x) => x.textContent.includes('techno')).click()); await sleep(500)
console.log('ya no pregunta (debe ser false):', await p.evaluate(() => !!document.querySelector('[role=alertdialog]')))
console.log('ahora:', await label(), '| estilo', await p.evaluate(() => window.__engine.style.value), '| bpm', await p.evaluate(() => window.__engine.bpm.value), errs)
await b.close()

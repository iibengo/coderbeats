// Estudio · «Editar parte»: las capas de la parte, encender/apagar y abrir la batería y el Órgano desde ahí.
import { open, clickLabel, sleep } from './lib.mjs'
const { b, p, errs } = await open()
const sl = () => p.evaluate(() => JSON.stringify(window.__parte.slots()))
console.log('abre:', await clickLabel(p, 'editar parte')); await sleep(600)
console.log('parte:', await p.evaluate(() => window.__parte.name()), '| capas [clave, tiene, suena]:', await sl())
await p.evaluate(() => document.querySelector('[data-slot=bajo] button').click()); await sleep(200)
console.log('toco el bajo:', await sl())
await p.evaluate(() => document.querySelector('[data-edit=bateria]').click()); await sleep(800)
console.log('editar batería abre el cuadro:', await p.evaluate(() => !!document.querySelector('[role=dialog][aria-label="batería de la parte"]')))
await p.evaluate(() => document.querySelector('[aria-label="cerrar la batería"]').click()); await sleep(500)
// crear la melodía desde el panel: la melodía está vacía → «editar» abre el Órgano
await p.evaluate(() => document.querySelector('[data-edit=melodia]').click()); await sleep(1500)
console.log('editar melodía abre el Órgano:', await p.evaluate(() => !!document.querySelector('[aria-label="órgano de la melodía"]')))
await p.screenshot({ path: `${process.env.OUT || '/tmp'}/parte1.png` })
console.log(errs)
await b.close()
